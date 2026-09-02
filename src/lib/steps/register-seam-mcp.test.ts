import { expect, test } from 'vitest'

import {
  AUTHENTICATED_SEAM_MCP_URL,
  buildMcpRegistrationNotices,
  CLAUDE_MCP_ADD_COMMAND,
  mcpJsonSnippet,
  registerSeamMcpWithClaudeCli,
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
