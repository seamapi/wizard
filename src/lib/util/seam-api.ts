// Minimal Seam API access used to validate a pasted API key. We deliberately
// avoid pulling in the full SDK just for a health check — a single fetch keeps
// the wizard's install footprint tiny.

const SEAM_API_BASE = 'https://connect.getseam.com'

export interface SeamWorkspace {
  workspace_id: string
  name: string
  is_sandbox: boolean
}

export class ApiKeyError extends Error {}

// Validates the key by fetching the workspace it belongs to. Returns the
// workspace so the wizard can show which workspace the key is for.
export async function getWorkspaceForApiKey(
  api_key: string,
): Promise<SeamWorkspace> {
  let response: Response
  try {
    response = await fetch(`${SEAM_API_BASE}/workspaces/get`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${api_key}`,
        'content-type': 'application/json',
      },
      body: '{}',
    })
  } catch {
    throw new ApiKeyError(
      'Could not reach the Seam API. Check your network connection and try again.',
    )
  }

  if (response.status === 401) {
    throw new ApiKeyError(
      'That key was rejected (401). Make sure you copied the full key, including the seam_ prefix.',
    )
  }
  if (!response.ok) {
    throw new ApiKeyError(
      `The Seam API returned ${response.status}. Please try again in a moment.`,
    )
  }

  const body = (await response.json()) as { workspace?: SeamWorkspace }
  if (body.workspace == null) {
    throw new ApiKeyError('Unexpected response from the Seam API.')
  }
  return body.workspace
}

export function looksLikeSeamApiKey(value: string): boolean {
  return /^seam_[A-Za-z0-9]/.test(value.trim())
}

// Base URL for Seam-hosted inference. The embedded agent's SDK appends
// /v1/messages; the exchange endpoint below lives at /session.
export const SEAM_INFERENCE_BASE_URL = `${SEAM_API_BASE}/internal/wizard_inference`

// The Console-collected onboarding answers Seam returns alongside the token, so
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
  api_key: string,
): Promise<WizardInferenceSession> {
  let response: Response
  try {
    response = await fetch(`${SEAM_INFERENCE_BASE_URL}/session`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${api_key}`,
        'content-type': 'application/json',
      },
      body: '{}',
    })
  } catch {
    throw new ApiKeyError(
      'Could not reach Seam to start the AI session. Check your network connection and try again.',
    )
  }

  if (!response.ok) {
    throw new ApiKeyError(
      `Seam couldn't start the AI session (${response.status}). Please try again in a moment.`,
    )
  }

  const body = (await response.json()) as {
    wizard_session?: { token: string; expires_at: string }
    onboarding?: WizardOnboarding | null
  }
  if (body.wizard_session == null) {
    throw new ApiKeyError(
      'Unexpected response from Seam starting the AI session.',
    )
  }
  return {
    token: body.wizard_session.token,
    expires_at: body.wizard_session.expires_at,
    onboarding: body.onboarding ?? null,
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
