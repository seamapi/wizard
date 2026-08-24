import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ToolDefinition } from '@earendil-works/pi-coding-agent'

import { toolInputTouchesSecret } from './secret-paths.js'
import type { Harness, HarnessRunStepArgs, StepRunResult } from './types.js'

// The official Seam MCP — same server the anthropic harness and the seam-plugin
// wire up. Bridged into pi over stdio via mcp-remote, so pi reuses the OAuth
// token cache mcp-remote already established.
const SEAM_MCP_URL = 'https://mcp.seam.co/mcp'
const PROVIDER = 'seam-proxy'

// Cap on agent turns, matching the anthropic control's maxTurns. pi exposes no
// native turn limit, so we count turn_start events and abort at the cap — this
// bounds a run that would otherwise wander (e.g. read-only) without finishing.
const MAX_TURNS = 100

export function upsertSeamMcp(root: string): void {
  const configDir = join(root, '.pi')
  const configPath = join(configDir, 'mcp.json')
  const config = existsSync(configPath)
    ? parseMcpConfig(readFileSync(configPath, 'utf8'), configPath)
    : {}
  const servers = config.mcpServers ?? {}

  config.mcpServers = {
    ...servers,
    'seam-docs': { url: SEAM_MCP_URL, lifecycle: 'eager' },
  }
  mkdirSync(configDir, { recursive: true })
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
}

function parseMcpConfig(
  text: string,
  path: string,
): Record<string, unknown> & {
  mcpServers?: Record<string, unknown>
} {
  let config: unknown
  try {
    config = JSON.parse(text)
  } catch {
    throw new Error(`Invalid MCP config: ${path}`)
  }
  if (config == null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid MCP config: ${path}`)
  }
  const mcpServers = (config as { mcpServers?: unknown }).mcpServers
  if (
    mcpServers != null &&
    (typeof mcpServers !== 'object' || Array.isArray(mcpServers))
  ) {
    throw new Error(`Invalid MCP servers: ${path}`)
  }
  return config as Record<string, unknown> & {
    mcpServers?: Record<string, unknown>
  }
}

// Per-MTok prices for the models we run, to estimate a step's cost from pi's
// token stats. The provider spec reports zero cost (the Seam proxy meters real
// cost server-side); this gives the eval a comparable client-side figure.
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
}

// The challenger harness: drives the integration with pi.dev's coding agent
// (@earendil-works/pi-coding-agent), pointed at the same Seam inference proxy
// (registered as an anthropic-messages provider) and the same seam-docs MCP, so
// it is a fair A/B against the anthropic control. Heavy deps are imported lazily
// so selecting `anthropic` never loads them.
export const piHarness: Harness = {
  name: 'pi',
  async runStep(args: HarnessRunStepArgs): Promise<StepRunResult> {
    const { goal, cwd, model: modelId, systemAppend, inference, signal } = args
    const { onText, onTool } = args

    const {
      createAgentSession,
      DefaultResourceLoader,
      SessionManager,
      ModelRuntime,
      getAgentDir,
      createReadToolDefinition,
      createEditToolDefinition,
      createWriteToolDefinition,
      createLsToolDefinition,
      createFindToolDefinition,
      createGrepToolDefinition,
    } = await import('@earendil-works/pi-coding-agent')

    // Register the Seam proxy as an anthropic-messages provider: same protocol
    // the claude-agent-sdk path uses, the scoped wizard token sent as the Bearer
    // the proxy authenticates. Provider cost is zero (metered server-side).
    const modelRuntime = await ModelRuntime.create({
      modelsPath: null,
      refreshOnCreate: false,
    })
    modelRuntime.registerProvider(PROVIDER, {
      name: 'Seam Inference',
      baseUrl: inference.base_url,
      apiKey: inference.token,
      authHeader: true,
      api: 'anthropic-messages',
      models: [
        {
          id: modelId,
          name: modelId,
          api: 'anthropic-messages',
          baseUrl: inference.base_url,
          reasoning: true,
          // forceAdaptiveThinking: send `thinking:{type:'adaptive'}` +
          // output_config.effort (what Opus 4.8 / Sonnet 5 require) instead of
          // pi-ai's default deprecated `thinking:{type:'enabled',budget_tokens}`,
          // which those models reject with a 400 — matching the anthropic
          // control's adaptive thinking. supportsTemperature:false because Opus
          // 4.7+ rejects a non-default temperature. Both mirror how pi-ai's own
          // built-in anthropic-messages models are configured.
          compat: { forceAdaptiveThinking: true, supportsTemperature: false },
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_000_000,
          maxTokens: 64_000,
        },
      ],
    })
    const model = modelRuntime.getModel(PROVIDER, modelId)
    if (model == null) {
      return {
        ok: false,
        summary: 'pi: gateway model not resolved',
        costUsd: null,
      }
    }

    // Load the adapter as a Pi extension. The MCP config is upserted so other
    // project MCP servers remain available.
    upsertSeamMcp(cwd)
    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir: getAgentDir(),
      systemPrompt: systemAppend,
      noExtensions: true,
      noSkills: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noThemes: true,
      additionalExtensionPaths: [
        fileURLToPath(import.meta.resolve('pi-mcp-adapter')),
      ],
    })
    await resourceLoader.reload()

    // Read/search/write only — no bash, matching the anthropic harness's
    // no-shell policy. `noTools: 'builtin'` drops pi's default bash tool.
    // Each factory returns a differently-parameterised ToolDefinition; widen to
    // the general type createAgentSession accepts (the per-tool schema variance
    // is irrelevant to the session, which treats them uniformly).
    const customTools = guardSecretFileTools([
      createReadToolDefinition(cwd),
      createEditToolDefinition(cwd),
      createWriteToolDefinition(cwd),
      createLsToolDefinition(cwd),
      createFindToolDefinition(cwd),
      createGrepToolDefinition(cwd),
    ] as unknown as ToolDefinition[])

    const { session } = await createAgentSession({
      model,
      modelRuntime,
      // Adaptive-thinking effort, matching the anthropic control's medium effort.
      thinkingLevel: 'medium',
      cwd,
      sessionManager: SessionManager.inMemory(cwd),
      resourceLoader,
      noTools: 'builtin',
      customTools,
    })
    await session.bindExtensions({})

    // Stop the session once (turn cap reached, or an external abort like Ctrl-C
    // / the eval's signal). abort() is async; fire-and-forget is fine.
    let stopped = false
    const stop = (): void => {
      if (stopped) return
      stopped = true
      session.abort().catch(() => {})
    }
    if (signal.aborted) stop()
    const onExternalAbort = (): void => stop()
    signal.addEventListener('abort', onExternalAbort, { once: true })

    let summary = ''
    let toolCalls = 0
    let turns = 0
    const unsubscribe = session.subscribe((event) => {
      if (event.type === 'turn_start') {
        turns += 1
        if (turns > MAX_TURNS) stop()
        return
      }
      if (signal.aborted) return
      if (event.type === 'message_end') {
        if (readRole(event.message) !== 'assistant') return
        const text = extractText(event.message).trim()
        if (text.length > 0) {
          summary = text
          onText(text)
        }
      } else if (event.type === 'tool_execution_start') {
        toolCalls += 1
        onTool(event.toolName, describeArgs(event.args))
      }
    })

    try {
      await session.prompt(goal)
    } finally {
      unsubscribe()
      signal.removeEventListener('abort', onExternalAbort)
    }

    const stats = session.getSessionStats()
    // A run that never called a tool left the project untouched — not a success.
    return {
      ok: toolCalls > 0,
      summary,
      costUsd: estimateCost(modelId, stats.tokens),
    }
  },
}

// pi's built-in file tools ship no secret-file guard, so wrap each one: a call
// whose input targets a secret file (.env, …) is refused before it runs — parity
// with the anthropic harness's PreToolUse deny. Only `execute` is overridden;
// every other field (schema, renderers) is preserved by the spread.
type PiToolExecute = (
  toolCallId: string,
  params: unknown,
  signal: AbortSignal | undefined,
  onUpdate: unknown,
  ctx: unknown,
) => Promise<unknown>

function guardSecretFileTools(tools: ToolDefinition[]): ToolDefinition[] {
  return tools.map((tool) => {
    const runOriginal = (
      tool as unknown as { execute: PiToolExecute }
    ).execute.bind(tool)
    const execute: PiToolExecute = async (
      toolCallId,
      params,
      signal,
      onUpdate,
      ctx,
    ) => {
      if (toolInputTouchesSecret(params)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Reading .env / secret files is blocked. Load SEAM_API_KEY from the runtime environment instead.',
            },
          ],
          details: {},
        }
      }
      return runOriginal(toolCallId, params, signal, onUpdate, ctx)
    }
    return { ...tool, execute } as unknown as ToolDefinition
  })
}

function readRole(message: unknown): string | undefined {
  const role = (message as { role?: unknown }).role
  return typeof role === 'string' ? role : undefined
}

// pi AgentMessage content is a string or an array of text/image blocks.
function extractText(message: unknown): string {
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (block): block is { type: string; text: string } =>
        typeof (block as { type?: unknown }).type === 'string' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map((block) => block.text)
    .join('')
}

function describeArgs(args: unknown): string {
  const path = args as { file_path?: unknown; pattern?: unknown } | null
  const value = path?.file_path ?? path?.pattern
  return typeof value === 'string' ? value : ''
}

function estimateCost(
  modelId: string,
  tokens: { input: number; output: number },
): number | null {
  const price = PRICES_USD_PER_MTOK[modelId]
  if (price == null) return null
  return (
    (tokens.input * price.input) / 1_000_000 +
    (tokens.output * price.output) / 1_000_000
  )
}
