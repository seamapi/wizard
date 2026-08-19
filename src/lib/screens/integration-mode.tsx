import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import type { ReactElement } from 'react'

export interface IntegrationModeItem {
  label: string
  value: string
}

// Pick between the hosted Customer Portal and full API control. Presentation
// only: the caller supplies the ordered items (recommended first), the optional
// rationale line, and the select handler.
export function IntegrationModeScreen({
  items,
  rationale,
  onSelect,
}: {
  items: IntegrationModeItem[]
  rationale?: string | undefined
  onSelect: (item: IntegrationModeItem) => void
}): ReactElement {
  return (
    <Box flexDirection='column'>
      <Text bold>How do you want to integrate Seam?</Text>
      {rationale != null && rationale.length > 0 && (
        <Text color='gray'>{`  ${rationale}`}</Text>
      )}
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={onSelect} />
      </Box>
    </Box>
  )
}
