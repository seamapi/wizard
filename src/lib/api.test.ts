import { SeamHttpInvalidTokenError } from '@seamapi/http'
import { afterEach, expect, test, vi } from 'vitest'

import { exchangeWizardInferenceToken, getWorkspaceForApiKey } from './api.js'

afterEach(() => vi.unstubAllGlobals())

// Fixed noncredential fixtures; all requests stop at the fetch boundary.
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
  const requests: Request[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      requests.push(request)
      return Response.json(
        request.url.endsWith('/session')
          ? {
              wizard_session: {
                token: 'token',
                expires_at: 'tomorrow',
                onboarding,
              },
            }
          : { workspace },
      )
    }),
  )
  await expect(getWorkspaceForApiKey('seam_key')).resolves.toEqual(workspace)
  await expect(exchangeWizardInferenceToken('seam_key')).resolves.toEqual({
    token: 'token',
    expires_at: 'tomorrow',
    onboarding,
  })
  expect(new URL(requests[1]?.url ?? '').pathname).toBe(
    '/seam/wizard/v1/session',
  )
  expect(await requests[1]?.json()).toEqual({})
})

test('malformed and wrong token types preserve the native local error', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  for (const token of ['not-a-key', 'seam_pk_not-a-key']) {
    await expect(getWorkspaceForApiKey(token)).rejects.toBeInstanceOf(
      SeamHttpInvalidTokenError,
    )
  }
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['json', 'text'])(
  'an actual unauthorized %s response reports 401',
  async (format) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        format === 'json'
          ? Response.json({}, { status: 401 })
          : new Response('secret-marker', { status: 401 }),
      ),
    )
    await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
      name: 'SeamHttpUnauthorizedError',
      statusCode: 401,
    })
  },
)

test('a 5xx response preserves the native SDK exception and details', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { error: { type: 'internal_error', message: 'secret-marker' } },
        { status: 503 },
      ),
    ),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    name: 'SeamHttpApiError',
    statusCode: 503,
    message: 'secret-marker',
  })
})

test('fetch transport failures preserve the SDK transport exception', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch secret-marker')
    }),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    code: 'ERR_NETWORK',
  })
})

test('non-JSON HTTP failures retain their known status', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('secret-marker', { status: 502 })),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    response: { status: 502 },
  })
})

test('the SDK transport exception retains its original cause', async () => {
  const original = new TypeError('secret-marker')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw original
    }),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    isAxiosError: true,
    cause: original,
  })
})
