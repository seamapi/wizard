// Guards the integration agent away from the developer's secret files. `.env`
// (and `.env.local`, `.env.production`, …) routinely hold secrets beyond the
// Seam key — database URLs, Stripe keys, etc. — that must never be read into the
// model context. `.env.example` is the value-less template the wizard writes, so
// it stays readable.

// Tool-input fields that carry a filesystem path across the built-in tools:
// Read/Edit/Write use `file_path`, Grep/Glob/Ls use `path`, Grep also takes a
// `glob`, and notebook tools use `notebook_path`.
const PATH_BEARING_KEYS = [
  'file_path',
  'path',
  'notebook_path',
  'glob',
] as const

// True for `.env` and `.env.*` at any directory depth, except `.env.example`.
export function isSecretFilePath(candidate: string): boolean {
  const basename = candidate.split(/[/\\]/).pop() ?? candidate
  if (basename === '.env.example') return false
  return basename === '.env' || basename.startsWith('.env.')
}

// True when a tool's input targets a secret file via any of its path-bearing
// fields. Used by the PreToolUse deny hook, which fires for every tool (so a
// deny overrides the broad `Read` allow and covers Grep/Edit/Write too).
export function toolInputTouchesSecret(toolInput: unknown): boolean {
  if (typeof toolInput !== 'object' || toolInput == null) return false
  const record = toolInput as Record<string, unknown>
  for (const key of PATH_BEARING_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && isSecretFilePath(value)) return true
  }
  return false
}
