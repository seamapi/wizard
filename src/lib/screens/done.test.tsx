import { render } from 'ink-testing-library'
import { afterEach, expect, test, vi } from 'vitest'

import { AGENT_CONSENT_NOTICE, DoneScreen } from './done.js'

const WORKSPACE_ID = '0004449d-b669-46ac-b094-d530bda66641'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('DoneScreen: points at the workspace assistant', () => {
  const { lastFrame, unmount } = render(
    <DoneScreen
      workspaceName='Acme'
      workspaceId={WORKSPACE_ID}
      outcome={null}
      showCost={false}
    />,
  )
  try {
    const frame = lastFrame() ?? ''
    expect(frame).toContain(
      `https://console.seam.co/dashboard/${WORKSPACE_ID}/assistant`,
    )
    expect(frame).toContain('Seam AI')
  } finally {
    unmount()
  }
})

test('DoneScreen: honors SEAM_CONSOLE_URL for the assistant link', () => {
  vi.stubEnv('SEAM_CONSOLE_URL', 'https://console.example.com/')

  const { lastFrame, unmount } = render(
    <DoneScreen
      workspaceName='Acme'
      workspaceId={WORKSPACE_ID}
      outcome={null}
      showCost={false}
    />,
  )
  try {
    expect(lastFrame() ?? '').toContain(
      `https://console.example.com/dashboard/${WORKSPACE_ID}/assistant`,
    )
  } finally {
    unmount()
  }
})

// A run that never settled on a workspace has no assistant to link to.
test('DoneScreen: omits the assistant link without a workspace', () => {
  const { lastFrame, unmount } = render(
    <DoneScreen
      workspaceName='your workspace'
      workspaceId={null}
      outcome={null}
      showCost={false}
    />,
  )
  try {
    const frame = lastFrame() ?? ''
    expect(frame).not.toContain('/assistant')
    expect(frame).toContain('Press any key to exit')
  } finally {
    unmount()
  }
})

test('DoneScreen: says the agent will sign in and choose permissions', () => {
  const { lastFrame, unmount } = render(
    <DoneScreen
      workspaceName='Acme'
      workspaceId={WORKSPACE_ID}
      outcome={null}
      showCost={false}
    />,
  )
  try {
    // Ink wraps the sentence across rows, so compare on collapsed whitespace.
    const frame = (lastFrame() ?? '').replace(/\s+/g, ' ')
    expect(frame).toContain(AGENT_CONSENT_NOTICE)
  } finally {
    unmount()
  }
})

test('AGENT_CONSENT_NOTICE is the copy the merge design specifies', () => {
  expect(AGENT_CONSENT_NOTICE).toBe(
    'Your coding agent will be asked to sign in to Seam and choose permissions the first time it uses a Seam tool.',
  )
})
