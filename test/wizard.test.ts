import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, getAuth, resetAdapter } from 'lib/adapter.js'
import { renderApp } from 'lib/render.js'
import seamapiWizardVersion from 'lib/version.js'
import wizard from 'lib/wizard.js'

vi.mock('lib/render.js', () => ({ renderApp: vi.fn() }))

// The wizard refuses to run without a TTY, so a test that expects it to render
// has to look like a terminal. Tests for the refusal set this to undefined.
const setInteractive = (isTty: boolean | undefined): void => {
  Object.defineProperty(process.stdin, 'isTTY', {
    value: isTty,
    configurable: true,
  })
}

const initialIsTty = process.stdin.isTTY

beforeEach(() => {
  vi.mocked(renderApp).mockClear()
  setInteractive(true)
})

afterEach(() => {
  setInteractive(initialIsTty)
  // Set by the refusal path; left alone it would fail the whole test run.
  process.exitCode = 0
  resetAdapter()
})

const captureError = async (
  options: Parameters<typeof wizard>[0],
): Promise<string> => {
  const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try {
    await wizard(options)
    return write.mock.calls.map(([chunk]) => String(chunk)).join('')
  } finally {
    write.mockRestore()
  }
}

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
  expect(renderApp).toHaveBeenCalledWith({
    root: process.cwd(),
    showCost: false,
    showChanges: false,
  })
})

test('wizard: runs the app in the given directory', async () => {
  await wizard({ argv: [], cwd: '/tmp/example-project' })
  expect(renderApp).toHaveBeenCalledWith({
    root: '/tmp/example-project',
    showCost: false,
    showChanges: false,
  })
})

test('wizard: passes showCost when --show-cost is given', async () => {
  await wizard({ argv: ['--show-cost'], cwd: '/tmp/example-project' })
  expect(renderApp).toHaveBeenCalledWith({
    root: '/tmp/example-project',
    showCost: true,
    showChanges: false,
  })
})

test('wizard: passes showChanges when --show-changes is given', async () => {
  await wizard({ argv: ['--show-changes'], cwd: '/tmp/example-project' })
  expect(renderApp).toHaveBeenCalledWith({
    root: '/tmp/example-project',
    showCost: false,
    showChanges: true,
  })
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

test('wizard: refuses to run without an interactive terminal', async () => {
  setInteractive(undefined)

  const output = await captureError({ argv: [], commandName: 'seam wizard' })

  expect(output).toContain('needs an interactive terminal')
  expect(output).toContain("Run 'seam wizard' in your terminal instead.")
  expect(renderApp).not.toHaveBeenCalled()
  expect(process.exitCode).toBe(1)
})

test('wizard: still displays usage without an interactive terminal', async () => {
  setInteractive(undefined)

  const output = await captureOutput({ argv: ['--help'] })

  expect(output).toContain('$ wizard [options]')
  expect(process.exitCode).not.toBe(1)
})

test('wizard: still displays the version without an interactive terminal', async () => {
  setInteractive(undefined)

  const output = await captureOutput({ argv: ['--version'] })

  expect(output.trim()).toBe(seamapiWizardVersion)
  expect(process.exitCode).not.toBe(1)
})
