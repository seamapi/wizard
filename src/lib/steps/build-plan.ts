import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Top-level fork: let Seam host the UI (the app calls ~2 endpoints), or drive
// everything through the API and build the UI yourself.
export type BuildMode = 'customer_portal' | 'full_api'

export interface BuildBlock {
  id: string
  group: 'Core' | 'Common'
  label: string
  // Appended (as an instruction line) to the agent goal when selected.
  agent_hint: string
}

// Core building blocks — the foundation almost every integration needs.
// `access_grants` is Seam's recommended way to grant a person access, so it is
// the default-checked item.
export const CORE_BLOCKS: BuildBlock[] = [
  {
    id: 'connect_device',
    group: 'Core',
    label: 'Connect a device (Connect Webview + connected accounts)',
    agent_hint:
      'Set up a Connect Webview so an end user can connect their account and devices, then list the connected devices.',
  },
  {
    id: 'access_grants',
    group: 'Core',
    label: 'Access Grants — grant a person access',
    agent_hint:
      "Create an Access Grant to give a person access to a space or device (Seam's recommended API for granting access).",
  },
  {
    id: 'user_identities',
    group: 'Core',
    label: 'User Identities (the people who receive access)',
    agent_hint:
      'Create and manage User Identities representing the people who receive access.',
  },
]

// Common building blocks — frequent next steps beyond the core.
export const COMMON_BLOCKS: BuildBlock[] = [
  {
    id: 'access_codes',
    group: 'Common',
    label: 'Access codes (PIN codes on locks)',
    agent_hint: 'Program PIN access codes on smart locks.',
  },
  {
    id: 'reservations',
    group: 'Common',
    label: 'Reservations → access (PMS / booking flow)',
    agent_hint:
      'Wire a booking/reservation flow so each reservation automatically provisions and revokes access.',
  },
  {
    id: 'mobile_keys',
    group: 'Common',
    label: 'Mobile keys / credentials',
    agent_hint: 'Issue mobile-key credentials to users.',
  },
  {
    id: 'webhooks',
    group: 'Common',
    label: 'Webhooks & events',
    agent_hint:
      'Subscribe to Seam webhooks and handle the events (e.g. access granted, device connected).',
  },
]

export const ALL_BLOCKS: BuildBlock[] = [...CORE_BLOCKS, ...COMMON_BLOCKS]

export function blockById(id: string): BuildBlock | undefined {
  return ALL_BLOCKS.find((block) => block.id === id)
}

// Turn the chosen mode + building blocks + free-text note into the goal string
// that drives the embedded integration agent.
export function composeGoal(args: {
  mode: BuildMode
  selections: string[]
  note: string | null
  framework: string | null
}): string {
  const { mode, selections, note, framework } = args
  const target = framework ?? 'the project'
  const noteSuffix =
    note != null && note.trim().length > 0
      ? ` Additional context from the developer: ${note.trim()}`
      : ''

  if (mode === 'customer_portal') {
    return (
      'Integrate Seam using the Customer Portal so the UI is Seam-hosted and ' +
      'this app only calls a couple of endpoints. Create a Customer Portal for ' +
      'a customer (it returns a hosted URL), embed it in the app (iframe or a ' +
      'magic link), and regenerate the portal per visit since the session is ' +
      `short-lived. Wire it into ${target}'s conventions, load SEAM_API_KEY from ` +
      'the existing .env, and add a short runnable example.' +
      noteSuffix
    )
  }

  const hints = selections
    .map((id) => blockById(id)?.agent_hint)
    .filter((hint): hint is string => hint != null)
    .map((hint) => `- ${hint}`)
    .join('\n')

  return (
    'Set up a Seam integration that controls everything through the Seam API. ' +
    `Implement the following, wired into ${target}'s conventions:\n${hints}\n` +
    'Load SEAM_API_KEY from the existing .env, keep changes minimal and ' +
    'idiomatic, and add a short runnable example.' +
    noteSuffix
  )
}

// Schema version for the on-disk record; bump on any breaking shape change.
const RECORD_SCHEMA_VERSION = 1

export interface OnboardingRecord {
  schema_version: number
  created_at: string
  mode: BuildMode
  selections: string[]
  note: string | null
  goal: string
  analysis: {
    sdk: string | null
    framework: string | null
    app_type_guess: string | null
    seam_already_setup: boolean
    used_onboarding: boolean
    recommendation_source: 'llm' | 'heuristic'
  }
  result?: {
    ok: boolean
    files_summary: string
    cost_usd: number | null
  }
}

// Write the wizard's run record to <root>/.seam/onboarding.json. Holds no
// secrets (the API key stays in .env), so it is safe to commit as a record of
// what was set up, and the embedded agent / a later editor agent can read it.
export function writeOnboardingRecord(
  root: string,
  record: Omit<OnboardingRecord, 'schema_version'>,
): void {
  const dir = join(root, '.seam')
  mkdirSync(dir, { recursive: true })
  const full: OnboardingRecord = {
    schema_version: RECORD_SCHEMA_VERSION,
    ...record,
  }
  writeFileSync(
    join(dir, 'onboarding.json'),
    `${JSON.stringify(full, null, 2)}\n`,
  )
}
