import { render } from 'ink-testing-library'
import { expect, test } from 'vitest'

import {
  LEARN_CARD_SECONDS,
  LEARN_CARDS,
  LEARN_CARDS_MAX_LINE_LENGTH,
  Tips,
} from './tips.js'

// Every rendered line is printed after a leading space inside a 30-wide column.
// A line over the limit wraps and shears the two-column layout, which is only
// visible in a real terminal — so it is asserted here instead.
test('LEARN_CARDS: every title and line fits the Tips column', () => {
  const tooWide = LEARN_CARDS.flatMap((card) =>
    [card.title, ...card.lines]
      .map((line) => ({ line, width: 1 + [...line].length }))
      .filter(({ width }) => width > LEARN_CARDS_MAX_LINE_LENGTH),
  )

  expect(tooWide).toEqual([])
})

test('LEARN_CARDS: every card has a title and a body', () => {
  for (const card of LEARN_CARDS) {
    expect(card.title).not.toBe('')
    expect(card.lines.some((line) => line !== '')).toBe(true)
  }
})

// The rotation in IntegrateProgress indexes by elapsed time modulo the card
// count, so an empty deck would render nothing at all.
test('LEARN_CARDS: the deck covers a long run', () => {
  expect(LEARN_CARDS).toHaveLength(10)
  expect(LEARN_CARDS.length * LEARN_CARD_SECONDS).toBeGreaterThanOrEqual(60)
})

test('Tips: renders the card title and its lines', () => {
  const card = { title: 'How Seam works', lines: ['An Access Grant', 'PIN'] }

  const { lastFrame, unmount } = render(<Tips learnCard={card} />)
  try {
    const frame = lastFrame() ?? ''
    expect(frame).toContain('How Seam works')
    expect(frame).toContain('An Access Grant')
    expect(frame).toContain('PIN')
  } finally {
    unmount()
  }
})
