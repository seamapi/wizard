import { anthropicHarness } from './anthropic.js'
import { piHarness } from './pi.js'
import type { Harness } from './types.js'

// Which agent harness drives the integration. `anthropic` (Claude Agent SDK) is
// the default control; other harnesses are opt-in via SEAM_WIZARD_HARNESS so a
// benchmark/eval can A/B them without touching the run code. An unknown value
// falls back to the control rather than failing a real run.
export function resolveHarness(): Harness {
  switch (process.env['SEAM_WIZARD_HARNESS']) {
    case 'pi':
      return piHarness
    case 'anthropic':
      return anthropicHarness
    default:
      return anthropicHarness
  }
}
