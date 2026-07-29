import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export type EnvWriteResult = "created" | "updated" | "added"

// dotenv files we look at for an existing key, in priority order.
const ENV_FILE_NAMES = [
  ".env.local",
  ".env",
  ".env.development",
  ".env.development.local",
]

export interface FoundApiKey {
  api_key: string
  source: string // e.g. ".env.local" or "environment"
}

// Look for an existing SEAM_API_KEY: first the process environment, then the
// project's dotenv files. Returns the first hit so the wizard can skip auth.
export function findExistingApiKey(root: string): FoundApiKey | null {
  const from_process = process.env.SEAM_API_KEY?.trim()
  if (from_process != null && from_process.length > 0) {
    return { api_key: from_process, source: "environment" }
  }

  for (const file_name of ENV_FILE_NAMES) {
    const file_path = join(root, file_name)
    if (!existsSync(file_path)) continue
    const match = readFileSync(file_path, "utf8").match(
      /^\s*SEAM_API_KEY\s*=\s*(.+?)\s*$/m
    )
    const value = match?.[1]?.replace(/^["']|["']$/g, "").trim()
    if (value != null && value.length > 0) {
      return { api_key: value, source: file_name }
    }
  }

  return null
}

// Upsert a KEY=value line into a dotenv file without disturbing other entries.
// Returns what happened so the wizard can report it accurately.
export function upsertEnvVar(
  file_path: string,
  key: string,
  value: string
): EnvWriteResult {
  const line = `${key}=${value}`

  if (!existsSync(file_path)) {
    writeFileSync(file_path, `${line}\n`)
    return "created"
  }

  const content = readFileSync(file_path, "utf8")
  const existing_line = new RegExp(`^${key}=.*$`, "m")

  if (existing_line.test(content)) {
    writeFileSync(file_path, content.replace(existing_line, line))
    return "updated"
  }

  const separator = content.length === 0 || content.endsWith("\n") ? "" : "\n"
  writeFileSync(file_path, `${content}${separator}${line}\n`)
  return "added"
}
