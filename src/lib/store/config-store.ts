import { getAdapter } from 'lib/adapter.js'
import type { Sdk } from 'lib/steps/detect-project.js'

const sdkKey = 'sdk'
const installIdKey = 'analytics_install_id'

export const readPreferredSdk = async (): Promise<Sdk | null> => {
  const sdk = await getAdapter().config.get(sdkKey)
  return sdk === 'javascript' ||
    sdk === 'python' ||
    sdk === 'ruby' ||
    sdk === 'php'
    ? sdk
    : null
}

export const writePreferredSdk = async (sdk: Sdk): Promise<void> => {
  await getAdapter().config.set(sdkKey, sdk)
}

// The anonymous id analytics events are attributed to. It identifies this
// install of the host CLI — not the developer — and is what lets a repeat run
// be recognized as the same install rather than a new one. Null until a run has
// written one.
export const readInstallId = async (): Promise<string | null> => {
  const installId = await getAdapter().config.get(installIdKey)
  return typeof installId === 'string' && installId.length > 0
    ? installId
    : null
}

export const writeInstallId = async (installId: string): Promise<void> => {
  await getAdapter().config.set(installIdKey, installId)
}
