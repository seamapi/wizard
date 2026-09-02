import { gunzipSync } from 'node:zlib'

import { render } from 'ink-testing-library'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from 'lib/adapter.js'
import {
  flushAnalytics,
  resetAnalytics,
  startAnalytics,
} from 'lib/analytics.js'
import { App, nextStepsLines } from 'lib/app.js'

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

// nextStepsLines feeds both the live message log and the exit report's env
// hint. .env and .env.example are written independently by saveProjectApiKey,
// so a refusal on one must not make the hint lie about the other — this was
// the bug in the merged envRefusedRef (round 2 of the PLA-2951 review).
test('nextStepsLines: reports .env and .env.example refusals independently', () => {
  const neither = nextStepsLines('javascript', 'Acme', false, false)
  expect(neither.join('\n')).toContain(
    'Your key is in .env (git ignored); .env.example tells the rest of your team what to set.',
  )

  const envOnly = nextStepsLines('javascript', 'Acme', true, false)
  expect(envOnly.join('\n')).toContain(
    'Add SEAM_API_KEY to your real env file yourself; the wizard did not write through the symlinked .env.',
  )
  expect(envOnly.join('\n')).not.toContain('.env.example')

  const exampleOnly = nextStepsLines('javascript', 'Acme', false, true)
  expect(exampleOnly.join('\n')).toContain('Your key is in .env (git ignored)')
  expect(exampleOnly.join('\n')).toContain(
    '.env.example is a symlink, so the wizard did not update it.',
  )
  expect(exampleOnly.join('\n')).not.toContain('did not write through')

  const both = nextStepsLines('javascript', 'Acme', true, true)
  expect(both.join('\n')).toContain(
    'the wizard did not write through the symlinked .env.',
  )
  expect(both.join('\n')).toContain(
    '.env.example is a symlink, so the wizard did not update it',
  )
})
