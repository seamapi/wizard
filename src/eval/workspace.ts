import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Copy a fixture into a throwaway temp dir and commit it as the git baseline, so
// everything the integration writes afterward shows up as a diff against it. The
// fixture.json (eval metadata, not part of the app) is dropped from the copy.
export function prepareFixture(fixtureDir: string): string {
  const workDir = mkdtempSync(join(tmpdir(), 'seam-eval-'))
  cpSync(fixtureDir, workDir, { recursive: true })
  rmSync(join(workDir, 'fixture.json'), { force: true })
  runGit(workDir, ['init', '-q'])
  runGit(workDir, ['config', 'user.email', 'eval@seam.co'])
  runGit(workDir, ['config', 'user.name', 'seam-eval'])
  runGit(workDir, ['add', '-A'])
  runGit(workDir, ['commit', '-q', '-m', 'baseline'])
  return workDir
}

// The diff the integration produced against the baseline, plus the list of
// changed paths. Staging first (`add -A`) folds new files into the diff too.
export function captureDiff(workDir: string): {
  diff: string
  changedFiles: string[]
} {
  runGit(workDir, ['add', '-A'])
  const diff = runGit(workDir, ['diff', '--cached'])
  const changedFiles = runGit(workDir, ['diff', '--cached', '--name-only'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  return { diff, changedFiles }
}

function runGit(cwd: string, gitArgs: string[]): string {
  return execFileSync('git', gitArgs, { cwd, encoding: 'utf8' })
}
