import { afterEach, beforeEach, expect, test } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from 'lib/adapter.js'
import { type ProjectConnection, readProjectRecord } from 'lib/store/index.js'
import { fingerprintApiKey } from 'lib/util/api-key.js'
import type { SeamWorkspace } from 'lib/util/seam-api.js'

import {
  compareConnection,
  describeChange,
  saveConnection,
} from './connection.js'

const apiKey = 'seam_apikey1_first_key'
const workspace: SeamWorkspace = {
  workspace_id: 'workspace-1',
  name: 'Acme',
  is_sandbox: false,
}

const recorded: ProjectConnection = {
  endpoint: 'https://connect.getseam.com',
  workspace_id: workspace.workspace_id,
  workspace_name: workspace.name,
  api_key: fingerprintApiKey(apiKey),
  api_key_source: 'project',
  api_key_location: '.env',
}

const current = {
  endpoint: recorded.endpoint,
  workspace,
  api_key: apiKey,
}

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(resetAdapter)

test('compareConnection: nothing changed is nothing to ask about', () => {
  expect(compareConnection(recorded, current)).toEqual([])
})

test('compareConnection: the same key read from another file has not changed', () => {
  expect(
    compareConnection({ ...recorded, api_key_location: '.env.local' }, current),
  ).toEqual([])
})

test('compareConnection: reports a different key by its last characters', () => {
  const changes = compareConnection(recorded, {
    ...current,
    api_key: 'seam_apikey1_second_0f8f',
  })

  expect(changes).toEqual([{ what: 'api_key', from: '_key', to: '0f8f' }])
})

test('compareConnection: reports a different workspace by name', () => {
  const changes = compareConnection(recorded, {
    ...current,
    workspace: { ...workspace, workspace_id: 'workspace-2', name: 'Other' },
  })

  expect(changes).toEqual([{ what: 'workspace', from: 'Acme', to: 'Other' }])
})

test('compareConnection: reports a different server', () => {
  const changes = compareConnection(recorded, {
    ...current,
    endpoint: 'https://connect.example.com',
  })

  expect(changes).toEqual([
    {
      what: 'endpoint',
      from: 'https://connect.getseam.com',
      to: 'https://connect.example.com',
    },
  ])
})

test('compareConnection: reports everything that moved at once', () => {
  const changes = compareConnection(recorded, {
    endpoint: 'https://connect.example.com',
    workspace: { ...workspace, workspace_id: 'workspace-2', name: 'Other' },
    api_key: 'seam_apikey1_second_0f8f',
  })

  expect(changes.map((change) => change.what)).toEqual([
    'api_key',
    'workspace',
    'endpoint',
  ])
})

test('compareConnection: asks nothing about a record that kept no key', () => {
  expect(compareConnection({ ...recorded, api_key: null }, current)).toEqual([])
})

test('describeChange: reads as what moved, and where to', () => {
  expect(
    describeChange({
      what: 'endpoint',
      from: 'https://connect.getseam.com',
      to: 'https://connect.example.com',
    }),
  ).toBe('Endpoint: https://connect.getseam.com → https://connect.example.com')
})

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
    compareConnection(record?.connection as ProjectConnection, current),
  ).toEqual([])
})
