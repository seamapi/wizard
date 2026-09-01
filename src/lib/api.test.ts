import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@seamapi/http', () => ({
  isSeamHttpApiError: () => false,
  isSeamHttpUnauthorizedError: () => false,
  SeamHttpInvalidTokenError: class extends Error {},
  SeamHttpWorkspaces: class {
    get = get
    client = { post }
  },
}))

import {
  exchangeWizardInferenceToken,
  getWizardEventsUrl,
  getWorkspaceForApiKey,
  postWizardEvents,
} from './api.js'

beforeEach(() => vi.clearAllMocks())

afterEach(() => vi.unstubAllGlobals())

test('uses the workspace SDK and its raw client', async () => {
  const workspace = {
    workspace_id: 'workspace-1',
    name: 'Test',
    is_sandbox: true,
  }
  const onboarding = {
    org_type: 'startup',
    primary_goal: null,
    use_case: null,
    build_target: null,
    embed_customer_portal: null,
    device_categories: ['locks'],
  }
  get.mockResolvedValue(workspace)
  post.mockResolvedValue({
    data: {
      wizard_session: { token: 'token', expires_at: 'tomorrow', onboarding },
    },
  })

  await expect(getWorkspaceForApiKey('seam_key')).resolves.toBe(workspace)
  await expect(exchangeWizardInferenceToken('seam_key')).resolves.toEqual({
    token: 'token',
    expires_at: 'tomorrow',
    onboarding,
  })
  expect(post).toHaveBeenCalledWith('/seam/wizard/v1/session', {})
})

test('posts analytics events to Seam unauthenticated', async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const event = {
    event: 'wizard_run_started',
    distinct_id: 'install-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    properties: { wizard_version: '0.0.0' },
  }

  await expect(postWizardEvents([event])).resolves.toBeUndefined()

  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ]
  expect(url).toBe(getWizardEventsUrl())
  expect(url).toBe('https://connect.getseam.com/seam/wizard/v1/events')
  expect(init.method).toBe('POST')
  expect(init.headers).toEqual({ 'content-type': 'application/json' })
  expect(JSON.parse(String(init.body))).toEqual({ events: [event] })
  // No credential: the events the wizard cares most about happen before the
  // developer has connected one.
  expect(JSON.stringify(init)).not.toContain('authorization')
})

test('rejects when Seam refuses an analytics batch', async () => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }))

  await expect(postWizardEvents([])).rejects.toThrow(
    'Seam analytics returned 503',
  )
})
