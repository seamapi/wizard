// Minimal render smoke test: mount <App/> and assert the first frame renders
// without throwing. Uses a nonexistent root with no SEAM_API_KEY so no network
// call happens (findExistingApiKey returns null before any API request).
// A full interactive run can't be exercised headlessly.

import { render } from 'ink-testing-library'
import React from 'react'

import { App } from 'lib/app.js'

delete process.env.SEAM_API_KEY

const { lastFrame, unmount } = render(
  <App root='/tmp/seam-wizard-smoke-nonexistent' />,
)
const frame = lastFrame() ?? ''
unmount()

if (!frame.includes('Checking')) {
  console.error(`SMOKE FAIL — unexpected first frame:\n${frame}`)
  process.exit(1)
}

console.log('SMOKE OK — initial frame rendered')
process.exit(0)
