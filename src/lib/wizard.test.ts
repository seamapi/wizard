import { expect, test, vi } from 'vitest'

import wizard from './wizard.js'

const captureOutput = async (
  options: Parameters<typeof wizard>[0],
): Promise<string> => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    await wizard(options)
    return log.mock.calls.map(([message]) => String(message)).join('\n')
  } finally {
    log.mockRestore()
  }
}

test('wizard: displays usage with the --help flag', async () => {
  const output = await captureOutput({ argv: ['--help'] })
  expect(output).toContain('Seam Wizard')
  expect(output).toContain('$ wizard [options]')
})

test('wizard: displays usage with the -h alias', async () => {
  const output = await captureOutput({ argv: ['-h'] })
  expect(output).toContain('Seam Wizard')
})

test('wizard: uses the given command name in usage', async () => {
  const output = await captureOutput({
    argv: ['--help'],
    commandName: 'seam wizard',
  })
  expect(output).toContain('$ seam wizard [options]')
})

test('wizard: runs with no arguments', async () => {
  const output = await captureOutput({})
  expect(output).toContain('not implemented yet')
})

test('wizard: reports forwarded arguments', async () => {
  const output = await captureOutput({ argv: ['setup', 'devices'] })
  expect(output).toContain('setup devices')
})
