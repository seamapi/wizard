import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { createJiti } from 'jiti'

import type { Harness, HarnessRunStepArgs, StepRunResult } from './types.js'

// The official Seam MCP — same server the anthropic harness and the seam-plugin
// wire up. Bridged into pi over stdio via mcp-remote, so pi reuses the OAuth
// token cache mcp-remote already established.
const SEAM_MCP_URL = 'https://mcp.seam.co/mcp'
const PROVIDER = 'seam-proxy'

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
      AuthStorage,
      ModelRegistry,
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
    const registry = ModelRegistry.inMemory(AuthStorage.inMemory())
    registry.registerProvider(PROVIDER, {
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
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_000_000,
          maxTokens: 64_000,
        },
      ],
    })
    const model = registry.find(PROVIDER, modelId)
    if (model == null) {
      return {
        ok: false,
        summary: 'pi: gateway model not resolved',
        costUsd: null,
      }
    }

    // Bridge the seam-docs MCP in via pi-mcp-adapter, using the SAME stdio
    // command the anthropic harness uses so mcp-remote's OAuth cache is reused.
    // pi-mcp-adapter ships raw TS; jiti loads it, per its documented usage.
    const jiti = createJiti(import.meta.url)
    const mcpModule = (await jiti.import('pi-mcp-adapter')) as {
      createMcpAdapter: (options: unknown) => unknown
    }
    const mcpFactory = mcpModule.createMcpAdapter({
      config: {
        mcpServers: {
          'seam-docs': {
            command: 'npx',
            args: ['-y', 'mcp-remote', SEAM_MCP_URL],
            lifecycle: 'eager',
          },
        },
        settings: { toolPrefix: 'seam-docs' },
      },
    })

    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir: getAgentDir(),
      systemPrompt: systemAppend,
      noExtensions: true,
      noSkills: true,
      noContextFiles: true,
      noPromptTemplates: true,
      noThemes: true,
      extensionFactories: [mcpFactory as never],
    })
    await resourceLoader.reload()

    // Read/search/write only — no bash, matching the anthropic harness's
    // no-shell policy. `noTools: 'builtin'` drops pi's default bash tool.
    // Each factory returns a differently-parameterised ToolDefinition; widen to
    // the general type createAgentSession accepts (the per-tool schema variance
    // is irrelevant to the session, which treats them uniformly).
    const customTools = [
      createReadToolDefinition(cwd),
      createEditToolDefinition(cwd),
      createWriteToolDefinition(cwd),
      createLsToolDefinition(cwd),
      createFindToolDefinition(cwd),
      createGrepToolDefinition(cwd),
    ] as unknown as ToolDefinition[]

    const { session } = await createAgentSession({
      model,
      modelRegistry: registry,
      cwd,
      sessionManager: SessionManager.inMemory(cwd),
      resourceLoader,
      noTools: 'builtin',
      customTools,
    })
    await session.bindExtensions({})

    let summary = ''
    let toolCalls = 0
    const unsubscribe = session.subscribe((event) => {
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
