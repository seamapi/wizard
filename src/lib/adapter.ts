/**
 * What the wizard cannot decide for itself, answered by whoever mounts it.
 *
 * The Seam CLI mounts the wizard and implements this: it owns the login and
 * it owns where files go, so the wizard asks rather than reaching for either.
 */

export interface WizardAuth {
  /** The Seam API endpoint to talk to. */
  endpoint: string
  /** Whether the endpoint was overridden, chosen in the CLI, or the default. */
  endpointSource: 'env' | 'cli' | 'default'
  /** A workspace API key the project can use as SEAM_API_KEY, if there is one. */
  apiKey: string | null
  /** The workspace the login is pointed at, when it names one. */
  workspaceId: string | null
  authMethod:
    'api_key' | 'personal_access_token' | 'console_session_token' | 'none'
}

/** Values the adapter keeps for the wizard. The keys are the wizard's own. */
export interface WizardValues {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
}

export interface WizardAdapter {
  getAuth: () => Promise<WizardAuth>
  /** Preferences the developer chose, e.g., the SDK. */
  config: WizardValues
  /** What the wizard recorded about the projects it set up. */
  state: WizardValues
}

export const defaultEndpoint = 'https://connect.getseam.com'

const loggedOut: WizardAuth = {
  endpoint: defaultEndpoint,
  endpointSource: 'default',
  apiKey: null,
  workspaceId: null,
  authMethod: 'none',
}

export const createMemoryValues = (
  initialValues: Record<string, unknown> = {},
): WizardValues => {
  const values = new Map(Object.entries(initialValues))
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value)
    },
  }
}

/** The default adapter: the run works, nothing outlives it. */
export const createMemoryAdapter = ({
  auth = loggedOut,
  config = {},
  state = {},
}: {
  auth?: WizardAuth
  config?: Record<string, unknown>
  state?: Record<string, unknown>
} = {}): WizardAdapter => ({
  getAuth: async () => auth,
  config: createMemoryValues(config),
  state: createMemoryValues(state),
})

let adapter: WizardAdapter = createMemoryAdapter()
let auth: WizardAuth | null = null

export const getAdapter = (): WizardAdapter => adapter

/** Mount the wizard on an adapter, e.g., the Seam CLI, or a test's own. */
export const setAdapter = (nextAdapter: WizardAdapter): void => {
  adapter = nextAdapter
  auth = null
}

export const resetAdapter = (): void => {
  adapter = createMemoryAdapter()
  auth = null
}

/** Ask the adapter who the developer is, once for the run. */
export const loadAuth = async (): Promise<WizardAuth> => {
  auth ??= await adapter.getAuth()
  return auth
}

/** The auth loaded at startup. Logged out until {@link loadAuth} resolves. */
export const getAuth = (): WizardAuth => auth ?? loggedOut
