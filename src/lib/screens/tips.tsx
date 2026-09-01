import { Box, Text } from 'ink'
import type { ReactElement } from 'react'

export interface LearnCard {
  title: string
  lines: string[]
}

// Educational cards shown in the Tips column while the wizard works. Shared by
// the running two-column frame and the integration Tasks screen.
//
// The column is 30 wide and every line is printed after a leading space, so
// lines must stay under ~27 characters or they wrap and break the layout.
// LEARN_CARDS_MAX_LINE_LENGTH guards this.
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
    title: 'One API, every brand',
    lines: [
      'August, Yale, Schlage,',
      'Salto, Latch, Brivo, and',
      '100+ more speak one',
      'Seam API.',
      '',
      'Swap brands without',
      'rewriting your code.',
    ],
  },
  {
    title: 'Grants, not codes',
    lines: [
      'Say who gets in, where,',
      'and when — Seam picks',
      'the method each device',
      'supports.',
      '',
      'Reach for access codes',
      'only when you must.',
    ],
  },
  {
    title: 'Connect an account',
    lines: [
      'A Connect Webview is a',
      'hosted page where your',
      'user signs in to their',
      'lock account.',
      '',
      'You never touch their',
      'password.',
    ],
  },
  {
    title: 'Test without hardware',
    lines: [
      'A sandbox workspace ships',
      'with virtual devices.',
      '',
      'Build and test the whole',
      'flow before any real lock',
      'arrives.',
    ],
  },
  {
    title: 'Events over polling',
    lines: [
      'Locks go offline, guests',
      'arrive early, batteries',
      'die.',
      '',
      'Subscribe to webhooks and',
      'let Seam tell you.',
    ],
  },
  {
    title: 'Work is asynchronous',
    lines: [
      'A lock may be asleep or',
      'offline, so writes return',
      'an action attempt.',
      '',
      'Poll it — or await the',
      'event — for the result.',
    ],
  },
  {
    title: 'Ask your editor',
    lines: [
      'The seam-docs MCP is now',
      'in your AI assistant.',
      '',
      'Ask it for the exact API',
      'call instead of guessing',
      'at parameter names.',
    ],
  },
  {
    title: 'Where to go next',
    lines: [
      'Docs   docs.seam.co',
      'API    connect.getseam.com',
      'Ask AI Seam Assistant, in',
      '       the Console',
    ],
  },
]

// The widest line the 30-wide Tips column renders without wrapping, counting
// the leading space each line is printed with.
export const LEARN_CARDS_MAX_LINE_LENGTH = 27

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
