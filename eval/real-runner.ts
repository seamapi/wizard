import { getInferenceBaseUrl } from 'lib/api.js'
import { buildIntegrationSteps } from 'lib/steps/build-plan.js'
import { runIntegration } from 'lib/steps/integrate.js'

import type { CaseRunner } from './run-case.js'

// The real runner: writes the integration into the fixture with the same
// runIntegration the wizard uses. The harness is selected out-of-band by
// SEAM_WIZARD_HARNESS (the switchboard reads it), so a case just sets that env
// before running. Cost/ok come from the terminal `done` event.
export function createRealRunner(token: string): CaseRunner {
  return async (workDir, spec, context) => {
    const steps = buildIntegrationSteps({
      mode: spec.mode,
      note: null,
      framework: context.config.framework,
    })

    let ok = false
    let costUsd: number | null = null
    await runIntegration({
      root: workDir,
      sdk: context.config.sdk,
      workspace_name: 'seam-eval',
      steps,
      inference: { base_url: getInferenceBaseUrl(), token },
      framework: context.config.framework,
      mode: spec.mode,
      signal: context.signal,
      onEvent: (event) => {
        if (event.kind === 'done') {
          ok = event.ok
          costUsd = event.cost_usd
        }
      },
    })
    return { ok, costUsd }
  }
}
