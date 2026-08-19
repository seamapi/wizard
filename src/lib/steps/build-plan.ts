// Top-level fork: let Seam host the UI (the app calls ~2 endpoints), or drive
// everything through the API and build the UI yourself.
export type BuildMode = 'customer_portal' | 'full_api'

export interface BuildBlock {
  id: string
  label: string
  // Appended (as an instruction line) to the agent goal.
  agent_hint: string
}

// One agent step. The wizard runs the integration one step at a time, so each
// building block becomes a step the agent — and the Tasks checklist — works
// through in order.
export interface IntegrationStep {
  id: string
  label: string
  goal: string
}

// The building blocks every full-API integration gets. There is no longer a
// checklist to toggle these — a Seam integration always sets up connected
// accounts (devices), spaces (the app's properties), user identities (the
// people), and access grants (Seam's recommended way to grant access).
export const INTEGRATION_BLOCKS: BuildBlock[] = [
  {
    id: 'connect_device',
    label: 'Connect a device (Connect Webview + connected accounts)',
    agent_hint:
      'Set up a Connect Webview so an end user can connect their account and devices, then list the connected devices.',
  },
  {
    id: 'access_grants',
    label: 'Access Grants — grant a person access',
    agent_hint:
      "Create an Access Grant to give a person access to a space or device (Seam's recommended API for granting access).",
  },
  {
    id: 'user_identities',
    label: 'User Identities (the people who receive access)',
    agent_hint:
      'Create and manage User Identities representing the people who receive access.',
  },
  {
    id: 'spaces',
    label: 'Spaces (the app’s properties / units)',
    agent_hint:
      "Model the app's properties/units as Seam Spaces and map connected devices onto the right space.",
  },
]

export function blockById(id: string): BuildBlock | undefined {
  return INTEGRATION_BLOCKS.find((block) => block.id === id)
}

// Turn the chosen mode + free-text note into the goal string that drives the
// embedded integration agent.
export function composeGoal(args: {
  mode: BuildMode
  note: string | null
  framework: string | null
}): string {
  const { mode, note, framework } = args
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

  const hints = INTEGRATION_BLOCKS.map((block) => `- ${block.agent_hint}`).join(
    '\n',
  )

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

// Break the integration into ordered steps the agent runs one at a time.
// Customer Portal is a single step; Full API is one step per building block, so
// the agent loop and the Tasks checklist share the same list. The holistic
// full-API guidance (extend existing flows, reservation -> access grant) lives
// in the agent system prompt, so each per-block step inherits it.
export function buildIntegrationSteps(args: {
  mode: BuildMode
  note: string | null
  framework: string | null
}): IntegrationStep[] {
  const { mode, note, framework } = args

  if (mode === 'customer_portal') {
    return [
      {
        id: 'customer_portal',
        label: 'Customer Portal',
        goal: composeGoal({ mode, note, framework }),
      },
    ]
  }

  const target = framework ?? 'the project'
  const noteSuffix =
    note != null && note.trim().length > 0
      ? ` Additional context from the developer: ${note.trim()}`
      : ''

  return INTEGRATION_BLOCKS.map((block, index) => ({
    id: block.id,
    label: block.label,
    goal:
      `Continue the Seam integration in ${target} — step ${index + 1} of ${INTEGRATION_BLOCKS.length}. ` +
      'Earlier steps may already have added Seam setup; read the existing files ' +
      'and build on them rather than duplicating. Now implement just this:\n' +
      `- ${block.agent_hint}\n` +
      "Wire it into the app's existing models, flows, and pages (extend them; do " +
      'not add standalone Seam-only pages). Load SEAM_API_KEY from the existing ' +
      '.env, keep changes minimal and idiomatic.' +
      noteSuffix,
  }))
}
