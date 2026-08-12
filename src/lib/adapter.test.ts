import { afterEach, expect, test, vi } from 'vitest'

import {
  createMemoryAdapter,
  defaultEndpoint,
  getAdapter,
  getAuth,
  loadAuth,
  resetAdapter,
  setAdapter,
  type WizardAuth,
} from './adapter.js'

afterEach(resetAdapter)

const apiKeyLogin: WizardAuth = {
  endpoint: 'https://connect.example.com',
  apiKey: 'seam_apikey1_token',
  workspaceId: 'workspace-1',
}

test('adapter: runs logged out against an in-memory adapter by default', async () => {
  expect(await loadAuth()).toEqual({
    endpoint: defaultEndpoint,
    apiKey: null,
    workspaceId: null,
  })
})

test('adapter: keeps values for the run and nothing beyond it', async () => {
  await getAdapter().config.set('sdk', 'python')
  expect(await getAdapter().config.get('sdk')).toBe('python')

  resetAdapter()
  expect(await getAdapter().config.get('sdk')).toBeUndefined()
})

test('adapter: keeps config apart from state', async () => {
  await getAdapter().config.set('sdk', 'python')

  expect(await getAdapter().state.get('sdk')).toBeUndefined()
})

test('adapter: uses the auth the host answers with', async () => {
  setAdapter(createMemoryAdapter({ auth: apiKeyLogin }))

  expect(await loadAuth()).toEqual(apiKeyLogin)
  expect(getAuth()).toEqual(apiKeyLogin)
})

test('adapter: asks the adapter who the developer is once', async () => {
  const getAuthSpy = vi.fn(async () => apiKeyLogin)
  setAdapter({ ...createMemoryAdapter(), getAuth: getAuthSpy })

  await loadAuth()
  await loadAuth()

  expect(getAuthSpy).toHaveBeenCalledTimes(1)
})

test('adapter: is logged out until the auth has been loaded', () => {
  setAdapter(createMemoryAdapter({ auth: apiKeyLogin }))

  expect(getAuth().apiKey).toBeNull()
  expect(getAuth().endpoint).toBe(defaultEndpoint)
})

test('adapter: forgets the auth loaded for a previous adapter', async () => {
  setAdapter(createMemoryAdapter({ auth: apiKeyLogin }))
  await loadAuth()

  setAdapter(createMemoryAdapter())

  expect(await loadAuth()).toMatchObject({ apiKey: null })
})

test('adapter: starts from the values it was created with', async () => {
  setAdapter(
    createMemoryAdapter({
      config: { sdk: 'javascript' },
      state: { 'projects.app-1234567890': { goal: 'Set up Seam.' } },
    }),
  )

  expect(await getAdapter().config.get('sdk')).toBe('javascript')
  expect(await getAdapter().state.get('projects.app-1234567890')).toEqual({
    goal: 'Set up Seam.',
  })
})
