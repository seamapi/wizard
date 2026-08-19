import { Text } from 'ink'
import Spinner from 'ink-spinner'
import type { ReactElement } from 'react'

// The wizard reads the project before recommending how to integrate. Its own
// screen so it reads full-screen under the header like the other steps.
export function AnalyzeScreen(): ReactElement {
  return (
    <Text>
      <Text color='cyan'>
        <Spinner type='dots' />
      </Text>{' '}
      Analyzing your project…
    </Text>
  )
}
