#!/usr/bin/env node

// This CLI exists for local development of the wizard only:
// it is not compiled or published, and the package exposes no bin.
// Consumers, e.g., the Seam CLI, mount the wizard with the default export.
// Run it with 'npm run wizard'.

import wizard from 'lib/wizard.js'

// The wizard sets up whichever project it is run in, which here is this
// repository. '--cwd <path>' points it at a scratch project instead. It is
// consumed here rather than forwarded, since it is an option of the wizard
// rather than one of its arguments. Every other argument is passed through
// untouched, so 'npm run wizard -- --help' reaches the wizard as '--help'.
const argv = process.argv.slice(2)
const cwdIndex = argv.indexOf('--cwd')
const cwd = cwdIndex === -1 ? undefined : argv.splice(cwdIndex, 2)[1]

wizard({ argv, ...(cwd == null ? {} : { cwd }) }).catch((err: unknown) => {
  const { message, stack } = err instanceof Error ? err : new Error(String(err))
  // eslint-disable-next-line no-console
  console.error(`Wizard Error: ${message}\n${stack ?? ''}`)
  process.exitCode = 1
})
