import { Box, Text, useInput } from 'ink'
import React, { useState } from 'react'

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
  initial_selected,
  onSubmit,
}: {
  items: CheckboxItem[]
  initial_selected: string[]
  onSubmit: (selected: string[]) => void
}): React.ReactElement {
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial_selected),
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
        const is_cursor = index === cursor
        const is_checked = selected.has(item.id)
        const show_group =
          item.group != null && item.group !== items[index - 1]?.group
        return (
          <React.Fragment key={item.id}>
            {show_group && <Text color='gray'>{`  ${item.group ?? ''}`}</Text>}
            <Text color={is_cursor ? 'cyan' : undefined}>
              {is_cursor ? '❯ ' : '  '}
              {is_checked ? '◉ ' : '◯ '}
              {item.label}
            </Text>
          </React.Fragment>
        )
      })}
      <Text color='gray'>{'  ↑/↓ move · space toggle · enter confirm'}</Text>
    </Box>
  )
}
