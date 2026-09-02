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
