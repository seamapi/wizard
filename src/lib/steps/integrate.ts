import type { ProjectStepResult } from 'lib/store/project-store.js'

import type { IntegrationStep } from './build-plan.js'
import type { Sdk } from './detect-project.js'
import { resolveHarness } from './harness/switchboard.js'

export type IntegrateEvent =
  // Per-step lifecycle — one set per step, in order. `index` is 0-based, `total`
  // is the step count, so the UI can show "label (index+1/total)" and a checklist.
  | {
      kind: 'step_start'
      id: string
      label: string
      index: number
      total: number
    }
  | {
      kind: 'step_done'
      id: string
      index: number
      total: number
      cost_usd: number | null
    }
  | {
      kind: 'step_failed'
      id: string
      index: number
      total: number
      reason: string
    }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | {
      kind: 'done'
      ok: boolean
      summary: string
      cost_usd: number | null
      steps: ProjectStepResult[]
    }

export interface RunIntegrationArgs {
  root: string
  sdk: Sdk
  workspace_name: string
  // The integration is run one step at a time (one agent pass per step), so a
  // long run reads as discrete progress rather than one opaque call.
  steps: IntegrationStep[]
  inference: { base_url: string; token: string }
  // The detected framework + chosen mode, so the agent fetches the matching
  // reference app from the Seam MCP (get_example_app) to model its work on.
  framework?: string | null
  mode?: 'full_api' | 'customer_portal'
  signal: AbortSignal
  onEvent: (event: IntegrateEvent) => void
}

// Overall dollar ceiling across all steps of one run. Each step is given the
// budget still remaining, so N steps can never sum past this.
const OVERALL_BUDGET_USD = 100

// Drive the Claude Agent SDK to write the integration into the developer's
// project, routed through Seam-hosted inference — one agent pass per step, in
// order. Steps share the cwd (files persist) and env, so a later step reads and
// builds on what earlier ones wrote. Streams progress via onEvent; resolves when
// the run finishes or the signal aborts.
export async function runIntegration(args: RunIntegrationArgs): Promise<void> {
  const {
    root,
    sdk,
    workspace_name: workspaceName,
    steps,
    inference,
    framework,
    mode,
    signal,
    onEvent,
  } = args
  const abortController = new AbortController()
  const forwardAbort = (): void => abortController.abort()
  signal.addEventListener('abort', forwardAbort, { once: true })

  const systemAppend = buildSystemAppend(sdk, workspaceName, framework, mode)
  const agentEnv = buildAgentEnv(inference)
  // Customer Portal is the simple path (the app calls ~2 endpoints), so it runs
  // on the faster Sonnet; full API control does more and runs on Opus.
  const model =
    mode === 'customer_portal' ? 'claude-sonnet-5' : 'claude-opus-4-8'
  // Which agent backend drives the run (Claude Agent SDK by default).
  const harness = resolveHarness()

  let totalCostUsd = 0
  let allOk = true
  const summaries: string[] = []
  // Per-step outcome, seeded as "skipped" and updated as each step resolves, so
  // the run record lists every step even after an early stop.
  const stepResults: ProjectStepResult[] = steps.map(
    (step): ProjectStepResult => ({
      id: step.id,
      label: step.label,
      status: 'skipped',
      cost_usd: null,
      summary: '',
    }),
  )

  try {
    for (const [index, step] of steps.entries()) {
      if (signal.aborted) break

      const remainingBudgetUsd = OVERALL_BUDGET_USD - totalCostUsd
      if (remainingBudgetUsd <= 0) {
        allOk = false
        summaries.push(`Skipped "${step.label}" — inference budget exhausted.`)
        stepResults[index] = {
          id: step.id,
          label: step.label,
          status: 'skipped',
          cost_usd: null,
          summary: 'inference budget exhausted',
        }
        onEvent({
          kind: 'step_failed',
          id: step.id,
          index,
          total: steps.length,
          reason: 'inference budget exhausted',
        })
        break
      }

      onEvent({
        kind: 'step_start',
        id: step.id,
        label: step.label,
        index,
        total: steps.length,
      })

      let stepOk = false
      let stepSummary = ''
      let stepCostUsd: number | null = null
      let stepFailReason: string | null = null

      try {
        const result = await harness.runStep({
          goal: step.goal,
          cwd: root,
          model,
          maxBudgetUsd: remainingBudgetUsd,
          systemAppend,
          agentEnv,
          inference,
          signal,
          abortController,
          onText: (text) => onEvent({ kind: 'text', text }),
          onTool: (name, detail) => onEvent({ kind: 'tool', name, detail }),
        })
        stepOk = result.ok
        stepSummary = result.summary
        stepCostUsd = result.costUsd
        if (result.costUsd != null) totalCostUsd += result.costUsd
      } catch (error) {
        // The SDK throws on failure (max turns, overload/529, …). Catch it per
        // step so the run stops gracefully — marks this step failed and still
        // records what earlier steps completed — instead of an opaque crash.
        stepFailReason = describeStepError(error)
      }

      if (signal.aborted) break

      if (stepSummary.trim().length > 0) {
        summaries.push(
          steps.length > 1 ? `${step.label}:\n${stepSummary}` : stepSummary,
        )
      }
      if (stepOk) {
        stepResults[index] = {
          id: step.id,
          label: step.label,
          status: 'done',
          cost_usd: stepCostUsd,
          summary: stepSummary.slice(0, 500),
        }
        onEvent({
          kind: 'step_done',
          id: step.id,
          index,
          total: steps.length,
          cost_usd: stepCostUsd,
        })
      } else {
        // Stop the run on a failed step — later steps build on it. Surface which
        // step failed and why so the developer can re-run or finish by hand.
        allOk = false
        const reason = stepFailReason ?? 'the step did not complete'
        summaries.push(`${step.label}: stopped — ${reason}`)
        stepResults[index] = {
          id: step.id,
          label: step.label,
          status: 'failed',
          cost_usd: stepCostUsd,
          summary: reason,
        }
        onEvent({
          kind: 'step_failed',
          id: step.id,
          index,
          total: steps.length,
          reason,
        })
        break
      }
    }

    if (!signal.aborted) {
      onEvent({
        kind: 'done',
        ok: allOk,
        summary: summaries.join('\n\n'),
        cost_usd: totalCostUsd > 0 ? totalCostUsd : null,
        steps: stepResults,
      })
    }
  } finally {
    signal.removeEventListener('abort', forwardAbort)
  }
}

function buildSystemAppend(
  sdk: Sdk,
  workspaceName: string,
  framework?: string | null,
  mode?: 'full_api' | 'customer_portal',
): string {
  const language = sdk === 'python' ? 'Python' : 'JavaScript/TypeScript'
  const frameworkLabel = framework ?? "this project's framework"
  const modeLabel = mode === 'customer_portal' ? 'Customer Portal' : 'full-API'
  return [
    `You are the Seam integration agent, embedded in the seam-wizard CLI.`,
    `The developer has just connected their Seam account (workspace "${workspaceName}"),`,
    `and their SEAM_API_KEY is already saved in a local .env file. This is a ${language} project.`,
    ``,
    `Before writing any code:`,
    `- Fetch the reference integration: call mcp__seam-docs__list_example_apps, then`,
    `  mcp__seam-docs__get_example_app to pull the example matching ${frameworkLabel} and the`,
    `  ${modeLabel} approach. Model your integration on it — match its structure and Seam API`,
    `  usage — but ADAPT it to this project's actual framework version, conventions, and file`,
    `  layout. Do not copy it verbatim, and don't add files this project doesn't need.`,
    `- Find and read the installed Seam skill. Glob for a directory named like "*seam*" under`,
    `  .claude/skills and .agents/skills, and read its SKILL.md and any referenced files.`,
    `- Use the seam-docs MCP tools (prefixed mcp__seam-docs__) to confirm current Seam API usage.`,
    `  Prefer Access Grants for granting a person access — they are Seam's recommended API.`,
    `- Read the surrounding project files first and match its language, framework, and conventions.`,
    ``,
    ...(mode === 'customer_portal'
      ? []
      : [
          `This is a full-API integration: wire Seam into the app's EXISTING models, flows, and pages —`,
          `extend them, do not add standalone Seam-only pages. If the app has a reservation or booking`,
          `flow, create an Access Grant when a reservation is created (its guest as a User Identity, on`,
          `the reservation's space, over the stay window) and revoke it on cancellation by hooking the`,
          `existing create/update/delete handlers; map connected devices onto the app's spaces/units;`,
          `and surface the resulting access (such as the PIN code) on the existing reservation view.`,
          ``,
        ]),
    `Then implement exactly what the developer asked for — nothing more. Load SEAM_API_KEY from the`,
    `existing .env; never hardcode or print it. Keep changes minimal and idiomatic. When finished,`,
    `give a short summary of the files you changed and how to run the result.`,
  ].join('\n')
}

// Route the embedded agent through Seam-hosted inference: point the SDK at the
// Seam proxy with the scoped wizard token, and drop any developer Anthropic key
// so it can't override the proxy routing. The SDK reads credentials from the
// child-process env (ANTHROPIC_AUTH_TOKEN is sent as a Bearer, which is what the
// proxy authenticates).
function buildAgentEnv(inference: {
  base_url: string
  token: string
}): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) env[key] = value
  }
  delete env['ANTHROPIC_API_KEY']
  env['ANTHROPIC_BASE_URL'] = inference.base_url
  env['ANTHROPIC_AUTH_TOKEN'] = inference.token
  return env
}

// Turn a caught step error into a short, provider-neutral reason for the UI.
// Overload (529/503) is the common transient case, with its own friendly copy;
// other errors are sanitized of the provider name and trimmed.
function describeStepError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  if (/overload|\b529\b|\b503\b/i.test(raw)) {
    return 'Seam AI is overloaded — wait a minute and re-run the wizard'
  }
  const sanitized = raw.replace(/Claude Code|Claude/g, 'Seam AI')
  return sanitized.length > 200 ? `${sanitized.slice(0, 200)}…` : sanitized
}
