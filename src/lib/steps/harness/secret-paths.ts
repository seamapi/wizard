// Guards the integration agent away from the developer's secret files. `.env`
// (and `.env.local`, `.env.production`, …) routinely hold secrets beyond the
// Seam key — database URLs, Stripe keys, etc. — that must never be read into the
// model context. `.env.example` is the value-less template the wizard writes, so
// it stays readable.

// Tool-input fields that carry a filesystem path across the built-in tools of
// both harnesses. Claude Agent SDK: Read/Edit/Write use `file_path`, Grep/Glob
// use `path` + `glob`, notebooks use `notebook_path`. pi: Read/Grep/Find use
// `path`, Grep/Find also take `glob`, Ls uses `dir`/`directory`.
const PATH_BEARING_KEYS = [
  'file_path',
  'path',
  'notebook_path',
  'glob',
  'dir',
  'directory',
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

// Drop lines a grep surfaced from a secret file. The PreToolUse deny only fires
// when a tool *names* a secret path, so a repo-wide grep (path ".") still scans
// `.env` and returns its matching lines; this strips them from the output before
// it reaches the model. Each grep line is prefixed with its source file
// (`path:line:text` in content mode, or a bare `path` in files-with-matches
// mode), so the leading token is the file to test.
export function redactSecretGrepLines(output: string): string {
  const lines = output.split('\n')
  const kept = lines.filter((line) => {
    const leadingPath = line.split(':', 1)[0] ?? line
    return !isSecretFilePath(leadingPath)
  })
  return kept.length === lines.length ? output : kept.join('\n')
}
