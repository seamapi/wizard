import { mkdtempSync, rmSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

const { openBrowser } = vi.hoisted(() => ({
  openBrowser: vi.fn(async (_url: string) => undefined),
}))
vi.mock('open', () => ({ default: openBrowser }))

let sdkRequests = 0
let root = ''
let cleanup: (() => void) | undefined
let posted: Array<{ event: string; properties: Record<string, unknown> }> = []

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'wizard-connect-'))
  setAdapter(createMemoryAdapter())
  vi.stubEnv('SEAM_API_KEY', '')
  vi.stubEnv('SEAM_WIZARD_POSTHOG_KEY', 'phc_test_project')
  posted = []
  const captured = posted
  sdkRequests = 0
  openBrowser.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: Request | string, init?: RequestInit) => {
      if (typeof input !== 'string') {
        sdkRequests++
        return Response.json(
          { error: { type: 'unauthorized', message: 'secret-marker' } },
          { status: 401 },
        )
      }
      const body = JSON.parse(
        gunzipSync(init?.body as Uint8Array).toString('utf8'),
      ) as { batch: typeof posted }
      captured.push(...body.batch)
      return new Response('{}', { status: 200 })
    }),
  )
  await startAnalytics({ command: 'seam wizard' })
})

afterEach(async () => {
  cleanup?.()
  cleanup = undefined
  await flushAnalytics()
  process.exitCode = 0
  resetAnalytics()
  resetAdapter()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
})

test('paste retries and give-up preserve 401 and send only safe failure metadata', async () => {
  const reports: string[][] = []
  const { stdin, lastFrame, unmount } = render(
    <App root={root} onExit={(lines) => reports.push(lines)} />,
  )
  cleanup = unmount
  // Wait for Ink to attach its input listener before each input transition.
  await vi.waitFor(() => expect(lastFrame()).toContain('Press any key'))
  await new Promise((resolve) => setTimeout(resolve, 50))
  stdin.write('x')
  await vi.waitFor(() =>
    expect(lastFrame()).toContain('How do you want to connect'),
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  stdin.write('\u001b[B')
  await new Promise((resolve) => setTimeout(resolve, 50))
  stdin.write('\r')
  await vi.waitFor(() =>
    expect(lastFrame()).toContain('Paste your Seam API key'),
  )
  for (let attempt = 1; attempt <= 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    stdin.write('seam_fixture_secret-marker')
    await new Promise((resolve) => setTimeout(resolve, 50))
    stdin.write('\r')
    await vi.waitFor(() => expect(sdkRequests).toBe(attempt))
    if (attempt < 3) {
      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Paste your Seam API key')
        expect(lastFrame()).toContain('rejected that key (401)')
      })
    } else {
      await vi.waitFor(() =>
        expect(reports.flat().join(' ')).toContain('Too many attempts'),
      )
      expect(reports.flat().join(' ')).toContain('rejected that key (401)')
    }
  }
  unmount()
  cleanup = undefined
  await flushAnalytics()
  const failures = posted.filter(
    ({ event }) => event === 'wizard_connect_failed',
  )
  expect(failures).toHaveLength(3)
  failures.forEach(({ properties }, index) => {
    expect(properties).toMatchObject({
      method: 'paste',
      reason: 'unauthorized',
      failure_stage: 'key_validation',
      http_status: 401,
      attempt: index + 1,
      gave_up: index === 2,
    })
  })
  expect(JSON.stringify(posted)).not.toContain('secret-marker')
  expect(JSON.stringify(posted)).not.toContain(root)
  expect(lastFrame()).not.toContain('secret-marker')
}, 15000)

test('browser key receipt followed by local validation failure reports the validation stage safely', async () => {
  const reports: string[][] = []
  const { stdin, lastFrame, unmount } = render(
    <App root={root} onExit={(lines) => reports.push(lines)} />,
  )
  cleanup = unmount
  await new Promise((resolve) => setTimeout(resolve, 50))
  stdin.write('x')
  await vi.waitFor(() =>
    expect(lastFrame()).toContain('How do you want to connect'),
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  stdin.write('\r')
  await vi.waitFor(() => expect(openBrowser.mock.calls).toHaveLength(1))
  const url = new URL(openBrowser.mock.calls[0]?.[0] ?? '')
  await new Promise<void>((resolve, reject) => {
    const callback = request(
      {
        hostname: '127.0.0.1',
        port: url.searchParams.get('cli_port') ?? '',
        method: 'POST',
        path: '/',
        headers: { 'content-type': 'application/json' },
      },
      (response) => {
        response.resume()
        response.on('end', () => resolve())
      },
    )
    callback.on('error', reject)
    callback.end(
      JSON.stringify({
        state: url.searchParams.get('cli_state'),
        api_key: 'seam_pk_secret-marker',
      }),
    )
  })
  await vi.waitFor(() =>
    expect(reports.flat().join(' ')).toContain('not a supported Seam API key'),
  )
  unmount()
  cleanup = undefined
  await flushAnalytics()
  expect(sdkRequests).toBe(0)
  expect(
    posted.filter(({ event }) => event === 'wizard_browser_key_received'),
  ).toHaveLength(1)
  expect(
    posted.find(({ event }) => event === 'wizard_connect_failed')?.properties,
  ).toMatchObject({
    method: 'browser',
    reason: 'invalid_token_format',
    failure_stage: 'key_validation',
    http_status: null,
  })
  expect(JSON.stringify(posted)).not.toContain('secret-marker')
  expect(JSON.stringify(posted)).not.toContain(
    url.searchParams.get('cli_state'),
  )
  expect(JSON.stringify(posted)).not.toContain(url.href)
}, 10000)
