import { Box, Text } from 'ink'
import type { ReactElement } from 'react'

import {
  type CheckboxItem,
  CheckboxList,
} from 'lib/components/checkbox-list.js'

// Choose which building blocks the integration includes. These are the same
// blocks that become the Tasks steps, so this is the input to the Tasks screen.
export function ChecklistScreen({
  items,
  initialSelected,
  onSubmit,
}: {
  items: CheckboxItem[]
  initialSelected: string[]
  onSubmit: (selected: string[]) => void
}): ReactElement {
  return (
    <Box flexDirection='column'>
      <Text bold>What should the integration include? (space to toggle)</Text>
      <Box marginTop={1}>
        <CheckboxList
          items={items}
          initial_selected={initialSelected}
          onSubmit={onSubmit}
        />
      </Box>
    </Box>
  )
}
