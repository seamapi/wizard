import {
  isSeamHttpApiError,
  isSeamHttpUnauthorizedError,
  SeamHttpInvalidTokenError,
} from '@seamapi/http'

export type ConnectionFailureStage =
  'browser_callback' | 'key_validation' | 'env_write' | 'unknown'

export type KeyValidationCategory =
  | 'invalid_token_format'
  | 'unauthorized'
  | 'api_error'
  | 'transport_error'
  | 'unknown'

interface KeyValidationFailure {
  category: KeyValidationCategory
  statusCode: number | null
  message: string
}

// Associate a stage with the original exception without mutating, wrapping or
// serializing it. Native type, stack, cause and SDK details remain available to
// callers; only the safe descriptor below is used for display and analytics.
const contexts = new WeakMap<
  object,
  { stage: ConnectionFailureStage; category: 'unknown' | 'timeout' }
>()

export function markConnectionFailure<T>(
  error: T,
  stage: ConnectionFailureStage,
  category: 'unknown' | 'timeout' = 'unknown',
): T {
  if (typeof error === 'object' && error != null && !contexts.has(error)) {
    contexts.set(error, { stage, category })
  }
  return error
}

function keyValidationFailure(
  category: KeyValidationCategory,
  statusCode: number | null = null,
): KeyValidationFailure {
  const messages: Record<KeyValidationCategory, string> = {
    invalid_token_format:
      'That value is not a supported Seam API key. Copy the full API key, including the seam_ prefix.',
    unauthorized:
      'The Seam API rejected that key (401). Check that the key is valid and active.',
    api_error:
      statusCode == null
        ? 'The Seam API returned an error. Please try again in a moment.'
        : `The Seam API returned ${statusCode}. Please try again in a moment.`,
    transport_error:
      'Could not reach the Seam API. Check your connection and try again.',
    unknown:
      'An unexpected error occurred while verifying the key. Please try again.',
  }
  return { category, statusCode, message: messages[category] }
}

export function classifyKeyValidationError(
  error: unknown,
): KeyValidationFailure {
  if (error instanceof SeamHttpInvalidTokenError) {
    return keyValidationFailure('invalid_token_format')
  }
  if (isSeamHttpUnauthorizedError(error)) {
    return keyValidationFailure('unauthorized', 401)
  }
  if (isSeamHttpApiError(error)) {
    return keyValidationFailure('api_error', knownHttpStatus(error.statusCode))
  }
  // A non-JSON HTTP failure can remain an Axios error instead of becoming a
  // SeamHttpApiError. Its response status is still evidence of an HTTP failure.
  if (
    error instanceof Error &&
    'isAxiosError' in error &&
    error.isAxiosError === true &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response != null &&
    'status' in error.response
  ) {
    const status = knownHttpStatus(error.response.status)
    if (status != null) return keyValidationFailure('api_error', status)
  }
  // Axios' fetch adapter identifies transport failures by code. An arbitrary
  // Error or TypeError is not evidence of a network failure.
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
  ) {
    return keyValidationFailure('transport_error')
  }
  return keyValidationFailure('unknown')
}

function knownHttpStatus(status: unknown): number | null {
  return typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : null
}

export function describeConnectionFailure(error: unknown): {
  message: string
  properties: {
    reason: KeyValidationCategory | 'timeout'
    failure_stage: ConnectionFailureStage
    http_status: number | null
  }
} {
  const context =
    typeof error === 'object' && error != null ? contexts.get(error) : undefined
  const stage = context?.stage ?? 'unknown'
  const category = context?.category ?? 'unknown'
  if (stage === 'key_validation') {
    const failure = classifyKeyValidationError(error)
    return {
      message: failure.message,
      properties: {
        reason: failure.category,
        failure_stage: stage,
        http_status: failure.statusCode,
      },
    }
  }
  const message =
    stage === 'env_write'
      ? 'The key was verified, but the wizard could not save it to the project. Check file permissions and try again.'
      : stage === 'browser_callback'
        ? category === 'timeout'
          ? 'Timed out waiting for the browser to return a key. Please try again.'
          : 'The browser handoff could not complete. Please try again or paste your API key.'
        : 'An unexpected error occurred while connecting. Please try again.'
  return {
    message,
    properties: { reason: category, failure_stage: stage, http_status: null },
  }
}
