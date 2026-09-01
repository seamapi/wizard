import { randomUUID } from 'node:crypto'
import { platform, release } from 'node:os'

import {
  postWizardEvents,
  type SeamWorkspace,
  type WizardAnalyticsEvent,
} from 'lib/api.js'
import type { Sdk } from 'lib/steps/detect-project.js'
import { readInstallId, writeInstallId } from 'lib/store/index.js'
import seamapiWizardVersion from 'lib/version.js'

/**
 * Usage analytics for a wizard run.
 *
 * The wizard is a funnel — connect, install, analyze, integrate — and what this
 * measures is how far a developer gets and where they leave. Every phase the app
 * enters is reported, so a run that stops shows up as the screen it stopped on.
 *
 * Events are queued and posted in batches to Seam, which forwards them to
 * PostHog (see `postWizardEvents`). Nothing here can fail a run: `track` never
 * throws, never blocks the render, and a batch that cannot be delivered is
 * dropped. Until `startAnalytics` has run, every call is a no-op — which is what
 * keeps tests and one-off invocations (`--help`, `--debug-screen`) silent.
 *
 * What is deliberately not sent: no API keys, no key fingerprints, no project
 * paths, no source code, no agent output, and not the free-text note the
 * developer writes — only its length.
 */

// A batch is posted a beat after the first event in it, so a burst of events
// (a phase change plus the decision that caused it) travels as one request.
const FLUSH_DELAY_MS = 1000
const MAX_BATCH = 20
// A guard against an unbounded queue if every post fails: the oldest events are
// dropped rather than held forever.
const MAX_QUEUE = 200
// Long string properties are truncated rather than dropped, so an event stays
// readable without carrying an agent's error dump into PostHog.
const MAX_STRING_LENGTH = 500

export type RunOutcome = 'completed' | 'abandoned' | 'error'

interface Run {
  install_id: string
  started_at: number
  // Merged into every event: what stays true for the whole run.
  common: Record<string, unknown>
  // Every phase entered, in order, including repeats.
  screens: string[]
  queue: WizardAnalyticsEvent[]
  timer: NodeJS.Timeout | null
  // Posts are chained so a batch cannot overtake an earlier one, and so a flush
  // can await whatever is already in flight.
  inflight: Promise<void>
  finished: boolean
}

let run: Run | null = null

/**
 * Begin a run: resolve the anonymous install id and record what is true of the
 * whole run. Call once, before the app renders. Events tracked before this are
 * dropped.
 */
export const startAnalytics = async ({
  command,
}: {
  command: string
}): Promise<void> => {
  run = {
    install_id: await resolveInstallId(),
    started_at: Date.now(),
    common: {
      session_id: randomUUID(),
      wizard_version: seamapiWizardVersion,
      command,
      node_version: process.version,
      os_platform: platform(),
      os_release: release(),
      is_ci: isCi(),
    },
    screens: [],
    queue: [],
    timer: null,
    inflight: Promise.resolve(),
    finished: false,
  }
}

/** Queue one event. Fire and forget: it neither throws nor blocks. */
export const track = (
  event: string,
  properties: Record<string, unknown> = {},
): void => {
  const current = run
  if (current == null) return

  current.queue.push({
    event,
    distinct_id: current.install_id,
    timestamp: new Date().toISOString(),
    properties: sanitize({
      ...current.common,
      seconds_since_start: secondsSince(current.started_at),
      ...properties,
    }),
  })

  if (current.queue.length > MAX_QUEUE) {
    current.queue.splice(0, current.queue.length - MAX_QUEUE)
  }
  if (current.queue.length >= MAX_BATCH) {
    sendQueued(current)
    return
  }
  scheduleFlush(current)
}

/**
 * Report the screen the run just moved to. The screen sequence is the funnel:
 * `screen_index` orders it, and the last one reported is where the run stopped.
 */
export const trackScreen = (screen: string): void => {
  const current = run
  if (current == null) return
  current.screens.push(screen)
  track('wizard_screen_viewed', {
    screen,
    screen_index: current.screens.length - 1,
  })
}

/**
 * Attribute the rest of the run to the workspace it connected to. The id (not
 * the name) rides along on every later event, and on the workspace group so
 * PostHog can roll a workspace's runs up together.
 */
export const setAnalyticsWorkspace = (workspace: SeamWorkspace): void => {
  if (run == null) return
  run.common['workspace_id'] = workspace.workspace_id
  run.common['workspace_is_sandbox'] = workspace.is_sandbox
  run.common['$groups'] = { workspace: workspace.workspace_id }
}

/** Attribute the rest of the run to the SDK it is setting up. */
export const setAnalyticsSdk = (sdk: Sdk): void => {
  if (run == null) return
  run.common['sdk'] = sdk
}

/**
 * Close the run with how it ended, summarizing the whole funnel in one event.
 *
 * `abandoned` is the interesting one: it is what a Ctrl-C or a closed terminal
 * leaves behind, carrying the screen the developer walked away from. Only the
 * first call counts, so the app can report a clean finish and still call this
 * unconditionally on unmount.
 */
export const finishAnalytics = (
  outcome: RunOutcome,
  properties: Record<string, unknown> = {},
): void => {
  const current = run
  if (current == null || current.finished) return
  current.finished = true
  track('wizard_run_finished', {
    outcome,
    last_screen: current.screens.at(-1) ?? null,
    screens_seen: [...new Set(current.screens)],
    screen_count: current.screens.length,
    duration_seconds: secondsSince(current.started_at),
    ...properties,
  })
}

/**
 * Post everything queued and wait for it to land. Called once on the way out,
 * where it is the only thing that blocks — briefly, and bounded by the request
 * timeout — so the last events of a run are not lost to process exit.
 */
export const flushAnalytics = async (): Promise<void> => {
  const current = run
  if (current == null) return
  sendQueued(current)
  await current.inflight
}

/** Forget the run. For tests, and for a second run in one process. */
export const resetAnalytics = (): void => {
  if (run?.timer != null) clearTimeout(run.timer)
  run = null
}

const scheduleFlush = (current: Run): void => {
  if (current.timer != null) return
  const timer = setTimeout(() => {
    sendQueued(current)
  }, FLUSH_DELAY_MS)
  // The wizard must exit when the developer is done, not when analytics is: an
  // unreferenced timer never holds the process open.
  timer.unref()
  current.timer = timer
}

const sendQueued = (current: Run): void => {
  if (current.timer != null) {
    clearTimeout(current.timer)
    current.timer = null
  }
  if (current.queue.length === 0) return
  const batch = current.queue.splice(0, current.queue.length)
  current.inflight = current.inflight
    .then(async () => {
      await postWizardEvents(batch)
    })
    // A batch that cannot be delivered is dropped. Analytics never reports
    // itself to the developer, and never fails a run.
    .catch(() => {})
}

// A new install id is written back so the next run is recognized as the same
// install. Where the host cannot store one, the run still reports — under an id
// that lives only as long as the process.
const resolveInstallId = async (): Promise<string> => {
  try {
    const existing = await readInstallId()
    if (existing != null) return existing
    const installId = randomUUID()
    await writeInstallId(installId)
    return installId
  } catch {
    return randomUUID()
  }
}

const secondsSince = (startedAt: number): number =>
  Math.round((Date.now() - startedAt) / 1000)

const sanitize = (
  properties: Record<string, unknown>,
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    sanitized[key] =
      typeof value === 'string' && value.length > MAX_STRING_LENGTH
        ? `${value.slice(0, MAX_STRING_LENGTH)}…`
        : value
  }
  return sanitized
}

// Runs from a pipeline are real, but they are not developers dropping off, so
// they are flagged rather than filtered out here.
const isCi = (): boolean => {
  const ci = process.env['CI']
  return ci != null && ci !== '' && ci !== '0' && ci !== 'false'
}
