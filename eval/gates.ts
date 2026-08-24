import type { GateResults } from './types.js'

// Cheap, build-free checks over the diff. Each is a hard expectation of any good
// Seam integration, so a failure is a red flag regardless of the quality score.
export function evaluateGates(args: {
  changedFiles: string[]
  diff: string
}): GateResults {
  const { changedFiles, diff } = args
  return {
    envUntouched: !changedFiles.some(
      (file) => file === '.env' || file.endsWith('/.env'),
    ),
    // JS: `from 'seam'` / `require('seam')`; Python: `from seam import …` /
    // `import seam` — so the gate holds across javascript and python fixtures.
    seamImported:
      /from ['"]seam['"]|require\(['"]seam['"]\)|from seam import|import seam\b/.test(
        diff,
      ),
    noStandalonePage: !changedFiles.some((file) =>
      /(^|\/)seam[^/]*\/(page|index)\.[jt]sx?$/i.test(file),
    ),
  }
}
