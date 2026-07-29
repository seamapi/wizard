import { join } from "node:path"
import {
  getWorkspaceForApiKey,
  type SeamWorkspace,
} from "lib/util/seam-api.js"
import { upsertEnvVar, findExistingApiKey } from "lib/util/env-file.js"

export interface AuthResult {
  workspace: SeamWorkspace
}

export interface ExistingKeyResult {
  workspace: SeamWorkspace
  source: string
}

// Pure auth logic (no UI). The Ink app drives the prompts and renders progress.
// The wizard never handles credentials — keys are created in the browser or
// pasted, never minted from a password here.

// Return the workspace for an already-present SEAM_API_KEY (env or .env*), or
// null when there is none / it doesn't verify.
export async function findVerifiedExistingKey(
  root: string
): Promise<ExistingKeyResult | null> {
  const existing = findExistingApiKey(root)
  if (existing == null) return null
  try {
    const workspace = await getWorkspaceForApiKey(existing.api_key)
    return { workspace, source: existing.source }
  } catch {
    return null
  }
}

// Verify a pasted key and save it to .env. Throws (ApiKeyError) if invalid.
export async function verifyAndSaveKey(
  root: string,
  api_key: string
): Promise<AuthResult> {
  const trimmed = api_key.trim()
  const workspace = await getWorkspaceForApiKey(trimmed)
  upsertEnvVar(join(root, ".env"), "SEAM_API_KEY", trimmed)
  return { workspace }
}
