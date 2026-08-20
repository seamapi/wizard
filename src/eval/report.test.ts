import { expect, test } from 'vitest'

import { formatReport } from './report.js'
import type { CaseResult } from './types.js'

const baseResult: CaseResult = {
  fixture: 'nextjs-rentals',
  mode: 'full_api',
  harness: 'anthropic',
  ok: true,
  costUsd: 2.59,
  elapsedSec: 132,
  changedFiles: ['lib/seam.ts'],
  diff: '',
  gates: {
    envUntouched: true,
    seamImported: true,
    noStandalonePage: true,
  },
}

test('formatReport: renders a header and one row per case', () => {
  const report = formatReport([
    baseResult,
    { ...baseResult, harness: 'pi', costUsd: null, ok: false },
  ])
  const lines = report.split('\n')
  // header + separator + 2 rows
  expect(lines).toHaveLength(4)
  expect(lines[0]).toContain('fixture')
  expect(lines[0]).toContain('harness')
})

test('formatReport: shows gate ratio, cost, ok, and n/a cost', () => {
  const report = formatReport([
    baseResult,
    { ...baseResult, harness: 'pi', costUsd: null, ok: false },
  ])
  expect(report).toContain('3/3')
  expect(report).toContain('$2.59')
  expect(report).toContain('n/a')
  expect(report).toContain('yes')
  expect(report).toContain('no')
})

test('formatReport: is deterministic (no timestamps)', () => {
  expect(formatReport([baseResult])).toBe(formatReport([baseResult]))
})
