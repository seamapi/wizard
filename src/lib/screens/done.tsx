import { Box, Text, useStdout } from 'ink'
import type { ReactElement } from 'react'

export interface IntegrationOutcome {
  ok: boolean
  // Null when the model did not report a cost. Only shown when --show-cost is on.
  costUsd: number | null
  elapsedSec: number
  doneSteps: number
  totalSteps: number
}

// The last screen — a centered celebration of what just shipped. Shows how the
// run went and how long it took; the cost is only shown with --show-cost.
// `outcome` is null when the wizard finished without running the agent (e.g.
// "Continue on my own"), so it just confirms setup. Self-centers like the
// welcome splash rather than sitting under the header.
export function DoneScreen({
  workspaceName,
  outcome,
  showCost,
}: {
  workspaceName: string
  outcome: IntegrationOutcome | null
  showCost: boolean
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

  return (
    <Box
      height={rows}
      width={columns}
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
        <Text> </Text>
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
