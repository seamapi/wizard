#!/usr/bin/env node

import wizard from 'lib/wizard.js'

// Dev-only entry to preview a wizard screen without the Seam CLI or the
// auth/agent flow. `npm run screen -- welcome` previews one; `npm run screen`
// with no name opens a chooser. Calls the wizard directly so the preview is
// isolated from any consuming project's node_modules.
const name = process.argv[2]
const argv = name != null ? ['--debug-screen', name] : ['--debug-screen']

await wizard({ argv }).catch((error: unknown) => {
  const { message } = error instanceof Error ? error : new Error(String(error))
  // eslint-disable-next-line no-console
  console.error(`Screen preview error: ${message}`)
  process.exitCode = 1
})
