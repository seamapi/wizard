import { expect, test } from 'vitest'

import { formatIntegrateEvent } from './real-runner.js'

test('formatIntegrateEvent: prints live step and agent activity', () => {
  expect(
    [
      formatIntegrateEvent({
        kind: 'step_start',
        id: 'inspect',
        label: 'Inspect the project',
        index: 0,
        total: 2,
      }),
      formatIntegrateEvent({ kind: 'thinking', text: 'Read files\nThen edit' }),
      formatIntegrateEvent({ kind: 'tool', name: 'Read', detail: 'app.ts' }),
      formatIntegrateEvent({ kind: 'text', text: 'Implemented it.' }),
      formatIntegrateEvent({
        kind: 'step_done',
        id: 'inspect',
        index: 0,
        total: 2,
        cost_usd: 1.25,
      }),
    ].join('\n'),
  ).toBe(`  step 1/2: Inspect the project
    thinking: Read files
      Then edit
    tool: Read app.ts
    agent: Implemented it.
  step 1/2: done · $1.25`)
})
