import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  ensureEnvExample,
  ensureGitignored,
  ENV_SYMLINK_REFUSAL_MESSAGE,
  findExistingApiKey,
  saveProjectApiKey,
  upsertEnvVar,
} from './env-file.js'

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

test('saveProjectApiKey: writes the key, the example, and the ignore rule', () => {
  mkdirSync(join(dir, '.git'))

  const result = saveProjectApiKey(dir, 'seam_new_key')

  expect(result).toEqual({
    env: 'created',
    example: 'created',
    gitignore: 'added',
  })
  expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(
    'SEAM_API_KEY=seam_new_key\n',
  )
  expect(readFileSync(join(dir, '.env.example'), 'utf8')).toBe(
    'SEAM_API_KEY=\n',
  )
  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('.env\n')
})

test('saveProjectApiKey: never writes the key where it could be committed', () => {
  mkdirSync(join(dir, '.git'))

  saveProjectApiKey(dir, 'seam_new_key')

  expect(readFileSync(join(dir, '.env.example'), 'utf8')).not.toContain(
    'seam_new_key',
  )
})

test('ensureEnvExample: leaves an example that already declares the key', () => {
  writeEnvFile('.env.example', '# Seam\nSEAM_API_KEY=your-key-here\n')

  expect(ensureEnvExample(dir)).toBe('unchanged')
  expect(readFileSync(join(dir, '.env.example'), 'utf8')).toContain(
    'your-key-here',
  )
})

test('ensureEnvExample: adds the key to an example that lacks it', () => {
  writeEnvFile('.env.example', 'OTHER=1\n')

  expect(ensureEnvExample(dir)).toBe('added')
  expect(readFileSync(join(dir, '.env.example'), 'utf8')).toBe(
    'OTHER=1\nSEAM_API_KEY=\n',
  )
})

test('ensureGitignored: adds the entry to an existing .gitignore', () => {
  writeEnvFile('.gitignore', 'node_modules\n')

  expect(ensureGitignored(dir, '.env')).toBe('added')
  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe(
    'node_modules\n.env\n',
  )
})

test('ensureGitignored: terminates a last line that has no newline', () => {
  writeEnvFile('.gitignore', 'node_modules')

  ensureGitignored(dir, '.env')

  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe(
    'node_modules\n.env\n',
  )
})

test('ensureGitignored: leaves an entry that is already ignored', () => {
  writeEnvFile('.gitignore', 'node_modules\n/.env/\n')

  expect(ensureGitignored(dir, '.env')).toBe('unchanged')
  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe(
    'node_modules\n/.env/\n',
  )
})

test('ensureGitignored: starts a .gitignore for a repository without one', () => {
  mkdirSync(join(dir, '.git'))

  expect(ensureGitignored(dir, '.env')).toBe('added')
  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toBe('.env\n')
})

test('ensureGitignored: writes no git files outside a repository', () => {
  expect(ensureGitignored(dir, '.env')).toBe('unchanged')
  expect(existsSync(join(dir, '.gitignore'))).toBe(false)
})

// A symlinked .env usually points at a shared secrets file outside the repo.
// Writing through it would edit that file — and it is exactly the case where
// the wizard cannot know the destination is the developer's to change.
test('upsertEnvVar refuses a symlinked file and leaves the target untouched', () => {
  const targetPath = join(dir, 'shared-secrets.env')
  const linkPath = join(dir, '.env')
  writeFileSync(targetPath, 'OTHER=1\n')
  symlinkSync(targetPath, linkPath)

  expect(upsertEnvVar(linkPath, 'SEAM_API_KEY', 'seam_new')).toBe(
    'symlink-refused',
  )
  expect(readFileSync(targetPath, 'utf8')).toBe('OTHER=1\n')
})

// existsSync follows the link, so a dangling one would otherwise look absent
// and get created at the far end.
test('upsertEnvVar refuses a dangling symlink without creating its target', () => {
  const targetPath = join(dir, 'missing-secrets.env')
  const linkPath = join(dir, '.env')
  symlinkSync(targetPath, linkPath)

  expect(upsertEnvVar(linkPath, 'SEAM_API_KEY', 'seam_new')).toBe(
    'symlink-refused',
  )
  expect(existsSync(targetPath)).toBe(false)
})

test('saveProjectApiKey reports the refusal and still ignores .env', () => {
  mkdirSync(join(dir, '.git'))
  const targetPath = join(dir, 'shared-secrets.env')
  writeFileSync(targetPath, 'OTHER=1\n')
  symlinkSync(targetPath, join(dir, '.env'))

  const result = saveProjectApiKey(dir, 'seam_new_key')

  expect(result.env).toBe('symlink-refused')
  expect(result.gitignore).toBe('added')
  expect(readFileSync(targetPath, 'utf8')).not.toContain('seam_new_key')
})

test('ENV_SYMLINK_REFUSAL_MESSAGE tells the developer what to do, without a key', () => {
  expect(ENV_SYMLINK_REFUSAL_MESSAGE).toContain('SEAM_API_KEY')
  expect(ENV_SYMLINK_REFUSAL_MESSAGE).toContain('symlink')
  expect(ENV_SYMLINK_REFUSAL_MESSAGE).not.toMatch(/seam_[A-Za-z0-9]/)
})
