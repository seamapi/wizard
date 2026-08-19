import parseArgs from 'minimist'

import { loadAuth, setAdapter, type WizardAdapter } from './adapter.js'
import { renderApp, renderDebugScreen } from './render.js'
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
   * command in. The wizard reads and writes the project's own files here,
   * e.g., `.env`, `.env.example`, and `.gitignore`.
   */
  cwd?: string

  adapter?: WizardAdapter
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
  if (options.adapter != null) setAdapter(options.adapter)

  const args = parseArgs([...argv], {
    boolean: ['help', 'version'],
    string: ['debug-screen'],
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

  // Dev-only: preview a single screen's layout without the auth/agent flow.
  const debugScreen = args['debug-screen']
  if (typeof debugScreen === 'string' && debugScreen.length > 0) {
    await renderDebugScreen(debugScreen)
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
    '  -h, --help            Display this help guide.',
    '  -v, --version         Display the version.',
    '  --debug-screen <name> Preview a single screen and exit (dev).',
    '',
  ].join('\n')

// TODO: Replace this with a logger wrapper.
const write = (message: string): void => {
  process.stdout.write(`${message}\n`)
}
