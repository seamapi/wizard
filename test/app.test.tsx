import { gunzipSync } from 'node:zlib'

import { render } from 'ink-testing-library'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from 'lib/adapter.js'
import {
  flushAnalytics,
  resetAnalytics,
  startAnalytics,
} from 'lib/analytics.js'
import { App } from 'lib/app.js'

// A project root that does not exist, with no key in the environment, keeps the
// render offline: the wizard opens on the welcome splash and only leaves it on a
// keypress, so nothing is fetched. A full interactive run of the wizard cannot
// be exercised headlessly, so this covers the mount and the first frame only.
const NONEXISTENT_ROOT = '/nonexistent/seam-wizard-test-project'

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(() => {
  resetAnalytics()
  resetAdapter()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

test('App: opens on the welcome splash', () => {
  vi.stubEnv('SEAM_API_KEY', '')

  const { lastFrame, unmount } = render(<App root={NONEXISTENT_ROOT} />)
  try {
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Seam Wizard')
    expect(frame).toContain('Press any key to get started')
  } finally {
    unmount()
  }
})

test('App: reports the run it started and the screen it stopped on', async () => {
  vi.stubEnv('SEAM_API_KEY', '')
  // The key is injected when the package is packed, so a run from the source
  // tree reports nothing without one.
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  const posted: Array<{ event: string; properties: Record<string, unknown> }> =
    []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      // The PostHog SDK gzips its batches.
      const body = JSON.parse(
        gunzipSync(init.body as Uint8Array).toString('utf8'),
      ) as {
        batch: Array<{ event: string; properties: Record<string, unknown> }>
      }
      posted.push(...body.batch)
      return new Response('{}', { status: 200 })
    }),
  )
  await startAnalytics({ command: 'seam wizard' })

  // Mounted and then closed on the welcome splash: what a developer who runs
  // the wizard and immediately quits leaves behind.
  const { unmount } = render(<App root={NONEXISTENT_ROOT} />)
  unmount()
  await flushAnalytics()

  expect(posted.map((event) => event.event)).toEqual([
    'wizard_run_started',
    'wizard_screen_viewed',
    'wizard_run_finished',
  ])
  expect(posted[1]?.properties['screen']).toBe('welcome')
  expect(posted[2]?.properties).toMatchObject({
    outcome: 'abandoned',
    last_screen: 'welcome',
    reached_integration: false,
  })
})
