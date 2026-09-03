import { Box, Text, useStdout } from 'ink'
import type { ReactElement } from 'react'

import { getAssistantUrl } from 'lib/api.js'

export interface IntegrationOutcome {
  ok: boolean
  // Null when the model did not report a cost. Only shown when --show-cost is on.
  costUsd: number | null
  elapsedSec: number
  doneSteps: number
  totalSteps: number
}

// Verbatim from the merge design: the developer is told, before they leave, that
// the agent authenticates itself rather than reusing the app's key.
export const AGENT_CONSENT_NOTICE =
  'Your coding agent will be asked to sign in to Seam and choose permissions the first time it uses a Seam tool.'

// The last screen — a centered celebration of what just shipped. Shows how the
// run went and how long it took; the cost is only shown with --show-cost.
// `outcome` is null when the wizard finished without running the agent (e.g.
// "Continue on my own"), so it just confirms setup. Self-centers like the
// welcome splash rather than sitting under the header.
//
// `workspaceId` is null only when the run never settled on a workspace, in
// which case there is no assistant to link to and the pointer is dropped.
export function DoneScreen({
  workspaceName,
  workspaceId,
  outcome,
  showCost,
  mcpRegistrationAttempted,
}: {
  workspaceName: string
  workspaceId: string | null
  outcome: IntegrationOutcome | null
  showCost: boolean
  // The consent notice describes what the MCP registration step does, so it
  // would mislead a run that quit (e.g. from the drift screen) before that
  // step ever ran.
  mcpRegistrationAttempted: boolean
}): ReactElement {
  const { stdout } = useStdout()
  const rows = stdout?.rows ?? 24
  const columns = stdout?.columns ?? 80

  const stoppedEarly = outcome != null && !outcome.ok
  const accent = stoppedEarly ? 'yellow' : 'green'
  const headline = stoppedEarly
    ? 'Almost there'
    : outcome == null
      ? 'You’re all set!'
      : 'Integration complete!'

  const stats =
    outcome == null
      ? null
      : `${outcome.doneSteps}/${outcome.totalSteps} steps · ${formatDuration(outcome.elapsedSec)}` +
        (showCost && outcome.costUsd != null
          ? ` · $${outcome.costUsd.toFixed(2)}`
          : '')

  // The workspace id is a UUID, so this URL runs to ~79 columns — too wide to
  // sit inside the bordered card, whose border and padding would push it past
  // an 80-column terminal. It goes underneath, where it gets the full width.
  const assistantUrl = workspaceId == null ? null : getAssistantUrl(workspaceId)

  return (
    // minHeight, not height: the card centers in a tall terminal but the box
    // grows on a short one. A fixed height overflows instead, and Ink then
    // overlaps the overflowing rows — which silently corrupts the URL below.
    <Box
      minHeight={rows}
      width={columns}
      flexDirection='column'
      alignItems='center'
      justifyContent='center'
    >
      <Box
        flexDirection='column'
        alignItems='center'
        borderStyle='round'
        borderColor={accent}
        paddingX={5}
        paddingY={1}
      >
        <Text bold color={accent}>
          ✦ ⋆ ˚ ✦ ⋆ ˚ ✦
        </Text>
        <Text> </Text>
        <Text bold color={accent}>
          {headline}
        </Text>
        <Text color='gray'>
          {stoppedEarly ? 'in ' : 'Seam is wired into '}
          {workspaceName}
        </Text>
        {stats != null && (
          <>
            <Text> </Text>
            <Text bold>{stats}</Text>
          </>
        )}
        <Text> </Text>
        {outcome != null && (
          <Text>
            Review the changes with <Text color='cyan'>git diff</Text>
          </Text>
        )}
        <Text color='gray'>docs.seam.co · seam docs MCP in your editor</Text>
      </Box>
      {assistantUrl != null && (
        <Box
          flexDirection='column'
          alignItems='center'
          width={columns}
          marginTop={1}
        >
          <Text>
            Ask{' '}
            <Text bold color={accent}>
              Seam AI
            </Text>{' '}
            about your workspace — devices, grants, events
          </Text>
          <Text color='cyan' wrap='truncate-middle'>
            {assistantUrl}
          </Text>
        </Box>
      )}
      {mcpRegistrationAttempted && (
        <Box
          flexDirection='column'
          alignItems='center'
          width={columns}
          marginTop={1}
          paddingX={2}
        >
          <Text color='gray'>{AGENT_CONSENT_NOTICE}</Text>
        </Box>
      )}
      {/* A margin, not a blank <Text> </Text>: this column is vertically
          centered, and when that offset lands on a half row Ink overlaps the
          rows it paints. A blank Text paints a real space, which lands mid-URL
          above and silently corrupts it. A margin paints nothing. */}
      <Box marginTop={1}>
        <Text color='gray'>Press any key to exit</Text>
      </Box>
    </Box>
  )
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}
