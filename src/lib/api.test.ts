import {
  SeamHttpApiError,
  SeamHttpInvalidTokenError,
  SeamHttpUnauthorizedError,
} from '@seamapi/http'
import { afterEach, expect, test, vi } from 'vitest'

import {
  classifyKeyValidationError,
  exchangeWizardInferenceToken,
  getWorkspaceForApiKey,
} from './api.js'

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

test('malformed and wrong token types fail locally without claiming 401', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  for (const token of ['not-a-key', 'seam_pk_not-a-key']) {
    await expect(getWorkspaceForApiKey(token)).rejects.toMatchObject({
      category: 'invalid_token_format',
      statusCode: null,
      message: expect.stringContaining('not a supported Seam API key'),
    })
  }
  expect(fetch).not.toHaveBeenCalled()
})

test('an actual unauthorized response reports 401', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({}, { status: 401 })),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    category: 'unauthorized',
    statusCode: 401,
  })
})

test('a 5xx response reports its status without the API message', async () => {
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
    category: 'api_error',
    statusCode: 503,
    message: 'The Seam API returned 503. Please try again in a moment.',
  })
})

test.each([
  [
    new SeamHttpInvalidTokenError('secret-marker'),
    'invalid_token_format',
    null,
  ],
  [new SeamHttpUnauthorizedError('secret-marker'), 'unauthorized', 401],
  [
    new SeamHttpApiError(
      {
        type: 'internal_error',
        message: 'secret-marker',
        data: { key: 'secret-marker' },
      },
      500,
      'secret-marker',
    ),
    'api_error',
    500,
  ],
  [
    Object.assign(new Error('secret-marker'), {
      code: 'ERR_NETWORK',
      config: { url: 'secret-marker' },
    }),
    'transport_error',
    null,
  ],
  [
    Object.assign(new Error('secret-marker'), { code: 'ETIMEDOUT' }),
    'transport_error',
    null,
  ],
  [new Error('secret-marker'), 'unknown', null],
  [new TypeError('secret-marker'), 'unknown', null],
  ['secret-marker', 'unknown', null],
])('normalizes SDK failures safely (%#)', (error, category, statusCode) => {
  const result = classifyKeyValidationError(error)
  expect(result).toMatchObject({ category, statusCode })
  expect(`${result.stack} ${JSON.stringify(result)}`).not.toContain(
    'secret-marker',
  )
  expect(result).not.toHaveProperty('cause')
})

test('fetch transport failures survive the SDK boundary as transport errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch secret-marker')
    }),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    category: 'transport_error',
    statusCode: null,
  })
})

test('non-JSON HTTP failures retain their known status', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('secret-marker', { status: 502 })),
  )
  await expect(getWorkspaceForApiKey('seam_key')).rejects.toMatchObject({
    category: 'api_error',
    statusCode: 502,
    message: 'The Seam API returned 502. Please try again in a moment.',
  })
})
