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
    'Set up a Seam integration that controls everything through the Seam API. ' +
    `Implement the following, wired into ${target}'s conventions:\n${hints}\n` +
    'Load SEAM_API_KEY from the existing .env, keep changes minimal and ' +
    'idiomatic, and add a short runnable example.' +
    noteSuffix
  )
}
