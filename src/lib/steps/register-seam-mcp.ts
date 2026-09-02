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
