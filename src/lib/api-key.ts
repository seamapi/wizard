import { createHash } from 'node:crypto'

export interface ApiKeyFingerprint {
  digest: string
  hint: string
}

export const fingerprintApiKey = (apiKey: string): ApiKeyFingerprint => {
  const trimmed = apiKey.trim()
  return {
    digest: createHash('sha256').update(trimmed).digest('hex').slice(0, 16),
    hint: trimmed.slice(-4),
  }
}

export const isSameApiKey = (
  fingerprint: ApiKeyFingerprint,
  apiKey: string,
): boolean => fingerprintApiKey(apiKey).digest === fingerprint.digest
