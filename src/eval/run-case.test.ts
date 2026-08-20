import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test } from 'vitest'

import { runCase } from './run-case.js'
import type { FixtureConfig } from './types.js'

const config: FixtureConfig = {
  name: 'demo',
  sdk: 'javascript',
  framework: 'Next.js',
}

// A source fixture on disk: one file the "integration" will extend.
function makeFixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'seam-eval-src-'))
  writeFileSync(join(dir, 'app.ts'), 'export const app = true\n')
  writeFileSync(join(dir, 'fixture.json'), JSON.stringify(config))
  return dir
}

// Advance a fake clock by 5s per call so elapsedSec is deterministic.
function fakeClock(): () => number {
  let t = 1000
  return () => {
    const now = t
    t += 5000
    return now
  }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

test('runCase: captures the diff + gates from what the runner writes', async () => {
  const fixtureDir = makeFixtureDir()
  const result = await runCase({
    fixtureDir,
    spec: { fixture: 'demo', mode: 'full_api', harness: 'anthropic' },
    config,
    signal: new AbortController().signal,
    now: fakeClock(),
    runner: async (workDir) => {
      writeFileSync(join(workDir, 'seam.ts'), "import { Seam } from 'seam'\n")
      return { ok: true, costUsd: 1.23 }
    },
  })

  expect(result.ok).toBe(true)
  expect(result.costUsd).toBe(1.23)
  expect(result.elapsedSec).toBe(5)
  expect(result.changedFiles).toContain('seam.ts')
  expect(result.gates.seamImported).toBe(true)
  expect(result.gates.envUntouched).toBe(true)
  expect(result.error).toBeUndefined()
})

test('runCase: records a thrown runner as an error, still captures gates', async () => {
  const fixtureDir = makeFixtureDir()
  const result = await runCase({
    fixtureDir,
    spec: { fixture: 'demo', mode: 'customer_portal', harness: 'pi' },
    config,
    signal: new AbortController().signal,
    now: fakeClock(),
    runner: async () => {
      throw new Error('agent exploded')
    },
  })

  expect(result.ok).toBe(false)
  expect(result.error).toBe('agent exploded')
  // Nothing was written, so seamImported is false but the pipeline still ran.
  expect(result.gates.seamImported).toBe(false)
  expect(result.changedFiles).toHaveLength(0)
})
