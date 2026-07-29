import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { findExistingApiKey, upsertEnvVar } from './env-file.js'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seam-wizard-'))
  // The module reads process.env['SEAM_API_KEY']; start every test without it.
  vi.stubEnv('SEAM_API_KEY', undefined)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

const writeEnvFile = (fileName: string, contents: string): void => {
  writeFileSync(join(dir, fileName), contents)
}

test('findExistingApiKey: prefers the process environment', () => {
  vi.stubEnv('SEAM_API_KEY', 'seam_from_environment')
  writeEnvFile('.env.local', 'SEAM_API_KEY=seam_from_file\n')

  expect(findExistingApiKey(dir)).toEqual({
    api_key: 'seam_from_environment',
    source: 'environment',
  })
})

test('findExistingApiKey: trims the process environment value', () => {
  vi.stubEnv('SEAM_API_KEY', '  seam_padded  ')

  expect(findExistingApiKey(dir)).toEqual({
    api_key: 'seam_padded',
    source: 'environment',
  })
})

test('findExistingApiKey: reads .env.local before .env', () => {
  writeEnvFile('.env.local', 'SEAM_API_KEY=seam_local\n')
  writeEnvFile('.env', 'SEAM_API_KEY=seam_plain\n')

  expect(findExistingApiKey(dir)).toEqual({
    api_key: 'seam_local',
    source: '.env.local',
  })
})

test('findExistingApiKey: falls back to .env when .env.local is missing', () => {
  writeEnvFile('.env', 'OTHER=1\nSEAM_API_KEY=seam_plain\n')

  expect(findExistingApiKey(dir)).toEqual({
    api_key: 'seam_plain',
    source: '.env',
  })
})

test('findExistingApiKey: falls back to the development dotenv files', () => {
  writeEnvFile('.env.development', 'SEAM_API_KEY=seam_dev\n')

  expect(findExistingApiKey(dir)).toEqual({
    api_key: 'seam_dev',
    source: '.env.development',
  })
})

test('findExistingApiKey: strips surrounding double quotes', () => {
  writeEnvFile('.env', 'SEAM_API_KEY="seam_quoted"\n')

  expect(findExistingApiKey(dir)?.api_key).toBe('seam_quoted')
})

test('findExistingApiKey: strips surrounding single quotes', () => {
  writeEnvFile('.env', "SEAM_API_KEY = 'seam_quoted'\n")

  expect(findExistingApiKey(dir)?.api_key).toBe('seam_quoted')
})

test('findExistingApiKey: returns null when there is no key anywhere', () => {
  writeEnvFile('.env', 'OTHER=1\n')

  expect(findExistingApiKey(dir)).toBeNull()
})

test('findExistingApiKey: returns null when the project has no dotenv files', () => {
  expect(findExistingApiKey(dir)).toBeNull()
})

test('findExistingApiKey: treats a whitespace-only environment value as absent', () => {
  vi.stubEnv('SEAM_API_KEY', '   ')
  writeEnvFile('.env', 'SEAM_API_KEY=seam_plain\n')

  expect(findExistingApiKey(dir)).toEqual({
    api_key: 'seam_plain',
    source: '.env',
  })
})

test('findExistingApiKey: treats an empty environment value as absent', () => {
  vi.stubEnv('SEAM_API_KEY', '')

  expect(findExistingApiKey(dir)).toBeNull()
})

test('upsertEnvVar: creates a missing file', () => {
  const filePath = join(dir, '.env')

  expect(upsertEnvVar(filePath, 'SEAM_API_KEY', 'seam_new')).toBe('created')
  expect(readFileSync(filePath, 'utf8')).toBe('SEAM_API_KEY=seam_new\n')
})

test('upsertEnvVar: adds the key to an existing file', () => {
  const filePath = join(dir, '.env')
  writeFileSync(filePath, 'OTHER=1\n')

  expect(upsertEnvVar(filePath, 'SEAM_API_KEY', 'seam_new')).toBe('added')
  expect(readFileSync(filePath, 'utf8')).toBe(
    'OTHER=1\nSEAM_API_KEY=seam_new\n',
  )
})

test('upsertEnvVar: appends a newline separator when the file does not end in one', () => {
  const filePath = join(dir, '.env')
  writeFileSync(filePath, 'OTHER=1')

  expect(upsertEnvVar(filePath, 'SEAM_API_KEY', 'seam_new')).toBe('added')
  expect(readFileSync(filePath, 'utf8')).toBe(
    'OTHER=1\nSEAM_API_KEY=seam_new\n',
  )
})

test('upsertEnvVar: updates an existing value', () => {
  const filePath = join(dir, '.env')
  writeFileSync(filePath, 'SEAM_API_KEY=seam_old\n')

  expect(upsertEnvVar(filePath, 'SEAM_API_KEY', 'seam_new')).toBe('updated')
  expect(readFileSync(filePath, 'utf8')).toBe('SEAM_API_KEY=seam_new\n')
})

test('upsertEnvVar: leaves other entries intact when updating', () => {
  const filePath = join(dir, '.env')
  writeFileSync(filePath, 'BEFORE=1\nSEAM_API_KEY=seam_old\nAFTER=2\n')

  expect(upsertEnvVar(filePath, 'SEAM_API_KEY', 'seam_new')).toBe('updated')
  expect(readFileSync(filePath, 'utf8')).toBe(
    'BEFORE=1\nSEAM_API_KEY=seam_new\nAFTER=2\n',
  )
})

test('upsertEnvVar: writes into an existing empty file without a leading newline', () => {
  const filePath = join(dir, '.env')
  writeFileSync(filePath, '')

  expect(upsertEnvVar(filePath, 'SEAM_API_KEY', 'seam_new')).toBe('added')
  expect(readFileSync(filePath, 'utf8')).toBe('SEAM_API_KEY=seam_new\n')
})
