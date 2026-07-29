import type { Builder, Command, Describe, Handler } from 'landlubber'

import wizard from '@seamapi/wizard'

interface Options {
  cwd: string
}

export const command: Command = 'wizard'

export const describe: Describe = 'Mount and run the Seam setup wizard'

export const builder: Builder = {
  cwd: {
    type: 'string',
    default: '.',
    describe: 'The project root the wizard should set up',
  },
}

export const handler: Handler<Options> = async ({ cwd }) => {
  await wizard({ argv: [], commandName: 'example wizard', cwd })
}
