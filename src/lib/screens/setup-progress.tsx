import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { ReactElement } from 'react'

import { STEP_COLOR, STEP_ICON, type StepState } from './integrate-progress.js'

// The install/setup phase, styled like the Tasks screen: a checklist of setup
// steps (SDK, plugin) with live status, a spinner for the running step, and the
// installer's own output below.
export interface SetupProgressProps {
  steps: StepState[]
  label: string
  outputLines: string[]
}

export function SetupProgress({
  steps,
  label,
  outputLines,
}: SetupProgressProps): ReactElement {
  return (
    <Box flexDirection='column'>
      {steps.length > 0 && (
        <Box flexDirection='column' marginBottom={1}>
          <Text bold> Setup</Text>
          {steps.map((step) => (
            <Text key={step.id} color={STEP_COLOR[step.status]}>
              {'  '}
              {STEP_ICON[step.status]} {step.label}
            </Text>
          ))}
        </Box>
      )}
      <Text>
        <Text color='cyan'>
          <Spinner type='dots' />
        </Text>{' '}
        {label}
      </Text>
      {outputLines.map((line, index) => (
        <Text key={index} color='gray'>
          {' '}
          {line}
        </Text>
      ))}
    </Box>
  )
}
