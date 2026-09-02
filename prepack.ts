import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

const versionFile = './src/lib/version.ts'
const analyticsKeyFile = './src/lib/analytics-key.ts'

const main = async (): Promise<void> => {
  const version = await injectVersion(resolveFile(versionFile))
  // eslint-disable-next-line no-console
  console.log(`✓ Version ${version} injected into ${versionFile}`)

  const injected = await injectPostHogProjectKey(resolveFile(analyticsKeyFile))
  // eslint-disable-next-line no-console
  console.log(
    injected
      ? `✓ PostHog project key injected into ${analyticsKeyFile}`
      : `▲ No SEAM_WIZARD_POSTHOG_KEY set — this package reports no analytics`,
  )

  const { command } = await $`tsc --project tsconfig.prepack.json`
  // eslint-disable-next-line no-console
  console.log(`✓ Rebuilt with '${command}'`)
}

const injectVersion = async (path: string): Promise<string> => {
  const { version } = await readPackageJson()

  if (version == null) {
    throw new Error('Missing version in package.json')
  }

  await replaceInFile(
    path,
    "const seamapiWizardVersion = '0.0.0'",
    `const seamapiWizardVersion = '${version}'`,
  )

  return version
}

// The key is a build input, not a checked-in constant: it comes from the
// environment (a repository secret in the publish workflow). A pack without it
// still succeeds — the package simply reports nothing — because a missing
// analytics key must never be what stops a release.
const injectPostHogProjectKey = async (path: string): Promise<boolean> => {
  const key = process.env['SEAM_WIZARD_POSTHOG_KEY']
  if (key == null || key.length === 0) return false

  await replaceInFile(
    path,
    "const seamPostHogProjectKey = ''",
    `const seamPostHogProjectKey = '${key}'`,
  )

  return true
}

const replaceInFile = async (
  path: string,
  placeholder: string,
  replacement: string,
): Promise<void> => {
  const source = await readFile(path, 'utf8')

  if (!source.includes(placeholder)) {
    throw new Error(`Missing generated-value placeholder in ${path}`)
  }

  await writeFile(path, source.replace(placeholder, replacement), 'utf8')
}

const resolveFile = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url))

const readPackageJson = async (): Promise<{ version?: string }> =>
  JSON.parse(await readFile(resolveFile('package.json'), 'utf8')) as {
    version?: string
  }

await main()
