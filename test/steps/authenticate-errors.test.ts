import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from 'lib/adapter.js'
import { describeConnectionFailure } from 'lib/connection-error.js'
import { verifyAndSaveKey } from 'lib/steps/authenticate.js'

let root = ''
afterEach(() => {
  resetAdapter()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

test('saving failure after validation is distinct from a rejected key and excludes disk errors', async () => {
  setAdapter(createMemoryAdapter())
  root = mkdtempSync(join(tmpdir(), 'wizard-auth-errors-'))
  mkdirSync(join(root, '.env'))
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        workspace: {
          workspace_id: 'workspace-1',
          name: 'Test',
          is_sandbox: true,
        },
      }),
    ),
  )
  let failure: unknown
  try {
    await verifyAndSaveKey(root, 'seam_fixture_secret-marker')
  } catch (error) {
    failure = error
  }
  const result = describeConnectionFailure(failure)
  expect(result).toMatchObject({
    message: expect.stringContaining('key was verified'),
    properties: {
      reason: 'unknown',
      failure_stage: 'env_write',
      http_status: null,
    },
  })
  expect(JSON.stringify(result)).not.toContain(root)
  expect(JSON.stringify(result)).not.toContain('secret-marker')
})
