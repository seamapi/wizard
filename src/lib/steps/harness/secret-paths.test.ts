import { expect, test } from 'vitest'

import {
  isSecretFilePath,
  redactSecretGrepLines,
  toolInputTouchesSecret,
} from './secret-paths.js'

test('isSecretFilePath: blocks .env and its variants', () => {
  expect(isSecretFilePath('.env')).toBe(true)
  expect(isSecretFilePath('.env.local')).toBe(true)
  expect(isSecretFilePath('.env.production')).toBe(true)
  expect(isSecretFilePath('./.env')).toBe(true)
  expect(isSecretFilePath('/abs/project/.env')).toBe(true)
  expect(isSecretFilePath('config/.env.staging')).toBe(true)
})

test('isSecretFilePath: allows the value-less .env.example template', () => {
  expect(isSecretFilePath('.env.example')).toBe(false)
  expect(isSecretFilePath('./.env.example')).toBe(false)
  expect(isSecretFilePath('nested/dir/.env.example')).toBe(false)
})

test('isSecretFilePath: allows ordinary files', () => {
  expect(isSecretFilePath('src/index.ts')).toBe(false)
  expect(isSecretFilePath('README.md')).toBe(false)
  // Not a dotenv file — "environment.ts" merely starts with "env" after a slash.
  expect(isSecretFilePath('src/environment.ts')).toBe(false)
})

test('toolInputTouchesSecret: detects the path across tool input fields', () => {
  expect(toolInputTouchesSecret({ file_path: '.env' })).toBe(true) // SDK Read/Edit/Write
  expect(toolInputTouchesSecret({ path: './.env.local' })).toBe(true) // pi Read / SDK Grep
  expect(toolInputTouchesSecret({ glob: '.env' })).toBe(true) // Grep/Find glob
  expect(toolInputTouchesSecret({ dir: 'config/.env.staging' })).toBe(true) // pi Ls
  expect(toolInputTouchesSecret({ file_path: '.env.example' })).toBe(false)
  expect(toolInputTouchesSecret({ file_path: 'src/app.ts' })).toBe(false)
})

test('redactSecretGrepLines: drops lines sourced from a secret file', () => {
  const output = [
    'src/config.ts:12:const url = process.env.DATABASE_URL',
    '.env:1:DATABASE_URL=postgres://user:pw@host/db',
    'config/.env.production:3:STRIPE_KEY=sk_live_abc',
    'src/app.ts:5:import { Seam } from "seam"',
  ].join('\n')
  const redacted = redactSecretGrepLines(output)
  expect(redacted).toBe(
    [
      'src/config.ts:12:const url = process.env.DATABASE_URL',
      'src/app.ts:5:import { Seam } from "seam"',
    ].join('\n'),
  )
  expect(redacted).not.toContain('sk_live_abc')
  expect(redacted).not.toContain('postgres://')
})

test('redactSecretGrepLines: keeps .env.example lines and is a no-op when clean', () => {
  const clean = ['src/a.ts:1:x', '.env.example:1:SEAM_API_KEY='].join('\n')
  expect(redactSecretGrepLines(clean)).toBe(clean)
})

test('redactSecretGrepLines: handles files-with-matches (bare path) output', () => {
  const output = ['src/config.ts', '.env', 'src/app.ts'].join('\n')
  expect(redactSecretGrepLines(output)).toBe(
    ['src/config.ts', 'src/app.ts'].join('\n'),
  )
})

test('toolInputTouchesSecret: safe on non-object / empty input', () => {
  expect(toolInputTouchesSecret(null)).toBe(false)
  expect(toolInputTouchesSecret(undefined)).toBe(false)
  expect(toolInputTouchesSecret('a string')).toBe(false)
  expect(toolInputTouchesSecret({})).toBe(false)
})
