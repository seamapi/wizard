export interface WizardAuth {
  endpoint: string
  apiKey: string | null
  workspaceId: string | null
}

export interface StorageAdapter {
  get: (key: string) => Promise<unknown>
  set: (key: string, value: unknown) => Promise<void>
}

export interface WizardAdapter {
  getAuth: () => Promise<WizardAuth>
  config: StorageAdapter
  state: StorageAdapter
}

export const defaultEndpoint = 'https://connect.getseam.com'

const loggedOut: WizardAuth = {
  endpoint: defaultEndpoint,
  apiKey: null,
  workspaceId: null,
}

export const createMemoryStorage = (
  initialValues: Record<string, unknown> = {},
): StorageAdapter => {
  const values = new Map(Object.entries(initialValues))
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value)
    },
  }
}

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
  config: createMemoryStorage(config),
  state: createMemoryStorage(state),
})

let adapter: WizardAdapter = createMemoryAdapter()
let auth: WizardAuth | null = null

export const getAdapter = (): WizardAdapter => adapter

export const setAdapter = (nextAdapter: WizardAdapter): void => {
  adapter = nextAdapter
  auth = null
}

export const resetAdapter = (): void => {
  adapter = createMemoryAdapter()
  auth = null
}

export const loadAuth = async (): Promise<WizardAuth> => {
  auth ??= await adapter.getAuth()
  return auth
}

export const getAuth = (): WizardAuth => auth ?? loggedOut
