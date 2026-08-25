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
    // Recognizes a Seam SDK import/instantiation across every fixture language:
    //   JS:     from 'seam'  |  require('seam')
    //   Python: from seam import …  |  import seam
    //   Ruby:   require 'seam'  (no parens)
    //   PHP:    use Seam\…  |  new [\]Seam\Seam
    seamImported:
      /from ['"]seam['"]|require\(['"]seam['"]\)|from seam import|import seam\b|require ['"]seam['"]|use Seam\\|new \\?Seam\\Seam/.test(
        diff,
      ),
    noStandalonePage: !changedFiles.some((file) =>
      /(^|\/)seam[^/]*\/(page|index)\.[jt]sx?$/i.test(file),
    ),
  }
}
