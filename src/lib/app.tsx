import React, { useEffect, useRef, useState } from "react"
import { Box, Text, useApp, useStdout } from "ink"
import Spinner from "ink-spinner"
import SelectInput from "ink-select-input"
import TextInput from "ink-text-input"
import {
  detectProject,
  installSeamSdkCommand,
  type ProjectInfo,
  type Sdk,
} from "./steps/detect-project.js"
import {
  findVerifiedExistingKey,
  verifyAndSaveKey,
} from "./steps/authenticate.js"
import { connectViaWeb } from "./steps/connect-web.js"
import {
  detectPluginTarget,
  SEAM_PLUGIN_NPX_COMMAND,
  CLAUDE_CODE_COMMANDS,
} from "./steps/install-seam-plugin.js"
import { runIntegration, type IntegrateEvent } from "./steps/integrate.js"
import { analyzeProject, type ProjectAnalysis } from "./steps/analyze-project.js"
import {
  CORE_BLOCKS,
  COMMON_BLOCKS,
  composeGoal,
  writeOnboardingRecord,
  type BuildMode,
  type OnboardingRecord,
} from "./steps/build-plan.js"
import { CheckboxList } from "./components/checkbox-list.js"
import { runInstall } from "./util/run-install.js"
import { findExistingApiKey } from "./util/env-file.js"
import {
  ApiKeyError,
  exchangeWizardInferenceToken,
  looksLikeSeamApiKey,
  SEAM_INFERENCE_BASE_URL,
  type SeamWorkspace,
  type WizardInferenceSession,
} from "./util/seam-api.js"

const MAX_ATTEMPTS = 3

type Tone = "ok" | "info" | "warn" | "plain"
interface Msg {
  tone: Tone
  text: string
}

type Phase =
  | { t: "init" }
  | { t: "method" }
  | { t: "browser" }
  | { t: "paste" }
  | { t: "verify-paste"; api_key: string }
  | { t: "sdk" }
  | { t: "install-sdk" }
  | { t: "install-plugin" }
  | { t: "offer-integrate" }
  | { t: "analyze" }
  | { t: "integrate-mode" }
  | { t: "checklist" }
  | { t: "note" }
  | { t: "integrate"; goal: string }
  | { t: "done" }
  | { t: "error"; message: string }

export function App({
  root,
  onExit,
}: {
  root: string
  onExit?: (lines: string[]) => void
}): React.ReactElement {
  const { exit } = useApp()
  const { stdout } = useStdout()
  const project_ref = useRef<ProjectInfo>(detectProject(root))
  const attempt_ref = useRef(0)

  const [dimensions, setDimensions] = useState({
    rows: stdout?.rows ?? 24,
    columns: stdout?.columns ?? 80,
  })

  const [messages, setMessages] = useState<Msg[]>([])
  const [phase, setPhase] = useState<Phase>({ t: "init" })
  const [sdk, setSdk] = useState<Sdk | null>(null)
  const [workspace, setWorkspace] = useState<SeamWorkspace | null>(null)

  const [browser, setBrowser] = useState<{ url: string | null; received: boolean }>({
    url: null,
    received: false,
  })
  const [paste_value, setPasteValue] = useState("")
  const [paste_error, setPasteError] = useState<string | null>(null)
  const [install_lines, setInstallLines] = useState<string[]>([])
  const [note_value, setNoteValue] = useState("")
  const [agent_lines, setAgentLines] = useState<string[]>([])
  const [session, setSession] = useState<WizardInferenceSession | null>(null)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [mode, setMode] = useState<BuildMode | null>(null)
  const [selections, setSelections] = useState<string[]>([])

  // The plan record (written to .seam/onboarding.json before the agent runs);
  // the done handler rewrites it with the run result.
  const plan_ref = useRef<Omit<OnboardingRecord, "schema_version"> | null>(null)

  // Kept in sync with `messages` so the exit handler can hand the full
  // transcript to index.tsx to reprint after leaving the alt screen.
  const messages_ref = useRef<Msg[]>([])
  const addMessage = (message: Msg): void =>
    setMessages((previous) => {
      const next = [...previous, message]
      messages_ref.current = next
      return next
    })

  const finishWithNextSteps = (): void => {
    pushNextSteps(addMessage, sdk, workspace?.name ?? "your workspace")
    setPhase({ t: "done" })
  }

  // Compose the goal from the chosen mode + building blocks + optional note,
  // persist the plan to .seam/onboarding.json, then hand off to the agent.
  const startIntegration = (note_input: string): void => {
    const note = note_input.trim().length > 0 ? note_input.trim() : null
    const effective_mode: BuildMode = mode ?? "full_api"
    const effective_selections =
      effective_mode === "customer_portal" ? [] : selections
    const goal = composeGoal({
      mode: effective_mode,
      selections: effective_selections,
      note,
      framework: analysis?.signals.framework ?? null,
    })
    const record: Omit<OnboardingRecord, "schema_version"> = {
      created_at: new Date().toISOString(),
      mode: effective_mode,
      selections: effective_selections,
      note,
      goal,
      analysis: {
        sdk: analysis?.signals.sdk ?? null,
        framework: analysis?.signals.framework ?? null,
        app_type_guess: analysis?.recommendation.app_type_guess ?? null,
        seam_already_setup: analysis?.signals.seam_already_setup ?? false,
        used_onboarding: analysis?.used_onboarding ?? false,
        recommendation_source: analysis?.recommendation.source ?? "heuristic",
      },
    }
    plan_ref.current = record
    try {
      writeOnboardingRecord(root, record)
      addMessage({ tone: "info", text: "Saved your plan to .seam/onboarding.json" })
    } catch {
      // Writing the record is best-effort; proceed with the integration.
    }
    setPhase({ t: "integrate", goal })
  }

  const handleIntegrateEvent = (event: IntegrateEvent): void => {
    if (event.kind === "text") {
      setAgentLines((previous) => [...previous.slice(-5), truncate(event.text, 100)])
    } else if (event.kind === "tool") {
      setAgentLines((previous) => [
        ...previous.slice(-5),
        formatTool(event.name, event.detail),
      ])
    } else {
      setAgentLines([])
      if (plan_ref.current != null) {
        try {
          writeOnboardingRecord(root, {
            ...plan_ref.current,
            result: {
              ok: event.ok,
              files_summary: event.summary.trim().slice(0, 4000),
              cost_usd: event.cost_usd,
            },
          })
        } catch {
          // Recording the result is best-effort; never block finishing.
        }
      }
      addMessage(
        event.ok
          ? { tone: "ok", text: "Integration written — review it with `git diff`" }
          : { tone: "warn", text: "Agent stopped early — review what it changed with `git diff`" }
      )
      for (const line of event.summary.trim().split("\n").slice(0, 15)) {
        if (line.trim().length > 0) addMessage({ tone: "plain", text: `  ${line}` })
      }
      if (event.cost_usd != null) {
        addMessage({ tone: "info", text: `Model cost: $${event.cost_usd.toFixed(2)}` })
      }
    }
  }

  // Once a workspace is known, choose SDK (or skip if detected) then install.
  const advanceAfterAuth = (): void => {
    const detected = project_ref.current.detected_sdk
    if (detected != null) {
      setSdk(detected)
      addMessage({ tone: "info", text: `Detected ${detected} project` })
      setPhase({ t: "install-sdk" })
    } else {
      setPhase({ t: "sdk" })
    }
  }

  // init: reuse an existing key if valid, else ask how to connect.
  useEffect(() => {
    if (phase.t !== "init") return
    let cancelled = false
    void (async () => {
      const existing = await findVerifiedExistingKey(root)
      if (cancelled) return
      if (existing != null) {
        setWorkspace(existing.workspace)
        addMessage({
          tone: "ok",
          text: `Using existing key from ${existing.source} · workspace ${existing.workspace.name}`,
        })
        advanceAfterAuth()
      } else {
        setPhase({ t: "method" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // browser handoff
  useEffect(() => {
    if (phase.t !== "browser") return
    let cancelled = false
    void (async () => {
      try {
        const result = await connectViaWeb(root, {
          onUrl: (url) => !cancelled && setBrowser((b) => ({ ...b, url })),
          onReceived: () => !cancelled && setBrowser((b) => ({ ...b, received: true })),
        })
        if (cancelled) return
        setWorkspace(result.workspace)
        addMessage({ tone: "ok", text: `Connected · workspace ${result.workspace.name}` })
        advanceAfterAuth()
      } catch (error) {
        if (!cancelled) {
          setPhase({
            t: "error",
            message: error instanceof Error ? error.message : "Browser connection failed.",
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // verify a pasted key
  useEffect(() => {
    if (phase.t !== "verify-paste") return
    const { api_key } = phase
    let cancelled = false
    void (async () => {
      try {
        const result = await verifyAndSaveKey(root, api_key)
        if (cancelled) return
        setWorkspace(result.workspace)
        addMessage({ tone: "ok", text: `Workspace: ${result.workspace.name}` })
        advanceAfterAuth()
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof ApiKeyError ? error.message : "Couldn't verify the key."
        if (attempt_ref.current >= MAX_ATTEMPTS) {
          setPhase({ t: "error", message: "Too many attempts. Re-run with a valid key." })
        } else {
          setPasteError(message)
          setPasteValue("")
          setPhase({ t: "paste" })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // install the Seam SDK (streamed), then install the plugin
  useEffect(() => {
    if (phase.t !== "install-sdk" || sdk == null) return
    let cancelled = false
    const command = installSeamSdkCommand(sdk, project_ref.current)
    void (async () => {
      try {
        await runInstall(command, root, (line) => {
          if (!cancelled) setInstallLines((previous) => [...previous.slice(-3), line])
        })
        if (!cancelled) addMessage({ tone: "ok", text: "Seam SDK installed" })
      } catch {
        if (!cancelled) {
          addMessage({
            tone: "warn",
            text: `Couldn't finish installing — run it yourself: ${command.join(" ")}`,
          })
        }
      }
      if (!cancelled) {
        setInstallLines([])
        setPhase({ t: "install-plugin" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase.t, sdk])

  // install the official Seam plugin skills, then finish. We always run the
  // universal installer (works everywhere); for Claude Code we additionally
  // point at the native /plugin path, which also wires up the seam-docs MCP.
  useEffect(() => {
    if (phase.t !== "install-plugin") return
    const workspace_name = workspace?.name ?? "your workspace"
    const target = detectPluginTarget(root)

    let cancelled = false
    void (async () => {
      try {
        await runInstall(SEAM_PLUGIN_NPX_COMMAND, root, (line) => {
          if (!cancelled) setInstallLines((previous) => [...previous.slice(-3), line])
        })
        if (!cancelled) addMessage({ tone: "ok", text: "Installed the Seam plugin skills" })
      } catch {
        if (!cancelled) {
          addMessage({
            tone: "warn",
            text: `Couldn't install the plugin — run it yourself: ${SEAM_PLUGIN_NPX_COMMAND.join(" ")}`,
          })
        }
      }
      if (!cancelled) {
        if (target === "claude-code") {
          addMessage({
            tone: "info",
            text: "Claude Code: for the native plugin + seam-docs MCP, you can also run:",
          })
          for (const command of CLAUDE_CODE_COMMANDS) {
            addMessage({ tone: "plain", text: `  ${command}` })
          }
        }
        setPhase({ t: "offer-integrate" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // analyze: exchange the API key for a scoped wizard token (which also returns
  // the Console onboarding answers), scan the project, and get a mode/checklist
  // recommendation to pre-fill the next steps. The token is reused by the
  // integration agent below, so it is minted once.
  useEffect(() => {
    if (phase.t !== "analyze") return
    let cancelled = false
    void (async () => {
      const found = findExistingApiKey(root)
      if (found == null) {
        addMessage({
          tone: "warn",
          text: "Couldn't find your Seam API key to plan the integration.",
        })
        if (!cancelled) finishWithNextSteps()
        return
      }

      let current_session: WizardInferenceSession
      try {
        current_session = await exchangeWizardInferenceToken(found.api_key)
      } catch (error) {
        if (!cancelled) {
          addMessage({
            tone: "warn",
            text: `Couldn't start the AI session: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          })
          finishWithNextSteps()
        }
        return
      }
      if (cancelled) return
      setSession(current_session)

      const result = await analyzeProject({
        root,
        project: project_ref.current,
        onboarding: current_session.onboarding,
        inference: {
          base_url: SEAM_INFERENCE_BASE_URL,
          token: current_session.token,
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
        .join(" · ")
      addMessage({
        tone: "info",
        text: `Analyzed your project${detail.length > 0 ? `: ${detail}` : ""}`,
      })
      if (current_session.onboarding != null) {
        addMessage({ tone: "plain", text: "  Used your Console onboarding answers" })
      }
      setPhase({ t: "integrate-mode" })
    })()
    return () => {
      cancelled = true
    }
  }, [phase.t])

  // run the embedded integration agent (Claude Agent SDK), routed through
  // Seam-hosted inference using the token minted during the analyze step — no
  // developer Anthropic key.
  useEffect(() => {
    if (phase.t !== "integrate") return
    const { goal } = phase
    const controller = new AbortController()
    void (async () => {
      if (session == null) {
        addMessage({
          tone: "warn",
          text: "Lost the AI session — re-run the wizard to try again.",
        })
        if (!controller.signal.aborted) finishWithNextSteps()
        return
      }
      addMessage({ tone: "info", text: "Starting the Seam integration agent…" })
      try {
        await runIntegration({
          root,
          sdk: sdk ?? "javascript",
          workspace_name: workspace?.name ?? "your workspace",
          goal,
          inference: {
            base_url: SEAM_INFERENCE_BASE_URL,
            token: session.token,
          },
          framework: analysis?.signals.framework ?? null,
          mode: mode ?? "full_api",
          signal: controller.signal,
          onEvent: (event) => {
            if (!controller.signal.aborted) handleIntegrateEvent(event)
          },
        })
      } catch (error) {
        if (!controller.signal.aborted) {
          addMessage({
            tone: "warn",
            text: `Couldn't run the integration agent: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          })
        }
      }
      if (!controller.signal.aborted) finishWithNextSteps()
    })()
    return () => controller.abort()
  }, [phase.t])

  // keep the full-screen layout sized to the terminal
  useEffect(() => {
    if (stdout == null) return
    const onResize = (): void =>
      setDimensions({ rows: stdout.rows ?? 24, columns: stdout.columns ?? 80 })
    stdout.on("resize", onResize)
    return () => {
      stdout.off("resize", onResize)
    }
  }, [stdout])

  // exit when finished
  useEffect(() => {
    if (phase.t !== "done" && phase.t !== "error") return
    if (phase.t === "error") {
      addMessage({ tone: "warn", text: phase.message })
      process.exitCode = 1
    }
    // Hand the transcript back so index.tsx can reprint it once the alt screen
    // is torn down (its contents are otherwise discarded). Small delay lets the
    // final addMessage above flush into messages_ref.
    const id = setTimeout(() => {
      onExit?.(messages_ref.current.map(formatMessageLine))
      exit()
    }, 40)
    return () => clearTimeout(id)
  }, [phase.t])

  // Full-screen: a header, the transcript (bounded to what fits), then the
  // active step. The outer box is sized to the terminal so it fills the alt
  // screen; older transcript lines scroll off the top and are reprinted on exit.
  const transcript_capacity = Math.max(1, dimensions.rows - 8)
  const visible_messages = messages.slice(-transcript_capacity)

  return (
    <Box
      flexDirection="column"
      height={dimensions.rows}
      width={dimensions.columns}
      paddingX={1}
    >
      <Header />
      <Box flexDirection="column" flexGrow={1}>
        {visible_messages.map((message, index) => (
          <MessageLine key={index} message={message} />
        ))}
      </Box>
      {renderActive()}
    </Box>
  )

  function renderActive(): React.ReactElement | null {
    switch (phase.t) {
      case "init":
        return <Pending label="Checking for an existing key…" />
      case "method":
        return (
          <Prompt title="How do you want to connect your Seam account?">
            <SelectInput
              items={[
                { label: "Continue in your browser  (create a key in the Console)", value: "browser" },
                { label: "Paste an API key  (if you already have one)", value: "paste" },
              ]}
              onSelect={(item) => {
                if (item.value === "paste") {
                  attempt_ref.current = 0
                  setPhase({ t: "paste" })
                } else {
                  setPhase({ t: "browser" })
                }
              }}
            />
          </Prompt>
        )
      case "browser":
        return (
          <Box flexDirection="column">
            <Pending label={browser.received ? "Verifying the key…" : "Waiting for you to finish in the browser…"} />
            {browser.url != null && <Text color="gray">  {browser.url}</Text>}
          </Box>
        )
      case "paste":
        return (
          <Prompt title="Paste your Seam API key (from Console → Settings → API Keys)">
            <Box>
              <Text color="cyan">{"› "}</Text>
              <TextInput
                value={paste_value}
                onChange={setPasteValue}
                mask="*"
                placeholder="seam_…"
                onSubmit={(value) => {
                  if (!looksLikeSeamApiKey(value)) {
                    setPasteError("That doesn't look like a Seam key (expected seam_…).")
                    return
                  }
                  setPasteError(null)
                  attempt_ref.current += 1
                  setPhase({ t: "verify-paste", api_key: value })
                }}
              />
            </Box>
            {paste_error != null && <Text color="red">  {paste_error}</Text>}
          </Prompt>
        )
      case "verify-paste":
        return <Pending label="Verifying your key with Seam…" />
      case "sdk":
        return (
          <Prompt title="Which SDK are you using?">
            <SelectInput
              items={[
                { label: "JavaScript / TypeScript", value: "javascript" },
                { label: "Python", value: "python" },
              ]}
              onSelect={(item) => {
                const chosen: Sdk = item.value === "python" ? "python" : "javascript"
                setSdk(chosen)
                addMessage({ tone: "info", text: `SDK: ${chosen}` })
                setPhase({ t: "install-sdk" })
              }}
            />
          </Prompt>
        )
      case "install-sdk":
        return (
          <Box flexDirection="column">
            <Pending label="Installing the Seam SDK…" />
            {install_lines.map((line, index) => (
              <Text key={index} color="gray">  {line}</Text>
            ))}
          </Box>
        )
      case "install-plugin":
        return (
          <Box flexDirection="column">
            <Pending label="Installing the Seam plugin…" />
            {install_lines.map((line, index) => (
              <Text key={index} color="gray">  {line}</Text>
            ))}
          </Box>
        )
      case "offer-integrate":
        return (
          <Prompt title="Want the wizard to write your Seam integration now?">
            <SelectInput
              items={[
                { label: "Yes — the agent reads my project and writes it", value: "yes" },
                { label: "No thanks, I'll do it myself", value: "no" },
              ]}
              onSelect={(item) => {
                if (item.value === "yes") setPhase({ t: "analyze" })
                else finishWithNextSteps()
              }}
            />
          </Prompt>
        )
      case "analyze":
        return <Pending label="Analyzing your project…" />
      case "integrate-mode": {
        const recommended: BuildMode = mode ?? "full_api"
        const portal_item = {
          label: "Customer Portal — Seam hosts the UI (you call ~2 endpoints)",
          value: "customer_portal",
        }
        const api_item = {
          label: "Full API control — you build the UI, wire up the API",
          value: "full_api",
        }
        const items =
          recommended === "customer_portal"
            ? [portal_item, api_item]
            : [api_item, portal_item]
        return (
          <Prompt title="How do you want to integrate Seam?">
            {analysis?.recommendation.rationale != null &&
              analysis.recommendation.rationale.length > 0 && (
                <Text color="gray">{`  ${analysis.recommendation.rationale}`}</Text>
              )}
            <SelectInput
              items={items}
              onSelect={(item) => {
                const chosen: BuildMode =
                  item.value === "customer_portal" ? "customer_portal" : "full_api"
                setMode(chosen)
                addMessage({
                  tone: "info",
                  text: `Mode: ${
                    chosen === "customer_portal" ? "Customer Portal" : "Full API"
                  }`,
                })
                setPhase(chosen === "customer_portal" ? { t: "note" } : { t: "checklist" })
              }}
            />
          </Prompt>
        )
      }
      case "checklist":
        return (
          <Prompt title="What should the integration include? (space to toggle)">
            <CheckboxList
              items={[...CORE_BLOCKS, ...COMMON_BLOCKS].map((block) => ({
                id: block.id,
                label: block.label,
                group: block.group,
              }))}
              initial_selected={selections}
              onSubmit={(chosen) => {
                setSelections(chosen)
                setPhase({ t: "note" })
              }}
            />
          </Prompt>
        )
      case "note":
        return (
          <Prompt title="Anything else to add? (optional — Enter to skip)">
            <Box>
              <Text color="cyan">{"› "}</Text>
              <TextInput
                value={note_value}
                onChange={setNoteValue}
                placeholder="e.g. wire it into the checkout page"
                onSubmit={(value) => startIntegration(value)}
              />
            </Box>
          </Prompt>
        )
      case "integrate":
        return (
          <Box flexDirection="column">
            <Pending label="Writing your Seam integration…" />
            {agent_lines.map((line, index) => (
              <Text key={index} color="gray">  {line}</Text>
            ))}
          </Box>
        )
      case "done":
      case "error":
        return null
    }
  }
}

function pushNextSteps(
  addMessage: (message: Msg) => void,
  sdk: Sdk | null,
  workspace_name: string
): void {
  const env_hint =
    sdk === "python"
      ? "Make sure SEAM_API_KEY is exported (it's in .env)."
      : "Add .env to .gitignore — it holds your API key."
  addMessage({ tone: "plain", text: "" })
  addMessage({ tone: "ok", text: `You're set up in ${workspace_name}` })
  addMessage({ tone: "plain", text: "Next steps:" })
  addMessage({
    tone: "plain",
    text: '  1. Describe your integration to your AI assistant — e.g. "add Seam access grants". The Seam skill will guide it.',
  })
  addMessage({ tone: "plain", text: `  2. ${env_hint}` })
  addMessage({ tone: "plain", text: "  3. Docs: https://docs.seam.co" })
}

function truncate(text: string, max_length: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim()
  return collapsed.length > max_length
    ? `${collapsed.slice(0, max_length - 1)}…`
    : collapsed
}

// A compact one-line label for a tool the agent just invoked.
function formatTool(name: string, detail: string): string {
  const verb =
    name === "Write"
      ? "write"
      : name === "Edit"
        ? "edit"
        : name === "Read"
          ? "read"
          : name === "Glob" || name === "Grep"
            ? "search"
            : name === "WebFetch"
              ? "fetch"
              : name.startsWith("mcp__seam-docs__")
                ? "docs"
                : name
  return detail.length > 0 ? `${verb} ${truncate(detail, 60)}` : verb
}

function Header(): React.ReactElement {
  return (
    <Box marginBottom={1}>
      <Text backgroundColor="cyan" color="black" bold>
        {" Seam setup wizard "}
      </Text>
    </Box>
  )
}

// Plain-text rendering of a message, matching MessageLine's symbols — used to
// reprint the transcript into the normal terminal after the alt screen closes.
function formatMessageLine(message: Msg): string {
  if (message.tone === "plain") return message.text
  const symbol =
    message.tone === "ok" ? "✔" : message.tone === "warn" ? "▲" : "•"
  return `${symbol} ${message.text}`
}

function MessageLine({ message }: { message: Msg }): React.ReactElement {
  if (message.tone === "plain") return <Text>{message.text}</Text>
  const symbol = message.tone === "ok" ? "✔" : message.tone === "warn" ? "▲" : "•"
  const color = message.tone === "ok" ? "green" : message.tone === "warn" ? "yellow" : "cyan"
  return (
    <Text>
      <Text color={color}>{symbol}</Text> {message.text}
    </Text>
  )
}

function Pending({ label }: { label: string }): React.ReactElement {
  return (
    <Text>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>{" "}
      {label}
    </Text>
  )
}

function Prompt({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>{title}</Text>
      {children}
    </Box>
  )
}
