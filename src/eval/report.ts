import type { CaseResult } from './types.js'

// A compact fixed-width table of every case, grouped so an A/B (anthropic vs pi)
// reads down the harness column. Deterministic — no timestamps — so it can be
// snapshot-tested.
export function formatReport(results: CaseResult[]): string {
  const header = [
    pad('fixture', 20),
    pad('mode', 16),
    pad('harness', 10),
    pad('ok', 4),
    pad('gates', 7),
    pad('score', 6),
    pad('cost', 8),
    pad('time', 6),
  ].join(' ')

  const rows = results.map((result) => {
    const gatesPassed = Object.values(result.gates).filter(Boolean).length
    const gatesTotal = Object.values(result.gates).length
    return [
      pad(result.fixture, 20),
      pad(result.mode, 16),
      pad(result.harness, 10),
      pad(result.ok ? 'yes' : 'no', 4),
      pad(`${gatesPassed}/${gatesTotal}`, 7),
      pad(result.score == null ? 'n/a' : result.score.total.toFixed(2), 6),
      pad(result.costUsd == null ? 'n/a' : `$${result.costUsd.toFixed(2)}`, 8),
      pad(`${result.elapsedSec}s`, 6),
    ].join(' ')
  })

  return [header, '-'.repeat(header.length), ...rows].join('\n')
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text.padEnd(width)
}
