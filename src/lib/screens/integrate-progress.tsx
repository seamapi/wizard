import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { ReactElement } from 'react'

import { LEARN_CARD_SECONDS, LEARN_CARDS, Tips } from './tips.js'

// The integration runs one step per selected building block; this panel shows
// each step's live state (the Tasks column) alongside a rotating Learn column.
export type StepStatus = 'pending' | 'active' | 'done' | 'failed'
export interface StepState {
  id: string
  label: string
  status: StepStatus
}

export const STEP_ICON: Record<StepStatus, string> = {
  pending: '☐',
  active: '▶',
  done: '✓',
  failed: '✗',
}
export const STEP_COLOR: Record<StepStatus, string> = {
  pending: 'gray',
  active: 'cyan',
  done: 'green',
  failed: 'red',
}

const formatElapsed = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export interface IntegrateProgressProps {
  stepStates: StepState[]
  currentStep: { label: string; index: number; total: number } | null
  elapsedSec: number
  idleSec: number
  agentLines: string[]
  columns: number
}

export function IntegrateProgress({
  stepStates,
  currentStep,
  elapsedSec,
  idleSec,
  agentLines,
  columns,
}: IntegrateProgressProps): ReactElement {
  // Tips are always part of this screen: side-by-side with Tasks when the
  // terminal is wide enough, stacked below it when narrow so they never wrap
  // awkwardly — but never dropped.
  const isWide = columns >= 90
  const learnCard =
    LEARN_CARDS[
      Math.floor(elapsedSec / LEARN_CARD_SECONDS) % LEARN_CARDS.length
    ]
  const label =
    currentStep == null
      ? `Writing your Seam integration… ${formatElapsed(elapsedSec)}`
      : `${currentStep.label} (${currentStep.index + 1}/${currentStep.total}) · ${formatElapsed(elapsedSec)}`

  return (
    <Box flexDirection='column'>
      {stepStates.length > 0 &&
        (isWide ? (
          <Box flexDirection='row' marginBottom={1}>
            {learnCard != null && (
              <Box flexDirection='column' width={30} marginRight={3}>
                <Tips learnCard={learnCard} />
              </Box>
            )}
            <Box flexDirection='column' flexGrow={1}>
              <Tasks stepStates={stepStates} />
            </Box>
          </Box>
        ) : (
          <Box flexDirection='column' marginBottom={1}>
            <Tasks stepStates={stepStates} />
            {learnCard != null && (
              <Box flexDirection='column' marginTop={1}>
                <Tips learnCard={learnCard} />
              </Box>
            )}
          </Box>
        ))}
      <Text>
        <Text color='cyan'>
          <Spinner type='dots' />
        </Text>{' '}
        {label}
      </Text>
      {idleSec >= 20 && (
        <Text color='yellow'>
          {' '}
          Still working — large integrations take a few minutes, and Seam AI may
          be busy. Press Ctrl-C to stop.
        </Text>
      )}
      {agentLines.map((line, index) => (
        <Text key={index} color='gray'>
          {' '}
          {line}
        </Text>
      ))}
    </Box>
  )
}

function Tasks({ stepStates }: { stepStates: StepState[] }): ReactElement {
  return (
    <>
      <Text bold> Tasks</Text>
      {stepStates.map((step) => (
        <Text key={step.id} color={STEP_COLOR[step.status]}>
          {'  '}
          {STEP_ICON[step.status]} {step.label}
        </Text>
      ))}
      <Text color='gray'>
        {'  '}Progress:{' '}
        {stepStates.filter((step) => step.status === 'done').length}/
        {stepStates.length} completed
      </Text>
    </>
  )
}
