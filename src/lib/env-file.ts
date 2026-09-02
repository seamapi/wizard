import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type EnvWriteResult = 'created' | 'updated' | 'added' | 'symlink-refused'

export const ENV_SYMLINK_REFUSAL_MESSAGE =
  '.env is a symlink — the wizard did not write through it. Add SEAM_API_KEY to the real file yourself.'

// dotenv files we look at for an existing key, in priority order.
const ENV_FILE_NAMES = [
  '.env.local',
  '.env',
  '.env.development',
  '.env.development.local',
]

export interface FoundApiKey {
  api_key: string
  source: string // e.g. ".env.local" or "environment"
}

// Look for an existing SEAM_API_KEY: first the process environment, then the
// project's dotenv files. Returns the first hit so the wizard can skip auth.
export function findExistingApiKey(root: string): FoundApiKey | null {
  const fromProcess = process.env['SEAM_API_KEY']?.trim()
  if (fromProcess != null && fromProcess.length > 0) {
    return { api_key: fromProcess, source: 'environment' }
  }

  for (const fileName of ENV_FILE_NAMES) {
    const filePath = join(root, fileName)
    if (!existsSync(filePath)) continue
    const match = readFileSync(filePath, 'utf8').match(
      /^\s*SEAM_API_KEY\s*=\s*(.+?)\s*$/m,
    )
    const value = match?.[1]?.replace(/^["']|["']$/g, '').trim()
    if (value != null && value.length > 0) {
      return { api_key: value, source: fileName }
    }
  }

  return null
}

export interface ProjectEnvResult {
  env: EnvWriteResult
  example: EnvWriteResult | 'unchanged'
  gitignore: 'added' | 'unchanged'
}

export function saveProjectApiKey(
  root: string,
  apiKey: string,
): ProjectEnvResult {
  return {
    env: upsertEnvVar(join(root, '.env'), 'SEAM_API_KEY', apiKey),
    ...ensureProjectEnvConventions(root),
  }
}

export function ensureProjectEnvConventions(
  root: string,
): Omit<ProjectEnvResult, 'env'> {
  return {
    example: ensureEnvExample(root),
    gitignore: ensureGitignored(root, '.env'),
  }
}

export function ensureEnvExample(root: string): EnvWriteResult | 'unchanged' {
  const filePath = join(root, '.env.example')
  if (
    existsSync(filePath) &&
    /^\s*SEAM_API_KEY\s*=/m.test(readFileSync(filePath, 'utf8'))
  ) {
    return 'unchanged'
  }
  return upsertEnvVar(filePath, 'SEAM_API_KEY', '')
}

export function ensureGitignored(
  root: string,
  entry: string,
): 'added' | 'unchanged' {
  const filePath = join(root, '.gitignore')

  if (!existsSync(filePath)) {
    if (!existsSync(join(root, '.git'))) return 'unchanged'
    writeFileSync(filePath, `${entry}\n`)
    return 'added'
  }

  const content = readFileSync(filePath, 'utf8')
  const isIgnored = content
    .split('\n')
    .some((line) => line.trim().replace(/^\/+|\/+$/g, '') === entry)
  if (isIgnored) return 'unchanged'

  const separator = content.length === 0 || content.endsWith('\n') ? '' : '\n'
  writeFileSync(filePath, `${content}${separator}${entry}\n`)
  return 'added'
}

// Upsert a KEY=value line into a dotenv file without disturbing other entries.
// Returns what happened so the wizard can report it accurately.
export function upsertEnvVar(
  filePath: string,
  key: string,
  value: string,
): EnvWriteResult {
  const line = `${key}=${value}`

  const link = lstatSync(filePath, { throwIfNoEntry: false })
  if (link?.isSymbolicLink() === true) {
    return 'symlink-refused'
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${line}\n`)
    return 'created'
  }

  const content = readFileSync(filePath, 'utf8')
  const existingLine = new RegExp(`^${key}=.*$`, 'm')

  if (existingLine.test(content)) {
    writeFileSync(filePath, content.replace(existingLine, line))
    return 'updated'
  }

  const separator = content.length === 0 || content.endsWith('\n') ? '' : '\n'
  writeFileSync(filePath, `${content}${separator}${line}\n`)
  return 'added'
}
