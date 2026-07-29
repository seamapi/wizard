import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  blockById,
  composeGoal,
  type OnboardingRecord,
  writeOnboardingRecord,
} from './build-plan.js'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seam-wizard-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const hintFor = (id: string): string => {
  const block = blockById(id)
  if (block == null) throw new Error(`Missing build block: ${id}`)
  return block.agent_hint
}

const hintLines = (goal: string): string[] =>
  goal.split('\n').filter((line) => line.startsWith('- '))

test('blockById: finds a core block', () => {
  expect(blockById('access_grants')).toMatchObject({
    id: 'access_grants',
    group: 'Core',
  })
})

test('blockById: finds a common block', () => {
  expect(blockById('webhooks')).toMatchObject({
    id: 'webhooks',
    group: 'Common',
  })
})

test('blockById: returns undefined for an unknown id', () => {
  expect(blockById('not_a_block')).toBeUndefined()
})

test('composeGoal: describes the Customer Portal for customer_portal', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    selections: [],
    note: null,
    framework: null,
  })

  expect(goal).toContain('Customer Portal')
})

test('composeGoal: ignores selections for customer_portal', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    selections: ['access_codes', 'webhooks'],
    note: null,
    framework: null,
  })

  expect(goal).not.toContain(hintFor('access_codes'))
  expect(hintLines(goal)).toEqual([])
})

test('composeGoal: includes the agent hint of each selected block for full_api', () => {
  const goal = composeGoal({
    mode: 'full_api',
    selections: ['connect_device', 'webhooks'],
    note: null,
    framework: null,
  })

  expect(hintLines(goal)).toEqual([
    `- ${hintFor('connect_device')}`,
    `- ${hintFor('webhooks')}`,
  ])
})

test('composeGoal: skips unknown block ids for full_api', () => {
  const goal = composeGoal({
    mode: 'full_api',
    selections: ['not_a_block', 'access_grants'],
    note: null,
    framework: null,
  })

  expect(hintLines(goal)).toEqual([`- ${hintFor('access_grants')}`])
})

test('composeGoal: names the framework when given', () => {
  const goal = composeGoal({
    mode: 'full_api',
    selections: ['access_grants'],
    note: null,
    framework: 'Next.js',
  })

  expect(goal).toContain("Next.js's conventions")
})

test('composeGoal: falls back to a generic phrase without a framework', () => {
  const goal = composeGoal({
    mode: 'full_api',
    selections: ['access_grants'],
    note: null,
    framework: null,
  })

  expect(goal).toContain("the project's conventions")
})

test('composeGoal: names the framework for customer_portal too', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    selections: [],
    note: null,
    framework: 'Django',
  })

  expect(goal).toContain("Django's conventions")
})

test('composeGoal: appends the developer note', () => {
  const goal = composeGoal({
    mode: 'full_api',
    selections: ['access_grants'],
    note: '  Use the existing service layer.  ',
    framework: null,
  })

  expect(goal).toContain(
    'Additional context from the developer: Use the existing service layer.',
  )
})

test('composeGoal: omits the note when it is null', () => {
  const goal = composeGoal({
    mode: 'full_api',
    selections: ['access_grants'],
    note: null,
    framework: null,
  })

  expect(goal).not.toContain('Additional context from the developer')
})

test('composeGoal: omits the note when it is only whitespace', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    selections: [],
    note: '   \n  ',
    framework: null,
  })

  expect(goal).not.toContain('Additional context from the developer')
})

const exampleRecord: Omit<OnboardingRecord, 'schema_version'> = {
  created_at: '2026-07-29T00:00:00.000Z',
  mode: 'full_api',
  selections: ['access_grants'],
  note: null,
  goal: 'Set up a Seam integration.',
  analysis: {
    sdk: 'javascript',
    framework: 'Next.js',
    app_type_guess: 'property management',
    seam_already_setup: false,
    used_onboarding: true,
    recommendation_source: 'llm',
  },
}

test('writeOnboardingRecord: writes the record to .seam/onboarding.json', () => {
  writeOnboardingRecord(dir, exampleRecord)

  const contents = readFileSync(join(dir, '.seam', 'onboarding.json'), 'utf8')
  expect(JSON.parse(contents)).toEqual({
    schema_version: 1,
    ...exampleRecord,
  })
})

test('writeOnboardingRecord: ends the file with a trailing newline', () => {
  writeOnboardingRecord(dir, exampleRecord)

  const contents = readFileSync(join(dir, '.seam', 'onboarding.json'), 'utf8')
  expect(contents.endsWith('}\n')).toBe(true)
})

test('writeOnboardingRecord: keeps an optional result in the record', () => {
  writeOnboardingRecord(dir, {
    ...exampleRecord,
    result: { ok: true, files_summary: 'Added src/seam.ts', cost_usd: 0.42 },
  })

  const contents = readFileSync(join(dir, '.seam', 'onboarding.json'), 'utf8')
  expect(JSON.parse(contents)).toMatchObject({
    schema_version: 1,
    result: { ok: true, files_summary: 'Added src/seam.ts', cost_usd: 0.42 },
  })
})
