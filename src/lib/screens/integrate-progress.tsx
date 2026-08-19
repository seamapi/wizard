import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import type { ReactElement } from 'react'

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

// Educational cards shown in the Learn column while the agent works. Rotates
// every 8s off the elapsed clock, so no extra timer.
const LEARN_CARDS: Array<{ title: string; lines: string[] }> = [
  {
    title: 'How Seam works',
    lines: [
      'An Access Grant gives a',
      'person access to a space',
      'or device for a window of',
      'time.',
      '',
      'Seam issues the method:',
      'PIN · mobile key · card',
    ],
  },
  {
    title: 'The building blocks',
    lines: [
      'Connected account',
      '  → its Devices',
      'Space groups devices',
      'User identity = a person',
      'Access grant links them',
    ],
  },
  {
    title: 'While this runs',
    lines: [
      'Docs  docs.seam.co',
      'MCP   seam-docs, in your',
      '      AI editor',
      'API   connect.getseam.com',
    ],
  },
]
const LEARN_CARD_SECONDS = 8

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

function Tips({
  learnCard,
}: {
  learnCard: { title: string; lines: string[] }
}): ReactElement {
  return (
    <>
      <Text bold color='cyan'>
        {' '}
        {learnCard.title}
      </Text>
      {learnCard.lines.map((line, index) => (
        <Text key={index} color='gray'>
          {' '}
          {line}
        </Text>
      ))}
    </>
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
