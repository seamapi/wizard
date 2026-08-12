/**
 * What the wizard cannot decide for itself, answered by whoever mounts it.
 *
 * The Seam CLI mounts the wizard and implements this: it owns the login and
 * it owns where files go, so the wizard asks rather than reaching for either.
 */

export interface WizardAuth {
  /** The Seam API server to talk to. */
  server: string
  /** Whether the server was overridden, chosen in the CLI, or the default. */
  serverSource: 'env' | 'cli' | 'default'
  /** A workspace API key the project can use as SEAM_API_KEY, if there is one. */
  apiKey: string | null
  /** The workspace the login is pointed at, when it names one. */
  workspaceId: string | null
  loginKind:
    'api_key' | 'personal_access_token' | 'console_session_token' | 'none'
}

/** Values the host keeps for the wizard. The keys are the wizard's own. */
export interface WizardValues {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
}

export interface WizardHost {
  getAuth: () => Promise<WizardAuth>
  /** Preferences the developer chose, e.g., the SDK. */
  settings: WizardValues
  /** What the wizard recorded about the projects it set up. */
  state: WizardValues
}

export const defaultServer = 'https://connect.getseam.com'

const loggedOut: WizardAuth = {
  server: defaultServer,
  serverSource: 'default',
  apiKey: null,
  workspaceId: null,
  loginKind: 'none',
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

/** The default host: the run works, nothing outlives it. */
export const createMemoryHost = ({
  auth = loggedOut,
  settings = {},
  state = {},
}: {
  auth?: WizardAuth
  settings?: Record<string, unknown>
  state?: Record<string, unknown>
} = {}): WizardHost => ({
  getAuth: async () => auth,
  settings: createMemoryValues(settings),
  state: createMemoryValues(state),
})

let host: WizardHost = createMemoryHost()
let auth: WizardAuth | null = null

export const getHost = (): WizardHost => host

/** Mount the wizard on a host, e.g., the Seam CLI, or a fake from a test. */
export const setHost = (nextHost: WizardHost): void => {
  host = nextHost
  auth = null
}

export const resetHost = (): void => {
  host = createMemoryHost()
  auth = null
}

/** Ask the host who the developer is, once for the run. */
export const loadAuth = async (): Promise<WizardAuth> => {
  auth ??= await host.getAuth()
  return auth
}

/** The auth loaded at startup. Logged out until {@link loadAuth} resolves. */
export const getAuth = (): WizardAuth => auth ?? loggedOut
