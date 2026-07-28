import { expect, test } from 'vitest'

import { todo } from './todo.js'

test('todo: returns argument', () => {
  expect(todo('todo')).toBe('todo')
})
