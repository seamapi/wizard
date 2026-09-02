import { randomUUID } from 'node:crypto'
import { platform, release } from 'node:os'

import { PostHog } from 'posthog-node'

import seamPostHogProjectKey from 'lib/analytics-key.js'
import type { SeamWorkspace } from 'lib/api.js'
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
 * Events go to Seam's PostHog project through the PostHog Node SDK, reported to
 * the same host the Console reports to. Nothing here can fail a run: `track`
 * never throws, never blocks the render, and an undeliverable batch is dropped.
 * Until `startAnalytics` has run, every call is a no-op — which is what keeps
 * tests and one-off invocations (`--help`, `--debug-screen`) silent.
 *
 * What is deliberately not sent: no API keys, no key fingerprints, no project
 * paths, no source code, no agent output, and not the free-text note the
 * developer writes — only its length.
 */

// The project key is not in the source: it is injected when the package is
// packed (see prepack.ts), and read from the environment otherwise. Without one
// a run reports nothing at all. The host — Seam's PostHog proxy, the same one
// the Console reports to — is just a hostname, so it has a default.
const getProjectKey = (): string =>
  process.env['SEAM_WIZARD_POSTHOG_KEY'] ?? seamPostHogProjectKey

const getPostHogHost = (): string =>
  process.env['SEAM_WIZARD_POSTHOG_HOST'] ?? 'https://e.seam.co'

// A run's events arrive in bursts — a screen change plus the decision that
// caused it — so they batch for a beat instead of one request each.
const FLUSH_AT = 20
const FLUSH_INTERVAL_MS = 1000
// The flush on the way out is the only analytics a developer ever waits for.
const REQUEST_TIMEOUT_MS = 3000
const SHUTDOWN_TIMEOUT_MS = 3000

// Long string properties are truncated rather than dropped, so an event stays
// readable without carrying an agent's error dump into PostHog.
const MAX_STRING_LENGTH = 500

// A CLI install id is a UUID and so is a Console user id, so the CLI's ids are
// namespaced: a run is an install, never a person.
const DISTINCT_ID_PREFIX = 'wizard_cli_'

export type RunOutcome = 'completed' | 'abandoned' | 'error'

interface Run {
  client: PostHog
  distinct_id: string
  started_at: number
  // Merged into every event: what stays true for the whole run.
  common: Record<string, unknown>
  // Set once the run knows its workspace, so later events join the group.
  workspace_id: string | null
  // Every phase entered, in order, including repeats.
  screens: string[]
  finished: boolean
}

let run: Run | null = null

/**
 * Begin a run: open the PostHog client, resolve the anonymous install id, and
 * record what is true of the whole run. Call once, before the app renders.
 * Events tracked before this are dropped.
 *
 * A build with no project key starts no run, so the wizard reports nothing.
 */
export const startAnalytics = async ({
  command,
}: {
  command: string
}): Promise<void> => {
  const projectKey = getProjectKey()
  if (projectKey.length === 0) return

  const client = new PostHog(projectKey, {
    host: getPostHogHost(),
    flushAt: FLUSH_AT,
    flushInterval: FLUSH_INTERVAL_MS,
    requestTimeout: REQUEST_TIMEOUT_MS,
  })
  // Without a listener the client's delivery errors surface as an unhandled
  // event. A developer setting up Seam is not the audience for them.
  client.on('error', () => {})

  run = {
    client,
    distinct_id: `${DISTINCT_ID_PREFIX}${await resolveInstallId()}`,
    started_at: Date.now(),
    common: {
      session_id: randomUUID(),
      wizard_version: seamapiWizardVersion,
      command,
      node_version: process.version,
      os_platform: platform(),
      os_release: release(),
      is_ci: isCi(),
      source: 'seam_wizard_cli',
    },
    workspace_id: null,
    screens: [],
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

  try {
    current.client.capture({
      distinctId: current.distinct_id,
      event,
      properties: sanitize({
        ...current.common,
        seconds_since_start: secondsSince(current.started_at),
        ...properties,
      }),
      ...(current.workspace_id == null
        ? {}
        : { groups: { workspace: current.workspace_id } }),
    })
  } catch {
    // Analytics never reports itself to the developer, and never fails a run.
  }
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
  run.workspace_id = workspace.workspace_id
  run.common['workspace_id'] = workspace.workspace_id
  run.common['workspace_is_sandbox'] = workspace.is_sandbox
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
 * Send everything queued and wait for it to land, then close the client. Called
 * once on the way out, where it is the only thing that blocks — briefly, and
 * bounded by the shutdown timeout — so the last events of a run are not lost to
 * process exit.
 */
export const flushAnalytics = async (): Promise<void> => {
  const current = run
  if (current == null) return
  try {
    await current.client.shutdown(SHUTDOWN_TIMEOUT_MS)
  } catch {
    // An undelivered batch is dropped, like any other delivery failure.
  }
}

/** Forget the run. For tests, and for a second run in one process. */
export const resetAnalytics = (): void => {
  // Closing the client clears its flush timer; a run left open would otherwise
  // keep one alive for the rest of the process.
  run?.client.shutdown(SHUTDOWN_TIMEOUT_MS).catch(() => {})
  run = null
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
