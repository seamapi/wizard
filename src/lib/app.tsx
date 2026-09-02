import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink'
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
import {
  finishAnalytics,
  setAnalyticsSdk,
  setAnalyticsWorkspace,
  track,
  trackScreen,
} from './analytics.js'
import {
  ApiKeyError,
  exchangeWizardInferenceToken,
  getInferenceBaseUrl,
  looksLikeSeamApiKey,
  type SeamWorkspace,
  type WizardInferenceSession,
} from './api.js'
import { ensureProjectEnvConventions, findExistingApiKey } from './env-file.js'
import { runInstall } from './run-install.js'
import { AnalyzeScreen } from './screens/analyze.js'
import { DoneScreen, type IntegrationOutcome } from './screens/done.js'
import { Header } from './screens/header.js'
import {
  IntegrateProgress,
  type StepState,
} from './screens/integrate-progress.js'
import { IntegrationModeScreen } from './screens/integration-mode.js'
import { NoteScreen } from './screens/note.js'
import { SetupProgress } from './screens/setup-progress.js'
import { LEARN_CARD_SECONDS, LEARN_CARDS } from './screens/tips.js'
import { WelcomeScreen } from './screens/welcome.js'
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
  composeGoal,
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

const MAX_ATTEMPTS = 3

type Tone = 'ok' | 'info' | 'warn' | 'plain'
interface Msg {
  tone: Tone
  text: string
}

type Phase =
  | { t: 'welcome' }
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
  | { t: 'note' }
  | { t: 'integrate'; steps: IntegrationStep[] }
  | { t: 'done' }
  | { t: 'error'; message: string }

export function App({
  root,
  showCost = false,
  showChanges = false,
  onExit,
}: {
  root: string
  showCost?: boolean
  showChanges?: boolean
  onExit?: (lines: string[]) => void
}): ReactElement {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const { isRawModeSupported } = useStdin()
  const projectRef = useRef<ProjectInfo>(detectProject(root))
  const attemptRef = useRef(0)
  // The key this run actually connected with. Downstream steps read this
  // instead of the environment, which may hold a key for another workspace.
  const apiKeyRef = useRef<string | null>(null)

  const [dimensions, setDimensions] = useState({
    rows: stdout?.rows ?? 24,
    columns: stdout?.columns ?? 80,
  })

  const [messages, setMessages] = useState<Msg[]>([])
  const [phase, setPhase] = useState<Phase>({ t: 'welcome' })
  const [sdk, setSdk] = useState<Sdk | null>(null)
  const [workspace, setWorkspace] = useState<SeamWorkspace | null>(null)

  // The intro splash advances into the wizard on any keypress. Where raw mode
  // isn't available (non-TTY) skip straight to init so the run isn't stuck.
  useInput(
    () => {
      if (phase.t === 'welcome') setPhase({ t: 'init' })
    },
    { isActive: isRawModeSupported && phase.t === 'welcome' },
  )
  useEffect(() => {
    if (phase.t === 'welcome' && !isRawModeSupported) setPhase({ t: 'init' })
  }, [phase.t, isRawModeSupported])

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
  // How the integration went, captured when it finishes so the final screen can
  // report it. Null once done means the wizard finished without running the agent.
  const [finalResult, setFinalResult] = useState<IntegrationOutcome | null>(
    null,
  )

  const planRef = useRef<ProjectPlan | null>(null)
  // Start times for the durations the analytics events report: the install
  // commands and the agent step running right now.
  const installStartedAtRef = useRef(0)
  const stepStartedAtRef = useRef(0)
  // The plan the integration is running, so a step event can name its step.
  const integrationStepsRef = useRef<IntegrationStep[]>([])
  // Mirrors integrateElapsedSec so the done event can read the final elapsed
  // time without a stale closure (the tick updates state, not this handler).
  const integrateElapsedRef = useRef(0)
  // The final outcome + the agent's file summary, captured on the done event so
  // the exit report reads them directly (state is batched/async at that point).
  const finalResultRef = useRef<IntegrationOutcome | null>(null)
  const finalSummaryRef = useRef('')

  const addMessage = (message: Msg): void =>
    setMessages((previous) => [...previous, message])

  // How far the run got with the agent, for the event that closes the run. Read
  // from the ref, so the unmount cleanup — which closes over the first render —
  // reports the same thing a clean finish does.
  const integrationOutcomeProperties = (): Record<string, unknown> => ({
    reached_integration: finalResultRef.current != null,
    integration_ok: finalResultRef.current?.ok ?? null,
  })

  // Open the run, then close it on unmount. The cleanup is what reports a run
  // the developer walked out of: Ctrl-C unmounts the app without going through
  // the final screen, and `finishAnalytics` only counts the first call, so a
  // clean finish reports itself and this becomes a no-op.
  useEffect(() => {
    const project = projectRef.current
    track('wizard_run_started', {
      detected_sdk: project.detected_sdk,
      js_package_manager: project.js_package_manager,
      python_installer: project.python_installer,
      is_tty: isRawModeSupported,
      terminal_columns: dimensions.columns,
      terminal_rows: dimensions.rows,
    })
    return () => {
      finishAnalytics('abandoned', integrationOutcomeProperties())
    }
  }, [])

  // The funnel: every phase the run enters, in order. Where a run stops is the
  // last screen reported.
  useEffect(() => {
    trackScreen(phase.t)
  }, [phase.t])

  // The final screen and the exit report carry the outcome + next steps now, so
  // finishing is just moving to the done phase.
  const finishWithNextSteps = (): void => {
    setPhase({ t: 'done' })
  }

  const startIntegration = (noteInput: string): void => {
    const note = noteInput.trim().length > 0 ? noteInput.trim() : null
    const effectiveMode: BuildMode = mode ?? 'full_api'
    const framework = analysis?.signals.framework ?? null
    const goal = composeGoal({ mode: effectiveMode, note, framework })
    const plan: ProjectPlan = {
      mode: effectiveMode,
      note,
      goal,
      analysis: {
        sdk: analysis?.signals.sdk ?? null,
        framework,
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
      note,
      framework,
    })
    integrationStepsRef.current = steps
    // The note itself is the developer's own prose about their product, so only
    // whether they wrote one — and how much — is reported.
    track('wizard_integration_started', {
      mode: effectiveMode,
      framework,
      has_note: note != null,
      note_length: note?.length ?? 0,
      total_steps: steps.length,
    })
    setPhase({ t: 'integrate', steps })
  }

  // An install either finished or the developer was told to run it themselves.
  // Reported either way: a failing installer is a reason runs stall here.
  const trackInstallFinished = (
    target: 'sdk' | 'plugin',
    ok: boolean,
    properties: Record<string, unknown>,
  ): void => {
    track('wizard_install_finished', {
      target,
      ok,
      duration_ms: Date.now() - installStartedAtRef.current,
      ...properties,
    })
  }

  // Which step of the run this was, and how long it took. The step's id comes
  // from the plan by index: the failure event does not carry one.
  const trackStepFinished = ({
    index,
    total,
    status,
    cost_usd: costUsd = null,
    reason = null,
  }: {
    index: number
    total: number
    status: 'done' | 'failed'
    cost_usd?: number | null
    reason?: string | null
  }): void => {
    track('wizard_integration_step_finished', {
      step_id: integrationStepsRef.current[index]?.id ?? null,
      step_index: index,
      total_steps: total,
      status,
      duration_ms:
        stepStartedAtRef.current === 0
          ? null
          : Date.now() - stepStartedAtRef.current,
      cost_usd: costUsd,
      reason,
    })
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
      stepStartedAtRef.current = Date.now()
    } else if (event.kind === 'step_done') {
      setStepStates((previous) =>
        previous.map((step, index) =>
          index === event.index ? { ...step, status: 'done' } : step,
        ),
      )
      trackStepFinished({
        index: event.index,
        total: event.total,
        status: 'done',
        cost_usd: event.cost_usd,
      })
    } else if (event.kind === 'step_failed') {
      setStepStates((previous) =>
        previous.map((step, index) =>
          index === event.index ? { ...step, status: 'failed' } : step,
        ),
      )
      trackStepFinished({
        index: event.index,
        total: event.total,
        status: 'failed',
        reason: event.reason,
      })
      addMessage({
        tone: 'warn',
        text: `Step ${event.index + 1}/${event.total} stopped — ${event.reason}`,
      })
    } else if (event.kind === 'thinking') {
      setIntegrateIdleSec(0)
      setAgentLines((previous) => [
        ...previous.slice(-5),
        `Thinking: ${truncate(event.text, 90)}`,
      ])
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
      const outcome: IntegrationOutcome = {
        ok: event.ok,
        costUsd: event.cost_usd ?? null,
        elapsedSec: integrateElapsedRef.current,
        doneSteps: doneCount,
        totalSteps: event.steps.length,
      }
      track('wizard_integration_finished', {
        ok: event.ok,
        done_steps: doneCount,
        total_steps: event.steps.length,
        failed_step_ids: event.steps
          .filter((step) => step.status === 'failed')
          .map((step) => step.id),
        duration_seconds: integrateElapsedRef.current,
        cost_usd: event.cost_usd,
        // How much of the tips deck the developer had time to read while the
        // agent worked — the deck cycles on a timer, so it follows the run's
        // length.
        tip_cards_shown: Math.min(
          LEARN_CARDS.length,
          Math.floor(integrateElapsedRef.current / LEARN_CARD_SECONDS) + 1,
        ),
      })
      setFinalResult(outcome)
      // Captured in refs (not messages) so the final screen and the concise exit
      // report render them; the full run log is not replayed on exit.
      finalResultRef.current = outcome
      finalSummaryRef.current = event.summary.trim()
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
    apiKeyRef.current = apiKey
    setWorkspace(settledWorkspace)
    // Everything after this point is attributed to the workspace. The name is
    // sent once, here, so the workspace can be labelled; the id rides along on
    // every later event.
    setAnalyticsWorkspace(settledWorkspace)
    track('wizard_connected', {
      source,
      location,
      workspace_name: settledWorkspace.name,
    })
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
      setAnalyticsSdk(detected)
      track('wizard_sdk_selected', { sdk: detected, was_detected: true })
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

      // What the run starts from: whether the wizard has been here before, and
      // whether it found a key it can use without asking.
      track('wizard_init_finished', {
        project_seen_before: recorded != null,
        has_project_key: existing != null,
        project_key_source: existing?.source ?? null,
        has_cli_key: cliResult != null,
      })

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
        track('wizard_drift_shown', {
          changes: changes.map((change) => change.what),
        })
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
          onReceived: () => {
            if (cancelled) return
            // Between opening the browser and this, the developer is off in the
            // Console. A run that never gets here is one that left there.
            track('wizard_browser_key_received')
            setBrowser((b) => ({ ...b, received: true }))
          },
        })
        if (cancelled) return
        addMessage({
          tone: 'ok',
          text: `Connected · workspace ${result.workspace.name}`,
        })
        settleOn(result.workspace, result.api_key, 'browser', '.env')
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Browser connection failed.'
          track('wizard_connect_failed', {
            method: 'browser',
            reason: message,
          })
          setPhase({ t: 'error', message })
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
        addMessage({ tone: 'ok', text: `Workspace: ${result.workspace.name}` })
        settleOn(result.workspace, result.api_key, 'pasted', '.env')
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof ApiKeyError
            ? error.message
            : "Couldn't verify the key."
        track('wizard_connect_failed', {
          method: 'paste',
          reason: message,
          attempt: attemptRef.current,
          gave_up: attemptRef.current >= MAX_ATTEMPTS,
        })
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
      installStartedAtRef.current = Date.now()
      try {
        await runInstall(command, root, (line) => {
          if (!cancelled) {
            setInstallLines((previous) => [...previous.slice(-3), line])
          }
        })
        if (!cancelled) {
          trackInstallFinished('sdk', true, { installer: command[0] ?? null })
          addMessage({ tone: 'ok', text: 'Seam SDK installed' })
        }
      } catch {
        if (!cancelled) {
          trackInstallFinished('sdk', false, { installer: command[0] ?? null })
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
      installStartedAtRef.current = Date.now()
      try {
        await runInstall(SEAM_PLUGIN_NPX_COMMAND, root, (line) => {
          if (!cancelled) {
            setInstallLines((previous) => [...previous.slice(-3), line])
          }
        })
        if (!cancelled) {
          trackInstallFinished('plugin', true, { plugin_target: target })
          addMessage({ tone: 'ok', text: 'Installed the Seam plugin skills' })
        }
      } catch {
        if (!cancelled) {
          trackInstallFinished('plugin', false, { plugin_target: target })
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
      const analyzeStartedAt = Date.now()
      // Prefer the key this run connected with: re-reading here would pick up
      // SEAM_API_KEY, which can belong to a different workspace than the one
      // just chosen, and silently plan the integration against that one.
      const apiKey = apiKeyRef.current ?? findExistingApiKey(root)?.api_key
      if (apiKey == null) {
        track('wizard_analyze_failed', { reason: 'no_api_key' })
        addMessage({
          tone: 'warn',
          text: "Couldn't find your Seam API key to plan the integration.",
        })
        if (!cancelled) finishWithNextSteps()
        return
      }

      let currentSession: WizardInferenceSession
      try {
        currentSession = await exchangeWizardInferenceToken(apiKey)
      } catch (error) {
        if (!cancelled) {
          track('wizard_analyze_failed', {
            reason: 'session_exchange_failed',
            message: error instanceof Error ? error.message : 'unknown error',
          })
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
      track('wizard_analyze_finished', {
        duration_ms: Date.now() - analyzeStartedAt,
        framework: result.signals.framework,
        analyzed_sdk: result.signals.sdk,
        app_type_guess: result.recommendation.app_type_guess,
        recommended_mode: result.recommendation.mode,
        recommendation_source: result.recommendation.source,
        seam_already_setup: result.signals.seam_already_setup,
        used_onboarding: result.used_onboarding,
      })
      setAnalysis(result)
      setMode(result.recommendation.mode)

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
        if (!controller.signal.aborted) {
          track('wizard_integration_failed', { reason: 'no_session' })
        }
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
          track('wizard_integration_failed', {
            reason: 'agent_error',
            message: rawMessage,
            is_overloaded: isOverloaded,
            elapsed_seconds: integrateElapsedRef.current,
          })
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
    integrateElapsedRef.current = 0
    const interval = setInterval(() => {
      setIntegrateElapsedSec((seconds) => seconds + 1)
      setIntegrateIdleSec((seconds) => seconds + 1)
      integrateElapsedRef.current += 1
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

  // What gets reprinted to the normal terminal after the alt screen closes: a
  // concise report (status, time, next steps — cost/changes only behind flags),
  // not a replay of the whole run log.
  const buildExitReport = (): string[] => {
    if (phase.t === 'error') return [`▲ ${phase.message}`]

    const workspaceName = workspace?.name ?? 'your workspace'
    const outcome = finalResultRef.current
    const lines: string[] = []

    if (outcome == null) {
      lines.push(`✔ You're set up in ${workspaceName}`)
    } else if (outcome.ok) {
      lines.push(`✔ Integration written in ${workspaceName}`)
    } else {
      lines.push(`▲ Agent stopped early in ${workspaceName}`)
    }
    if (outcome != null) {
      const stats =
        `  ${outcome.doneSteps}/${outcome.totalSteps} steps · took ${formatDuration(outcome.elapsedSec)}` +
        (showCost && outcome.costUsd != null
          ? ` · $${outcome.costUsd.toFixed(2)}`
          : '')
      lines.push(stats)
    }
    lines.push('', ...nextStepsLines(sdk, workspaceName))
    if (showChanges && finalSummaryRef.current.length > 0) {
      lines.push('', 'What changed:')
      for (const line of finalSummaryRef.current.split('\n')) {
        lines.push(`  ${line}`)
      }
    }
    return lines
  }

  const finish = (): void => {
    finishAnalytics(phase.t === 'error' ? 'error' : 'completed', {
      ...integrationOutcomeProperties(),
      // The wizard's own last word: the pointer at the workspace assistant only
      // appears once a run has a workspace to point at.
      assistant_link_shown: phase.t === 'done' && workspace != null,
    })
    onExit?.(buildExitReport())
    exit()
  }

  // exit when finished. `done` shows a final screen and waits for a keypress
  // (see the useInput below); it only auto-exits where raw mode is unavailable
  // (non-TTY) so a headless run never hangs. `error` always exits.
  useEffect(() => {
    if (phase.t !== 'done' && phase.t !== 'error') return
    if (phase.t === 'error') {
      track('wizard_error', { message: phase.message })
      addMessage({ tone: 'warn', text: phase.message })
      process.exitCode = 1
    }
    if (phase.t === 'done' && isRawModeSupported) return
    // Hand the exit report back so index.tsx can reprint it once the alt screen
    // is torn down. Small delay lets the final state settle first.
    const id = setTimeout(finish, 40)
    return () => clearTimeout(id)
  }, [phase.t])

  // On the final screen, any key exits.
  useInput(finish, { isActive: isRawModeSupported && phase.t === 'done' })

  // Full-screen: a header, the transcript (bounded to what fits), then the
  // active step. The outer box is sized to the terminal so it fills the alt
  // screen; older transcript lines scroll off the top and are reprinted on exit.
  const transcriptCapacity = Math.max(1, dimensions.rows - 8)
  const visibleMessages = messages.slice(-transcriptCapacity)

  // Every step that isn't the transcript is its own full-screen screen: the
  // header on top, the screen's content below. Sized to the terminal so it
  // fills the alt screen.
  const fullScreen = (content: ReactNode): ReactElement => (
    <Box
      flexDirection='column'
      height={dimensions.rows}
      width={dimensions.columns}
      paddingX={1}
      paddingY={1}
    >
      <Header />
      {content}
    </Box>
  )

  // The intro splash takes over the whole screen (no header/transcript chrome).
  if (phase.t === 'welcome') return <WelcomeScreen />

  // The integration runs on its own full screen — the Tasks + tips panel is the
  // whole view, not a footer under the transcript.
  if (phase.t === 'integrate') {
    return fullScreen(
      <IntegrateProgress
        stepStates={stepStates}
        currentStep={currentStep}
        elapsedSec={integrateElapsedSec}
        idleSec={integrateIdleSec}
        agentLines={agentLines}
        columns={dimensions.columns}
      />,
    )
  }

  // Installing the SDK + plugin, styled like the Tasks screen: a setup checklist
  // with the running step spinning.
  if (phase.t === 'install-sdk' || phase.t === 'install-plugin') {
    const installingSdk = phase.t === 'install-sdk'
    const setupSteps: StepState[] = [
      {
        id: 'sdk',
        label: 'Install the Seam SDK',
        status: installingSdk ? 'active' : 'done',
      },
      {
        id: 'plugin',
        label: 'Install the Seam plugin',
        status: installingSdk ? 'pending' : 'active',
      },
    ]
    return fullScreen(
      <SetupProgress
        steps={setupSteps}
        label={
          installingSdk
            ? 'Installing the Seam SDK…'
            : 'Installing the Seam plugin…'
        }
        outputLines={installLines}
      />,
    )
  }

  if (phase.t === 'analyze') return fullScreen(<AnalyzeScreen />)

  if (phase.t === 'integrate-mode') {
    const recommended: BuildMode = mode ?? 'full_api'
    const portalItem = {
      label: 'Customer Portal — Seam hosts the UI (you call ~2 endpoints)',
      value: 'customer_portal',
    }
    const apiItem = {
      label: 'Full API control — you build the UI, wire up the API',
      value: 'full_api',
    }
    // Setup (SDK + plugin) is already done by this point, so offer to stop here
    // and integrate by hand.
    const continueItem = {
      label: 'Continue on my own — setup is done, I’ll build it',
      value: 'continue_on_own',
    }
    return fullScreen(
      <IntegrationModeScreen
        items={[
          ...(recommended === 'customer_portal'
            ? [portalItem, apiItem]
            : [apiItem, portalItem]),
          continueItem,
        ]}
        rationale={analysis?.recommendation.rationale ?? undefined}
        columns={dimensions.columns}
        onSelect={(item) => {
          // Reported for every choice, including walking away from the agent:
          // whether the developer takes the recommended mode is the point.
          track('wizard_mode_selected', {
            choice: item.value,
            recommended_mode: recommended,
            followed_recommendation: item.value === recommended,
          })
          if (item.value === 'continue_on_own') {
            finishWithNextSteps()
            return
          }
          const chosen: BuildMode =
            item.value === 'customer_portal' ? 'customer_portal' : 'full_api'
          setMode(chosen)
          addMessage({
            tone: 'info',
            text: `Mode: ${chosen === 'customer_portal' ? 'Customer Portal' : 'Full API'}`,
          })
          setPhase({ t: 'note' })
        }}
      />,
    )
  }

  if (phase.t === 'note') {
    return fullScreen(
      <NoteScreen
        value={noteValue}
        onChange={setNoteValue}
        onSubmit={(value) => startIntegration(value)}
      />,
    )
  }

  // The final screen is a centered celebration — no header/transcript chrome.
  if (phase.t === 'done') {
    return (
      <DoneScreen
        workspaceName={workspace?.name ?? 'your workspace'}
        workspaceId={workspace?.workspace_id ?? null}
        outcome={finalResult}
        showCost={showCost}
      />
    )
  }

  // The running frame: header, then a two-column body — the active prompt (the
  // question) on the left, Recent activity on the right. On a narrow terminal
  // they stack (activity first, then the prompt) so nothing wraps awkwardly.
  const twoColumn = dimensions.columns >= 90
  const activityColumn = (
    <Box flexDirection='column' flexGrow={1}>
      <Text bold>Recent activity</Text>
      {visibleMessages.map((message, index) => (
        <MessageLine key={index} message={message} />
      ))}
    </Box>
  )
  const promptColumn = (
    <Box
      flexDirection='column'
      flexGrow={1}
      marginRight={twoColumn ? 3 : 0}
      marginTop={twoColumn ? 0 : 1}
    >
      {renderActive()}
    </Box>
  )
  return (
    <Box
      flexDirection='column'
      height={dimensions.rows}
      width={dimensions.columns}
      paddingX={1}
    >
      <Header />
      <Box flexDirection={twoColumn ? 'row' : 'column'} flexGrow={1}>
        {twoColumn ? (
          <>
            {promptColumn}
            {activityColumn}
          </>
        ) : (
          <>
            {activityColumn}
            {promptColumn}
          </>
        )}
      </Box>
    </Box>
  )

  function onConnectSelected(value: string): void {
    track('wizard_connect_method_selected', { method: value })
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
                track('wizard_drift_resolved', { choice: item.value })
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
        const sdkItems = [
          { label: 'JavaScript / TypeScript', value: 'javascript' },
          { label: 'Python', value: 'python' },
          { label: 'Ruby', value: 'ruby' },
          { label: 'PHP', value: 'php' },
        ]
        // Float the previously-chosen SDK to the top, otherwise keep the order.
        const items =
          preferredSdk == null
            ? sdkItems
            : [
                ...sdkItems.filter((item) => item.value === preferredSdk),
                ...sdkItems.filter((item) => item.value !== preferredSdk),
              ]
        return (
          <Prompt title='Which SDK are you using?'>
            <SelectInput
              items={items}
              onSelect={(item) => {
                const chosen: Sdk =
                  item.value === 'python' ||
                  item.value === 'ruby' ||
                  item.value === 'php'
                    ? item.value
                    : 'javascript'
                setSdk(chosen)
                setAnalyticsSdk(chosen)
                track('wizard_sdk_selected', {
                  sdk: chosen,
                  was_detected: false,
                  was_preferred: chosen === preferredSdk,
                })
                writePreferredSdk(chosen).catch(() => {})
                addMessage({ tone: 'info', text: `SDK: ${chosen}` })
                setPhase({ t: 'install-sdk' })
              }}
            />
          </Prompt>
        )
      }
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
                track('wizard_integration_offer_answered', {
                  answer: item.value,
                })
                if (item.value === 'yes') setPhase({ t: 'analyze' })
                else finishWithNextSteps()
              }}
            />
          </Prompt>
        )
      case 'welcome':
      case 'install-sdk':
      case 'install-plugin':
      case 'analyze':
      case 'integrate-mode':
      case 'note':
      case 'integrate':
      case 'done':
      case 'error':
        return null
    }
  }
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
function nextStepsLines(sdk: Sdk | null, workspaceName: string): string[] {
  const envHint =
    sdk === 'python'
      ? "Make sure SEAM_API_KEY is exported (it's in .env)."
      : 'Your key is in .env (git ignored); .env.example tells the rest of your team what to set.'
  return [
    `You're set up in ${workspaceName}`,
    'Next steps:',
    '  1. Describe your integration to your AI assistant — e.g. "add Seam access grants". The Seam skill will guide it.',
    `  2. ${envHint}`,
    '  3. Docs: https://docs.seam.co',
  ]
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
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
