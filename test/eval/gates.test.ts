import { expect, test } from 'vitest'

import { evaluateGates } from 'eval/gates.js'

// A minimal added-lines diff wrapping one code line, as `git diff` would emit it.
function diffAdding(file: string, line: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    '--- /dev/null',
    `+++ b/${file}`,
    '@@ -0,0 +1 @@',
    `+${line}`,
  ].join('\n')
}

test('seamImported: recognizes the JavaScript import forms', () => {
  const esm = evaluateGates({
    changedFiles: ['seam.ts'],
    diff: diffAdding('seam.ts', "import { Seam } from 'seam'"),
  })
  const cjs = evaluateGates({
    changedFiles: ['seam.js'],
    diff: diffAdding('seam.js', "const { Seam } = require('seam')"),
  })
  expect(esm.seamImported).toBe(true)
  expect(cjs.seamImported).toBe(true)
})

test('seamImported: recognizes the Python import forms', () => {
  const fromImport = evaluateGates({
    changedFiles: ['seam_client.py'],
    diff: diffAdding('seam_client.py', 'from seam import Seam'),
  })
  const bareImport = evaluateGates({
    changedFiles: ['seam_client.py'],
    diff: diffAdding('seam_client.py', 'import seam'),
  })
  expect(fromImport.seamImported).toBe(true)
  expect(bareImport.seamImported).toBe(true)
})

test('seamImported: a lookalike package name does not count', () => {
  const gates = evaluateGates({
    changedFiles: ['app.py'],
    diff: diffAdding('app.py', 'import seamless'),
  })
  expect(gates.seamImported).toBe(false)
})

test('envUntouched: false when the diff touches a .env file', () => {
  expect(evaluateGates({ changedFiles: ['.env'], diff: '' }).envUntouched).toBe(
    false,
  )
  expect(
    evaluateGates({ changedFiles: ['config/.env'], diff: '' }).envUntouched,
  ).toBe(false)
  expect(
    evaluateGates({ changedFiles: ['app.ts'], diff: '' }).envUntouched,
  ).toBe(true)
})

test('noStandalonePage: false when a standalone Seam page is added', () => {
  expect(
    evaluateGates({ changedFiles: ['app/seam/page.tsx'], diff: '' })
      .noStandalonePage,
  ).toBe(false)
  expect(
    evaluateGates({ changedFiles: ['app/reservations/page.tsx'], diff: '' })
      .noStandalonePage,
  ).toBe(true)
})
