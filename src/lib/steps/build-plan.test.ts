import { expect, test } from 'vitest'

import {
  blockById,
  buildIntegrationSteps,
  composeGoal,
  INTEGRATION_BLOCKS,
} from './build-plan.js'

const hintLines = (goal: string): string[] =>
  goal.split('\n').filter((line) => line.startsWith('- '))

test('blockById: finds an integration block', () => {
  expect(blockById('access_grants')).toMatchObject({ id: 'access_grants' })
})

test('blockById: returns undefined for an unknown id', () => {
  expect(blockById('not_a_block')).toBeUndefined()
})

test('INTEGRATION_BLOCKS: the fixed set is connect, grants, users, spaces', () => {
  expect(INTEGRATION_BLOCKS.map((block) => block.id)).toEqual([
    'connect_device',
    'access_grants',
    'user_identities',
    'spaces',
  ])
})

test('composeGoal: describes the Customer Portal for customer_portal', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    note: null,
    framework: null,
  })

  expect(goal).toContain('Customer Portal')
})

test('composeGoal: customer_portal lists no building-block hints', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    note: null,
    framework: null,
  })

  expect(hintLines(goal)).toEqual([])
})

test('composeGoal: full_api includes every fixed block hint', () => {
  const goal = composeGoal({ mode: 'full_api', note: null, framework: null })

  expect(hintLines(goal)).toEqual(
    INTEGRATION_BLOCKS.map((block) => `- ${block.agent_hint}`),
  )
})

test('composeGoal: names the framework when given', () => {
  const goal = composeGoal({
    mode: 'full_api',
    note: null,
    framework: 'Next.js',
  })

  expect(goal).toContain("Next.js's conventions")
})

test('composeGoal: falls back to a generic phrase without a framework', () => {
  const goal = composeGoal({ mode: 'full_api', note: null, framework: null })

  expect(goal).toContain("the project's conventions")
})

test('composeGoal: names the framework for customer_portal too', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    note: null,
    framework: 'Django',
  })

  expect(goal).toContain("Django's conventions")
})

test('composeGoal: appends the developer note', () => {
  const goal = composeGoal({
    mode: 'full_api',
    note: '  Use the existing service layer.  ',
    framework: null,
  })

  expect(goal).toContain(
    'Additional context from the developer: Use the existing service layer.',
  )
})

test('composeGoal: omits the note when it is null', () => {
  const goal = composeGoal({ mode: 'full_api', note: null, framework: null })

  expect(goal).not.toContain('Additional context from the developer')
})

test('composeGoal: omits the note when it is only whitespace', () => {
  const goal = composeGoal({
    mode: 'customer_portal',
    note: '   \n  ',
    framework: null,
  })

  expect(goal).not.toContain('Additional context from the developer')
})

test('buildIntegrationSteps: customer_portal is a single step', () => {
  const steps = buildIntegrationSteps({
    mode: 'customer_portal',
    note: null,
    framework: 'Next.js',
  })

  expect(steps).toHaveLength(1)
  expect(steps[0]?.id).toBe('customer_portal')
  expect(steps[0]?.goal).toContain('Customer Portal')
})

test('buildIntegrationSteps: full_api is one step per fixed block, in order', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    note: null,
    framework: 'Next.js',
  })

  expect(steps.map((step) => step.id)).toEqual(
    INTEGRATION_BLOCKS.map((block) => block.id),
  )
})

test('buildIntegrationSteps: each step goal carries its block hint', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    note: null,
    framework: 'Next.js',
  })

  for (const [index, block] of INTEGRATION_BLOCKS.entries()) {
    expect(steps[index]?.label).toBe(block.label)
    expect(steps[index]?.goal).toContain(block.agent_hint)
  }
})

test('buildIntegrationSteps: appends the developer note to each step', () => {
  const steps = buildIntegrationSteps({
    mode: 'full_api',
    note: '  Use the existing service layer.  ',
    framework: null,
  })

  for (const step of steps) {
    expect(step.goal).toContain(
      'Additional context from the developer: Use the existing service layer.',
    )
  }
})
