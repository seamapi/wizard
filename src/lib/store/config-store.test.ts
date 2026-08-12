import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  createMemoryAdapter,
  getAdapter,
  resetAdapter,
  setAdapter,
} from 'lib/adapter.js'

import { readPreferredSdk, writePreferredSdk } from './config-store.js'

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

test('preferred SDK: ignores an SDK the wizard no longer offers', async () => {
  await getAdapter().config.set('sdk', 'ruby')

  expect(await readPreferredSdk()).toBeNull()
})
