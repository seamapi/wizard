import { Box, Text, useStdout } from 'ink'
import type { ReactElement } from 'react'

// The wizard's intro screen. Self-centers in the terminal so it reads the same
// in a real run and in `--debug-screen welcome`.
export function WelcomeScreen(): ReactElement {
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
          ◆ Seam Wizard
        </Text>
        <Text> </Text>
        <Text>Set up Seam in your project — connect a device,</Text>
        <Text>grant a person access, all from your code.</Text>
        <Text> </Text>
        <Text color='gray'>
          We&apos;ll analyze your project and write the integration.
        </Text>
        <Text color='gray'>Your SEAM_API_KEY stays in your local .env.</Text>
        <Text> </Text>
        <Text color='yellow'>▶ Get started</Text>
      </Box>
    </Box>
  )
}
