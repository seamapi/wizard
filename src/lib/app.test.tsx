import { render } from 'ink-testing-library'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { createMemoryAdapter, resetAdapter, setAdapter } from './adapter.js'
import { App } from './app.js'

// A project root that does not exist, with no key in the environment, keeps the
// render offline: the wizard opens on the welcome splash and only leaves it on a
// keypress, so nothing is fetched. A full interactive run of the wizard cannot
// be exercised headlessly, so this covers the mount and the first frame only.
const NONEXISTENT_ROOT = '/nonexistent/seam-wizard-test-project'

beforeEach(() => {
  setAdapter(createMemoryAdapter())
})

afterEach(() => {
  resetAdapter()
  vi.unstubAllEnvs()
})

test('App: opens on the welcome splash', () => {
  vi.stubEnv('SEAM_API_KEY', '')

  const { lastFrame, unmount } = render(<App root={NONEXISTENT_ROOT} />)
  try {
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Seam Wizard')
    expect(frame).toContain('Press any key to get started')
  } finally {
    unmount()
  }
})
