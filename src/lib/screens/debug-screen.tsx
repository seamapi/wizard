import { Box, Text, useApp, useInput, useStdin } from 'ink'
import SelectInput from 'ink-select-input'
import { type ReactElement, useState } from 'react'

import { WelcomeScreen } from './welcome.js'

// Named screens previewable via `--debug-screen <name>`, so the visuals can be
// iterated on without running the real auth/agent flow. Add a screen here as it
// gets built.
const SCREENS: Record<string, () => ReactElement> = {
  welcome: () => <WelcomeScreen />,
}

export const DEBUG_SCREEN_NAMES = Object.keys(SCREENS)

// `name` picks a screen directly; omit it (or pass an unknown one) to get a
// chooser listing every available screen.
export function DebugScreen({ name }: { name?: string }): ReactElement {
  const { exit } = useApp()
  const { isRawModeSupported } = useStdin()
  const [selected, setSelected] = useState<string | null>(
    name != null && SCREENS[name] != null ? name : null,
  )

  // q / Esc exits from anywhere; Enter is left to the chooser's own selection.
  useInput(
    (input, key) => {
      if (input === 'q' || key.escape) exit()
    },
    { isActive: isRawModeSupported },
  )

  if (selected != null) {
    const screen = SCREENS[selected]
    if (screen != null) return screen()
  }

  const unknownRequested =
    name != null && name.length > 0 && SCREENS[name] == null
  return (
    <Box flexDirection='column' padding={1}>
      <Text bold color='cyan'>
        Preview a screen
      </Text>
      {unknownRequested && <Text color='red'>Unknown screen: {name}</Text>}
      <Text color='gray'>Pick one (↑↓, Enter) · q to quit</Text>
      <Box marginTop={1}>
        <SelectInput
          items={DEBUG_SCREEN_NAMES.map((screenName) => ({
            label: screenName,
            value: screenName,
          }))}
          onSelect={(item) => setSelected(item.value)}
        />
      </Box>
    </Box>
  )
}
