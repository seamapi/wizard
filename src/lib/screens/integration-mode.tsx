import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import { type ReactElement, useState } from 'react'

export interface IntegrationModeItem {
  label: string
  value: string
}

// What each option involves, shown in the side column as you move between the
// options — the concrete calls for the Portal, the endpoints for Full API, and
// where to go if setup is all you needed.
const DETAILS: Record<string, { title: string; lines: string[] }> = {
  customer_portal: {
    title: 'Customer Portal — what you call',
    lines: [
      'customers.pushData(reservation)',
      '  sync a booking to Seam',
      'customers.deleteData(key)',
      '  remove it on cancellation',
      'Automation config',
      '  auto-issue codes / keys per stay',
    ],
  },
  full_api: {
    title: 'Full API — endpoints you’ll use',
    lines: [
      'connect_webviews.create',
      '  connect a device account',
      'spaces.create',
      '  model your properties',
      'user_identities.create',
      '  the people who get access',
      'access_grants.create',
      '  grant access to a space',
    ],
  },
  continue_on_own: {
    title: 'You’re all set',
    lines: [
      'The SDK and plugin are installed.',
      '',
      'Docs   docs.seam.co',
      'MCP    seam docs, in your editor',
      'API    connect.getseam.com',
      '',
      'Re-run the wizard anytime to have',
      'Seam AI write the integration.',
    ],
  },
}

// Pick between the hosted Customer Portal, full API control, or continuing on
// your own now that setup is done. Presentation only: the caller supplies the
// ordered items (recommended first), the optional rationale, and the handler.
// A side column shows what the highlighted option involves.
export function IntegrationModeScreen({
  items,
  rationale,
  columns,
  onSelect,
}: {
  items: IntegrationModeItem[]
  rationale?: string | undefined
  columns: number
  onSelect: (item: IntegrationModeItem) => void
}): ReactElement {
  const [highlighted, setHighlighted] = useState<string | null>(
    items[0]?.value ?? null,
  )
  const detail = highlighted != null ? DETAILS[highlighted] : undefined
  const isWide = columns >= 90

  return (
    <Box flexDirection='column'>
      <Text bold>How do you want to integrate Seam?</Text>
      {rationale != null && rationale.length > 0 && (
        <Text color='gray'>{`  ${rationale}`}</Text>
      )}
      <Box flexDirection={isWide ? 'row' : 'column'} marginTop={1}>
        <Box flexDirection='column' marginRight={isWide ? 4 : 0}>
          <SelectInput
            items={items}
            onSelect={onSelect}
            onHighlight={(item) => setHighlighted(item.value)}
          />
        </Box>
        {detail != null && (
          <Box flexDirection='column' marginTop={isWide ? 0 : 1}>
            <Text bold color='cyan'>
              {detail.title}
            </Text>
            {detail.lines.map((line, index) => (
              <Text key={index} color='gray'>
                {line}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
