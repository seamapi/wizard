import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  createMemoryAdapter,
  getAdapter,
  resetAdapter,
  setAdapter,
} from 'lib/adapter.js'

import {
  getProjectKey,
  type ProjectConnection,
  type ProjectPlan,
  readProjectRecord,
  recordConnection,
  recordPlan,
  recordResult,
} from './project-store.js'

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(resetAdapter)

const exampleConnection: ProjectConnection = {
  endpoint: 'https://connect.getseam.com',
  workspace_id: 'workspace-1',
  workspace_name: 'Acme',
  api_key: { digest: 'abcdef0123456789', hint: '1234' },
  api_key_source: 'project',
  api_key_location: '.env',
}

const examplePlan: ProjectPlan = {
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

test('recordConnection: keeps what the project was set up to talk to', async () => {
  await recordConnection('/projects/app', exampleConnection)

  expect(await readProjectRecord('/projects/app')).toMatchObject({
    schema_version: 2,
    connection: exampleConnection,
  })
})

test('recordConnection: never keeps the key itself', async () => {
  await recordConnection('/projects/app', exampleConnection)

  const written = JSON.stringify(
    await getAdapter().state.get(getProjectKey('/projects/app')),
  )
  expect(written).not.toContain('seam_')
  expect(written).toContain('1234')
})

test('recordPlan: adds to the record without dropping the connection', async () => {
  await recordConnection('/projects/app', exampleConnection)
  await recordPlan('/projects/app', examplePlan)

  expect(await readProjectRecord('/projects/app')).toMatchObject({
    connection: exampleConnection,
    plan: examplePlan,
  })
})

test('recordResult: adds to the record without dropping the plan', async () => {
  await recordPlan('/projects/app', examplePlan)
  await recordResult('/projects/app', {
    ok: true,
    files_summary: 'Added src/seam.ts',
    cost_usd: 0.42,
  })

  expect(await readProjectRecord('/projects/app')).toMatchObject({
    plan: examplePlan,
    result: { ok: true, files_summary: 'Added src/seam.ts', cost_usd: 0.42 },
  })
})

test('recordConnection: replaces what an earlier run recorded', async () => {
  await recordConnection('/projects/app', exampleConnection)
  await recordConnection('/projects/app', {
    ...exampleConnection,
    workspace_name: 'Other',
  })

  expect(await readProjectRecord('/projects/app')).toMatchObject({
    connection: { workspace_name: 'Other' },
  })
})

test('recordConnection: keeps when the project was first set up', async () => {
  await recordConnection('/projects/app', exampleConnection)
  const first = await readProjectRecord('/projects/app')

  await recordPlan('/projects/app', examplePlan)
  const second = await readProjectRecord('/projects/app')

  expect(second?.created_at).toBe(first?.created_at)
  expect(second?.updated_at).not.toBeUndefined()
})

test('readProjectRecord: is null for a project with no record', async () => {
  expect(await readProjectRecord('/projects/other')).toBeNull()
})

test('readProjectRecord: is null for a record the host cannot have written', async () => {
  await getAdapter().state.set(getProjectKey('/projects/app'), 'not a record')

  expect(await readProjectRecord('/projects/app')).toBeNull()
})

test('readProjectRecord: is null for a record written by another schema', async () => {
  await getAdapter().state.set(getProjectKey('/projects/app'), {
    schema_version: 1,
    created_at: '2026-07-29T00:00:00.000Z',
    goal: 'Set up a Seam integration.',
  })

  expect(await readProjectRecord('/projects/app')).toBeNull()
})

test('getProjectKey: names the key after the project', () => {
  expect(getProjectKey('/projects/My App')).toMatch(
    /^projects\.my-app-[0-9a-f]{10}$/,
  )
})

test('getProjectKey: is the same key for the same project', () => {
  expect(getProjectKey('/projects/app')).toBe(getProjectKey('/projects/app/'))
})

test('getProjectKey: separates projects with the same name', () => {
  expect(getProjectKey('/one/app')).not.toBe(getProjectKey('/two/app'))
})

test('getProjectKey: names a key for a project at the root', () => {
  expect(getProjectKey('/')).toMatch(/^projects\.project-[0-9a-f]{10}$/)
})
