import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from 'lib/adapter.js'
import { fingerprintApiKey } from 'lib/api-key.js'
import type { SeamWorkspace } from 'lib/seam-api.js'
import { compareConnection, saveConnection } from 'lib/steps/connection.js'
import { type ProjectConnection, readProjectRecord } from 'lib/store/index.js'

const apiKey = 'seam_apikey1_first_key'
const workspace: SeamWorkspace = {
  workspace_id: 'workspace-1',
  name: 'Acme',
  is_sandbox: false,
}

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(resetAdapter)

test('saveConnection: records what the project talks to, never the key', async () => {
  await saveConnection('/projects/app', {
    workspace,
    api_key: apiKey,
    source: 'project',
    location: '.env.local',
  })

  const record = await readProjectRecord('/projects/app')
  expect(record?.connection).toEqual({
    endpoint: 'https://connect.getseam.com',
    workspace_id: 'workspace-1',
    workspace_name: 'Acme',
    api_key: fingerprintApiKey(apiKey),
    api_key_source: 'project',
    api_key_location: '.env.local',
  })
  expect(JSON.stringify(record)).not.toContain(apiKey)
})

test('saveConnection: what it records reads back as unchanged', async () => {
  await saveConnection('/projects/app', {
    workspace,
    api_key: apiKey,
    source: 'browser',
  })

  const record = await readProjectRecord('/projects/app')
  expect(record?.connection).not.toBeNull()
  expect(
    compareConnection(record?.connection as ProjectConnection, {
      endpoint: 'https://connect.getseam.com',
      workspace,
      api_key: apiKey,
    }),
  ).toEqual([])
})
