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

// Captures what crossed the wire: every request the analytics client posted,
// flattened into the events it carried.
const captureEvents = (): {
  events: () => CapturedEvent[]
  requests: () => Array<{ url: string; body: { events: CapturedEvent[] } }>
} => {
  const requests: Array<{ url: string; body: { events: CapturedEvent[] } }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push({
        url,
        body: JSON.parse(String(init.body)) as { events: CapturedEvent[] },
      })
      return new Response(null, { status: 200 })
    }),
  )
  return {
    requests: () => requests,
    events: () => requests.flatMap((request) => request.body.events),
  }
}

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(() => {
  resetAnalytics()
  resetAdapter()
  vi.unstubAllGlobals()
})

test('sends nothing until a run has started', async () => {
  const captured = captureEvents()

  track('wizard_run_started')
  trackScreen('welcome')
  finishAnalytics('completed')
  await flushAnalytics()

  expect(captured.requests()).toEqual([])
})

test('posts a run as one batch of PostHog-shaped events', async () => {
  const captured = captureEvents()

  await startAnalytics({ command: 'seam wizard' })
  trackScreen('welcome')
  trackScreen('method')
  await flushAnalytics()

  const requests = captured.requests()
  expect(requests).toHaveLength(1)
  expect(requests[0]?.url).toBe(
    'https://connect.getseam.com/seam/wizard/v1/events',
  )

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
  expect(events[0]?.properties['command']).toBe('seam wizard')
  expect(events[0]?.timestamp).toEqual(expect.any(String))
})

test('attributes every event to the same anonymous install', async () => {
  const captured = captureEvents()

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
  expect(first?.distinct_id).toBe(installId)
  expect(second?.distinct_id).toBe(installId)
  // The install is the same; the run is not.
  expect(first?.properties['session_id']).not.toBe(
    second?.properties['session_id'],
  )
})

test('reports a run that could not store an install id', async () => {
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
  const captured = captureEvents()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')
  await flushAnalytics()

  expect(captured.events()[0]?.distinct_id).toEqual(expect.any(String))
})

test('carries the workspace and SDK on every event after they are known', async () => {
  const captured = captureEvents()

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
    $groups: { workspace: 'workspace-1' },
  })
})

test('closes a run with where it got to, once', async () => {
  const captured = captureEvents()

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
  const captured = captureEvents()

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_integration_failed', { message: 'x'.repeat(2000) })
  await flushAnalytics()

  const message = captured.events()[0]?.properties['message']
  expect(String(message)).toHaveLength(501)
  expect(String(message).endsWith('…')).toBe(true)
})

test('drops a batch Seam rejects and keeps reporting the run', async () => {
  const captured = captureEvents()
  const fetchMock = vi.mocked(fetch)
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))

  await startAnalytics({ command: 'seam wizard' })
  track('wizard_run_started')
  await expect(flushAnalytics()).resolves.toBeUndefined()

  track('wizard_run_finished')
  await flushAnalytics()

  expect(captured.events().map((event) => event.event)).toEqual([
    'wizard_run_finished',
  ])
})

test('sends a full batch without waiting for the flush', async () => {
  const captured = captureEvents()

  await startAnalytics({ command: 'seam wizard' })
  for (let index = 0; index < 20; index++) {
    track('wizard_screen_viewed', { screen: `screen-${index}` })
  }
  // No flush: reaching the batch size is what posts it.
  await vi.waitFor(() => {
    expect(captured.events()).toHaveLength(20)
  })
})
