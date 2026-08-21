import type { BuildMode } from 'lib/steps/build-plan.js'
import type { Sdk } from 'lib/steps/detect-project.js'

// A fixture is a small sample app the wizard integrates into. Its fixture.json
// declares what the wizard would otherwise detect, so a run is deterministic.
export interface FixtureConfig {
  name: string
  sdk: Sdk
  framework: string | null
}

// One eval run: integrate `fixture` in `mode` on a given harness.
export interface EvalCase {
  fixture: string
  mode: BuildMode
  harness: string
}

// Deterministic gates — cheap checks that don't need a build, so they run for
// free on every case regardless of scoring.
export interface GateResults {
  // The integration must not touch the developer's .env (it reads the key from
  // there; it must never rewrite or commit it).
  envUntouched: boolean
  // The integration should actually import the Seam SDK somewhere.
  seamImported: boolean
  // It should extend existing pages, not drop a standalone Seam-only page.
  noStandalonePage: boolean
}

// A quality score from the judge: an overall 0–1 plus the per-dimension 0–1s
// keyed by rubric dimension id.
export interface ScoreResult {
  total: number
  dimensions: Record<string, number>
}

export interface CaseResult {
  fixture: string
  mode: BuildMode
  harness: string
  // Whether the integration run reported success (the agent finished cleanly).
  ok: boolean
  costUsd: number | null
  elapsedSec: number
  changedFiles: string[]
  diff: string
  gates: GateResults
  // The judge's quality score, when scoring ran (best-effort — omitted if the
  // judge was not provided or failed).
  score?: ScoreResult
  // Set when the run threw before producing a result.
  error?: string
}
