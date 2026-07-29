import { Box, Text, useInput } from 'ink'
import { Fragment, type ReactElement, useState } from 'react'

export interface CheckboxItem {
  id: string
  label: string
  group?: string
}

// A minimal multi-select: ↑/↓ to move, space to toggle, enter to confirm. Ink
// ships single-select (ink-select-input) but no checkbox list, so we hand-roll
// one over useInput. Only mounted during the checklist phase.
export function CheckboxList({
  items,
  initial_selected: initialSelected,
  onSubmit,
}: {
  items: CheckboxItem[]
  initial_selected: string[]
  onSubmit: (selected: string[]) => void
}): ReactElement {
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  )

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setCursor((current) => (current - 1 + items.length) % items.length)
    } else if (key.downArrow || input === 'j') {
      setCursor((current) => (current + 1) % items.length)
    } else if (input === ' ') {
      const id = items[cursor]?.id
      if (id == null) return
      setSelected((previous) => {
        const next = new Set(previous)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else if (key.return) {
      onSubmit(
        items.filter((item) => selected.has(item.id)).map((item) => item.id),
      )
    }
  })

  return (
    <Box flexDirection='column'>
      {items.map((item, index) => {
        const isCursor = index === cursor
        const isChecked = selected.has(item.id)
        const showGroup =
          item.group != null && item.group !== items[index - 1]?.group
        return (
          <Fragment key={item.id}>
            {showGroup && <Text color='gray'>{`  ${item.group ?? ''}`}</Text>}
            {/* Non-cursor rows omit `color` entirely (rather than passing
                undefined, which exactOptionalPropertyTypes rejects) so they
                inherit the terminal's default color. */}
            <Text {...(isCursor ? { color: 'cyan' } : {})}>
              {isCursor ? '❯ ' : '  '}
              {isChecked ? '◉ ' : '◯ '}
              {item.label}
            </Text>
          </Fragment>
        )
      })}
      <Text color='gray'>{'  ↑/↓ move · space toggle · enter confirm'}</Text>
    </Box>
  )
}
