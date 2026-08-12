import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, getAuth, resetAdapter } from './adapter.js'
import { renderApp } from './render.js'
import seamapiWizardVersion from './version.js'
import wizard from './wizard.js'

vi.mock('./render.js', () => ({ renderApp: vi.fn() }))

beforeEach(() => {
  vi.mocked(renderApp).mockClear()
})

afterEach(resetAdapter)

const captureOutput = async (
  options: Parameters<typeof wizard>[0],
): Promise<string> => {
  const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  try {
    await wizard(options)
    return write.mock.calls.map(([chunk]) => String(chunk)).join('')
  } finally {
    write.mockRestore()
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

test('wizard: does not run the app when displaying usage', async () => {
  await captureOutput({ argv: ['--help'] })
  expect(renderApp).not.toHaveBeenCalled()
})

test('wizard: displays the version with the --version flag', async () => {
  const output = await captureOutput({ argv: ['--version'] })
  expect(output.trim()).toBe(seamapiWizardVersion)
})

test('wizard: displays the version with the -v alias', async () => {
  const output = await captureOutput({ argv: ['-v'] })
  expect(output.trim()).toBe(seamapiWizardVersion)
})

test('wizard: does not run the app when displaying the version', async () => {
  await captureOutput({ argv: ['--version'] })
  expect(renderApp).not.toHaveBeenCalled()
})

test('wizard: runs the app in the working directory by default', async () => {
  await wizard()
  expect(renderApp).toHaveBeenCalledWith({ root: process.cwd() })
})

test('wizard: runs the app in the given directory', async () => {
  await wizard({ argv: [], cwd: '/tmp/example-project' })
  expect(renderApp).toHaveBeenCalledWith({ root: '/tmp/example-project' })
})

test('wizard: runs on the adapter it is given', async () => {
  const adapter = createMemoryAdapter({
    auth: {
      endpoint: 'https://connect.example.com',
      apiKey: 'seam_apikey1_token',
      workspaceId: 'workspace-1',
    },
  })

  await wizard({ argv: [], adapter })

  expect(getAuth()).toMatchObject({ endpoint: 'https://connect.example.com' })
})

test('wizard: runs logged out when it is given no adapter', async () => {
  await wizard({ argv: [] })

  expect(getAuth().apiKey).toBeNull()
})

test('wizard: asks no adapter anything to display usage', async () => {
  const getAuthSpy = vi.fn(async () => ({
    endpoint: 'https://connect.example.com',
    apiKey: null,
    workspaceId: null,
  }))

  await captureOutput({
    argv: ['--help'],
    adapter: { ...createMemoryAdapter(), getAuth: getAuthSpy },
  })

  expect(getAuthSpy).not.toHaveBeenCalled()
})
