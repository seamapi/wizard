import { Box, Text } from 'ink'
import type { ReactElement } from 'react'

// The wizard's title bar. Shared so every full-screen view (the transcript
// layout and the Tasks screen) carries the same "Seam setup wizard" chrome.
export function Header(): ReactElement {
  return (
    <Box marginBottom={1}>
      <Text backgroundColor='cyan' color='black' bold>
        {' Seam setup wizard '}
      </Text>
    </Box>
  )
}
