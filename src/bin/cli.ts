#!/usr/bin/env node

// This CLI exists for local development of the wizard only:
// it is not compiled or published, and the package exposes no bin.
// Consumers, e.g., the Seam CLI, mount the wizard with the default export.
// Run it with 'npm run wizard'.

import wizard from 'lib/wizard.js'

wizard({ argv: process.argv.slice(2) }).catch((err: unknown) => {
  const { message, stack } = err instanceof Error ? err : new Error(String(err))
  // eslint-disable-next-line no-console
  console.error(`Wizard Error: ${message}\n${stack ?? ''}`)
  process.exitCode = 1
})
