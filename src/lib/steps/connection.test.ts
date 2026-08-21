import { expect, test } from 'vitest'

import {
  compareConnection,
  type CurrentConnection,
  describeChange,
} from './connection.js'

const apiKey = 'seam_apikey1_first_key'
const workspace: CurrentConnection['workspace'] = {
  workspace_id: 'workspace-1',
  name: 'Acme',
  is_sandbox: false,
}

const recorded: Parameters<typeof compareConnection>[0] = {
  endpoint: 'https://connect.getseam.com',
  workspace_id: workspace.workspace_id,
  workspace_name: workspace.name,
  api_key: { digest: '1068caa4a195dd39', hint: '_key' },
  api_key_source: 'project',
  api_key_location: '.env',
}

const current: CurrentConnection = {
  endpoint: recorded.endpoint,
  workspace,
  api_key: apiKey,
}

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
