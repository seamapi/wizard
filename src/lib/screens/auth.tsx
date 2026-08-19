import { Box, Text, useStdout } from 'ink'
import type { ReactElement } from 'react'

export interface AuthOption {
  label: string
  hint?: string
}

// The connect-your-account screen. Self-centers like the welcome splash so it
// reads the same in a real run and in `--debug-screen auth`. Presentational:
// the live method picker drives selection; this renders the framing and the
// options, with the highlighted row marked.
export function AuthScreen({
  options = DEFAULT_OPTIONS,
  selectedIndex = 0,
}: {
  options?: AuthOption[]
  selectedIndex?: number
}): ReactElement {
  const { stdout } = useStdout()
  const rows = stdout?.rows ?? 24
  const columns = stdout?.columns ?? 80

  return (
    <Box
      height={rows}
      width={columns}
      alignItems='center'
      justifyContent='center'
    >
      <Box flexDirection='column' alignItems='center'>
        <Text bold color='cyan'>
          ◆ Connect your Seam account
        </Text>
        <Text> </Text>
        <Text>How do you want to connect?</Text>
        <Text> </Text>
        <Box flexDirection='column'>
          {options.map((option, index) => {
            const isSelected = index === selectedIndex
            const row = (
              <>
                {isSelected ? '▸ ' : '  '}
                {option.label}
                {option.hint != null && (
                  <Text color='gray'> {option.hint}</Text>
                )}
              </>
            )
            return isSelected ? (
              <Text key={option.label} color='cyan'>
                {row}
              </Text>
            ) : (
              <Text key={option.label}>{row}</Text>
            )
          })}
        </Box>
        <Text> </Text>
        <Text color='gray'>
          Your SEAM_API_KEY stays in your local .env — it never leaves this
          machine.
        </Text>
      </Box>
    </Box>
  )
}

const DEFAULT_OPTIONS: AuthOption[] = [
  { label: 'Continue in your browser', hint: '(create a key in the Console)' },
  { label: 'Paste an API key', hint: '(if you already have one)' },
]
