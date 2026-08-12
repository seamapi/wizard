import { getAdapter } from 'lib/adapter.js'
import type { Sdk } from 'lib/steps/detect-project.js'

const sdkKey = 'sdk'

export const readPreferredSdk = async (): Promise<Sdk | null> => {
  const sdk = await getAdapter().config.get(sdkKey)
  return sdk === 'javascript' || sdk === 'python' ? sdk : null
}

export const writePreferredSdk = async (sdk: Sdk): Promise<void> => {
  await getAdapter().config.set(sdkKey, sdk)
}
