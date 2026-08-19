import { Box, Text, useApp, useInput, useStdin } from 'ink'
import type { ReactElement } from 'react'

import { WelcomeScreen } from './welcome.js'

// Named screens previewable via `--debug-screen <name>`, so the visuals can be
// iterated on without running the real auth/agent flow. Add a screen here as it
// gets built.
const SCREENS: Record<string, () => ReactElement> = {
  welcome: () => <WelcomeScreen />,
}

export const DEBUG_SCREEN_NAMES = Object.keys(SCREENS)

export function DebugScreen({ name }: { name: string }): ReactElement {
  const { exit } = useApp()
  const { isRawModeSupported } = useStdin()
  // Guard on raw-mode support so the preview doesn't crash in a non-TTY (e.g.
  // piped output); in a real terminal q / Esc / Enter exits.
  useInput(
    (input, key) => {
      if (input === 'q' || key.escape || key.return) exit()
    },
    { isActive: isRawModeSupported },
  )

  const screen = SCREENS[name]
  if (screen == null) {
    return (
      <Box flexDirection='column' padding={1}>
        <Text color='red'>Unknown screen: {name}</Text>
        <Text color='gray'>Available: {DEBUG_SCREEN_NAMES.join(', ')}</Text>
      </Box>
    )
  }
  return screen()
}
