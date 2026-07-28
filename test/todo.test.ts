import { expect, test } from 'vitest'

import { todo } from '@seamapi/wizard'

test('todo: returns argument', () => {
  expect(todo('todo')).toBe('todo')
})
