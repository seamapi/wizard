import { query } from '@anthropic-ai/claude-agent-sdk'

import type { Sdk } from './detect-project.js'

// The official Seam MCP (same server the seam-plugin wires up).
const SEAM_MCP_URL = 'https://mcp.seam.co/mcp'

// Read/search/write + the docs MCP. Deliberately no Bash, no subagents, no task
// tools: the agent writes integration code, it does not run the developer's
// shell. `mcp__seam-docs__*` grants every seam-docs tool.
const ALLOWED_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'Edit',
  'Write',
  'WebFetch',
  'mcp__seam-docs__*',
]

export type IntegrateEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'done'; ok: boolean; summary: string; cost_usd: number | null }

export interface RunIntegrationArgs {
  root: string
  sdk: Sdk
  workspace_name: string
  goal: string
  inference: { base_url: string; token: string }
  // The detected framework + chosen mode, so the agent fetches the matching
  // reference app from the Seam MCP (get_example_app) to model its work on.
  framework?: string | null
  mode?: 'full_api' | 'customer_portal'
  signal: AbortSignal
  onEvent: (event: IntegrateEvent) => void
}

// Drive the Claude Agent SDK to write the integration into the developer's
// project, routed through Seam-hosted inference. Streams progress via onEvent;
// resolves when the agent finishes or the signal aborts.
export async function runIntegration(args: RunIntegrationArgs): Promise<void> {
  const {
    root,
    sdk,
    workspace_name: workspaceName,
    goal,
    inference,
    framework,
    mode,
    signal,
    onEvent,
  } = args
  const abortController = new AbortController()
  const forwardAbort = (): void => abortController.abort()
  signal.addEventListener('abort', forwardAbort, { once: true })

  try {
    for await (const message of query({
      prompt: goal,
      options: {
        cwd: root,
        // Model depends on the chosen mode (see modelForMode): the customer-portal
        // path is a small, high-value surface, so it runs on Opus 4.8; the broader
        // full-API path runs on cheap Haiku 4.5. medium effort trims the thinking
        // spend, and maxBudgetUsd is a hard per-run dollar ceiling.
        model: modelForMode(mode),
        effort: 'medium',
        maxBudgetUsd: 100,
        env: buildAgentEnv(inference),
        allowedTools: ALLOWED_TOOLS,
        // Auto-apply file edits so the agent runs uninterrupted; the developer
        // reviews the result as a git diff afterward. Read/search tools and the
        // docs MCP are read-only, so nothing destructive runs unattended.
        permissionMode: 'acceptEdits',
        mcpServers: {
          // Wired exactly like the seam-plugin: mcp-remote bridges to the hosted
          // Seam MCP and runs the OAuth browser flow on first use, caching the
          // token in ~/.mcp-auth. The developer's Claude Code (also using
          // mcp-remote to the same server) then reuses it, already authenticated.
          'seam-docs': {
            command: 'npx',
            args: ['-y', 'mcp-remote', SEAM_MCP_URL],
          },
        },
        // Pick up any Seam skill installed into the project's .claude/skills.
        settingSources: ['project'],
        skills: 'all',
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: buildSystemAppend(sdk, workspaceName, framework, mode),
        },
        maxTurns: 40,
        abortController,
      },
    })) {
      if (signal.aborted) break

      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const text = block.text.trim()
            if (text.length > 0) onEvent({ kind: 'text', text })
          } else if (block.type === 'tool_use') {
            onEvent({
              kind: 'tool',
              name: block.name,
              detail: describeToolInput(block.input),
            })
          }
        }
      } else if (message.type === 'result') {
        const ok = message.subtype === 'success'
        onEvent({
          kind: 'done',
          ok,
          summary: ok ? message.result : '',
          cost_usd:
            typeof message.total_cost_usd === 'number'
              ? message.total_cost_usd
              : null,
        })
      }
    }
  } finally {
    signal.removeEventListener('abort', forwardAbort)
  }
}

// The embedded agent's model depends on the mode the developer chose. The
// customer-portal integration is small but high-value (embedded portal, deep
// links), so it runs on Opus 4.8; the broader full-API path runs on cheap Haiku
// 4.5. Defaults to Haiku when the mode is unknown.
function modelForMode(
  mode: 'full_api' | 'customer_portal' | undefined,
): string {
  return mode === 'customer_portal' ? 'claude-opus-4-8' : 'claude-haiku-4-5'
}

function buildSystemAppend(
  sdk: Sdk,
  workspaceName: string,
  framework?: string | null,
  mode?: 'full_api' | 'customer_portal',
): string {
  const language = sdk === 'python' ? 'Python' : 'JavaScript/TypeScript'
  const frameworkLabel = framework ?? "this project's framework"
  const modeLabel = mode === 'customer_portal' ? 'Customer Portal' : 'full-API'
  return [
    `You are the Seam integration agent, embedded in the seam-wizard CLI.`,
    `The developer has just connected their Seam account (workspace "${workspaceName}"),`,
    `and their SEAM_API_KEY is already saved in a local .env file. This is a ${language} project.`,
    ``,
    `Before writing any code:`,
    `- Fetch the reference integration: call mcp__seam-docs__list_example_apps, then`,
    `  mcp__seam-docs__get_example_app to pull the example matching ${frameworkLabel} and the`,
    `  ${modeLabel} approach. Model your integration on it — match its structure and Seam API`,
    `  usage — but ADAPT it to this project's actual framework version, conventions, and file`,
    `  layout. Do not copy it verbatim, and don't add files this project doesn't need.`,
    `- Find and read the installed Seam skill. Glob for a directory named like "*seam*" under`,
    `  .claude/skills and .agents/skills, and read its SKILL.md and any referenced files.`,
    `- Use the seam-docs MCP tools (prefixed mcp__seam-docs__) to confirm current Seam API usage.`,
    `  Prefer Access Grants for granting a person access — they are Seam's recommended API.`,
    `- Read the surrounding project files first and match its language, framework, and conventions.`,
    ``,
    `Then implement exactly what the developer asked for — nothing more. Load SEAM_API_KEY from the`,
    `existing .env; never hardcode or print it. Keep changes minimal and idiomatic. When finished,`,
    `give a short summary of the files you changed and how to run the result.`,
  ].join('\n')
}

// Route the embedded agent through Seam-hosted inference: point the SDK at the
// Seam proxy with the scoped wizard token, and drop any developer Anthropic key
// so it can't override the proxy routing. The SDK reads credentials from the
// child-process env (ANTHROPIC_AUTH_TOKEN is sent as a Bearer, which is what the
// proxy authenticates).
function buildAgentEnv(inference: {
  base_url: string
  token: string
}): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null) env[key] = value
  }
  delete env['ANTHROPIC_API_KEY']
  env['ANTHROPIC_BASE_URL'] = inference.base_url
  env['ANTHROPIC_AUTH_TOKEN'] = inference.token
  return env
}

// Pull the most useful identifier out of a tool's input for a one-line UI label,
// without asserting the input's shape.
function describeToolInput(input: unknown): string {
  return (
    stringField(input, 'file_path') ??
    stringField(input, 'pattern') ??
    stringField(input, 'query') ??
    stringField(input, 'url') ??
    ''
  )
}

function stringField(input: unknown, key: string): string | null {
  if (typeof input !== 'object' || input === null || !(key in input)) {
    return null
  }
  const value = (input as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}
