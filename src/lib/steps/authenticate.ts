import { getAuth } from 'lib/adapter.js'
import { getWorkspaceForApiKey, type SeamWorkspace } from 'lib/api.js'
import { findExistingApiKey, saveProjectApiKey } from 'lib/env-file.js'

export interface AuthResult {
  workspace: SeamWorkspace
  api_key: string
}

export interface ExistingKeyResult {
  workspace: SeamWorkspace
  api_key: string
  source: string
}

export interface CliKeyResult {
  workspace: SeamWorkspace
  api_key: string
}

// Pure auth logic (no UI). The Ink app drives the prompts and renders progress.
// The wizard never handles credentials — keys are created in the browser or
// pasted, never minted from a password here.

// Return the workspace for an already-present SEAM_API_KEY (env or .env*), or
// null when there is none / it doesn't verify.
export async function findVerifiedExistingKey(
  root: string,
): Promise<ExistingKeyResult | null> {
  const existing = findExistingApiKey(root)
  if (existing == null) return null
  try {
    const workspace = await getWorkspaceForApiKey(existing.api_key)
    return { workspace, api_key: existing.api_key, source: existing.source }
  } catch {
    return null
  }
}

export async function findVerifiedCliKey(): Promise<CliKeyResult | null> {
  const { apiKey } = getAuth()
  if (apiKey == null) return null
  try {
    const workspace = await getWorkspaceForApiKey(apiKey)
    return { workspace, api_key: apiKey }
  } catch {
    return null
  }
}

// Verify a pasted key and save it to the project. Throws (ApiKeyError) if invalid.
export async function verifyAndSaveKey(
  root: string,
  apiKey: string,
): Promise<AuthResult> {
  const trimmed = apiKey.trim()
  const workspace = await getWorkspaceForApiKey(trimmed)
  saveProjectApiKey(root, trimmed)
  return { workspace, api_key: trimmed }
}

export function saveVerifiedKey(root: string, apiKey: string): void {
  saveProjectApiKey(root, apiKey)
}
