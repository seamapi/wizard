import { gunzipSync } from 'node:zlib'

import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from 'lib/adapter.js'
import {
  finishAnalytics,
  flushAnalytics,
  resetAnalytics,
  setAnalyticsSdk,
  setAnalyticsWorkspace,
  startAnalytics,
  track,
  trackScreen,
} from 'lib/analytics.js'
import type { SeamWorkspace } from 'lib/api.js'
import { readInstallId } from 'lib/store/index.js'

const workspace: SeamWorkspace = {
  workspace_id: 'workspace-1',
  name: 'Acme',
  is_sandbox: false,
}

interface CapturedEvent {
  event: string
  distinct_id: string
  timestamp: string
  properties: Record<string, unknown>
}

interface CapturedRequest {
  url: string
  api_key: string
  batch: CapturedEvent[]
}

// Captures what crossed the wire to PostHog. The SDK gzips its batches, so the
// body is inflated back to the JSON the ingest endpoint receives.
const captureRequests = (
  respond: () => Response = () => new Response('{}', { status: 200 }),
): {
  requests: () => CapturedRequest[]
  events: () => CapturedEvent[]
} => {
  const requests: CapturedRequest[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const { body } = init
      const text =
        typeof body === 'string'
          ? body
          : gunzipSync(body as Uint8Array).toString('utf8')
      const payload = JSON.parse(text) as {
        api_key: string
        batch: CapturedEvent[]
      }
      requests.push({ url, ...payload })
      return respond()
    }),
  )
  return {
    requests: () => requests,
    events: () => requests.flatMap((request) => request.batch),
  }
}

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(async () => {
  resetAnalytics()
  resetAdapter()
  await vi.waitFor(() => {})
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test('sends nothing until a run has started', async () => {
  const captured = captureRequests()

  track('wizard_run_started')
  trackScreen('welcome')
  finishAnalytics('completed')
  await flushAnalytics()

  expect(captured.requests()).toEqual([])
})

test('reports nothing when the package carries no project key', async () => {
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  trackScreen('welcome')
  finishAnalytics('abandoned')
  await flushAnalytics()

  expect(captured.requests()).toEqual([])
})

test("posts a run's events to Seam's PostHog project", async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  trackScreen('welcome')
  trackScreen('method')
  await flushAnalytics()

  const requests = captured.requests()
  expect(requests).toHaveLength(1)
  expect(requests[0]?.url).toBe('https://e.seam.co/batch/')
  expect(requests[0]?.api_key).toBe('phc_test_project')

  const events = captured.events()
  expect(events.map((event) => event.event)).toEqual([
    'wizard_screen_viewed',
    'wizard_screen_viewed',
  ])
  expect(events.map((event) => event.properties['screen'])).toEqual([
    'welcome',
    'method',
  ])
  expect(events.map((event) => event.properties['screen_index'])).toEqual([
    0, 1,
  ])
  expect(events[0]?.properties).toMatchObject({
    source: 'seam_wizard_cli',
    command: 'seam wizard',
  })
  expect(events[0]?.timestamp).toEqual(expect.any(String))
})

test('can be pointed at another project and host', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_local')
  vi.stubEnv('SEAM_WIZARD_POSTHOG_HOST', 'http://127.0.0.1:8000')
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')
  await flushAnalytics()

  expect(captured.requests()[0]?.url).toBe('http://127.0.0.1:8000/batch/')
  expect(captured.requests()[0]?.api_key).toBe('phc_local')
})

test('attributes every event to the same anonymous install', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')
  await flushAnalytics()
  resetAnalytics()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')
  await flushAnalytics()

  const [first, second] = captured.events()
  const installId = await readInstallId()
  expect(installId).toEqual(expect.any(String))
  // Namespaced: a Console person's distinct_id is a UUID too, and a run is an
  // install, never a person.
  expect(first?.distinct_id).toBe(`wizard_cli_${installId ?? ''}`)
  expect(second?.distinct_id).toBe(first?.distinct_id)
  // The install is the same; the run is not.
  expect(first?.properties['session_id']).not.toBe(
    second?.properties['session_id'],
  )
})

test('reports a run that could not store an install id', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  setAdapter({
    ...createMemoryAdapter(),
    config: {
      get: async () => {
        throw new Error('no settings file')
      },
      set: async () => {
        throw new Error('no settings file')
      },
    },
  })
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')
  await flushAnalytics()

  expect(captured.events()[0]?.distinct_id).toMatch(/^wizard_cli_/)
})

test('carries the workspace and SDK on every event after they are known', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_init_finished')
  setAnalyticsWorkspace(workspace)
  setAnalyticsSdk('python')
  track('wizard_connected')
  await flushAnalytics()

  const [before, after] = captured.events()
  expect(before?.properties['workspace_id']).toBeUndefined()
  expect(after?.properties).toMatchObject({
    workspace_id: 'workspace-1',
    workspace_is_sandbox: false,
    sdk: 'python',
    // Set from the SDK's own group argument, so a workspace's runs roll up.
    $groups: { workspace: 'workspace-1' },
  })
})

test('closes a run with where it got to, once', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  trackScreen('welcome')
  trackScreen('method')
  trackScreen('paste')
  finishAnalytics('abandoned')
  finishAnalytics('completed')
  await flushAnalytics()

  const finished = captured
    .events()
    .filter((event) => event.event === 'wizard_run_finished')
  expect(finished).toHaveLength(1)
  expect(finished[0]?.properties).toMatchObject({
    outcome: 'abandoned',
    last_screen: 'paste',
    screens_seen: ['welcome', 'method', 'paste'],
    screen_count: 3,
  })
})

test('truncates a long property instead of shipping it whole', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  const captured = captureRequests()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_integration_failed', { message: 'x'.repeat(2000) })
  await flushAnalytics()

  const message = captured.events()[0]?.properties['message']
  expect(String(message)).toHaveLength(501)
  expect(String(message).endsWith('…')).toBe(true)
})

test('a batch PostHog rejects never surfaces to the developer', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  captureRequests(() => new Response('{}', { status: 500 }))

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')

  await expect(flushAnalytics()).resolves.toBeUndefined()
})

test('a run reports even when the network is gone', async () => {
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND e.seam.co')
    }),
  )

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')

  await expect(flushAnalytics()).resolves.toBeUndefined()
})
