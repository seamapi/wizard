# Agent Grant Registration and `.env` Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the wizard installs the Seam plugin skills, register the *authenticated* Seam MCP (`https://mcp.seam.co/mcp/authenticated`) with the developer's coding agent — via `claude mcp add` when Claude Code is detected, by printing the equivalent `.mcp.json` snippet otherwise — and refuse to write `SEAM_API_KEY` through a symlinked `.env`.

**Architecture:** One new module, `src/lib/steps/register-seam-mcp.ts`, holds every constant and string this feature needs (the `claude mcp add` argv, the `.mcp.json` snippet, the three per-tool hints, the printed-notice composer) plus a thin runner that spawns the argv through the existing `runInstall` seam and maps failure to a printed fallback. `src/lib/app.tsx`'s `install-plugin` phase calls the runner, reports the outcome on `wizard_install_finished`, and renders the composed notices through the existing `addMessage`. `src/lib/env-file.ts` gains an `lstat` guard and a fourth `EnvWriteResult` variant that the three save paths propagate so the Ink app can tell the developer to add the key by hand.

**Tech Stack:** TypeScript (ESM, `type: module`), React + Ink 7 for the TUI, vitest 4 (`npm test`), eslint 9 / neostandard + prettier, Node >= 22.12.

**Spec:** `/Users/philchmalts/Documents/development/seam-connect/docs/superpowers/specs/2026-09-01-api-key-bootstrap-delegated-agent-merge-design.md` — this plan is **Workstream C** (`seamapi/wizard`). Workstream A shipped as seam-connect#17512; Workstream B (seam-ai) has its own plan in its own repo. Read spec §2 (Invariant), §3 (as-is facts), and §5.C before starting.

## Global Constraints

- Branch: `phil/pla-2951-agent-grant-registration` in `/Users/philchmalts/Documents/development/wizard` (already checked out, off `main` at tag `0.44.2`). Do not `cd` outside it. Dependencies are already installed — do **not** run `npm ci` or `npm install`.
- Tests: `npm test` (`vitest run --coverage`, whole suite, fast) or a single file with `npx vitest run <path>`. Never call a live service from a test.
- Lint: `npm run lint` (`eslint .` then `prettier --check`). Format: `npm run format`. Typecheck: `npm run typecheck` (`tsc`). All three are project-wide and fast enough to run per task.
- **Invariant (spec §2):** the API key is never printed to the terminal and never enters the agent's context; only the `seam_wiz_` inference token reaches the subprocess env. Nothing in this PR may log, echo, or pass `SEAM_API_KEY` — the new `claude mcp add` spawn passes no `env` and no key, and the symlink-refusal message names the variable, never a value.
- **No change to the embedded agent harnesses.** `src/lib/steps/harness/anthropic.ts:10` and `src/lib/steps/harness/pi.ts:16` keep `const SEAM_MCP_URL = 'https://mcp.seam.co/mcp'` (anonymous). They only need docs (spec §5.C.4). Do not touch those files.
- No change to `seamapi/seam-plugin`'s registered URL, and keep `CLAUDE_CODE_COMMANDS` (the `/plugin` lines) as the optional docs-plugin path (spec §6).
- Style, per the existing code: `camelCase` locals and functions; `snake_case` only for analytics property keys and existing interface fields (`api_key`); prettier with `semi: false`, `singleQuote: true`, `jsxSingleQuote: true`; `no-console` is an eslint error — all output goes through `addMessage`; `@typescript-eslint/no-non-null-assertion` is an error; relative imports of `..`/`../**` are **forbidden** — reach across directories with the `lib/` path alias (e.g. `import { runInstall } from 'lib/run-install.js'`), same-directory `./x.js` is fine.
- Imports are sorted by `simple-import-sort` in these groups: `node:` · packages · `@seamapi/wizard` · `eval|lib|test` aliases · other · `./` relative. Run `npm run format` if the order is ever in doubt.
- Every comment added must earn its place: delete it if it would read identically at every similar call site, if a test already states the behavior, or if it is addressed to a reviewer.
- Every commit message mentions `PLA-2951` and ends with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/steps/register-seam-mcp.ts` | Every string and decision for authenticated-MCP registration: the `claude mcp add` argv, the `.mcp.json` snippet, the Cursor/Codex/OpenCode hints, the notice composer, and the runner that spawns the argv | **Create** |
| `src/lib/steps/register-seam-mcp.test.ts` | Unit tests for that module: exact argv, snippet JSON, hints, runner outcomes (injected runner), composed notices | **Create** |
| `src/lib/app.tsx` | The Ink app. `install-plugin` phase (lines 725-780) runs the skills install, then registration; reports `wizard_install_finished`; renders notices | Modify the `install-plugin` effect, the import block, and the four env-write call sites |
| `src/lib/screens/done.tsx` | Final screen | Add the exported `AGENT_CONSENT_NOTICE` copy line below the card |
| `src/lib/screens/done.test.tsx` | Done-screen render tests | Add one test for the consent copy |
| `src/lib/env-file.ts` | dotenv read/write helpers | `lstat` guard in `upsertEnvVar`, new `'symlink-refused'` variant, exported refusal message |
| `src/lib/env-file.test.ts` | Unit tests for those helpers | Add symlink tests |
| `src/lib/steps/authenticate.ts` | Pure auth logic | `saveVerifiedKey` returns the env result; `AuthResult` carries it |
| `src/lib/steps/authenticate.test.ts` | Unit tests for auth | Add one propagation test |
| `src/lib/steps/connect-web.ts` | Browser → CLI key handoff | `WebConnectResult` carries the env result |

Task order: 1 (pure strings) → 2 (runner) → 3 (app wiring + analytics + done copy) → 4 (`.env` hardening, independent of 1-3) → 5 (verify + PR).

---

### Task 1: The registration constants, snippet, and hints

**Files:**
- Create: `src/lib/steps/register-seam-mcp.ts`
- Create: `src/lib/steps/register-seam-mcp.test.ts`

**Interfaces:**
- Consumes: `type PluginTarget = 'claude-code' | 'universal'` from `./install-seam-plugin.js` (already exported at `src/lib/steps/install-seam-plugin.ts:4`).
- Produces (all used by Tasks 2 and 3):
  - `const AUTHENTICATED_SEAM_MCP_URL: string`
  - `const SEAM_MCP_SERVER_NAME: string`
  - `const CLAUDE_MCP_ADD_COMMAND: string[]`
  - `function mcpJsonSnippet(): string`
  - `const UNIVERSAL_MCP_HINTS: readonly string[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/steps/register-seam-mcp.test.ts`:

```ts
import { expect, test } from 'vitest'

import {
  AUTHENTICATED_SEAM_MCP_URL,
  CLAUDE_MCP_ADD_COMMAND,
  mcpJsonSnippet,
  SEAM_MCP_SERVER_NAME,
  UNIVERSAL_MCP_HINTS,
} from './register-seam-mcp.js'

test('CLAUDE_MCP_ADD_COMMAND is the exact non-interactive argv', () => {
  expect(CLAUDE_MCP_ADD_COMMAND).toEqual([
    'claude',
    'mcp',
    'add',
    '--transport',
    'http',
    '--scope',
    'project',
    'seam',
    'https://mcp.seam.co/mcp/authenticated',
  ])
})

test('mcpJsonSnippet is valid JSON registering the authenticated URL', () => {
  const snippet = JSON.parse(mcpJsonSnippet()) as {
    mcpServers: Record<string, { type: string; url: string }>
  }

  expect(Object.keys(snippet.mcpServers)).toEqual([SEAM_MCP_SERVER_NAME])
  expect(snippet.mcpServers[SEAM_MCP_SERVER_NAME]).toEqual({
    type: 'http',
    url: AUTHENTICATED_SEAM_MCP_URL,
  })
})

test('UNIVERSAL_MCP_HINTS names one config file per supported tool', () => {
  expect(UNIVERSAL_MCP_HINTS).toHaveLength(3)
  expect(UNIVERSAL_MCP_HINTS[0]).toContain('Cursor')
  expect(UNIVERSAL_MCP_HINTS[0]).toContain('.cursor/mcp.json')
  expect(UNIVERSAL_MCP_HINTS[1]).toContain('Codex')
  expect(UNIVERSAL_MCP_HINTS[1]).toContain('.codex/config.toml')
  expect(UNIVERSAL_MCP_HINTS[2]).toContain('OpenCode')
  expect(UNIVERSAL_MCP_HINTS[2]).toContain('opencode.json')
  for (const hint of UNIVERSAL_MCP_HINTS) {
    expect(hint.split('\n')).toHaveLength(1)
  }
})

// The anonymous /mcp is the plugin's and the embedded harnesses' server. Every
// URL this module hands the developer's own agent must be the authenticated one,
// or the agent gets docs instead of a delegated grant.
test('nothing this module emits points at the anonymous MCP', () => {
  const anonymousUrl = /mcp\.seam\.co\/mcp(?!\/authenticated)/

  for (const emitted of [
    CLAUDE_MCP_ADD_COMMAND.join(' '),
    mcpJsonSnippet(),
    ...UNIVERSAL_MCP_HINTS,
  ]) {
    expect(emitted).not.toMatch(anonymousUrl)
  }
})

test('nothing this module emits could carry an API key', () => {
  for (const emitted of [
    CLAUDE_MCP_ADD_COMMAND.join(' '),
    mcpJsonSnippet(),
    ...UNIVERSAL_MCP_HINTS,
  ]) {
    expect(emitted).not.toContain('SEAM_API_KEY')
    expect(emitted).not.toMatch(/seam_[A-Za-z0-9]/)
  }
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts`

Expected: FAIL — the suite cannot resolve `./register-seam-mcp.js` ("Failed to load url ./register-seam-mcp.js").

- [ ] **Step 3: Write the module**

Create `src/lib/steps/register-seam-mcp.ts`:

```ts
// The authenticated Seam MCP. Unlike the anonymous https://mcp.seam.co/mcp the
// plugin and the embedded harnesses use, this endpoint answers an unauthenticated
// request with 401 + WWW-Authenticate, which is what makes a coding agent start
// the OAuth consent flow and end up on its own delegated grant instead of
// borrowing the app's key from .env.
export const AUTHENTICATED_SEAM_MCP_URL =
  'https://mcp.seam.co/mcp/authenticated'

export const SEAM_MCP_SERVER_NAME = 'seam'

// Project scope writes .mcp.json in the project root, so the registration
// travels with the repo the wizard just set up. No flag here prompts, so the
// wizard can spawn it with stdin ignored like every other install.
export const CLAUDE_MCP_ADD_COMMAND = [
  'claude',
  'mcp',
  'add',
  '--transport',
  'http',
  '--scope',
  'project',
  SEAM_MCP_SERVER_NAME,
  AUTHENTICATED_SEAM_MCP_URL,
]

// What `claude mcp add` would have written, for the developer to paste when the
// CLI is missing or another agent is in use.
export function mcpJsonSnippet(): string {
  return JSON.stringify(
    {
      mcpServers: {
        [SEAM_MCP_SERVER_NAME]: {
          type: 'http',
          url: AUTHENTICATED_SEAM_MCP_URL,
        },
      },
    },
    null,
    2,
  )
}

export const UNIVERSAL_MCP_HINTS = [
  `Cursor — add the same mcpServers block to .cursor/mcp.json`,
  `Codex — add [mcp_servers.${SEAM_MCP_SERVER_NAME}] with url = "${AUTHENTICATED_SEAM_MCP_URL}" to ~/.codex/config.toml`,
  `OpenCode — add "${SEAM_MCP_SERVER_NAME}": { "type": "remote", "url": "${AUTHENTICATED_SEAM_MCP_URL}" } under "mcp" in opencode.json`,
] as const
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts`

Expected: PASS — 5 tests.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: both exit 0 with no findings. If prettier complains about the new file, run `npm run format` and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/lib/steps/register-seam-mcp.ts src/lib/steps/register-seam-mcp.test.ts
git commit -m "feat(mcp): add the authenticated Seam MCP registration constants

The claude mcp add argv, the equivalent .mcp.json snippet, and one-line
Cursor/Codex/OpenCode hints, all built from a single authenticated-URL
constant. Tests pin the exact argv and assert nothing emitted here points
at the anonymous /mcp or could carry an API key.

PLA-2951

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The registration runner

**Files:**
- Modify: `src/lib/steps/register-seam-mcp.ts` (append the runner below the constants from Task 1)
- Modify: `src/lib/steps/register-seam-mcp.test.ts` (append the runner tests)

**Interfaces:**
- Consumes: `runInstall(command: string[], cwd: string, onLine: (line: string) => void): Promise<void>` from `lib/run-install.js`. It spawns with `stdio: ['ignore', 'pipe', 'pipe']`, `shell: false`, no `env` override (so the child inherits the wizard's environment and nothing key-bearing is added); it rejects with the spawn `error` event — an `Error` whose `code` is `'ENOENT'` when the binary is missing — and with `new Error("claude exited with code <n>")` on a non-zero close. Also `CLAUDE_MCP_ADD_COMMAND` from Task 1.
- Produces:
  - `type McpRegistration = 'claude_cli' | 'printed' | 'failed'`
  - `type RunCommand = (command: string[], cwd: string, onLine: (line: string) => void) => Promise<void>`
  - `function registerSeamMcpWithClaudeCli(args: { root: string; onLine: (line: string) => void; runCommand?: RunCommand }): Promise<'claude_cli' | 'printed'>`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/steps/register-seam-mcp.test.ts`:

```ts
test('registerSeamMcpWithClaudeCli reports claude_cli after a clean run', async () => {
  const calls: Array<{ command: string[]; cwd: string }> = []

  const registration = await registerSeamMcpWithClaudeCli({
    root: '/tmp/seam-wizard-project',
    onLine: () => {},
    runCommand: async (command, cwd) => {
      calls.push({ command, cwd })
    },
  })

  expect(registration).toBe('claude_cli')
  expect(calls).toEqual([
    {
      command: CLAUDE_MCP_ADD_COMMAND,
      cwd: '/tmp/seam-wizard-project',
    },
  ])
})

// The developer may not have the Claude Code CLI on PATH at all: spawn rejects
// with ENOENT before anything runs, and the wizard has to fall back to printing.
test('registerSeamMcpWithClaudeCli reports printed when the binary is missing', async () => {
  const registration = await registerSeamMcpWithClaudeCli({
    root: '/tmp/seam-wizard-project',
    onLine: () => {},
    runCommand: async () => {
      throw Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })
    },
  })

  expect(registration).toBe('printed')
})

test('registerSeamMcpWithClaudeCli reports printed on a non-zero exit', async () => {
  const registration = await registerSeamMcpWithClaudeCli({
    root: '/tmp/seam-wizard-project',
    onLine: () => {},
    runCommand: async () => {
      throw new Error('claude exited with code 1')
    },
  })

  expect(registration).toBe('printed')
})

test('registerSeamMcpWithClaudeCli streams the command output it is given', async () => {
  const lines: string[] = []

  await registerSeamMcpWithClaudeCli({
    root: '/tmp/seam-wizard-project',
    onLine: (line) => lines.push(line),
    runCommand: async (_command, _cwd, onLine) => {
      onLine('Added HTTP MCP server seam')
    },
  })

  expect(lines).toEqual(['Added HTTP MCP server seam'])
})
```

Extend the existing import in that file so it also pulls `registerSeamMcpWithClaudeCli` (keep the named imports alphabetical for `simple-import-sort`):

```ts
import {
  AUTHENTICATED_SEAM_MCP_URL,
  CLAUDE_MCP_ADD_COMMAND,
  mcpJsonSnippet,
  registerSeamMcpWithClaudeCli,
  SEAM_MCP_SERVER_NAME,
  UNIVERSAL_MCP_HINTS,
} from './register-seam-mcp.js'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts`

Expected: FAIL — `registerSeamMcpWithClaudeCli is not a function` (or a TS/resolve error on the missing export) on the four new tests; the five from Task 1 still pass.

- [ ] **Step 3: Implement the runner**

In `src/lib/steps/register-seam-mcp.ts`, add the import at the top (packages/aliases group, above nothing else — this is the file's only import):

```ts
import { runInstall } from 'lib/run-install.js'
```

Add the types directly under `AUTHENTICATED_SEAM_MCP_URL`'s block:

```ts
// What the run did about MCP registration, as reported on
// wizard_install_finished. 'printed' covers both fallbacks — a missing or
// failing CLI, and a non-Claude-Code project that only gets the snippet.
// 'failed' is the caller's outcome when the registration step itself threw, so
// the developer got neither a registration nor a snippet.
export type McpRegistration = 'claude_cli' | 'printed' | 'failed'

export type RunCommand = (
  command: string[],
  cwd: string,
  onLine: (line: string) => void,
) => Promise<void>
```

Add the runner at the bottom of the file, below `UNIVERSAL_MCP_HINTS`:

```ts
// Register the authenticated MCP with the Claude Code CLI, in the project the
// wizard is setting up. Any spawn failure — no `claude` on PATH (ENOENT), or a
// non-zero exit — is a fallback, not an error: the caller prints the snippet
// instead. `runCommand` is injected so a test can drive both outcomes.
export async function registerSeamMcpWithClaudeCli({
  root,
  onLine,
  runCommand = runInstall,
}: {
  root: string
  onLine: (line: string) => void
  runCommand?: RunCommand
}): Promise<'claude_cli' | 'printed'> {
  try {
    await runCommand(CLAUDE_MCP_ADD_COMMAND, root, onLine)
    return 'claude_cli'
  } catch {
    return 'printed'
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts`

Expected: PASS — 9 tests.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: both exit 0. In particular there must be no `no-restricted-imports` error: `runInstall` is imported as `lib/run-install.js`, never `../run-install.js`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/steps/register-seam-mcp.ts src/lib/steps/register-seam-mcp.test.ts
git commit -m "feat(mcp): spawn claude mcp add with a printed fallback

registerSeamMcpWithClaudeCli runs the argv through the same runInstall
spawn the SDK and plugin installs use (stdin ignored, no env override, so
no API key can reach the child) and maps a missing binary or non-zero exit
to 'printed' so the caller can show the .mcp.json snippet instead.

PLA-2951

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Wire registration into the install-plugin phase, analytics, and the done screen

**Files:**
- Modify: `src/lib/steps/register-seam-mcp.ts` (add the notice composer)
- Modify: `src/lib/steps/register-seam-mcp.test.ts` (composer tests)
- Modify: `src/lib/app.tsx` — the import block (lines 74-79) and the `install-plugin` effect (lines 725-780)
- Modify: `src/lib/screens/done.tsx`
- Modify: `src/lib/screens/done.test.tsx`

**Interfaces:**
- Consumes from Tasks 1-2: `CLAUDE_MCP_ADD_COMMAND`, `mcpJsonSnippet()`, `UNIVERSAL_MCP_HINTS`, `type McpRegistration`, `registerSeamMcpWithClaudeCli`. From existing code: `detectPluginTarget(root): PluginTarget`, `SEAM_PLUGIN_NPX_COMMAND`, `CLAUDE_CODE_COMMANDS` (`src/lib/steps/install-seam-plugin.ts`); `addMessage(message: { tone: 'ok' | 'info' | 'warn' | 'plain'; text: string }): void` (`app.tsx:205`); `trackInstallFinished(target: 'sdk' | 'plugin', ok: boolean, properties: Record<string, unknown>): void` (`app.tsx:288`) — its third parameter is already `Record<string, unknown>`, so adding `mcp_registration` needs no signature change; typing comes from declaring the value as `McpRegistration` at the call site.
- Produces:
  - `interface McpNotice { tone: 'info' | 'warn' | 'plain'; text: string }`
  - `function buildMcpRegistrationNotices(args: { target: PluginTarget; registration: McpRegistration }): McpNotice[]`
  - `const AGENT_CONSENT_NOTICE: string` exported from `src/lib/screens/done.js`

- [ ] **Step 1: Write the failing composer tests**

Append to `src/lib/steps/register-seam-mcp.test.ts` (and add `buildMcpRegistrationNotices` to that file's existing import list, keeping it alphabetical — it sorts first, before `CLAUDE_MCP_ADD_COMMAND`):

```ts
test('buildMcpRegistrationNotices confirms a CLI registration without reprinting it', () => {
  const notices = buildMcpRegistrationNotices({
    target: 'claude-code',
    registration: 'claude_cli',
  })

  expect(notices).toHaveLength(1)
  expect(notices[0]?.tone).toBe('info')
  expect(notices[0]?.text).toContain('Registered the Seam MCP')
  expect(notices.map((notice) => notice.text).join('\n')).not.toContain(
    'mcpServers',
  )
})

test('buildMcpRegistrationNotices prints the snippet when the CLI could not register', () => {
  const notices = buildMcpRegistrationNotices({
    target: 'claude-code',
    registration: 'printed',
  })
  const text = notices.map((notice) => notice.text).join('\n')

  expect(text).toContain('.mcp.json')
  expect(text).toContain('https://mcp.seam.co/mcp/authenticated')
  expect(JSON.parse(mcpJsonSnippet())).toBeTruthy()
  // A Claude Code project does not need another agent's config file named at it.
  expect(text).not.toContain('opencode.json')
})

test('buildMcpRegistrationNotices adds the per-tool hints for a universal project', () => {
  const text = buildMcpRegistrationNotices({
    target: 'universal',
    registration: 'printed',
  })
    .map((notice) => notice.text)
    .join('\n')

  for (const hint of UNIVERSAL_MCP_HINTS) {
    expect(text).toContain(hint)
  }
})

test('buildMcpRegistrationNotices warns and prints when registration failed', () => {
  const notices = buildMcpRegistrationNotices({
    target: 'claude-code',
    registration: 'failed',
  })
  const text = notices.map((notice) => notice.text).join('\n')

  expect(notices[0]?.tone).toBe('warn')
  expect(text).toContain(CLAUDE_MCP_ADD_COMMAND.join(' '))
  expect(text).toContain('https://mcp.seam.co/mcp/authenticated')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts`

Expected: FAIL — `buildMcpRegistrationNotices is not a function` on the four new tests.

- [ ] **Step 3: Implement the composer**

In `src/lib/steps/register-seam-mcp.ts`, add the `PluginTarget` type import (it belongs in the trailing `./` relative group, so it goes below the `lib/run-install.js` import):

```ts
import type { PluginTarget } from './install-seam-plugin.js'
```

Add the interface next to `McpRegistration`:

```ts
// A line for the Ink app to render. The tones are the app's own Msg tones minus
// 'ok', which is reserved there for a step that actually succeeded.
export interface McpNotice {
  tone: 'info' | 'warn' | 'plain'
  text: string
}
```

Add the composer at the bottom of the file, below `registerSeamMcpWithClaudeCli`:

```ts
export function buildMcpRegistrationNotices({
  target,
  registration,
}: {
  target: PluginTarget
  registration: McpRegistration
}): McpNotice[] {
  if (registration === 'claude_cli') {
    return [
      {
        tone: 'info',
        text: 'Registered the Seam MCP for Claude Code in .mcp.json (project scope)',
      },
    ]
  }

  const heading: McpNotice =
    registration === 'failed'
      ? {
          tone: 'warn',
          text: `Couldn't register the Seam MCP — run it yourself: ${CLAUDE_MCP_ADD_COMMAND.join(' ')}`,
        }
      : {
          tone: 'info',
          text: 'Add the Seam MCP to your coding agent — put this in .mcp.json:',
        }

  const snippetLines: McpNotice[] = mcpJsonSnippet()
    .split('\n')
    .map((line) => ({ tone: 'plain', text: `  ${line}` }))

  const hintLines: McpNotice[] =
    target === 'universal'
      ? UNIVERSAL_MCP_HINTS.map((hint) => ({ tone: 'plain', text: `  ${hint}` }))
      : []

  return [heading, ...snippetLines, ...hintLines]
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts`

Expected: PASS — 13 tests.

- [ ] **Step 5: Wire the install-plugin phase in `app.tsx`**

Add the new import to `src/lib/app.tsx` after the `./steps/integrate.js` import at line 79 (alphabetically `install-seam-plugin` < `integrate` < `register-seam-mcp`):

```tsx
import {
  buildMcpRegistrationNotices,
  type McpRegistration,
  registerSeamMcpWithClaudeCli,
} from './steps/register-seam-mcp.js'
```

Replace the whole body of the `install-plugin` effect (`src/lib/app.tsx:725-780`, the block whose comment begins `// install the official Seam plugin skills, then finish.`) with:

```tsx
  // install the official Seam plugin skills, then register the authenticated
  // Seam MCP so the developer's own agent gets a delegated grant instead of
  // reading the app's key out of .env. For Claude Code we additionally point at
  // the native /plugin path, which wires up the anonymous docs MCP.
  useEffect(() => {
    if (phase.t !== 'install-plugin') return
    const target = detectPluginTarget(root)

    let cancelled = false
    const streamLine = (line: string): void => {
      if (!cancelled) {
        setInstallLines((previous) => [...previous.slice(-3), line])
      }
    }
    const run = async (): Promise<void> => {
      installStartedAtRef.current = Date.now()
      let skillsInstalled = true
      try {
        await runInstall(SEAM_PLUGIN_NPX_COMMAND, root, streamLine)
      } catch {
        skillsInstalled = false
      }
      if (cancelled) return

      addMessage(
        skillsInstalled
          ? { tone: 'ok', text: 'Installed the Seam plugin skills' }
          : {
              tone: 'warn',
              text: `Couldn't install the plugin — run it yourself: ${SEAM_PLUGIN_NPX_COMMAND.join(' ')}`,
            },
      )

      let registration: McpRegistration = 'printed'
      if (target === 'claude-code') {
        try {
          registration = await registerSeamMcpWithClaudeCli({
            root,
            onLine: streamLine,
          })
        } catch {
          registration = 'failed'
        }
      }
      if (cancelled) return

      trackInstallFinished('plugin', skillsInstalled, {
        plugin_target: target,
        mcp_registration: registration,
      })
      for (const notice of buildMcpRegistrationNotices({
        target,
        registration,
      })) {
        addMessage(notice)
      }

      setInstallLines([])
      if (target === 'claude-code') {
        addMessage({
          tone: 'info',
          text: 'Claude Code: for the native plugin + seam-docs MCP, you can also run:',
        })
        for (const command of CLAUDE_CODE_COMMANDS) {
          addMessage({ tone: 'plain', text: `  ${command}` })
        }
      }
      setPhase({ t: 'offer-integrate' })
    }
    run().catch((error: unknown) => {
      if (cancelled) return
      setPhase({
        t: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The wizard hit an unexpected error.',
      })
    })
    return () => {
      cancelled = true
    }
  }, [phase.t])
```

Three things changed beyond the new registration: the streamed-line closure is hoisted so both spawns share it, the skills-install messages moved out of the `try`/`catch` so registration can run before the analytics event, and `trackInstallFinished` fires once with both properties.

- [ ] **Step 6: Add the done-screen consent copy**

In `src/lib/screens/done.tsx`, add the exported constant directly above the `DoneScreen` function (below the `IntegrationOutcome` interface):

```tsx
// Verbatim from the merge design: the developer is told, before they leave, that
// the agent authenticates itself rather than reusing the app's key.
export const AGENT_CONSENT_NOTICE =
  'Your coding agent will be asked to sign in to Seam and choose permissions the first time it uses a Seam tool.'
```

Render it in the outer column, between the assistant-link block and the "Press any key to exit" margin box (it sits outside the bordered card, which is too narrow for a sentence this long):

```tsx
      <Box
        flexDirection='column'
        alignItems='center'
        width={columns}
        marginTop={1}
        paddingX={2}
      >
        <Text color='gray'>{AGENT_CONSENT_NOTICE}</Text>
      </Box>
```

- [ ] **Step 7: Write the done-screen test**

Append to `src/lib/screens/done.test.tsx`, and add `AGENT_CONSENT_NOTICE` to its existing `./done.js` import:

```tsx
test('DoneScreen: says the agent will sign in and choose permissions', () => {
  const { lastFrame, unmount } = render(
    <DoneScreen
      workspaceName='Acme'
      workspaceId={WORKSPACE_ID}
      outcome={null}
      showCost={false}
    />,
  )
  try {
    // Ink wraps the sentence across rows, so compare on collapsed whitespace.
    const frame = (lastFrame() ?? '').replace(/\s+/g, ' ')
    expect(frame).toContain(AGENT_CONSENT_NOTICE)
  } finally {
    unmount()
  }
})

test('AGENT_CONSENT_NOTICE is the copy the merge design specifies', () => {
  expect(AGENT_CONSENT_NOTICE).toBe(
    'Your coding agent will be asked to sign in to Seam and choose permissions the first time it uses a Seam tool.',
  )
})
```

- [ ] **Step 8: Run the affected tests**

Run: `npx vitest run src/lib/steps/register-seam-mcp.test.ts src/lib/screens/done.test.tsx test/app.test.tsx`

Expected: PASS — 13 register-seam-mcp tests, 5 done-screen tests, and the pre-existing app tests unchanged. If the frame assertion fails, print `lastFrame()` to check the notice is not being clipped by the terminal height the test harness reports; widen the assertion to the first clause only if the sentence is genuinely truncated, and keep the exact-copy test as the authority.

- [ ] **Step 9: Lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: both exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/lib/steps/register-seam-mcp.ts src/lib/steps/register-seam-mcp.test.ts src/lib/app.tsx src/lib/screens/done.tsx src/lib/screens/done.test.tsx
git commit -m "feat(wizard): register the authenticated Seam MCP after the skills install

The install-plugin phase now runs claude mcp add in the project root when
Claude Code is detected, and prints the .mcp.json snippet (plus Cursor,
Codex, and OpenCode hints for a universal project) when it cannot. The
outcome rides on wizard_install_finished as mcp_registration, and the done
screen tells the developer their agent will sign in and pick permissions on
first use. The /plugin lines stay as the optional docs-plugin path.

PLA-2951

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Refuse to write `SEAM_API_KEY` through a symlink

**Files:**
- Modify: `src/lib/env-file.ts:1` (imports), `:4` (`EnvWriteResult`), `:103-126` (`upsertEnvVar`)
- Modify: `src/lib/env-file.test.ts`
- Modify: `src/lib/steps/authenticate.ts:5-19` (`AuthResult`), `:62-64` (`saveVerifiedKey`)
- Modify: `src/lib/steps/authenticate.test.ts`
- Modify: `src/lib/steps/connect-web.ts:18-21` (`WebConnectResult`), `:116`
- Modify: `src/lib/app.tsx` — `useCliKey` (~line 429), `useProjectKey` (~line 445), the `verify-paste` effect (~line 636), the `browser` effect (~line 584)

**Interfaces:**
- Consumes: `existsSync`, `readFileSync`, `writeFileSync` from `node:fs` (already imported in `env-file.ts`); `type ProjectEnvResult { env: EnvWriteResult; example: EnvWriteResult | 'unchanged'; gitignore: 'added' | 'unchanged' }` and `saveProjectApiKey(root: string, apiKey: string): ProjectEnvResult` (already exported).
- Produces:
  - `type EnvWriteResult = 'created' | 'updated' | 'added' | 'symlink-refused'` (fourth variant added)
  - `const ENV_SYMLINK_REFUSAL_MESSAGE: string`
  - `saveVerifiedKey(root: string, apiKey: string): ProjectEnvResult` (was `void`)
  - `interface AuthResult { workspace: SeamWorkspace; api_key: string; env: ProjectEnvResult }` (field added)
  - `interface WebConnectResult { workspace: SeamWorkspace; api_key: string; env: ProjectEnvResult }` (field added)

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/env-file.test.ts` (and add `symlinkSync` to its `node:fs` import list, and `ENV_SYMLINK_REFUSAL_MESSAGE` to its `./env-file.js` import list):

```ts
// A symlinked .env usually points at a shared secrets file outside the repo.
// Writing through it would edit that file — and it is exactly the case where
// the wizard cannot know the destination is the developer's to change.
test('upsertEnvVar refuses a symlinked file and leaves the target untouched', () => {
  const targetPath = join(dir, 'shared-secrets.env')
  const linkPath = join(dir, '.env')
  writeFileSync(targetPath, 'OTHER=1\n')
  symlinkSync(targetPath, linkPath)

  expect(upsertEnvVar(linkPath, 'SEAM_API_KEY', 'seam_new')).toBe(
    'symlink-refused',
  )
  expect(readFileSync(targetPath, 'utf8')).toBe('OTHER=1\n')
})

// existsSync follows the link, so a dangling one would otherwise look absent
// and get created at the far end.
test('upsertEnvVar refuses a dangling symlink without creating its target', () => {
  const targetPath = join(dir, 'missing-secrets.env')
  const linkPath = join(dir, '.env')
  symlinkSync(targetPath, linkPath)

  expect(upsertEnvVar(linkPath, 'SEAM_API_KEY', 'seam_new')).toBe(
    'symlink-refused',
  )
  expect(existsSync(targetPath)).toBe(false)
})

test('saveProjectApiKey reports the refusal and still ignores .env', () => {
  mkdirSync(join(dir, '.git'))
  const targetPath = join(dir, 'shared-secrets.env')
  writeFileSync(targetPath, 'OTHER=1\n')
  symlinkSync(targetPath, join(dir, '.env'))

  const result = saveProjectApiKey(dir, 'seam_new_key')

  expect(result.env).toBe('symlink-refused')
  expect(result.gitignore).toBe('added')
  expect(readFileSync(targetPath, 'utf8')).not.toContain('seam_new_key')
})

test('ENV_SYMLINK_REFUSAL_MESSAGE tells the developer what to do, without a key', () => {
  expect(ENV_SYMLINK_REFUSAL_MESSAGE).toContain('SEAM_API_KEY')
  expect(ENV_SYMLINK_REFUSAL_MESSAGE).toContain('symlink')
  expect(ENV_SYMLINK_REFUSAL_MESSAGE).not.toMatch(/seam_[A-Za-z0-9]/)
})
```

Append to `src/lib/steps/authenticate.test.ts` (add `symlinkSync` and `writeFileSync` to its `node:fs` import):

```ts
// The refusal is only useful if it reaches the Ink app, which reads it off the
// result of the save.
test('verifyAndSaveKey reports a symlinked .env instead of writing through it', async () => {
  get.mockResolvedValue(workspace)
  const targetPath = join(dir, 'shared-secrets.env')
  writeFileSync(targetPath, 'OTHER=1\n')
  symlinkSync(targetPath, join(dir, '.env'))

  const result = await verifyAndSaveKey(dir, 'seam_pasted_key')

  expect(result.env.env).toBe('symlink-refused')
  expect(readFileSync(targetPath, 'utf8')).toBe('OTHER=1\n')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/env-file.test.ts src/lib/steps/authenticate.test.ts`

Expected: FAIL — the `upsertEnvVar` symlink tests report `'updated'`/`'added'` instead of `'symlink-refused'` and show the target file rewritten; `ENV_SYMLINK_REFUSAL_MESSAGE` is undefined; `result.env` is undefined in the authenticate test.

- [ ] **Step 3: Add the guard to `env-file.ts`**

Change the imports on line 1 and the type on line 4:

```ts
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type EnvWriteResult =
  | 'created'
  | 'updated'
  | 'added'
  | 'symlink-refused'

export const ENV_SYMLINK_REFUSAL_MESSAGE =
  '.env is a symlink — the wizard did not write through it. Add SEAM_API_KEY to the real file yourself.'
```

Add the symlink check as the first thing `upsertEnvVar` does, above the `existsSync` branch (`existsSync` resolves the link, so it must not run first):

```ts
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
```

The rest of the function is unchanged.

- [ ] **Step 4: Propagate the result through the save paths**

In `src/lib/steps/authenticate.ts`, import the result type and add the field:

```ts
import {
  findExistingApiKey,
  type ProjectEnvResult,
  saveProjectApiKey,
} from 'lib/env-file.js'

export interface AuthResult {
  workspace: SeamWorkspace
  api_key: string
  env: ProjectEnvResult
}
```

and change the two functions at the bottom:

```ts
export async function verifyAndSaveKey(
  root: string,
  apiKey: string,
): Promise<AuthResult> {
  const trimmed = apiKey.trim()
  const workspace = await getWorkspaceForApiKey(trimmed)
  return { workspace, api_key: trimmed, env: saveProjectApiKey(root, trimmed) }
}

export function saveVerifiedKey(
  root: string,
  apiKey: string,
): ProjectEnvResult {
  return saveProjectApiKey(root, apiKey)
}
```

In `src/lib/steps/connect-web.ts`, extend the import and the result type, and return the env result:

```ts
import { type ProjectEnvResult, saveProjectApiKey } from 'lib/env-file.js'

export interface WebConnectResult {
  workspace: SeamWorkspace
  api_key: string
  env: ProjectEnvResult
}
```

```ts
  const workspace = await getWorkspaceForApiKey(payload.api_key)
  return {
    workspace,
    api_key: payload.api_key,
    env: saveProjectApiKey(root, payload.api_key),
  }
```

- [ ] **Step 5: Surface the refusal in `app.tsx`**

Extend the `./env-file.js` import at line 29:

```tsx
import {
  ensureProjectEnvConventions,
  ENV_SYMLINK_REFUSAL_MESSAGE,
  findExistingApiKey,
  type ProjectEnvResult,
} from './env-file.js'
```

Add this helper immediately below `addMessage` (`src/lib/app.tsx:205-206`):

```tsx
  const reportEnvWrite = (result: ProjectEnvResult): void => {
    if (result.env === 'symlink-refused') {
      addMessage({ tone: 'warn', text: ENV_SYMLINK_REFUSAL_MESSAGE })
    }
  }
```

Then call it at the four save sites. `useCliKey` (~line 429):

```tsx
  const useCliKey = (found: CliKeyResult): void => {
    try {
      reportEnvWrite(saveVerifiedKey(root, found.api_key))
      addMessage({
        tone: 'ok',
        text: `Using your Seam CLI login · workspace ${found.workspace.name} · saved to .env`,
      })
    } catch {
```

`useProjectKey` (~line 445) — only the `environment` branch writes a key:

```tsx
      if (found.source === 'environment') {
        reportEnvWrite(saveVerifiedKey(root, found.api_key))
      } else {
        ensureProjectEnvConventions(root)
      }
```

The `verify-paste` effect (~line 636):

```tsx
        const result = await verifyAndSaveKey(root, apiKey)
        if (cancelled) return
        reportEnvWrite(result.env)
        addMessage({ tone: 'ok', text: `Workspace: ${result.workspace.name}` })
```

The `browser` effect (~line 595), right after the `if (cancelled) return`:

```tsx
        if (cancelled) return
        reportEnvWrite(result.env)
        addMessage({
          tone: 'ok',
          text: `Connected · workspace ${result.workspace.name}`,
        })
```

- [ ] **Step 6: Run the affected tests**

Run: `npx vitest run src/lib/env-file.test.ts src/lib/steps/authenticate.test.ts test/app.test.tsx`

Expected: PASS — the four new `env-file` tests, the new authenticate test, every pre-existing `.env` preservation / `.env.example` / `.gitignore` test, and the app tests. No pre-existing assertion may be edited to make this pass: `saveProjectApiKey`'s `toEqual({ env: 'created', example: 'created', gitignore: 'added' })` must still hold for a plain file.

- [ ] **Step 7: Lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: both exit 0. `tsc` is what proves the three widened result types have no un-updated caller.

- [ ] **Step 8: Commit**

```bash
git add src/lib/env-file.ts src/lib/env-file.test.ts src/lib/steps/authenticate.ts src/lib/steps/authenticate.test.ts src/lib/steps/connect-web.ts src/lib/app.tsx
git commit -m "fix(env): refuse to write SEAM_API_KEY through a symlinked .env

existsSync resolves a symlink, so the wizard would happily write the key
into whatever the link pointed at — typically a shared secrets file outside
the repo that .gitignore does not cover. upsertEnvVar now lstats first and
returns 'symlink-refused' without writing; the save paths carry that result
up so the app tells the developer to add SEAM_API_KEY by hand. The
created/updated/added report and ensureGitignored are unchanged, and there
is no destination-approval prompt.

PLA-2951

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Final verification and PR

**Files:** none new.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`

Expected: every test file passes. Coverage is reported but not gated.

- [ ] **Step 2: Lint, format check, and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: both exit 0. If prettier reports a file, run `npm run format`, re-run, and amend the commit that introduced it.

- [ ] **Step 3: Confirm the invariant held**

Run:

```bash
git diff main...HEAD | grep -nE '^\+.*(SEAM_API_KEY|seam_[A-Za-z0-9]|apiKey)'
```

Expected: the only additions naming `SEAM_API_KEY` are the refusal message, the `env-file` tests, and the `AGENT_CONSENT_NOTICE`-adjacent test literals — never a value interpolated into a message, a log line, an argv, or a subprocess `env`. Then:

```bash
git diff main...HEAD -- src/lib/steps/harness/
```

Expected: no output. The harnesses keep the anonymous `https://mcp.seam.co/mcp`.

- [ ] **Step 4: Review the comments the branch added**

Run: `git diff main...HEAD -U0 -- src | grep -E '^\+\s*(//|/\*|\*)'`

For each: would it read identically at every similar site (generality)? Is a test already the explanation (test coverage)? Is it aimed at a reviewer (audience)? Delete any that fail and amend. The ones written here are meant to survive: each records a *why* the code cannot state — why the authenticated URL differs from the plugin's, why a spawn failure is a fallback rather than an error, why `lstat` has to precede `existsSync`.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin phil/pla-2951-agent-grant-registration
gh pr create --title "feat(wizard): register the authenticated Seam MCP and harden .env (PLA-2951)" --body "$(cat <<'EOF'
## Summary

A developer's coding agent that arrives via `seam wizard` had no Seam credential of its own, so in practice it borrowed the app's durable key out of `.env`. After this change the wizard registers the **authenticated** Seam MCP (`https://mcp.seam.co/mcp/authenticated`) with the agent, which answers an anonymous request with `401 + WWW-Authenticate` — so the agent runs the consent flow and ends up on its own short-lived, revocable delegated grant instead.

Workstream C of the merge design (`seam-connect: docs/superpowers/specs/2026-09-01-api-key-bootstrap-delegated-agent-merge-design.md`, §5.C). Workstream A shipped as seamapi/seam-connect#17512.

## Changes

- **New `src/lib/steps/register-seam-mcp.ts`** — the exact `claude mcp add --transport http --scope project seam https://mcp.seam.co/mcp/authenticated` argv, the equivalent `.mcp.json` snippet, one-line Cursor / Codex / OpenCode hints, and a runner that spawns the argv in the project root through the existing `runInstall` seam. A missing `claude` binary (ENOENT) or a non-zero exit falls back to printing the snippet.
- **`install-plugin` phase** — runs registration after the skills install; `wizard_install_finished` now carries `mcp_registration: 'claude_cli' | 'printed' | 'failed'` alongside `plugin_target`. The `/plugin` slash-command lines stay as the optional docs-plugin path.
- **Done screen** — "Your coding agent will be asked to sign in to Seam and choose permissions the first time it uses a Seam tool."
- **`env-file.ts`** — `upsertEnvVar` `lstat`s the target first and returns `'symlink-refused'` without writing, so the key never lands in a shared secrets file the link pointed at. The `created | updated | added` report and `ensureGitignored` are unchanged, and there is no destination-approval prompt. The refusal is surfaced by the app, which tells the developer to add `SEAM_API_KEY` by hand.
- **Unchanged on purpose** — the embedded agent harnesses keep the anonymous `https://mcp.seam.co/mcp` (they only need docs), and `seamapi/seam-plugin`'s registered URL is untouched.

The invariant holds throughout: the API key is never printed and never enters the agent's context. Only the `seam_wiz_` inference token reaches a subprocess env, and the new spawn passes no env at all.

## Test plan

- [x] `npm test` — new unit tests for the argv, the snippet's JSON, the hints, the three runner outcomes with an injected runner, the composed notices, the symlink refusal (live and dangling links, target byte-identical afterwards), and the propagation up through `verifyAndSaveKey`
- [x] `npm run lint && npm run typecheck`
- [ ] Manual: `npm run wizard` in a scratch project with `.claude/` present (expect a registered `.mcp.json`) and in one without (expect the printed snippet plus hints)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.
