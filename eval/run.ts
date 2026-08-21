import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { exchangeWizardInferenceToken, getInferenceBaseUrl } from 'lib/api.js'
import type { BuildMode } from 'lib/steps/build-plan.js'

import { createRealRunner } from './real-runner.js'
import { formatReport } from './report.js'
import { runCase } from './run-case.js'
import { createLlmJudge } from './score.js'
import type { CaseResult, EvalCase, FixtureConfig } from './types.js'

// Where the fixture apps live (top-level, so tsc doesn't compile them).
const FIXTURES_DIR = join(process.cwd(), 'eval', 'fixtures')
const MODES: BuildMode[] = ['full_api', 'customer_portal']

// Run every fixture × mode on the active harness and print an A/B-ready table.
// Needs SEAM_API_KEY (a dev key) to mint an inference token; the run makes real
// model calls, so it costs money and takes minutes. The harness is selected by
// SEAM_WIZARD_HARNESS (default anthropic).
async function main(): Promise<void> {
  const apiKey = process.env['SEAM_API_KEY']
  if (apiKey == null || apiKey.length === 0) {
    write('Set SEAM_API_KEY (a dev key) to run the eval.')
    process.exitCode = 1
    return
  }

  const harness = process.env['SEAM_WIZARD_HARNESS'] ?? 'anthropic'
  const fixtures = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  if (fixtures.length === 0) {
    write(`No fixtures found in ${FIXTURES_DIR}.`)
    process.exitCode = 1
    return
  }

  const session = await exchangeWizardInferenceToken(apiKey)
  const runner = createRealRunner(session.token)
  const scorer = createLlmJudge({
    base_url: getInferenceBaseUrl(),
    token: session.token,
  })
  const controller = new AbortController()

  const results: CaseResult[] = []
  for (const fixture of fixtures) {
    const config = readFixtureConfig(fixture)
    for (const mode of MODES) {
      const spec: EvalCase = { fixture, mode, harness }
      write(`▶ ${fixture} · ${mode} · ${harness}`)
      const result = await runCase({
        fixtureDir: join(FIXTURES_DIR, fixture),
        spec,
        config,
        signal: controller.signal,
        runner,
        scorer,
        now: () => Date.now(),
      })
      results.push(result)
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
  process.stdout.write(`${message}\n`)
}

await main().catch((error: unknown) => {
  const { message } = error instanceof Error ? error : new Error(String(error))
  process.stderr.write(`Eval failed: ${message}\n`)
  process.exitCode = 1
})
