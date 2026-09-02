import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type PluginTarget = 'claude-code' | 'universal'

// The official Seam plugin: 3 integration skills + the Seam MCP.
const SEAM_PLUGIN = 'seamapi/seam-plugin'

// Install the plugin's three skills into .claude/skills. We must be
// non-interactive (`-y`) — the wizard spawns this with stdin ignored, and
// without a target the `skills` CLI prompts for an agent and installs nothing.
// We target `claude-code` explicitly so the skills land in .claude/skills,
// which is exactly where the embedded agent reads them (settingSources:
// ["project"]) and where Claude Code picks them up too.
export const SEAM_PLUGIN_NPX_COMMAND = [
  'npx',
  'skills',
  'add',
  SEAM_PLUGIN,
  '-y',
  '-a',
  'claude-code',
]

// Claude Code installs plugins via in-app slash commands, which an external CLI
// can't drive — so we print these for the user to run. This path also wires up
// the Seam MCP.
export const CLAUDE_CODE_COMMANDS = [
  '/plugin marketplace add seamapi/seam-plugin',
  '/plugin install seam@seamapi',
]

// Detect Claude Code so we print its slash commands instead of running npx.
export function detectPluginTarget(root: string): PluginTarget {
  const hasClaudeCode =
    existsSync(join(root, '.claude')) || existsSync(join(root, 'CLAUDE.md'))
  return hasClaudeCode ? 'claude-code' : 'universal'
}
