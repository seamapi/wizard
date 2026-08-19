import { Box, Text, useApp, useStdout } from 'ink'
import SelectInput from 'ink-select-input'
import Spinner from 'ink-spinner'
import TextInput from 'ink-text-input'
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'

import { getAuth } from './adapter.js'
import { CheckboxList } from './components/checkbox-list.js'
import {
  analyzeProject,
  type ProjectAnalysis,
} from './steps/analyze-project.js'
import {
  type CliKeyResult,
  type ExistingKeyResult,
  findVerifiedCliKey,
  findVerifiedExistingKey,
  saveVerifiedKey,
  verifyAndSaveKey,
} from './steps/authenticate.js'
import {
  buildIntegrationSteps,
  type BuildMode,
  COMMON_BLOCKS,
  composeGoal,
  CORE_BLOCKS,
  type IntegrationStep,
} from './steps/build-plan.js'
import { connectViaWeb } from './steps/connect-web.js'
import {
  compareConnection,
  type ConnectionChange,
  describeChange,
  saveConnection,
} from './steps/connection.js'
import {
  detectProject,
  installSeamSdkCommand,
  type ProjectInfo,
  type Sdk,
} from './steps/detect-project.js'
import {
  CLAUDE_CODE_COMMANDS,
  detectPluginTarget,
  SEAM_PLUGIN_NPX_COMMAND,
} from './steps/install-seam-plugin.js'
import { type IntegrateEvent, runIntegration } from './steps/integrate.js'
import {
  type ProjectPlan,
  readPreferredSdk,
  readProjectRecord,
  recordPlan,
  recordResult,
  writePreferredSdk,
} from './store/index.js'
import {
  ensureProjectEnvConventions,
  findExistingApiKey,
} from './util/env-file.js'
import { runInstall } from './util/run-install.js'
import {
  ApiKeyError,
  exchangeWizardInferenceToken,
  getInferenceBaseUrl,
  looksLikeSeamApiKey,
  type SeamWorkspace,
  type WizardInferenceSession,
} from './util/seam-api.js'

const MAX_ATTEMPTS = 3

type Tone = 'ok' | 'info' | 'warn' | 'plain'
interface Msg {
  tone: Tone
  text: string
}

// The integration runs one step per selected building block; the Tasks panel
// shows each step's live state.
type StepStatus = 'pending' | 'active' | 'done' | 'failed'
interface StepState {
  id: string
  label: string
  status: StepStatus
}

const STEP_ICON: Record<StepStatus, string> = {
  pending: '☐',
  active: '▶',
  done: '✓',
  failed: '✗',
}
const STEP_COLOR: Record<StepStatus, string> = {
  pending: 'gray',
  active: 'cyan',
  done: 'green',
  failed: 'red',
}

// Educational cards shown in the Learn column beside the Tasks panel while the
// agent works. Rotates every 8s off the elapsed clock, so no extra timer.
const LEARN_CARDS: Array<{ title: string; lines: string[] }> = [
  {
    title: 'How Seam works',
    lines: [
      'An Access Grant gives a',
      'person access to a space',
      'or device for a window of',
      'time.',
      '',
      'Seam issues the method:',
      'PIN · mobile key · card',
    ],
  },
  {
    title: 'The building blocks',
    lines: [
      'Connected account',
      '  → its Devices',
      'Space groups devices',
      'User identity = a person',
      'Access grant links them',
    ],
  },
  {
    title: 'While this runs',
    lines: [
      'Docs  docs.seam.co',
      'MCP   seam-docs, in your',
      '      AI editor',
      'API   connect.getseam.com',
    ],
  },
]
const LEARN_CARD_SECONDS = 8

type Phase =
  | { t: 'init' }
  | { t: 'method' }
  | { t: 'browser' }
  | { t: 'paste' }
  | { t: 'verify-paste'; api_key: string }
  | { t: 'drift'; changes: ConnectionChange[] }
  | { t: 'sdk' }
  | { t: 'install-sdk' }
  | { t: 'install-plugin' }
  | { t: 'offer-integrate' }
  | { t: 'analyze' }
  | { t: 'integrate-mode' }
  | { t: 'checklist' }
  | { t: 'note' }
  | { t: 'integrate'; steps: IntegrationStep[] }
  | { t: 'done' }
  | { t: 'error'; message: string }

export function App({
  root,
  onExit,
}: {
  root: string
  onExit?: (lines: string[]) => void
}): ReactElement {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const projectRef = useRef<ProjectInfo>(detectProject(root))
  const attemptRef = useRef(0)

  const [dimensions, setDimensions] = useState({
    rows: stdout?.rows ?? 24,
    columns: stdout?.columns ?? 80,
  })

  const [messages, setMessages] = useState<Msg[]>([])
  const [phase, setPhase] = useState<Phase>({ t: 'init' })
  const [sdk, setSdk] = useState<Sdk | null>(null)
  const [workspace, setWorkspace] = useState<SeamWorkspace | null>(null)

  const [browser, setBrowser] = useState<{
    url: string | null
    received: boolean
  }>({
    url: null,
    received: false,
  })
  const [cliKey, setCliKey] = useState<CliKeyResult | null>(null)
  const [projectKey, setProjectKey] = useState<ExistingKeyResult | null>(null)
  const [preferredSdk, setPreferredSdk] = useState<Sdk | null>(null)
  const [pasteValue, setPasteValue] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [installLines, setInstallLines] = useState<string[]>([])
  const [noteValue, setNoteValue] = useState('')
  const [agentLines, setAgentLines] = useState<string[]>([])
  const [integrateElapsedSec, setIntegrateElapsedSec] = useState(0)
  const [integrateIdleSec, setIntegrateIdleSec] = useState(0)
  const [currentStep, setCurrentStep] = useState<{
    label: string
    index: number
    total: number
  } | null>(null)
  const [stepStates, setStepStates] = useState<StepState[]>([])
  const [session, setSession] = useState<WizardInferenceSession | null>(null)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [mode, setMode] = useState<BuildMode | null>(null)
  const [selections, setSelections] = useState<string[]>([])

  const planRef = useRef<ProjectPlan | null>(null)

  // Kept in sync with `messages` so the exit handler can hand the full
  // transcript to index.tsx to reprint after leaving the alt screen.
  const messagesRef = useRef<Msg[]>([])
  const addMessage = (message: Msg): void =>
    setMessages((previous) => {
      const next = [...previous, message]
      messagesRef.current = next
      return next
    })

  const finishWithNextSteps = (): void => {
    pushNextSteps(addMessage, sdk, workspace?.name ?? 'your workspace')
    setPhase({ t: 'done' })
  }

  const startIntegration = (noteInput: string): void => {
    const note = noteInput.trim().length > 0 ? noteInput.trim() : null
    const effectiveMode: BuildMode = mode ?? 'full_api'
    const effectiveSelections =
      effectiveMode === 'customer_portal' ? [] : selections
    const goal = composeGoal({
      mode: effectiveMode,
      selections: effectiveSelections,
      note,
      framework: analysis?.signals.framework ?? null,
    })
    const plan: ProjectPlan = {
      mode: effectiveMode,
      selections: effectiveSelections,
      note,
      goal,
      analysis: {
        sdk: analysis?.signals.sdk ?? null,
        framework: analysis?.signals.framework ?? null,
        app_type_guess: analysis?.recommendation.app_type_guess ?? null,
        seam_already_setup: analysis?.signals.seam_already_setup ?? false,
        used_onboarding: analysis?.used_onboarding ?? false,
        recommendation_source: analysis?.recommendation.source ?? 'heuristic',
      },
    }
    planRef.current = plan
    recordPlan(root, plan).catch(() => {})
    addMessage({ tone: 'info', text: 'Saved your plan' })
    const steps = buildIntegrationSteps({
      mode: effectiveMode,
      selections: effectiveSelections,
      note,
      framework: analysis?.signals.framework ?? null,
    })
    setPhase({ t: 'integrate', steps })
  }

  const handleIntegrateEvent = (event: IntegrateEvent): void => {
    if (event.kind === 'step_start') {
      setCurrentStep({
        label: event.label,
        index: event.index,
        total: event.total,
      })
      setStepStates((previous) =>
        previous.map((step, index) =>
          index === event.index ? { ...step, status: 'active' } : step,
        ),
      )
      setAgentLines([])
      setIntegrateIdleSec(0)
    } else if (event.kind === 'step_done') {
      setStepStates((previous) =>
        previous.map((step, index) =>
          index === event.index ? { ...step, status: 'done' } : step,
        ),
      )
    } else if (event.kind === 'step_failed') {
      setStepStates((previous) =>
        previous.map((step, index) =>
          index === event.index ? { ...step, status: 'failed' } : step,
        ),
      )
      addMessage({
        tone: 'warn',
        text: `Step ${event.index + 1}/${event.total} stopped — ${event.reason}`,
      })
    } else if (event.kind === 'text') {
      setIntegrateIdleSec(0)
      setAgentLines((previous) => [
        ...previous.slice(-5),
        truncate(event.text, 100),
      ])
    } else if (event.kind === 'tool') {
      setIntegrateIdleSec(0)
      setAgentLines((previous) => [
        ...previous.slice(-5),
        formatTool(event.name, event.detail),
      ])
    } else {
      setCurrentStep(null)
      setAgentLines([])
      recordResult(root, {
        ok: event.ok,
        files_summary: event.summary.trim().slice(0, 4000),
        cost_usd: event.cost_usd,
        steps: event.steps,
      }).catch(() => {})
      const doneCount = event.steps.filter(
        (step) => step.status === 'done',
      ).length
      const stepSuffix =
        event.steps.length > 1
          ? ` — ${doneCount}/${event.steps.length} steps completed`
          : ''
      addMessage(
        event.ok
          ? {
              tone: 'ok',
              text: `Integration written${stepSuffix} — review it with \`git diff\``,
            }
          : {
              tone: 'warn',
              text: `Agent stopped early${stepSuffix} — review what it changed with \`git diff\``,
            },
      )
      for (const line of event.summary.trim().split('\n').slice(0, 15)) {
        if (line.trim().length > 0) {
          addMessage({ tone: 'plain', text: `  ${line}` })
        }
      }
      if (event.cost_usd != null) {
        addMessage({
          tone: 'info',
          text: `Model cost: $${event.cost_usd.toFixed(2)}`,
        })
      }
    }
  }

  const useCliKey = (found: CliKeyResult): void => {
    try {
      saveVerifiedKey(root, found.api_key)
      addMessage({
        tone: 'ok',
        text: `Using your Seam CLI login · workspace ${found.workspace.name} · saved to .env`,
      })
    } catch {
      addMessage({
        tone: 'warn',
        text: "Couldn't write .env — set SEAM_API_KEY there yourself.",
      })
    }
    settleOn(found.workspace, found.api_key, 'cli', null)
  }

  const useProjectKey = (found: ExistingKeyResult): void => {
    try {
      if (found.source === 'environment') {
        saveVerifiedKey(root, found.api_key)
      } else {
        ensureProjectEnvConventions(root)
      }
    } catch {
      // The project keeps working with the key it already has.
    }
    addMessage({
      tone: 'ok',
      text: `Using the key from ${found.source} · workspace ${found.workspace.name}`,
    })
    settleOn(found.workspace, found.api_key, 'project', found.source)
  }

  const settleOn = (
    settledWorkspace: SeamWorkspace,
    apiKey: string,
    source: 'project' | 'cli' | 'browser' | 'pasted',
    location: string | null,
  ): void => {
    setWorkspace(settledWorkspace)
    saveConnection(root, {
      workspace: settledWorkspace,
      api_key: apiKey,
      source,
      location,
    }).catch(() => {})
    advanceAfterAuth()
  }

  // Once a workspace is known, choose SDK (or skip if detected) then install.
  const advanceAfterAuth = (): void => {
    const detected = projectRef.current.detected_sdk
    if (detected != null) {
      setSdk(detected)
      addMessage({ tone: 'info', text: `Detected ${detected} project` })
      setPhase({ t: 'install-sdk' })
    } else {
      setPhase({ t: 'sdk' })
    }
  }

  useEffect(() => {
    if (phase.t !== 'init') return
    let cancelled = false
    const run = async (): Promise<void> => {
      const previous = await readProjectRecord(root)
      const existing = await findVerifiedExistingKey(root)
      if (cancelled) return
      setProjectKey(existing)

      const auth = getAuth()
      const cliResult =
        existing?.api_key === auth.apiKey ? null : await findVerifiedCliKey()
      if (cancelled) return
      setCliKey(cliResult)

      const recorded = previous?.connection ?? null

      if (recorded != null && existing != null) {
        const changes = compareConnection(recorded, {
          endpoint: auth.endpoint,
          workspace: existing.workspace,
          api_key: existing.api_key,
        })
        if (changes.length === 0) {
          addMessage({
            tone: 'ok',
            text: `Set up here before · workspace ${existing.workspace.name} · key from ${existing.source}`,
          })
          settleOn(
            existing.workspace,
            existing.api_key,
            'project',
            existing.source,
          )
          return
        }
        setPhase({ t: 'drift', changes })
        return
      }

      if (recorded != null) {
        addMessage({
          tone: 'warn',
          text: `Set up here on ${formatDate(previous?.created_at ?? '')}, but this project has no SEAM_API_KEY the wizard can verify now.`,
        })
      }

      setPhase({ t: 'method' })
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // browser handoff
  useEffect(() => {
    if (phase.t !== 'browser') return
    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        const result = await connectViaWeb(root, {
          onUrl: (url) => !cancelled && setBrowser((b) => ({ ...b, url })),
          onReceived: () =>
            !cancelled && setBrowser((b) => ({ ...b, received: true })),
        })
        if (cancelled) return
        setWorkspace(result.workspace)
        addMessage({
          tone: 'ok',
          text: `Connected · workspace ${result.workspace.name}`,
        })
        advanceAfterAuth()
      } catch (error) {
        if (!cancelled) {
          setPhase({
            t: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Browser connection failed.',
          })
        }
      }
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // verify a pasted key
  useEffect(() => {
    if (phase.t !== 'verify-paste') return
    const { api_key: apiKey } = phase
    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        const result = await verifyAndSaveKey(root, apiKey)
        if (cancelled) return
        setWorkspace(result.workspace)
        addMessage({ tone: 'ok', text: `Workspace: ${result.workspace.name}` })
        advanceAfterAuth()
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof ApiKeyError
            ? error.message
            : "Couldn't verify the key."
        if (attemptRef.current >= MAX_ATTEMPTS) {
          setPhase({
            t: 'error',
            message: 'Too many attempts. Re-run with a valid key.',
          })
        } else {
          setPasteError(message)
          setPasteValue('')
          setPhase({ t: 'paste' })
        }
      }
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // install the Seam SDK (streamed), then install the plugin
  useEffect(() => {
    if (phase.t !== 'install-sdk' || sdk == null) return
    let cancelled = false
    const command = installSeamSdkCommand(sdk, projectRef.current)
    const run = async (): Promise<void> => {
      try {
        await runInstall(command, root, (line) => {
          if (!cancelled) {
            setInstallLines((previous) => [...previous.slice(-3), line])
          }
        })
        if (!cancelled) addMessage({ tone: 'ok', text: 'Seam SDK installed' })
      } catch {
        if (!cancelled) {
          addMessage({
            tone: 'warn',
            text: `Couldn't finish installing — run it yourself: ${command.join(' ')}`,
          })
        }
      }
      if (!cancelled) {
        setInstallLines([])
        setPhase({ t: 'install-plugin' })
      }
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t, sdk])

  // install the official Seam plugin skills, then finish. We always run the
  // universal installer (works everywhere); for Claude Code we additionally
  // point at the native /plugin path, which also wires up the seam-docs MCP.
  useEffect(() => {
    if (phase.t !== 'install-plugin') return
    const target = detectPluginTarget(root)

    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        await runInstall(SEAM_PLUGIN_NPX_COMMAND, root, (line) => {
          if (!cancelled) {
            setInstallLines((previous) => [...previous.slice(-3), line])
          }
        })
        if (!cancelled) {
          addMessage({ tone: 'ok', text: 'Installed the Seam plugin skills' })
        }
      } catch {
        if (!cancelled) {
          addMessage({
            tone: 'warn',
            text: `Couldn't install the plugin — run it yourself: ${SEAM_PLUGIN_NPX_COMMAND.join(' ')}`,
          })
        }
      }
      if (!cancelled) {
        if (target === 'claude-code') {
          addMessage({
            tone: 'info',
            text: 'Claude Code: for the native plugin + seam-docs MCP, you can also run:',
          })
          for (const command of CLAUDE_CODE_COMMANDS) {
            addMessage({ tone: 'plain', text: `  ${command}` })
          }
        }
        setPhase({ t: 'offer-integrate' })
      }
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // analyze: exchange the API key for a scoped wizard token (which also returns
  // the Console onboarding answers), scan the project, and get a mode/checklist
  // recommendation to pre-fill the next steps. The token is reused by the
  // integration agent below, so it is minted once.
  useEffect(() => {
    if (phase.t !== 'analyze') return
    let cancelled = false
    const run = async (): Promise<void> => {
      const found = findExistingApiKey(root)
      if (found == null) {
        addMessage({
          tone: 'warn',
          text: "Couldn't find your Seam API key to plan the integration.",
        })
        if (!cancelled) finishWithNextSteps()
        return
      }

      let currentSession: WizardInferenceSession
      try {
        currentSession = await exchangeWizardInferenceToken(found.api_key)
      } catch (error) {
        if (!cancelled) {
          addMessage({
            tone: 'warn',
            text: `Couldn't start the AI session: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          })
          finishWithNextSteps()
        }
        return
      }
      if (cancelled) return
      setSession(currentSession)

      const result = await analyzeProject({
        root,
        project: projectRef.current,
        onboarding: currentSession.onboarding,
        inference: {
          base_url: getInferenceBaseUrl(),
          token: currentSession.token,
        },
      })
      if (cancelled) return
      setAnalysis(result)
      setMode(result.recommendation.mode)
      setSelections(result.recommendation.selections)

      const detail = [
        result.signals.framework ?? result.signals.sdk,
        result.recommendation.app_type_guess,
      ]
        .filter((value): value is string => value != null && value.length > 0)
        .join(' · ')
      addMessage({
        tone: 'info',
        text: `Analyzed your project${detail.length > 0 ? `: ${detail}` : ''}`,
      })
      if (currentSession.onboarding != null) {
        addMessage({
          tone: 'plain',
          text: '  Used your Console onboarding answers',
        })
      }
      setPhase({ t: 'integrate-mode' })
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // run the embedded integration agent (Claude Agent SDK), routed through
  // Seam-hosted inference using the token minted during the analyze step — no
  // developer Anthropic key.
  useEffect(() => {
    if (phase.t !== 'integrate') return
    const { steps } = phase
    setStepStates(
      steps.map((step): StepState => ({
        id: step.id,
        label: step.label,
        status: 'pending',
      })),
    )
    const controller = new AbortController()
    const run = async (): Promise<void> => {
      if (session == null) {
        addMessage({
          tone: 'warn',
          text: 'Lost the AI session — re-run the wizard to try again.',
        })
        if (!controller.signal.aborted) finishWithNextSteps()
        return
      }
      addMessage({ tone: 'info', text: 'Starting the Seam integration agent…' })
      try {
        await runIntegration({
          root,
          sdk: sdk ?? 'javascript',
          workspace_name: workspace?.name ?? 'your workspace',
          steps,
          inference: {
            base_url: getInferenceBaseUrl(),
            token: session.token,
          },
          framework: analysis?.signals.framework ?? null,
          mode: mode ?? 'full_api',
          signal: controller.signal,
          onEvent: (event) => {
            if (!controller.signal.aborted) handleIntegrateEvent(event)
          },
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          const rawMessage =
            error instanceof Error ? error.message : 'unknown error'
          const isOverloaded = /overload|\b529\b|\b503\b/i.test(rawMessage)
          // The wizard presents the model as "Seam AI"; the underlying provider
          // may change, so keep its name out of user-facing copy.
          const message = rawMessage.replace(/Claude Code|Claude/g, 'Seam AI')
          addMessage({
            tone: 'warn',
            text: isOverloaded
              ? 'Seam AI is overloaded right now — wait a minute and re-run the wizard.'
              : `Couldn't run the integration agent: ${message}`,
          })
        }
      }
      if (!controller.signal.aborted) finishWithNextSteps()
    }
    run().catch((error: unknown) => {
      if (controller.signal.aborted) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => controller.abort()
  }, [phase.t])

  // Tick an elapsed/idle clock during the integrate phase. Opus can think for a
  // while between tool calls, so a live clock is what tells the developer the
  // agent is working rather than frozen; idle time drives the "still working" hint.
  useEffect(() => {
    if (phase.t !== 'integrate') {
      setIntegrateElapsedSec(0)
      setIntegrateIdleSec(0)
      setCurrentStep(null)
      setStepStates([])
      return
    }
    const interval = setInterval(() => {
      setIntegrateElapsedSec((seconds) => seconds + 1)
      setIntegrateIdleSec((seconds) => seconds + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [phase.t])

  useEffect(() => {
    let cancelled = false
    readPreferredSdk()
      .then((sdk) => {
        if (!cancelled) setPreferredSdk(sdk)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // keep the full-screen layout sized to the terminal
  useEffect(() => {
    if (stdout == null) return
    const onResize = (): void =>
      setDimensions({ rows: stdout.rows ?? 24, columns: stdout.columns ?? 80 })
    stdout.on('resize', onResize)
    return () => {
      stdout.off('resize', onResize)
    }
  }, [stdout])

  // exit when finished
  useEffect(() => {
    if (phase.t !== 'done' && phase.t !== 'error') return
    if (phase.t === 'error') {
      addMessage({ tone: 'warn', text: phase.message })
      process.exitCode = 1
    }
    // Hand the transcript back so index.tsx can reprint it once the alt screen
    // is torn down (its contents are otherwise discarded). Small delay lets the
    // final addMessage above flush into messagesRef.
    const id = setTimeout(() => {
      onExit?.(messagesRef.current.map(formatMessageLine))
      exit()
    }, 40)
    return () => clearTimeout(id)
  }, [phase.t])

  // Full-screen: a header, the transcript (bounded to what fits), then the
  // active step. The outer box is sized to the terminal so it fills the alt
  // screen; older transcript lines scroll off the top and are reprinted on exit.
  const transcriptCapacity = Math.max(1, dimensions.rows - 8)
  const visibleMessages = messages.slice(-transcriptCapacity)

  return (
    <Box
      flexDirection='column'
      height={dimensions.rows}
      width={dimensions.columns}
      paddingX={1}
    >
      <Header />
      <Box flexDirection='column' flexGrow={1}>
        {visibleMessages.map((message, index) => (
          <MessageLine key={index} message={message} />
        ))}
      </Box>
      {renderActive()}
    </Box>
  )

  function onConnectSelected(value: string): void {
    if (value === 'project' && projectKey != null) {
      useProjectKey(projectKey)
    } else if (value === 'cli' && cliKey != null) {
      useCliKey(cliKey)
    } else if (value === 'paste') {
      attemptRef.current = 0
      setPhase({ t: 'paste' })
    } else {
      setPhase({ t: 'browser' })
    }
  }

  function renderActive(): ReactElement | null {
    switch (phase.t) {
      case 'init':
        return <Pending label='Checking for an existing key…' />
      case 'method':
        return (
          <Prompt title='How do you want to connect your Seam account?'>
            <SelectInput
              items={connectItems(projectKey, cliKey)}
              onSelect={(item) => {
                onConnectSelected(item.value)
              }}
            />
          </Prompt>
        )
      case 'browser':
        return (
          <Box flexDirection='column'>
            <Pending
              label={
                browser.received
                  ? 'Verifying the key…'
                  : 'Waiting for you to finish in the browser…'
              }
            />
            {browser.url != null && <Text color='gray'> {browser.url}</Text>}
          </Box>
        )
      case 'paste':
        return (
          <Prompt title='Paste your Seam API key (from Console → Settings → API Keys)'>
            <Box>
              <Text color='cyan'>{'› '}</Text>
              <TextInput
                value={pasteValue}
                onChange={setPasteValue}
                mask='*'
                placeholder='seam_…'
                onSubmit={(value) => {
                  if (!looksLikeSeamApiKey(value)) {
                    setPasteError(
                      "That doesn't look like a Seam key (expected seam_…).",
                    )
                    return
                  }
                  setPasteError(null)
                  attemptRef.current += 1
                  setPhase({ t: 'verify-paste', api_key: value })
                }}
              />
            </Box>
            {pasteError != null && <Text color='red'> {pasteError}</Text>}
          </Prompt>
        )
      case 'verify-paste':
        return <Pending label='Verifying your key with Seam…' />
      case 'drift':
        return (
          <Prompt title='This project was set up with something else:'>
            {phase.changes.map((change) => (
              <Text key={change.what} color='yellow'>
                {`  ${describeChange(change)}`}
              </Text>
            ))}
            <SelectInput
              items={[
                {
                  label: projectKeyLabel(
                    projectKey,
                    'Update this project to use',
                  ),
                  value: 'project',
                },
                {
                  label: 'Change what this project connects with…',
                  value: 'again',
                },
                { label: 'Quit, and leave everything as it is', value: 'quit' },
              ]}
              onSelect={(item) => {
                if (item.value === 'project' && projectKey != null) {
                  useProjectKey(projectKey)
                } else if (item.value === 'again') {
                  setPhase({ t: 'method' })
                } else {
                  addMessage({
                    tone: 'plain',
                    text: 'Nothing changed. Run seam wizard again once your environment is how you want it.',
                  })
                  setPhase({ t: 'done' })
                }
              }}
            />
          </Prompt>
        )
      case 'sdk': {
        const javascriptItem = {
          label: 'JavaScript / TypeScript',
          value: 'javascript',
        }
        const pythonItem = { label: 'Python', value: 'python' }
        return (
          <Prompt title='Which SDK are you using?'>
            <SelectInput
              items={
                preferredSdk === 'python'
                  ? [pythonItem, javascriptItem]
                  : [javascriptItem, pythonItem]
              }
              onSelect={(item) => {
                const chosen: Sdk =
                  item.value === 'python' ? 'python' : 'javascript'
                setSdk(chosen)
                writePreferredSdk(chosen).catch(() => {})
                addMessage({ tone: 'info', text: `SDK: ${chosen}` })
                setPhase({ t: 'install-sdk' })
              }}
            />
          </Prompt>
        )
      }
      case 'install-sdk':
        return (
          <Box flexDirection='column'>
            <Pending label='Installing the Seam SDK…' />
            {installLines.map((line, index) => (
              <Text key={index} color='gray'>
                {' '}
                {line}
              </Text>
            ))}
          </Box>
        )
      case 'install-plugin':
        return (
          <Box flexDirection='column'>
            <Pending label='Installing the Seam plugin…' />
            {installLines.map((line, index) => (
              <Text key={index} color='gray'>
                {' '}
                {line}
              </Text>
            ))}
          </Box>
        )
      case 'offer-integrate':
        return (
          <Prompt title='Want the wizard to write your Seam integration now?'>
            <SelectInput
              items={[
                {
                  label: 'Yes — the agent reads my project and writes it',
                  value: 'yes',
                },
                { label: "No thanks, I'll do it myself", value: 'no' },
              ]}
              onSelect={(item) => {
                if (item.value === 'yes') setPhase({ t: 'analyze' })
                else finishWithNextSteps()
              }}
            />
          </Prompt>
        )
      case 'analyze':
        return <Pending label='Analyzing your project…' />
      case 'integrate-mode': {
        const recommended: BuildMode = mode ?? 'full_api'
        const portalItem = {
          label: 'Customer Portal — Seam hosts the UI (you call ~2 endpoints)',
          value: 'customer_portal',
        }
        const apiItem = {
          label: 'Full API control — you build the UI, wire up the API',
          value: 'full_api',
        }
        const items =
          recommended === 'customer_portal'
            ? [portalItem, apiItem]
            : [apiItem, portalItem]
        return (
          <Prompt title='How do you want to integrate Seam?'>
            {analysis?.recommendation.rationale != null &&
              analysis.recommendation.rationale.length > 0 && (
                <Text color='gray'>{`  ${analysis.recommendation.rationale}`}</Text>
              )}
            <SelectInput
              items={items}
              onSelect={(item) => {
                const chosen: BuildMode =
                  item.value === 'customer_portal'
                    ? 'customer_portal'
                    : 'full_api'
                setMode(chosen)
                addMessage({
                  tone: 'info',
                  text: `Mode: ${
                    chosen === 'customer_portal'
                      ? 'Customer Portal'
                      : 'Full API'
                  }`,
                })
                setPhase(
                  chosen === 'customer_portal'
                    ? { t: 'note' }
                    : { t: 'checklist' },
                )
              }}
            />
          </Prompt>
        )
      }
      case 'checklist':
        return (
          <Prompt title='What should the integration include? (space to toggle)'>
            <CheckboxList
              items={[...CORE_BLOCKS, ...COMMON_BLOCKS].map((block) => ({
                id: block.id,
                label: block.label,
                group: block.group,
              }))}
              initial_selected={selections}
              onSubmit={(chosen) => {
                setSelections(chosen)
                setPhase({ t: 'note' })
              }}
            />
          </Prompt>
        )
      case 'note':
        return (
          <Prompt title='Anything else to add? (optional — Enter to skip)'>
            <Box>
              <Text color='cyan'>{'› '}</Text>
              <TextInput
                value={noteValue}
                onChange={setNoteValue}
                placeholder='e.g. wire it into the checkout page'
                onSubmit={(value) => startIntegration(value)}
              />
            </Box>
          </Prompt>
        )
      case 'integrate': {
        // Two-column Learn | Tasks only when the terminal is wide enough;
        // otherwise Tasks alone, so a narrow window never wraps awkwardly.
        const showLearn = dimensions.columns >= 90
        const learnCard =
          LEARN_CARDS[
            Math.floor(integrateElapsedSec / LEARN_CARD_SECONDS) %
              LEARN_CARDS.length
          ]
        return (
          <Box flexDirection='column'>
            {stepStates.length > 0 && (
              <Box flexDirection='row' marginBottom={1}>
                {showLearn && learnCard != null && (
                  <Box flexDirection='column' width={30} marginRight={3}>
                    <Text bold color='cyan'>
                      {' '}
                      {learnCard.title}
                    </Text>
                    {learnCard.lines.map((line, index) => (
                      <Text key={index} color='gray'>
                        {' '}
                        {line}
                      </Text>
                    ))}
                  </Box>
                )}
                <Box flexDirection='column' flexGrow={1}>
                  <Text bold> Tasks</Text>
                  {stepStates.map((step) => (
                    <Text key={step.id} color={STEP_COLOR[step.status]}>
                      {'  '}
                      {STEP_ICON[step.status]} {step.label}
                    </Text>
                  ))}
                  <Text color='gray'>
                    {'  '}Progress:{' '}
                    {stepStates.filter((step) => step.status === 'done').length}
                    /{stepStates.length} completed
                  </Text>
                </Box>
              </Box>
            )}
            <Pending
              label={
                currentStep == null
                  ? `Writing your Seam integration… ${formatElapsed(
                      integrateElapsedSec,
                    )}`
                  : `${currentStep.label} (${currentStep.index + 1}/${
                      currentStep.total
                    }) · ${formatElapsed(integrateElapsedSec)}`
              }
            />
            {integrateIdleSec >= 20 && (
              <Text color='yellow'>
                {' '}
                Still working — large integrations take a few minutes, and Seam
                AI may be busy. Press Ctrl-C to stop.
              </Text>
            )}
            {agentLines.map((line, index) => (
              <Text key={index} color='gray'>
                {' '}
                {line}
              </Text>
            ))}
          </Box>
        )
      }
      case 'done':
      case 'error':
        return null
    }
  }
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? timestamp
    : date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
}

function connectItems(
  projectKey: ExistingKeyResult | null,
  cliKey: CliKeyResult | null,
): Array<{ label: string; value: string }> {
  return [
    ...(projectKey != null
      ? [{ label: projectKeyLabel(projectKey, 'Use'), value: 'project' }]
      : []),
    ...(cliKey != null
      ? [
          {
            label: `Use your Seam CLI login  (workspace ${cliKey.workspace.name})`,
            value: 'cli',
          },
        ]
      : []),
    {
      label: 'Continue in your browser  (create a key in the Console)',
      value: 'browser',
    },
    { label: 'Paste an API key  (if you already have one)', value: 'paste' },
  ]
}

function projectKeyLabel(
  projectKey: ExistingKeyResult | null,
  verb: string,
): string {
  if (projectKey == null) return `${verb} what is in your environment`
  return `${verb} the SEAM_API_KEY in ${projectKey.source}  (workspace ${projectKey.workspace.name})`
}

// Said only of what the login actually is: a token the wizard cannot hand to
// a project, or one it could not verify.
function pushNextSteps(
  addMessage: (message: Msg) => void,
  sdk: Sdk | null,
  workspaceName: string,
): void {
  const envHint =
    sdk === 'python'
      ? "Make sure SEAM_API_KEY is exported (it's in .env)."
      : 'Your key is in .env (git ignored); .env.example tells the rest of your team what to set.'
  addMessage({ tone: 'plain', text: '' })
  addMessage({ tone: 'ok', text: `You're set up in ${workspaceName}` })
  addMessage({ tone: 'plain', text: 'Next steps:' })
  addMessage({
    tone: 'plain',
    text: '  1. Describe your integration to your AI assistant — e.g. "add Seam access grants". The Seam skill will guide it.',
  })
  addMessage({ tone: 'plain', text: `  2. ${envHint}` })
  addMessage({ tone: 'plain', text: '  3. Docs: https://docs.seam.co' })
}

function truncate(text: string, maxLength: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength - 1)}…`
    : collapsed
}

// A compact one-line label for a tool the agent just invoked.
function formatTool(name: string, detail: string): string {
  const verb =
    name === 'Write'
      ? 'write'
      : name === 'Edit'
        ? 'edit'
        : name === 'Read'
          ? 'read'
          : name === 'Glob' || name === 'Grep'
            ? 'search'
            : name === 'WebFetch'
              ? 'fetch'
              : name.startsWith('mcp__seam-docs__')
                ? 'docs'
                : name
  return detail.length > 0 ? `${verb} ${truncate(detail, 60)}` : verb
}

function Header(): ReactElement {
  return (
    <Box marginBottom={1}>
      <Text backgroundColor='cyan' color='black' bold>
        {' Seam setup wizard '}
      </Text>
    </Box>
  )
}

// Plain-text rendering of a message, matching MessageLine's symbols — used to
// reprint the transcript into the normal terminal after the alt screen closes.
function formatMessageLine(message: Msg): string {
  if (message.tone === 'plain') return message.text
  const symbol =
    message.tone === 'ok' ? '✔' : message.tone === 'warn' ? '▲' : '•'
  return `${symbol} ${message.text}`
}

function MessageLine({ message }: { message: Msg }): ReactElement {
  if (message.tone === 'plain') return <Text>{message.text}</Text>
  const symbol =
    message.tone === 'ok' ? '✔' : message.tone === 'warn' ? '▲' : '•'
  const color =
    message.tone === 'ok'
      ? 'green'
      : message.tone === 'warn'
        ? 'yellow'
        : 'cyan'
  return (
    <Text>
      <Text color={color}>{symbol}</Text> {message.text}
    </Text>
  )
}

function Pending({ label }: { label: string }): ReactElement {
  return (
    <Text>
      <Text color='cyan'>
        <Spinner type='dots' />
      </Text>{' '}
      {label}
    </Text>
  )
}

function Prompt({
  title,
  children,
}: {
  title: string
  children: ReactNode
}): ReactElement {
  return (
    <Box flexDirection='column' marginTop={1}>
      <Text bold>{title}</Text>
      {children}
    </Box>
  )
}
