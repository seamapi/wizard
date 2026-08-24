import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, expect, test } from 'vitest'

import {
  detectProject,
  installSeamSdkCommand,
  type JsPackageManager,
  type ProjectInfo,
  type PythonInstaller,
  type RubyInstaller,
} from './detect-project.js'

let dir = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seam-wizard-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const touch = (fileName: string): void => {
  writeFileSync(join(dir, fileName), '')
}

const jsProject = (packageManager: JsPackageManager): ProjectInfo => ({
  root: '/example',
  detected_sdk: 'javascript',
  js_package_manager: packageManager,
  python_installer: 'pip',
  ruby_installer: 'gem',
})

const pythonProject = (installer: PythonInstaller): ProjectInfo => ({
  root: '/example',
  detected_sdk: 'python',
  js_package_manager: 'npm',
  python_installer: installer,
  ruby_installer: 'gem',
})

const rubyProject = (installer: RubyInstaller): ProjectInfo => ({
  root: '/example',
  detected_sdk: 'ruby',
  js_package_manager: 'npm',
  python_installer: 'pip',
  ruby_installer: installer,
})

const phpProject = (): ProjectInfo => ({
  root: '/example',
  detected_sdk: 'php',
  js_package_manager: 'npm',
  python_installer: 'pip',
  ruby_installer: 'gem',
})

test('detectProject: reports the given directory as the root', () => {
  expect(detectProject(dir).root).toBe(dir)
})

test('detectProject: detects javascript from package.json', () => {
  touch('package.json')

  expect(detectProject(dir).detected_sdk).toBe('javascript')
})

test.each(['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile'])(
  'detectProject: detects python from %s',
  (marker) => {
    touch(marker)

    expect(detectProject(dir).detected_sdk).toBe('python')
  },
)

test.each(['Gemfile', 'Gemfile.lock'])(
  'detectProject: detects ruby from %s',
  (marker) => {
    touch(marker)

    expect(detectProject(dir).detected_sdk).toBe('ruby')
  },
)

test('detectProject: detects php from composer.json', () => {
  touch('composer.json')

  expect(detectProject(dir).detected_sdk).toBe('php')
})

test('detectProject: detects no sdk when javascript and python markers are both present', () => {
  touch('package.json')
  touch('requirements.txt')

  expect(detectProject(dir).detected_sdk).toBeNull()
})

test('detectProject: detects no sdk when several languages match', () => {
  touch('package.json')
  touch('Gemfile')
  touch('composer.json')

  expect(detectProject(dir).detected_sdk).toBeNull()
})

test('detectProject: detects the bundler ruby installer from a Gemfile', () => {
  touch('Gemfile')

  expect(detectProject(dir).ruby_installer).toBe('bundler')
})

test('detectProject: defaults to the gem ruby installer without a Gemfile', () => {
  expect(detectProject(dir).ruby_installer).toBe('gem')
})

test('detectProject: detects no sdk when neither marker is present', () => {
  expect(detectProject(dir).detected_sdk).toBeNull()
})

test.each([
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
])(
  'detectProject: detects the %s package manager as %s',
  (lockfile, expected) => {
    touch(lockfile)

    expect(detectProject(dir).js_package_manager).toBe(expected)
  },
)

test('detectProject: defaults to the npm package manager', () => {
  touch('package.json')

  expect(detectProject(dir).js_package_manager).toBe('npm')
})

test.each([
  ['poetry.lock', 'poetry'],
  ['uv.lock', 'uv'],
])(
  'detectProject: detects the %s python installer as %s',
  (lockfile, expected) => {
    touch(lockfile)

    expect(detectProject(dir).python_installer).toBe(expected)
  },
)

test('detectProject: defaults to the pip python installer', () => {
  touch('pyproject.toml')

  expect(detectProject(dir).python_installer).toBe('pip')
})

test('detectProject: prefers pnpm over yarn when both lockfiles exist', () => {
  touch('pnpm-lock.yaml')
  touch('yarn.lock')

  expect(detectProject(dir).js_package_manager).toBe('pnpm')
})

test('installSeamSdkCommand: installs the javascript sdk with npm', () => {
  expect(installSeamSdkCommand('javascript', jsProject('npm'))).toEqual([
    'npm',
    'install',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the javascript sdk with pnpm', () => {
  expect(installSeamSdkCommand('javascript', jsProject('pnpm'))).toEqual([
    'pnpm',
    'add',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the javascript sdk with yarn', () => {
  expect(installSeamSdkCommand('javascript', jsProject('yarn'))).toEqual([
    'yarn',
    'add',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the javascript sdk with bun', () => {
  expect(installSeamSdkCommand('javascript', jsProject('bun'))).toEqual([
    'bun',
    'add',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the python sdk with pip', () => {
  expect(installSeamSdkCommand('python', pythonProject('pip'))).toEqual([
    'pip',
    'install',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the python sdk with poetry', () => {
  expect(installSeamSdkCommand('python', pythonProject('poetry'))).toEqual([
    'poetry',
    'add',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the python sdk with uv', () => {
  expect(installSeamSdkCommand('python', pythonProject('uv'))).toEqual([
    'uv',
    'add',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the ruby sdk with bundler', () => {
  expect(installSeamSdkCommand('ruby', rubyProject('bundler'))).toEqual([
    'bundle',
    'add',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the ruby sdk with gem when there is no Gemfile', () => {
  expect(installSeamSdkCommand('ruby', rubyProject('gem'))).toEqual([
    'gem',
    'install',
    'seam',
  ])
})

test('installSeamSdkCommand: installs the php sdk with composer', () => {
  expect(installSeamSdkCommand('php', phpProject())).toEqual([
    'composer',
    'require',
    'seamapi/seam',
  ])
})

test('installSeamSdkCommand: ignores the python installer for the javascript sdk', () => {
  const project: ProjectInfo = {
    root: '/example',
    detected_sdk: 'javascript',
    js_package_manager: 'yarn',
    python_installer: 'poetry',
    ruby_installer: 'gem',
  }

  expect(installSeamSdkCommand('javascript', project)).toEqual([
    'yarn',
    'add',
    'seam',
  ])
})
