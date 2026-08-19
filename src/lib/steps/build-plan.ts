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

// One agent step. The wizard runs the integration one step at a time, so each
// selected building block becomes a step the agent — and the Tasks checklist —
// works through in order.
export interface IntegrationStep {
  id: string
  label: string
  goal: string
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
      'this app only calls a few endpoints. Build two flows. ' +
      '(1) A connections-and-mapping page: create an embedded Customer Portal ' +
      '(is_embedded: true) with the connect, organize, and manage features so ' +
      'the customer connects their device accounts and maps devices onto their ' +
      'spaces, and embed the returned hosted URL in an iframe. ' +
      '(2) Open a reservation directly: push the reservation to Seam ' +
      '(customers.pushData), then create a portal deep-linked to that ' +
      'reservation (landing_page or deep_link) that a reservation page links ' +
      'to. Keep Seam in sync with the app: call customers.pushData from the ' +
      'booking create and update handlers (and customers.deleteData on ' +
      'cancellation) so new and changed reservations reach the portal — do not ' +
      'push only when a reservation page is opened. Regenerate the portal on ' +
      `every visit since the session token is short-lived. Wire it into ${target}'s conventions, load SEAM_API_KEY ` +
      "from the existing .env, model the structure on Seam's Customer Portal " +
      'example app for this framework, and add a short runnable example.' +
      noteSuffix
    )
  }

  const hints = selections
    .map((id) => blockById(id)?.agent_hint)
    .filter((hint): hint is string => hint != null)
    .map((hint) => `- ${hint}`)
    .join('\n')

  return (
    'Set up a Seam integration that controls access through the Seam API, ' +
    `wired into ${target}'s conventions and into the app's EXISTING models, ` +
    'flows, and pages — extend them, do not add standalone Seam-only pages. ' +
    `Implement the following:\n${hints}\n` +
    'Integrate the way a real product would rather than as a parallel demo: if ' +
    'the app has a reservation or booking flow, create an Access Grant when a ' +
    'reservation is created (its guest as a User Identity, scoped to the ' +
    "reservation's space, over the stay window) and revoke it on cancellation, " +
    'by hooking the existing create/update/delete handlers — not a separate ' +
    "page; map connected devices onto the app's spaces/units; and surface the " +
    'resulting access (such as the PIN code) on the existing reservation view. ' +
    'Model the Seam API usage on the Full API example app for this framework. ' +
    'Load SEAM_API_KEY from the existing .env, keep changes minimal and ' +
    'idiomatic, and add a short runnable example.' +
    noteSuffix
  )
}

// Break the chosen integration into ordered steps the agent runs one at a time.
// Customer Portal is a single step; Full API is one step per selected building
// block, so the agent loop and the Tasks checklist share the same list. The
// holistic full-API guidance (extend existing flows, reservation -> access
// grant) lives in the agent system prompt, so each per-block step inherits it.
export function buildIntegrationSteps(args: {
  mode: BuildMode
  selections: string[]
  note: string | null
  framework: string | null
}): IntegrationStep[] {
  const { mode, selections, note, framework } = args

  if (mode === 'customer_portal') {
    return [
      {
        id: 'customer_portal',
        label: 'Customer Portal',
        goal: composeGoal({ mode, selections: [], note, framework }),
      },
    ]
  }

  const target = framework ?? 'the project'
  const noteSuffix =
    note != null && note.trim().length > 0
      ? ` Additional context from the developer: ${note.trim()}`
      : ''
  // Order steps by the canonical block order (CORE then COMMON), not the order
  // the developer happened to toggle them in — so the checklist and the agent
  // loop are deterministic and match the checklist's own display order. Unknown
  // ids fall out because they aren't in ALL_BLOCKS.
  const selectedIds = new Set(selections)
  const blocks = ALL_BLOCKS.filter((block) => selectedIds.has(block.id))

  return blocks.map((block, index) => ({
    id: block.id,
    label: block.label,
    goal:
      `Continue the Seam integration in ${target} — step ${index + 1} of ${blocks.length}. ` +
      'Earlier steps may already have added Seam setup; read the existing files ' +
      'and build on them rather than duplicating. Now implement just this:\n' +
      `- ${block.agent_hint}\n` +
      "Wire it into the app's existing models, flows, and pages (extend them; do " +
      'not add standalone Seam-only pages). Load SEAM_API_KEY from the existing ' +
      '.env, keep changes minimal and idiomatic.' +
      noteSuffix,
  }))
}
