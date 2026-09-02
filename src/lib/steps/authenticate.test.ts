import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@seamapi/http', () => ({
  isSeamHttpApiError: () => false,
  isSeamHttpUnauthorizedError: () => false,
  SeamHttpInvalidTokenError: class extends Error {},
  SeamHttpWorkspaces: class {
    get = get
    client = { post: vi.fn() }
  },
}))

const { verifyAndSaveKey } = await import('./authenticate.js')

const workspace = {
  workspace_id: 'workspace-1',
  name: 'Acme',
  is_sandbox: false,
}

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seam-wizard-'))
  vi.clearAllMocks()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// The run has to carry the key it verified. Returning only the workspace left
// the caller to re-read SEAM_API_KEY, which may belong to another workspace.
test('verifyAndSaveKey returns the key it verified', async () => {
  get.mockResolvedValue(workspace)

  const result = await verifyAndSaveKey(dir, 'seam_pasted_key')

  expect(result.workspace).toBe(workspace)
  expect(result.api_key).toBe('seam_pasted_key')
})

test('verifyAndSaveKey returns the trimmed key it saved, not the raw input', async () => {
  get.mockResolvedValue(workspace)

  const result = await verifyAndSaveKey(dir, '  seam_padded_key\n')

  expect(result.api_key).toBe('seam_padded_key')
  expect(readFileSync(join(dir, '.env'), 'utf8')).toContain(
    'SEAM_API_KEY=seam_padded_key',
  )
})

// The refusal is only useful if it reaches the Ink app, which reads it off the
// result of the save.
test('verifyAndSaveKey reports a symlinked .env instead of writing through it', async () => {
  get.mockResolvedValue(workspace)
  const targetPath = join(dir, 'shared-secrets.env')
  writeFileSync(targetPath, 'OTHER=1\n')
  symlinkSync(targetPath, join(dir, '.env'))

  const result = await verifyAndSaveKey(dir, 'seam_pasted_key')

  expect(result.env.env).toBe('symlink-refused')
  expect(readFileSync(targetPath, 'utf8')).toBe('OTHER=1\n')
})
