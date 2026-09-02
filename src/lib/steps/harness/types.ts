// The agent-runner seam. runIntegration owns the orchestration shared by every
// harness — the budget loop, per-step lifecycle events, summaries, and the done
// event. A harness owns only the agent loop and model transport for a single
// step: it runs the goal, streams text/tool activity back, and returns the
// outcome. `anthropic` (the Claude Agent SDK) is the control; `pi` (pi.dev) is
// the challenger. The active one is chosen by resolveHarness in switchboard.ts.

export interface StepRunResult {
  ok: boolean
  summary: string
  costUsd: number | null
}

export interface HarnessRunStepArgs {
  // The step's goal prompt, the project dir it runs in, and the model to use
  // (chosen per mode by the caller).
  goal: string
  cwd: string
  model: string
  // Dollars still left in this run; the harness caps its spend to this.
  maxBudgetUsd: number
  // System-prompt append and the child-process env (points inference at the
  // Seam proxy), both built once by the caller and shared across steps. The
  // anthropic harness uses agentEnv (child-process env); the pi harness uses
  // inference directly to register a provider — both point at the Seam proxy.
  systemAppend: string
  agentEnv: Record<string, string>
  inference: { base_url: string; token: string }
  signal: AbortSignal
  abortController: AbortController
  // Stream callbacks so the harness stays decoupled from the IntegrateEvent
  // union: thinking, assistant prose, tool activity, and turn timings.
  onThinking: (text: string) => void
  onText: (text: string) => void
  onTool: (name: string, detail: string) => void
  onToolDone: (name: string, detail: string, elapsedMs: number) => void
  onTurnDone: (index: number, elapsedMs: number) => void
}

export interface Harness {
  readonly name: string
  // Runs one step to completion. Resolves with the outcome; throws on failure
  // (max turns, overload, transport error) — runIntegration catches and maps it.
  runStep(args: HarnessRunStepArgs): Promise<StepRunResult>
}
