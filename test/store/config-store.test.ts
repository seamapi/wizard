import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  createMemoryAdapter,
  getAdapter,
  resetAdapter,
  setAdapter,
} from 'lib/adapter.js'
import {
  readInstallId,
  readPreferredSdk,
  writeInstallId,
  writePreferredSdk,
} from 'lib/store/config-store.js'

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(resetAdapter)

test('preferred SDK: is null until the developer has chosen one', async () => {
  expect(await readPreferredSdk()).toBeNull()
})

test('preferred SDK: reads back the SDK the developer chose', async () => {
  await writePreferredSdk('python')

  expect(await readPreferredSdk()).toBe('python')
})

test('preferred SDK: is kept in the settings the host holds', async () => {
  await writePreferredSdk('javascript')

  expect(await getAdapter().config.get('sdk')).toBe('javascript')
})

test('preferred SDK: ignores an SDK the wizard does not offer', async () => {
  await getAdapter().config.set('sdk', 'go')

  expect(await readPreferredSdk()).toBeNull()
})

test('install id: is null until a run has written one', async () => {
  expect(await readInstallId()).toBeNull()
})

test('install id: reads back the id analytics attributes runs to', async () => {
  await writeInstallId('install-1')

  expect(await readInstallId()).toBe('install-1')
  expect(await getAdapter().config.get('analytics_install_id')).toBe(
    'install-1',
  )
})

test('install id: ignores a value the host cannot have written', async () => {
  await getAdapter().config.set('analytics_install_id', '')

  expect(await readInstallId()).toBeNull()
})
