import { evaluateGates } from './gates.js'
import type { CaseResult, EvalCase, FixtureConfig } from './types.js'
import { captureDiff, prepareFixture } from './workspace.js'

// What a runner reports back. Kept minimal so a test can supply a fake that just
// writes a file into workDir, with no model calls.
export interface RunOutcome {
  ok: boolean
  costUsd: number | null
}

export interface RunContext {
  config: FixtureConfig
  signal: AbortSignal
}

// Drives one case: writes the integration into a fresh copy of the fixture (via
// `runner`) and returns the outcome plus the diff and the deterministic gates.
// The runner is injected so the pipeline is testable without the real agent.
export type CaseRunner = (
  workDir: string,
  spec: EvalCase,
  context: RunContext,
) => Promise<RunOutcome>

export async function runCase(args: {
  fixtureDir: string
  spec: EvalCase
  config: FixtureConfig
  signal: AbortSignal
  runner: CaseRunner
  now: () => number
}): Promise<CaseResult> {
  const { fixtureDir, spec, config, signal, runner, now } = args
  const workDir = prepareFixture(fixtureDir)
  const startedAt = now()

  let ok = false
  let costUsd: number | null = null
  let error: string | undefined
  try {
    const outcome = await runner(workDir, spec, { config, signal })
    ok = outcome.ok
    costUsd = outcome.costUsd
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }

  const elapsedSec = Math.round((now() - startedAt) / 1000)
  const { diff, changedFiles } = captureDiff(workDir)

  return {
    fixture: spec.fixture,
    mode: spec.mode,
    harness: spec.harness,
    ok,
    costUsd,
    elapsedSec,
    changedFiles,
    diff,
    gates: evaluateGates({ changedFiles, diff }),
    ...(error != null ? { error } : {}),
  }
}
