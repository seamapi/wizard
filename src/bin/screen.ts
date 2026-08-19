#!/usr/bin/env node

import wizard from 'lib/wizard.js'

// Dev-only entry to preview a single wizard screen without the Seam CLI or the
// auth/agent flow: `npm run screen -- welcome`. Calls the wizard directly so the
// preview is isolated from any consuming project's node_modules.
const name = process.argv[2] ?? 'welcome'

await wizard({ argv: ['--debug-screen', name] }).catch((error: unknown) => {
  const { message } = error instanceof Error ? error : new Error(String(error))
  // eslint-disable-next-line no-console
  console.error(`Screen preview error: ${message}`)
  process.exitCode = 1
})
