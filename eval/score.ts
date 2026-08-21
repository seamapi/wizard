import { callInferenceForText } from 'lib/api.js'
import type { BuildMode } from 'lib/steps/build-plan.js'

import { getRubric, type RubricDimension } from './rubric.js'
import type { ScoreResult } from './types.js'

// Scores one integration diff for quality. Pluggable so the LLM judge here can
// be swapped for a dedicated scorer (e.g. withpi) without touching the runner.
export type Scorer = (args: {
  goal: string
  diff: string
  mode: BuildMode
}) => Promise<ScoreResult>

// A cheap, fast model is plenty for grading against a concrete rubric.
const JUDGE_MODEL = 'claude-haiku-4-5'
// Cap the diff so a huge integration doesn't blow the judge's context.
const MAX_DIFF_CHARS = 40_000

// An LLM-as-judge scorer routed through the same Seam inference proxy the wizard
// uses (no new key or dependency). Reads the rubric for the mode, asks the model
// to rate each dimension 0–1, and returns the parsed scores.
export function createLlmJudge(inference: {
  base_url: string
  token: string
}): Scorer {
  return async ({ goal, diff, mode }) => {
    const rubric = getRubric(mode)
    const system =
      'You grade how well a code diff implements a requested Seam integration. ' +
      'Score each question from 0.0 (not at all) to 1.0 (fully). Judge only what ' +
      'the diff shows. Reply with ONLY a JSON object mapping each question id to ' +
      'its number, no prose.'
    const user = [
      'Integration goal:',
      goal,
      '',
      'Score these questions (id — question):',
      ...rubric.map((dimension) => `${dimension.id} — ${dimension.question}`),
      '',
      'Diff:',
      diff.length > MAX_DIFF_CHARS
        ? `${diff.slice(0, MAX_DIFF_CHARS)}\n… (diff truncated)`
        : diff,
      '',
      `Return exactly: {${rubric
        .map((dimension) => `"${dimension.id}": 0.0`)
        .join(', ')}}`,
    ].join('\n')

    const text = await callInferenceForText(inference, {
      model: JUDGE_MODEL,
      max_tokens: 500,
      system,
      user,
    })
    return parseJudgeResponse(text, rubric)
  }
}

// Parse the judge's JSON into per-dimension 0–1 scores + their average. Missing
// or non-numeric dimensions score 0; values are clamped to [0, 1]. `total` is 0
// when the rubric is empty.
export function parseJudgeResponse(
  text: string,
  rubric: RubricDimension[],
): ScoreResult {
  const parsed = extractJsonObject(text)
  const dimensions: Record<string, number> = {}
  for (const dimension of rubric) {
    dimensions[dimension.id] = clamp01(parsed?.[dimension.id])
  }
  const values = Object.values(dimensions)
  const total =
    values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length
  return { total, dimensions }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = /\{[\S\s]*\}/.exec(text)
  if (match == null) return null
  try {
    const parsed: unknown = JSON.parse(match[0])
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function clamp01(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
