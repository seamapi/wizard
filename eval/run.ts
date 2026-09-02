import { randomUUID } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import parseArgs from 'minimist'

import { exchangeWizardInferenceToken, getInferenceBaseUrl } from 'lib/api.js'
import type { BuildMode } from 'lib/steps/build-plan.js'

import { createRealRunner, formatDuration } from './real-runner.js'
import { formatReport } from './report.js'
import { runCase } from './run-case.js'
import { createLlmJudge } from './score.js'
import type { CaseResult, EvalCase, FixtureConfig } from './types.js'

// Where the fixture apps live (top-level, so tsc doesn't compile them).
const FIXTURES_DIR = join(process.cwd(), 'eval', 'fixtures')
const MODES: BuildMode[] = ['full_api', 'customer_portal']
let logFile: string | null = null

// Flatten a repeated/comma-separated CLI flag into a list of values.
function toList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : value == null ? [] : [value]
  return raw
    .filter((entry): entry is string => typeof entry === 'string')
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

// Run every fixture × mode on the active harness and print an A/B-ready table.
// Needs SEAM_API_KEY (a dev key) to mint an inference token; the run makes real
// model calls, so it costs money and takes minutes. The harness is selected by
// SEAM_WIZARD_HARNESS (default anthropic).
async function main(): Promise<void> {
  // `--fixture a,b` / `--mode full_api` narrow the run to specific cases (each
  // real case costs money + minutes), else run every fixture × mode.
  const args = parseArgs(process.argv.slice(2), {
    string: ['fixture', 'mode'],
  })
  logFile = join(tmpdir(), `seam-wizard-eval-${randomUUID()}.log`)
  writeFileSync(logFile, '', { flag: 'wx', mode: 0o600 })
  write(`Logging to ${logFile}`)

  const apiKey = process.env['SEAM_API_KEY']
  if (apiKey == null || apiKey.length === 0) {
    write('Set SEAM_API_KEY (a dev key) to run the eval.')
    process.exitCode = 1
    return
  }

  const harness = process.env['SEAM_WIZARD_HARNESS'] ?? 'anthropic'

  const fixtureFilter = toList(args['fixture'])
  const modeFilter = toList(args['mode'])

  const allFixtures = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const fixtures =
    fixtureFilter.length > 0
      ? allFixtures.filter((fixture) => fixtureFilter.includes(fixture))
      : allFixtures
  const modes =
    modeFilter.length > 0
      ? MODES.filter((mode) => modeFilter.includes(mode))
      : MODES

  if (fixtures.length === 0) {
    const detail =
      fixtureFilter.length > 0
        ? ` matching --fixture ${fixtureFilter.join(',')} (have: ${allFixtures.join(', ') || 'none'})`
        : ` in ${FIXTURES_DIR}`
    write(`No fixtures${detail}.`)
    process.exitCode = 1
    return
  }
  if (modes.length === 0) {
    write(
      `No modes matching --mode ${modeFilter.join(',')} (have: ${MODES.join(', ')}).`,
    )
    process.exitCode = 1
    return
  }

  write(`Starting ${harness} eval…`)
  const tokenStartedAt = Date.now()
  const session = await exchangeWizardInferenceToken(apiKey)
  write(`Inference token ready${formatDuration(Date.now() - tokenStartedAt)}`)
  const runner = createRealRunner(session.token, write)
  const scorer = createLlmJudge({
    base_url: getInferenceBaseUrl(),
    token: session.token,
  })
  const controller = new AbortController()

  const results: CaseResult[] = []
  for (const fixture of fixtures) {
    const config = readFixtureConfig(fixture)
    for (const mode of modes) {
      const spec: EvalCase = { fixture, mode, harness }
      write(`▶ ${fixture} · ${mode} · ${harness}`)
      const result = await runCase({
        fixtureDir: join(FIXTURES_DIR, fixture),
        spec,
        config,
        signal: controller.signal,
        runner,
        scorer: async (input) => {
          write('  scoring diff…')
          const scoringStartedAt = Date.now()
          try {
            return await scorer(input)
          } finally {
            write(
              `  scoring finished${formatDuration(Date.now() - scoringStartedAt)}`,
            )
          }
        },
        now: () => Date.now(),
      })
      results.push(result)
      write(
        `  case ${result.ok ? 'complete' : 'failed'} · ${result.elapsedSec}s`,
      )
    }
  }

  write('')
  write(formatReport(results))

  // Surface why any case failed, so a `no` row is never a dead end.
  const failures = results.filter((result) => result.error != null)
  if (failures.length > 0) {
    write('')
    write('Failures:')
    for (const failure of failures) {
      write(
        `  ${failure.fixture} · ${failure.mode} · ${failure.harness}: ${failure.error}`,
      )
    }
  }
}

function readFixtureConfig(fixture: string): FixtureConfig {
  const path = join(FIXTURES_DIR, fixture, 'fixture.json')
  if (!existsSync(path)) {
    throw new Error(`Fixture ${fixture} is missing fixture.json`)
  }
  return JSON.parse(readFileSync(path, 'utf8')) as FixtureConfig
}

function write(message: string): void {
  const line = `${message}\n`
  process.stdout.write(line)
  if (logFile != null) appendFileSync(logFile, line)
}

await main().catch((error: unknown) => {
  const { message } = error instanceof Error ? error : new Error(String(error))
  const line = `Eval failed: ${message}\n`
  process.stderr.write(line)
  if (logFile != null) {
    try {
      appendFileSync(logFile, line)
    } catch {}
  }
  process.exitCode = 1
})
