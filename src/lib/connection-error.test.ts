import {
  SeamHttpApiError,
  SeamHttpInvalidTokenError,
  SeamHttpUnauthorizedError,
} from '@seamapi/http'
import { expect, test } from 'vitest'

import {
  classifyKeyValidationError,
  describeConnectionFailure,
  markConnectionFailure,
} from './connection-error.js'

test('unexpected exceptions do not disclose messages or invent a stage', () => {
  const error = Object.assign(
    new Error('secret-marker https://private.invalid'),
    {
      api_key: 'secret-marker',
      fingerprint: 'secret-marker',
    },
  )
  expect(describeConnectionFailure(error)).toEqual({
    message: 'An unexpected error occurred while connecting. Please try again.',
    properties: {
      reason: 'unknown',
      failure_stage: 'unknown',
      http_status: null,
    },
  })
  expect(JSON.stringify(describeConnectionFailure(error))).not.toContain(
    'secret-marker',
  )
})

test('callback and saving failures report their known stage', () => {
  expect(
    describeConnectionFailure(
      markConnectionFailure(
        new Error('secret-marker'),
        'browser_callback',
        'timeout',
      ),
    ),
  ).toMatchObject({
    message: expect.stringContaining('Timed out'),
    properties: {
      reason: 'timeout',
      failure_stage: 'browser_callback',
      http_status: null,
    },
  })
  expect(
    describeConnectionFailure(
      markConnectionFailure(new Error('secret-marker'), 'env_write'),
    ),
  ).toMatchObject({
    message: expect.stringContaining('key was verified'),
    properties: {
      reason: 'unknown',
      failure_stage: 'env_write',
      http_status: null,
    },
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
  [
    Object.assign(new Error('secret-marker'), {
      isAxiosError: true,
      response: { status: 401, data: 'secret-marker' },
    }),
    'unauthorized',
    401,
  ],
  [new Error('secret-marker'), 'unknown', null],
  [new TypeError('secret-marker'), 'unknown', null],
  ['secret-marker', 'unknown', null],
])('normalizes SDK failures safely (%#)', (error, category, statusCode) => {
  const result = classifyKeyValidationError(error)
  expect(result).toMatchObject({ category, statusCode })
  expect(JSON.stringify(result)).not.toContain('secret-marker')
  expect(result).not.toHaveProperty('cause')
})

test('stage annotation preserves the original exception, cause and own properties', () => {
  const cause = new Error('cause-secret-marker')
  const error = new SeamHttpApiError(
    {
      type: 'internal_error',
      message: 'secret-marker',
      data: { key: 'secret-marker' },
    },
    503,
    'secret-marker',
  )
  error.cause = cause
  const originalProperties = Object.getOwnPropertyDescriptors(error)
  expect(markConnectionFailure(error, 'key_validation')).toBe(error)
  expect(Object.getOwnPropertyDescriptors(error)).toEqual(originalProperties)
  const report = describeConnectionFailure(error)
  expect(report).toMatchObject({
    message: 'The Seam API returned 503. Please try again in a moment.',
    properties: {
      reason: 'api_error',
      failure_stage: 'key_validation',
      http_status: 503,
    },
  })
  expect(JSON.stringify(report)).not.toContain('secret-marker')
  expect(error.cause).toBe(cause)
})
