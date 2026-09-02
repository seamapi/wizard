import { runInstall } from 'lib/run-install.js'

import type { PluginTarget } from './install-seam-plugin.js'

// The authenticated Seam MCP. Unlike the anonymous https://mcp.seam.co/mcp the
// plugin and the embedded harnesses use, this endpoint answers an unauthenticated
// request with 401 + WWW-Authenticate, which is what makes a coding agent start
// the OAuth consent flow and end up on its own delegated grant instead of
// borrowing the app's key from .env.
export const AUTHENTICATED_SEAM_MCP_URL =
  'https://mcp.seam.co/mcp/authenticated'

// What the run did about MCP registration, as reported on
// wizard_install_finished. 'printed' covers both fallbacks — a missing or
// failing CLI, and a non-Claude-Code project that only gets the snippet.
// 'failed' is the caller's outcome when the registration step itself threw, so
// the developer got neither a registration nor a snippet.
export type McpRegistration = 'claude_cli' | 'printed' | 'failed'

// A line for the Ink app to render. The tones are the app's own Msg tones minus
// 'ok', which is reserved there for a step that actually succeeded.
export interface McpNotice {
  tone: 'info' | 'warn' | 'plain'
  text: string
}

export type RunCommand = (
  command: string[],
  cwd: string,
  onLine: (line: string) => void,
) => Promise<void>

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
      ? UNIVERSAL_MCP_HINTS.map((hint) => ({
          tone: 'plain',
          text: `  ${hint}`,
        }))
      : []

  return [heading, ...snippetLines, ...hintLines]
}
