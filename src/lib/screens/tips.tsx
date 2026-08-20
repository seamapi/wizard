import { Box, Text } from 'ink'
import type { ReactElement } from 'react'

export interface LearnCard {
  title: string
  lines: string[]
}

// Educational cards shown in the Tips column while the wizard works. Shared by
// the running two-column frame and the integration Tasks screen.
export const LEARN_CARDS: LearnCard[] = [
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

export const LEARN_CARD_SECONDS = 8

// One tips card: a bold title over gray body lines. The leading space keeps it
// off the terminal edge, matching the surrounding panels.
export function Tips({ learnCard }: { learnCard: LearnCard }): ReactElement {
  return (
    <Box flexDirection='column'>
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
    </Box>
  )
}
