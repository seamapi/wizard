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
      formatIntegrateEvent({
        kind: 'tool_done',
        name: 'Read',
        detail: 'app.ts',
        elapsed_ms: 230,
      }),
      formatIntegrateEvent({ kind: 'text', text: 'Implemented it.' }),
      formatIntegrateEvent({
        kind: 'turn_done',
        index: 1,
        elapsed_ms: 8_400,
      }),
      formatIntegrateEvent(
        {
          kind: 'step_done',
          id: 'inspect',
          index: 0,
          total: 2,
          cost_usd: 1.25,
        },
        12_500,
      ),
    ].join('\n'),
  ).toBe(`  step 1/2: Inspect the project
    thinking: Read files
      Then edit
    tool: Read app.ts
    tool: Read app.ts · done · 0.2s
    agent: Implemented it.
    turn 1: done · 8.4s
  step 1/2: done · 12.5s · $1.25`)
})
