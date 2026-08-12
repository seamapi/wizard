import parseArgs from 'minimist'

import { loadAuth, setHost, type WizardHost } from './host.js'
import { renderApp } from './render.js'
import seamapiWizardVersion from './version.js'

export interface WizardOptions {
  /**
   * Command line arguments for the wizard, e.g., `process.argv.slice(2)`.
   *
   * These are the arguments _after_ the command used to invoke the wizard,
   * so a consumer mounting the wizard as a subcommand should forward only
   * the arguments belonging to the wizard.
   */
  argv?: readonly string[]

  /**
   * The command used to invoke the wizard, shown in help output.
   *
   * Defaults to `wizard`.
   * The Seam CLI mounts this wizard and passes `seam wizard`.
   */
  commandName?: string

  /**
   * The project root the wizard sets up.
   *
   * Defaults to `process.cwd()`, which is the project the developer ran the
   * command in. The wizard reads and writes files here, e.g., `.env` and
   * `.seam/onboarding.json`.
   */
  cwd?: string

  /**
   * Everything the wizard cannot decide for itself: the developer's Seam
   * login, and where what it records is kept.
   *
   * The Seam CLI passes its own. Without one the wizard runs against an
   * in-memory host: the run works, and nothing outlives it.
   */
  host?: WizardHost
}

/**
 * Run the Seam setup wizard.
 *
 * This is the entrypoint used by the Seam CLI to mount the entire wizard
 * as a subcommand. It is also used by the development CLI in `src/bin/cli.ts`.
 *
 * Resolves once the wizard has finished, having taken over the terminal for
 * the duration of the run. Rejects only if the wizard could not be run at
 * all: a step that fails reports itself to the user and does not reject.
 */
const wizard = async (options: WizardOptions = {}): Promise<void> => {
  const { argv = [], commandName = 'wizard', cwd = process.cwd() } = options
  if (options.host != null) setHost(options.host)

  const args = parseArgs([...argv], {
    boolean: ['help', 'version'],
    alias: { h: 'help', v: 'version' },
  })

  if (args['help'] === true) {
    write(usage(commandName))
    return
  }

  if (args['version'] === true) {
    write(seamapiWizardVersion)
    return
  }

  await loadAuth()

  await renderApp({ root: cwd })
}

export default wizard

const usage = (commandName: string): string =>
  [
    'Seam Wizard',
    '',
    '  The AI powered Seam setup wizard.',
    '',
    '  Connects your Seam account, installs the Seam SDK and the Seam plugin',
    '  skills, and optionally writes a Seam integration into your project.',
    '',
    'Usage',
    '',
    `  $ ${commandName} [options]`,
    '',
    'Options',
    '',
    '  -h, --help      Display this help guide.',
    '  -v, --version   Display the version.',
    '',
  ].join('\n')

// TODO: Replace this with a logger wrapper.
const write = (message: string): void => {
  process.stdout.write(`${message}\n`)
}
