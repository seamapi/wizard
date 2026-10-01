import { KeyValidationError } from './api.js'

export type ConnectionFailureStage =
  'browser_callback' | 'key_validation' | 'env_write' | 'unknown'

// Safe context for failures outside validation; do not retain their cause.
export class ConnectionError extends Error {
  constructor(
    readonly stage: 'browser_callback' | 'env_write',
    readonly category: 'unknown' | 'timeout' = 'unknown',
  ) {
    super(
      stage === 'env_write'
        ? 'The key was verified, but the wizard could not save it to the project. Check file permissions and try again.'
        : category === 'timeout'
          ? 'Timed out waiting for the browser to return a key. Please try again.'
          : 'The browser handoff could not complete. Please try again or paste your API key.',
    )
  }
}

export function describeConnectionFailure(error: unknown): {
  message: string
  properties: {
    reason: string
    failure_stage: ConnectionFailureStage
    http_status: number | null
  }
} {
  if (error instanceof KeyValidationError) {
    return {
      message: error.message,
      properties: {
        reason: error.category,
        failure_stage: 'key_validation',
        http_status: error.statusCode,
      },
    }
  }
  if (error instanceof ConnectionError) {
    return {
      message: error.message,
      properties: {
        reason: error.category,
        failure_stage: error.stage,
        http_status: null,
      },
    }
  }
  return {
    message: 'An unexpected error occurred while connecting. Please try again.',
    properties: {
      reason: 'unknown',
      failure_stage: 'unknown',
      http_status: null,
    },
  }
}
