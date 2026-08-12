import { getAuth } from 'lib/adapter.js'
import {
  type ConnectionSource,
  type ProjectConnection,
  recordConnection,
} from 'lib/store/index.js'
import { fingerprintApiKey } from 'lib/util/api-key.js'
import type { SeamWorkspace } from 'lib/util/seam-api.js'

export type ConnectionChange =
  | { what: 'api_key'; from: string; to: string }
  | { what: 'workspace'; from: string; to: string }
  | { what: 'endpoint'; from: string; to: string }

export interface CurrentConnection {
  endpoint: string
  workspace: SeamWorkspace
  api_key: string
}

export const compareConnection = (
  recorded: ProjectConnection,
  current: CurrentConnection,
): ConnectionChange[] => {
  const changes: ConnectionChange[] = []

  const currentKey = fingerprintApiKey(current.api_key)
  if (
    recorded.api_key != null &&
    recorded.api_key.digest !== currentKey.digest
  ) {
    changes.push({
      what: 'api_key',
      from: recorded.api_key.hint,
      to: currentKey.hint,
    })
  }

  if (
    recorded.workspace_id != null &&
    recorded.workspace_id !== current.workspace.workspace_id
  ) {
    changes.push({
      what: 'workspace',
      from: recorded.workspace_name ?? recorded.workspace_id,
      to: current.workspace.name,
    })
  }

  if (recorded.endpoint !== current.endpoint) {
    changes.push({
      what: 'endpoint',
      from: recorded.endpoint,
      to: current.endpoint,
    })
  }

  return changes
}

export const describeChange = (change: ConnectionChange): string => {
  if (change.what === 'api_key') {
    return `API key: one ending ${change.from} → one ending ${change.to}`
  }
  const label = change.what === 'workspace' ? 'Workspace' : 'Endpoint'
  return `${label}: ${change.from} → ${change.to}`
}

export const saveConnection = async (
  root: string,
  connection: {
    workspace: SeamWorkspace
    api_key: string
    source: ConnectionSource
    location?: string | null
  },
): Promise<void> => {
  await recordConnection(root, {
    endpoint: getAuth().endpoint,
    workspace_id: connection.workspace.workspace_id,
    workspace_name: connection.workspace.name,
    api_key: fingerprintApiKey(connection.api_key),
    api_key_source: connection.source,
    api_key_location: connection.location ?? null,
  })
}
