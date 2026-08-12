#!/usr/bin/env node

// This entry exists for local development of the wizard only: it is not
// compiled or published, and the package exposes no bin. It runs the Seam
// CLI from devDependencies with its '@seamapi/wizard' import pointed at this
// checkout, so 'npm run wizard' runs the wizard as 'seam wizard'.

import { registerHooks } from 'node:module'

const wizardEntry = new URL('../index.ts', import.meta.url).href

registerHooks({
  resolve: (specifier, context, next) =>
    specifier === '@seamapi/wizard'
      ? next(wizardEntry, context)
      : next(specifier, context),
})

// '--cwd <path>' is an option of this entry, pointing the wizard at a
// scratch project instead of this repository. Every other argument is passed
// through untouched.
const argv = process.argv.slice(2)
const cwdIndex = argv.indexOf('--cwd')
const cwd = cwdIndex === -1 ? undefined : argv.splice(cwdIndex, 2)[1]
if (cwd != null) process.chdir(cwd)

process.argv = [process.argv[0] ?? 'node', 'seam', 'wizard', ...argv]

await import('@seamapi/cli/cli')
