import { expect, test } from 'vitest'

import { isSecretFilePath, toolInputTouchesSecret } from './secret-paths.js'

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
  expect(toolInputTouchesSecret({ file_path: '.env' })).toBe(true) // Read/Edit/Write
  expect(toolInputTouchesSecret({ path: './.env.local' })).toBe(true) // Grep/Glob/Ls
  expect(toolInputTouchesSecret({ glob: '.env' })).toBe(true) // Grep glob
  expect(toolInputTouchesSecret({ file_path: '.env.example' })).toBe(false)
  expect(toolInputTouchesSecret({ file_path: 'src/app.ts' })).toBe(false)
})

test('toolInputTouchesSecret: safe on non-object / empty input', () => {
  expect(toolInputTouchesSecret(null)).toBe(false)
  expect(toolInputTouchesSecret(undefined)).toBe(false)
  expect(toolInputTouchesSecret('a string')).toBe(false)
  expect(toolInputTouchesSecret({})).toBe(false)
})
