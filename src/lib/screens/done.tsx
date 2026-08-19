import { Box, Text } from 'ink'
import type { ReactElement } from 'react'

export interface IntegrationOutcome {
  ok: boolean
  // Null when the model did not report a cost. Only shown when --show-cost is on.
  costUsd: number | null
  elapsedSec: number
  doneSteps: number
  totalSteps: number
}

// The last screen. Shows how the run went and how long it took; the cost is
// only shown when the wizard is started with --show-cost. `outcome` is null
// when the wizard finished without running the agent (e.g. "Continue on my
// own"), so it just confirms setup.
export function DoneScreen({
  workspaceName,
  outcome,
  showCost,
}: {
  workspaceName: string
  outcome: IntegrationOutcome | null
  showCost: boolean
}): ReactElement {
  const summary =
    outcome == null
      ? null
      : `${outcome.doneSteps}/${outcome.totalSteps} steps · took ${formatDuration(outcome.elapsedSec)}` +
        (showCost && outcome.costUsd != null
          ? ` · $${outcome.costUsd.toFixed(2)}`
          : '')

  return (
    <Box flexDirection='column'>
      {outcome == null ? (
        <Text bold color='green'>
          ✓ You’re set up in {workspaceName}
        </Text>
      ) : outcome.ok ? (
        <Text bold color='green'>
          ✓ Integration written in {workspaceName}
        </Text>
      ) : (
        <Text bold color='yellow'>
          ▲ Agent stopped early
        </Text>
      )}
      {summary != null && <Text color='gray'>{summary}</Text>}
      <Box flexDirection='column' marginTop={1}>
        <Text bold>Next</Text>
        {outcome != null && (
          <Text color='gray'>{'  Review the changes with `git diff`'}</Text>
        )}
        <Text color='gray'>{'  Docs   docs.seam.co'}</Text>
        <Text color='gray'>{'  MCP    seam docs, in your editor'}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color='cyan'>Press any key to exit</Text>
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
