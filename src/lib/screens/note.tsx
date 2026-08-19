import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import type { ReactElement } from 'react'

// The last step before the agent runs. People stalled here not knowing what to
// type, so the screen leads with "this is optional, Enter starts it" and shows
// concrete examples of the kind of instruction that helps.
export function NoteScreen({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
}): ReactElement {
  return (
    <Box flexDirection='column'>
      <Text bold>Anything specific the integration should do? (optional)</Text>
      <Text color='gray'>
        Press Enter to skip and start building — or add an instruction and Seam
        AI will follow it.
      </Text>
      <Box flexDirection='column' marginTop={1}>
        <Text color='gray'>For example:</Text>
        {EXAMPLES.map((example) => (
          <Text key={example} color='gray'>
            {'  • '}
            {example}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color='cyan'>{'› '}</Text>
        <TextInput
          value={value}
          onChange={onChange}
          placeholder='optional — press Enter to skip'
          onSubmit={onSubmit}
        />
      </Box>
    </Box>
  )
}

const EXAMPLES = [
  'wire it into the existing checkout page',
  'reuse our BookingService for reservations',
  'guests get a PIN, staff get a mobile key',
  'don’t change the admin dashboard',
]
