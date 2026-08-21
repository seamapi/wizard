import { expect, test } from 'vitest'

import { evaluateGates } from './gates.js'

test('evaluateGates: passes a clean integration', () => {
  const gates = evaluateGates({
    changedFiles: ['lib/seam.ts', 'app/reservations/page.tsx'],
    diff: "+import { Seam } from 'seam'",
  })
  expect(gates).toEqual({
    envUntouched: true,
    seamImported: true,
    noStandalonePage: true,
  })
})

test('evaluateGates: flags a touched .env', () => {
  const gates = evaluateGates({
    changedFiles: ['.env', 'lib/seam.ts'],
    diff: "import { Seam } from 'seam'",
  })
  expect(gates.envUntouched).toBe(false)
})

test('evaluateGates: flags a missing seam import', () => {
  const gates = evaluateGates({
    changedFiles: ['lib/notes.ts'],
    diff: '+const x = 1',
  })
  expect(gates.seamImported).toBe(false)
})

test('evaluateGates: detects the require() form of the seam import', () => {
  const gates = evaluateGates({
    changedFiles: ['lib/seam.js'],
    diff: "const { Seam } = require('seam')",
  })
  expect(gates.seamImported).toBe(true)
})

test('evaluateGates: flags a standalone Seam-only page', () => {
  const gates = evaluateGates({
    changedFiles: ['app/seam/page.tsx'],
    diff: "import { Seam } from 'seam'",
  })
  expect(gates.noStandalonePage).toBe(false)
})

test('evaluateGates: an existing page that merely mentions seam is fine', () => {
  const gates = evaluateGates({
    changedFiles: ['app/reservations/page.tsx'],
    diff: "import { Seam } from 'seam'",
  })
  expect(gates.noStandalonePage).toBe(true)
})
