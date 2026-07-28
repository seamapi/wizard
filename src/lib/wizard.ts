import parseArgs from 'minimist'

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
}

/**
 * Run the Seam setup wizard.
 *
 * This is the entrypoint used by the Seam CLI to mount the entire wizard
 * as a subcommand. It is also used by the development CLI in `src/bin/cli.ts`.
 */
const wizard = async (options: WizardOptions = {}): Promise<void> => {
  const { argv = [], commandName = 'wizard' } = options

  const args = parseArgs([...argv], {
    boolean: ['help'],
    alias: { h: 'help' },
  })

  if (args['help'] === true) {
    write(usage(commandName))
    return
  }

  // TODO: Implement the wizard.
  await Promise.resolve()

  write(
    [
      `The ${commandName} is not implemented yet.`,
      `Run '${commandName} --help' for usage.`,
      ...(args._.length > 0 ? [`Received arguments: ${args._.join(' ')}`] : []),
    ].join('\n'),
  )
}

export default wizard

const usage = (commandName: string): string =>
  [
    'Seam Wizard',
    '',
    '  The AI powered Seam setup wizard.',
    '',
    'Usage',
    '',
    `  $ ${commandName} [options]`,
    '',
    'Options',
    '',
    '  -h, --help   Display this help guide.',
    '',
  ].join('\n')

// TODO: Replace this with a logger wrapper.
const write = (message: string): void => {
  // eslint-disable-next-line no-console
  console.log(message)
}
