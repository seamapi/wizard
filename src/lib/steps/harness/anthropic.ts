import { type HookCallback, query } from '@anthropic-ai/claude-agent-sdk'

import {
  redactSecretGrepLines,
  toolInputTouchesSecret,
} from './secret-paths.js'
import type { Harness, HarnessRunStepArgs, StepRunResult } from './types.js'

const SEAM_MCP_URL = 'https://mcp.seam.co/mcp?agent=wizard'

// Read/search/write + the docs MCP. Deliberately no Bash, no subagents, no task
// tools: the agent writes integration code, it does not run the developer's
// shell. No WebFetch either — the agent gets its references from the Seam MCP,
// so arbitrary web egress is unnecessary and only widens the exfiltration
// surface. `mcp__seam__*` grants every Seam tool.
const ALLOWED_TOOLS = ['Read', 'Glob', 'Grep', 'Edit', 'Write', 'mcp__seam__*']

// Hard block on the developer's secret files: a deny here overrides the broad
// `Read` allow above and fires for every tool, so Read/Grep/Edit/Write can't
// touch `.env` (the system-prompt instruction alone is not enforcement).
const denySecretFileAccess: HookCallback = async (input) => {
  if (
    input.hook_event_name === 'PreToolUse' &&
    toolInputTouchesSecret(input.tool_input)
  ) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Reading .env / secret files is blocked. Load SEAM_API_KEY from the runtime environment instead.',
      },
    }
  }
  return {}
}

// The PreToolUse deny only fires when a tool *names* a secret path; a repo-wide
// grep (path ".") still scans `.env` and returns its lines. Strip those from the
// grep output before it reaches the model. Only the string form of the result is
// handled — a shape the redactor can't parse is left untouched.
const redactSecretsFromGrepOutput: HookCallback = async (input) => {
  if (input.hook_event_name !== 'PostToolUse') return {}
  if (input.tool_name !== 'Grep' || typeof input.tool_response !== 'string') {
    return {}
  }
  const redacted = redactSecretGrepLines(input.tool_response)
  if (redacted === input.tool_response) return {}
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: redacted,
    },
  }
}

// The control harness: drives the integration with the Claude Agent SDK.
export const anthropicHarness: Harness = {
  name: 'anthropic',
  async runStep(args: HarnessRunStepArgs): Promise<StepRunResult> {
    const {
      goal,
      cwd,
      model,
      maxBudgetUsd,
      systemAppend,
      agentEnv,
      signal,
      abortController,
      onText,
      onTool,
    } = args

    let ok = false
    let summary = ''
    let costUsd: number | null = null

    for await (const message of query({
      prompt: goal,
      options: {
        cwd,
        model,
        // medium effort trims the thinking spend; maxBudgetUsd is the budget
        // still left for this run.
        effort: 'medium',
        maxBudgetUsd,
        env: agentEnv,
        allowedTools: ALLOWED_TOOLS,
        // Auto-apply file edits so the agent runs uninterrupted; the developer
        // reviews the result as a git diff afterward. Read/search tools and the
        // docs MCP are read-only, so nothing destructive runs unattended.
        permissionMode: 'acceptEdits',
        // Block reads/writes of the developer's .env / secret files, and strip
        // any secret lines a broad grep still surfaces from them.
        hooks: {
          PreToolUse: [{ hooks: [denySecretFileAccess] }],
          PostToolUse: [{ hooks: [redactSecretsFromGrepOutput] }],
        },
        mcpServers: {
          seam: {
            type: 'http',
            url: SEAM_MCP_URL,
          },
        },
        // Pick up any Seam skill installed into the project's .claude/skills.
        settingSources: ['project'],
        skills: 'all',
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: systemAppend,
        },
        maxTurns: 100,
        abortController,
      },
    })) {
      if (signal.aborted) break

      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            const text = block.text.trim()
            if (text.length > 0) onText(text)
          } else if (block.type === 'tool_use') {
            onTool(block.name, describeToolInput(block.input))
          }
        }
      } else if (message.type === 'result') {
        // `result` only exists on the success subtype; narrow on `message`
        // itself so the type checker allows the access.
        if (message.subtype === 'success') {
          ok = true
          summary = message.result
        }
        if (typeof message.total_cost_usd === 'number') {
          costUsd = message.total_cost_usd
        }
      }
    }

    return { ok, summary, costUsd }
  },
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
