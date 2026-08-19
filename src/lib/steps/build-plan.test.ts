import { expect, test } from 'vitest'

import { blockById, buildIntegrationSteps, composeGoal } from './build-plan.js'

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

test('buildIntegrationSteps: customer_portal is a single step', () => {
  const steps = buildIntegrationSteps({
    mode: 'customer_portal',
    selections: [],
    note: null,
    framework: 'Next.js',
  })

  expect(steps).toHaveLength(1)
  expect(steps[0]?.id).toBe('customer_portal')
  expect(steps[0]?.goal).toContain('Customer Portal')
})

test('buildIntegrationSteps: full_api orders steps canonically, not by selection order', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    selections: ['webhooks', 'connect_device', 'access_grants'],
    note: null,
    framework: 'Next.js',
  })

  // ALL_BLOCKS order: connect_device, access_grants, …, webhooks
  expect(steps.map((step) => step.id)).toEqual([
    'connect_device',
    'access_grants',
    'webhooks',
  ])
})

test('buildIntegrationSteps: each step goal carries its block hint', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    selections: ['access_grants'],
    note: null,
    framework: 'Next.js',
  })

  expect(steps[0]?.label).toBe(blockById('access_grants')?.label)
  expect(steps[0]?.goal).toContain(hintFor('access_grants'))
})

test('buildIntegrationSteps: skips unknown block ids', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    selections: ['not_a_block', 'user_identities'],
    note: null,
    framework: null,
  })

  expect(steps.map((step) => step.id)).toEqual(['user_identities'])
})

test('buildIntegrationSteps: appends the developer note to each step', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    selections: ['connect_device'],
    note: '  Use the existing service layer.  ',
    framework: null,
  })

  expect(steps[0]?.goal).toContain(
    'Additional context from the developer: Use the existing service layer.',
  )
})
