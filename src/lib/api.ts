import {
  isSeamHttpApiError,
  isSeamHttpUnauthorizedError,
  SeamHttpInvalidTokenError,
  SeamHttpWorkspaces,
  type Workspace,
} from '@seamapi/http'

import { getAuth } from 'lib/adapter.js'

export function getApiBaseUrl(): string {
  return getAuth().endpoint.replace(/\/+$/, '')
}

export type SeamWorkspace = Pick<
  Workspace,
  'workspace_id' | 'name' | 'is_sandbox'
>

export class ApiKeyError extends Error {}

const getApi = (apiKey: string): SeamHttpWorkspaces =>
  new SeamHttpWorkspaces({ apiKey, endpoint: getApiBaseUrl() })

export async function getWorkspaceForApiKey(
  apiKey: string,
): Promise<SeamWorkspace> {
  try {
    return await getApi(apiKey).get()
  } catch (error) {
    if (
      error instanceof SeamHttpInvalidTokenError ||
      isSeamHttpUnauthorizedError(error)
    ) {
      throw new ApiKeyError(
        'That key was rejected (401). Make sure you copied the full key, including the seam_ prefix.',
      )
    }
    if (isSeamHttpApiError(error)) {
      throw new ApiKeyError(
        `The Seam API returned ${error.statusCode}. Please try again in a moment.`,
      )
    }
    throw new ApiKeyError(
      'Could not reach the Seam API. Check your network connection and try again.',
    )
  }
}

export function looksLikeSeamApiKey(value: string): boolean {
  return /^seam_[A-Za-z0-9]/.test(value.trim())
}

// Base URL for Seam-hosted inference. The embedded agent's SDK appends
// /v1/messages; the exchange endpoint below lives at /v1/session.
export function getInferenceBaseUrl(): string {
  return `${getApiBaseUrl()}/seam/wizard`
}

// The Console-collected onboarding answers Seam returns within the session, so
// the wizard can pre-fill its plan instead of re-asking (null if none recorded).
export interface WizardOnboarding {
  org_type: string | null
  primary_goal: string | null
  use_case: string | null
  build_target: string | null
  embed_customer_portal: boolean | null
  device_categories: string[] | null
}

export interface WizardInferenceSession {
  token: string
  expires_at: string
  onboarding: WizardOnboarding | null
}

// Exchange a Seam API key for a short-lived wizard inference token. The token —
// not the API key — is what the embedded agent sends to Seam-hosted inference,
// so the long-lived key stays off the repeated inference path.
export async function exchangeWizardInferenceToken(
  apiKey: string,
): Promise<WizardInferenceSession> {
  try {
    const { data: body } = await getApi(apiKey).client.post<{
      wizard_session?: {
        token: string
        expires_at: string
        onboarding?: WizardOnboarding | null
      }
    }>('/seam/wizard/v1/session', {})
    if (body.wizard_session == null) {
      throw new ApiKeyError(
        'Unexpected response from Seam starting the AI session.',
      )
    }
    return {
      token: body.wizard_session.token,
      expires_at: body.wizard_session.expires_at,
      onboarding: body.wizard_session.onboarding ?? null,
    }
  } catch (error) {
    if (error instanceof ApiKeyError) throw error
    if (isSeamHttpApiError(error)) {
      throw new ApiKeyError(
        `Seam couldn't start the AI session (${error.statusCode}). Please try again in a moment.`,
      )
    }
    throw new ApiKeyError(
      'Could not reach Seam to start the AI session. Check your network connection and try again.',
    )
  }
}

// One-shot call to Seam-hosted inference (Anthropic Messages API shape). Sent
// streamed so the proxy meters usage the same way it does for the agent; the
// text deltas are concatenated and returned. Used for the cheap project-analysis
// recommendation — not the full integration (that goes through the agent SDK).
export async function callInferenceForText(
  inference: { base_url: string; token: string },
  args: { model: string; max_tokens: number; system: string; user: string },
): Promise<string> {
  const response = await fetch(`${inference.base_url}/v1/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${inference.token}`,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.max_tokens,
      system: args.system,
      stream: true,
      messages: [{ role: 'user', content: args.user }],
    }),
  })

  if (!response.ok || response.body == null) {
    throw new Error(`Seam inference returned ${response.status}`)
  }

  return await readTextDeltas(response.body)
}

async function readTextDeltas(
  body: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice('data:'.length).trim()
      if (payload.length === 0 || payload === '[DONE]') continue
      try {
        const event = JSON.parse(payload) as {
          type?: string
          delta?: { type?: string; text?: string }
        }
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta'
        ) {
          text += event.delta.text ?? ''
        }
      } catch {
        // Ignore keep-alive pings and any non-JSON SSE lines.
      }
    }
  }
  return text
}
