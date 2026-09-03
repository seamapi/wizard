import parseArgs from 'minimist'

import { loadAuth, setAdapter, type WizardAdapter } from './adapter.js'
import { flushAnalytics, startAnalytics } from './analytics.js'
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
    boolean: ['help', 'version', 'show-cost', 'show-changes'],
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

  // Every run reaches a prompt — the connect method, the SDK, the offer to
  // write the integration — and a prompt needs stdin in raw mode, which only a
  // TTY allows. Without one the first prompt throws from inside Ink's render
  // and the developer gets a React stack trace, so say what is wrong instead.
  if (!isInteractive()) {
    writeError(nonInteractiveNotice(commandName))
    process.exitCode = 1
    return
  }

  // Dev-only: preview a screen's layout without the auth/agent flow. Passing
  // `--debug-screen` with no name opens a chooser of every available screen.
  const debugScreen = args['debug-screen']
  if (typeof debugScreen === 'string') {
    await renderDebugScreen(debugScreen.length > 0 ? debugScreen : undefined)
    return
  }

  await loadAuth()

  // Only a real run is measured: --help, --version and --debug-screen have
  // already returned above, so they start no run and send nothing.
  await startAnalytics({ command: commandName })

  try {
    await renderApp({
      root: cwd,
      showCost: args['show-cost'] === true,
      showChanges: args['show-changes'] === true,
    })
  } finally {
    // The events that say how the run ended are queued as the app unmounts, so
    // they are posted here — the last thing the wizard does, either way.
    await flushAnalytics()
  }
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
    '  --show-cost           Show the model cost on the final screen.',
    '  --show-changes        List the files the integration changed on exit.',
    '  --debug-screen [name] Preview a screen (dev). Omit name to choose one.',
    '',
  ].join('\n')

const nonInteractiveNotice = (commandName: string): string =>
  [
    'Seam Wizard needs an interactive terminal.',
    '',
    '  It asks which account to connect, which SDK to install, and whether to',
    '  write the integration, so it cannot run with stdin redirected — in a',
    '  pipe, a CI job, or a non-interactive shell.',
    '',
    `  Run '${commandName}' in your terminal instead.`,
    '',
  ].join('\n')

// Ink reads stdin, so this is the condition Ink itself checks before allowing
// raw mode. Where stdout is redirected the wizard still runs: it skips the
// alternate screen and leaves its frames in the log.
const isInteractive = (): boolean => process.stdin.isTTY === true

// TODO: Replace these with a logger wrapper.
const write = (message: string): void => {
  process.stdout.write(`${message}\n`)
}

const writeError = (message: string): void => {
  process.stderr.write(`${message}\n`)
}
