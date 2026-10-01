import { expect, test } from 'vitest'

import {
  ConnectionError,
  describeConnectionFailure,
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
      new ConnectionError('browser_callback', 'timeout'),
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
    describeConnectionFailure(new ConnectionError('env_write')),
  ).toMatchObject({
    message: expect.stringContaining('key was verified'),
    properties: {
      reason: 'unknown',
      failure_stage: 'env_write',
      http_status: null,
    },
  })
})
