import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'

import { getAdapter } from 'lib/adapter.js'
import type { ApiKeyFingerprint } from 'lib/api-key.js'
import type { BuildMode } from 'lib/steps/build-plan.js'

export type ConnectionSource = 'project' | 'cli' | 'browser' | 'pasted'

export interface ProjectConnection {
  endpoint: string
  workspace_id: string | null
  workspace_name: string | null
  api_key: ApiKeyFingerprint | null
  api_key_source: ConnectionSource
  api_key_location: string | null
}

export interface ProjectPlan {
  mode: BuildMode
  note: string | null
  goal: string
  analysis: {
    sdk: string | null
    framework: string | null
    app_type_guess: string | null
    seam_already_setup: boolean
    used_onboarding: boolean
    recommendation_source: 'llm' | 'heuristic'
  }
}

export interface ProjectStepResult {
  id: string
  label: string
  status: 'done' | 'failed' | 'skipped'
  cost_usd: number | null
  summary: string
}

export interface ProjectResult {
  ok: boolean
  files_summary: string
  cost_usd: number | null
  // Per-step outcome for a multi-step (full-API) run; absent on older records.
  // Additive/optional, so no schema bump is needed and old records stay valid.
  steps?: ProjectStepResult[]
}

export interface OnboardingRecord {
  schema_version: number
  created_at: string
  updated_at: string
  connection: ProjectConnection | null
  plan?: ProjectPlan
  result?: ProjectResult
}

const recordSchemaVersion = 2

export const getProjectKey = (root: string): string => {
  const fullPath = resolve(root)
  const digest = createHash('sha256')
    .update(fullPath)
    .digest('hex')
    .slice(0, 10)
  return `projects.${toSlug(basename(fullPath))}-${digest}`
}

export const readProjectRecord = async (
  root: string,
): Promise<OnboardingRecord | null> => {
  const record = await getAdapter().state.get(getProjectKey(root))
  return isOnboardingRecord(record) ? record : null
}

export const recordConnection = async (
  root: string,
  connection: ProjectConnection,
): Promise<void> => {
  await updateProjectRecord(root, (record) => ({ ...record, connection }))
}

export const recordPlan = async (
  root: string,
  plan: ProjectPlan,
): Promise<void> => {
  await updateProjectRecord(root, (record) => ({ ...record, plan }))
}

export const recordResult = async (
  root: string,
  result: ProjectResult,
): Promise<void> => {
  await updateProjectRecord(root, (record) => ({ ...record, result }))
}

const updateProjectRecord = async (
  root: string,
  update: (record: OnboardingRecord) => OnboardingRecord,
): Promise<void> => {
  const now = new Date().toISOString()
  const existing = await readProjectRecord(root)
  const record = update(
    existing ?? {
      schema_version: recordSchemaVersion,
      created_at: now,
      updated_at: now,
      connection: null,
    },
  )
  await getAdapter().state.set(getProjectKey(root), {
    ...record,
    schema_version: recordSchemaVersion,
    updated_at: now,
  })
}

const toSlug = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug.length > 0 ? slug.slice(0, 40) : 'project'
}

const isOnboardingRecord = (value: unknown): value is OnboardingRecord => {
  if (value == null || typeof value !== 'object') return false
  const record = value as Partial<OnboardingRecord>
  return (
    record.schema_version === recordSchemaVersion &&
    typeof record.created_at === 'string'
  )
}
