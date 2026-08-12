import { expect, test } from 'vitest'

import { fingerprintApiKey, isSameApiKey } from './api-key.js'

const apiKey = 'seam_apikey1_0f8fad5bd9cb469fa16570867728950e'

test('fingerprintApiKey: holds none of the key it fingerprints', () => {
  const fingerprint = fingerprintApiKey(apiKey)

  expect(JSON.stringify(fingerprint)).not.toContain('seam_')
  expect(apiKey).not.toContain(fingerprint.digest)
})

test('fingerprintApiKey: shows enough to recognize which key is meant', () => {
  expect(fingerprintApiKey(apiKey).hint).toBe('950e')
})

test('fingerprintApiKey: is the same for the same key', () => {
  expect(fingerprintApiKey(apiKey)).toEqual(fingerprintApiKey(apiKey))
})

test('fingerprintApiKey: ignores surrounding whitespace', () => {
  expect(fingerprintApiKey(`  ${apiKey}\n`)).toEqual(fingerprintApiKey(apiKey))
})

test('fingerprintApiKey: differs for a different key', () => {
  expect(fingerprintApiKey(apiKey).digest).not.toBe(
    fingerprintApiKey('seam_apikey1_other').digest,
  )
})

test('isSameApiKey: tells the recorded key from another', () => {
  const fingerprint = fingerprintApiKey(apiKey)

  expect(isSameApiKey(fingerprint, apiKey)).toBe(true)
  expect(isSameApiKey(fingerprint, 'seam_apikey1_other')).toBe(false)
})
