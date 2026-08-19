import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink'
import SelectInput from 'ink-select-input'
import { type ReactElement, type ReactNode, useState } from 'react'

import { AnalyzeScreen } from './analyze.js'
import { AuthScreen } from './auth.js'
import { ChecklistScreen } from './checklist.js'
import { Header } from './header.js'
import { IntegrateProgress, type StepState } from './integrate-progress.js'
import { IntegrationModeScreen } from './integration-mode.js'
import { SetupProgress } from './setup-progress.js'
import { WelcomeScreen } from './welcome.js'

// Mock state so the Tasks + Learn/tips panel can be previewed mid-run: a mix of
// done / active / pending steps, a wide `columns` so the Learn column shows.
const TASKS_STEP_STATES: StepState[] = [
  { id: 'connect_device', label: 'Connect a device', status: 'done' },
  { id: 'access_grants', label: 'Access Grants', status: 'active' },
  { id: 'user_identities', label: 'User Identities', status: 'pending' },
  { id: 'reservations', label: 'Reservations', status: 'pending' },
]

// Named screens previewable via `--debug-screen <name>`, so the visuals can be
// iterated on without running the real auth/agent flow. Add a screen here as it
// gets built.
const SCREENS: Record<string, () => ReactElement> = {
  welcome: () => <WelcomeScreen />,
  auth: () => <AuthScreen />,
  setup: () => (
    <FullScreen>
      <Header />
      <SetupProgress
        steps={[
          { id: 'sdk', label: 'Install the Seam SDK', status: 'done' },
          { id: 'plugin', label: 'Install the Seam plugin', status: 'active' },
        ]}
        label='Installing the Seam plugin…'
        outputLines={['added 3 packages', 'found 0 vulnerabilities']}
      />
    </FullScreen>
  ),
  analyze: () => (
    <FullScreen>
      <Header />
      <AnalyzeScreen />
    </FullScreen>
  ),
  mode: () => (
    <FullScreen>
      <Header />
      <IntegrationModeScreen
        items={[
          {
            label: 'Full API control — you build the UI, wire up the API',
            value: 'full_api',
          },
          {
            label:
              'Customer Portal — Seam hosts the UI (you call ~2 endpoints)',
            value: 'customer_portal',
          },
        ]}
        rationale='Your project looks like a full app, so full API control fits.'
        onSelect={NOOP}
      />
    </FullScreen>
  ),
  checklist: () => (
    <FullScreen>
      <Header />
      <ChecklistScreen
        items={[
          { id: 'connect_device', label: 'Connect a device', group: 'Core' },
          { id: 'access_grants', label: 'Access Grants', group: 'Core' },
          { id: 'user_identities', label: 'User Identities', group: 'Core' },
          { id: 'access_codes', label: 'Access Codes', group: 'Common' },
          { id: 'reservations', label: 'Reservations', group: 'Common' },
        ]}
        initialSelected={['connect_device', 'access_grants', 'user_identities']}
        onSubmit={NOOP}
      />
    </FullScreen>
  ),
  tasks: () => <TasksPreview />,
}

// Preview screens are static: their selection handlers do nothing.
const NOOP = (): void => {}

// Previews the Tasks + tips panel full-screen, using the real terminal width so
// the tips lay out (side-by-side vs. stacked) exactly as they will in a run.
function TasksPreview(): ReactElement {
  const { stdout } = useStdout()
  return (
    <FullScreen>
      <Header />
      <IntegrateProgress
        stepStates={TASKS_STEP_STATES}
        currentStep={{ label: 'Access Grants', index: 1, total: 4 }}
        elapsedSec={72}
        idleSec={0}
        agentLines={[
          'Reading src/pages/reservations/[key].tsx',
          'Writing src/lib/seam.ts',
        ]}
        columns={stdout?.columns ?? 80}
      />
    </FullScreen>
  )
}

// Sizes a screen to the whole terminal so a preview matches how the app renders
// the same view full-screen (the Tasks panel is the whole view, not a footer).
function FullScreen({ children }: { children: ReactNode }): ReactElement {
  const { stdout } = useStdout()
  return (
    <Box
      flexDirection='column'
      height={stdout?.rows ?? 24}
      width={stdout?.columns ?? 80}
      paddingX={1}
      paddingY={1}
    >
      {children}
    </Box>
  )
}

export const DEBUG_SCREEN_NAMES = Object.keys(SCREENS)

// `name` picks a screen directly; omit it (or pass an unknown one) to get a
// chooser listing every available screen.
export function DebugScreen({ name }: { name?: string }): ReactElement {
  const { exit } = useApp()
  const { isRawModeSupported } = useStdin()
  const [selected, setSelected] = useState<string | null>(
    name != null && SCREENS[name] != null ? name : null,
  )

  // q / Esc exits from anywhere; Enter is left to the chooser's own selection.
  useInput(
    (input, key) => {
      if (input === 'q' || key.escape) exit()
    },
    { isActive: isRawModeSupported },
  )

  if (selected != null) {
    const screen = SCREENS[selected]
    if (screen != null) return screen()
  }

  const unknownRequested =
    name != null && name.length > 0 && SCREENS[name] == null
  return (
    <Box flexDirection='column' padding={1}>
      <Text bold color='cyan'>
        Preview a screen
      </Text>
      {unknownRequested && <Text color='red'>Unknown screen: {name}</Text>}
      <Text color='gray'>Pick one (↑↓, Enter) · q to quit</Text>
      <Box marginTop={1}>
        <SelectInput
          items={DEBUG_SCREEN_NAMES.map((screenName) => ({
            label: screenName,
            value: screenName,
          }))}
          onSelect={(item) => setSelected(item.value)}
        />
      </Box>
    </Box>
  )
}
