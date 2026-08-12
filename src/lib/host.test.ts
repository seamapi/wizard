import { afterEach, expect, test, vi } from 'vitest'

import {
  createMemoryHost,
  defaultServer,
  getAuth,
  getHost,
  loadAuth,
  resetHost,
  setHost,
  type WizardAuth,
} from './host.js'

afterEach(resetHost)

const apiKeyLogin: WizardAuth = {
  server: 'https://connect.example.com',
  serverSource: 'cli',
  apiKey: 'seam_apikey1_token',
  workspaceId: 'workspace-1',
  loginKind: 'api_key',
}

test('host: runs logged out against an in-memory host by default', async () => {
  expect(await loadAuth()).toEqual({
    server: defaultServer,
    serverSource: 'default',
    apiKey: null,
    workspaceId: null,
    loginKind: 'none',
  })
})

test('host: keeps values for the run and nothing beyond it', async () => {
  await getHost().settings.set('sdk', 'python')
  expect(await getHost().settings.get('sdk')).toBe('python')

  resetHost()
  expect(await getHost().settings.get('sdk')).toBeUndefined()
})

test('host: keeps settings apart from state', async () => {
  await getHost().settings.set('sdk', 'python')

  expect(await getHost().state.get('sdk')).toBeUndefined()
})

test('host: uses the auth the host answers with', async () => {
  setHost(createMemoryHost({ auth: apiKeyLogin }))

  expect(await loadAuth()).toEqual(apiKeyLogin)
  expect(getAuth()).toEqual(apiKeyLogin)
})

test('host: asks the host who the developer is once', async () => {
  const getAuthSpy = vi.fn(async () => apiKeyLogin)
  setHost({ ...createMemoryHost(), getAuth: getAuthSpy })

  await loadAuth()
  await loadAuth()

  expect(getAuthSpy).toHaveBeenCalledTimes(1)
})

test('host: is logged out until the auth has been loaded', () => {
  setHost(createMemoryHost({ auth: apiKeyLogin }))

  expect(getAuth().loginKind).toBe('none')
  expect(getAuth().server).toBe(defaultServer)
})

test('host: forgets the auth loaded for a previous host', async () => {
  setHost(createMemoryHost({ auth: apiKeyLogin }))
  await loadAuth()

  setHost(createMemoryHost())

  expect(await loadAuth()).toMatchObject({ loginKind: 'none' })
})

test('host: starts from the values it was created with', async () => {
  setHost(
    createMemoryHost({
      settings: { sdk: 'javascript' },
      state: { 'projects.app-1234567890': { goal: 'Set up Seam.' } },
    }),
  )

  expect(await getHost().settings.get('sdk')).toBe('javascript')
  expect(await getHost().state.get('projects.app-1234567890')).toEqual({
    goal: 'Set up Seam.',
  })
})
