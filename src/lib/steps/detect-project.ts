import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type Sdk = 'javascript' | 'python' | 'ruby' | 'php'
export type JsPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'
export type PythonInstaller = 'pip' | 'poetry' | 'uv'
export type RubyInstaller = 'bundler' | 'gem'

export interface ProjectInfo {
  root: string
  detected_sdk: Sdk | null
  js_package_manager: JsPackageManager
  python_installer: PythonInstaller
  ruby_installer: RubyInstaller
}

export function detectProject(cwd: string): ProjectInfo {
  return {
    root: cwd,
    detected_sdk: detectSdk(cwd),
    js_package_manager: detectJsPackageManager(cwd),
    python_installer: detectPythonInstaller(cwd),
    ruby_installer: detectRubyInstaller(cwd),
  }
}

// null when the project is ambiguous (zero or several languages match) — the
// wizard then asks. Each SDK has its own marker files.
function detectSdk(cwd: string): Sdk | null {
  const has = (...markers: string[]): boolean =>
    markers.some((marker) => existsSync(join(cwd, marker)))

  const matches: Sdk[] = []
  if (has('package.json')) matches.push('javascript')
  if (has('pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile')) {
    matches.push('python')
  }
  if (has('Gemfile', 'Gemfile.lock')) matches.push('ruby')
  if (has('composer.json')) matches.push('php')

  return matches.length === 1 ? (matches[0] ?? null) : null
}

function detectJsPackageManager(cwd: string): JsPackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(cwd, 'bun.lockb'))) return 'bun'
  return 'npm'
}

function detectPythonInstaller(cwd: string): PythonInstaller {
  if (existsSync(join(cwd, 'poetry.lock'))) return 'poetry'
  if (existsSync(join(cwd, 'uv.lock'))) return 'uv'
  return 'pip'
}

function detectRubyInstaller(cwd: string): RubyInstaller {
  // A Gemfile means Bundler manages deps; without one, install the gem directly.
  return existsSync(join(cwd, 'Gemfile')) ? 'bundler' : 'gem'
}

export function installSeamSdkCommand(
  sdk: Sdk,
  project: ProjectInfo,
): string[] {
  if (sdk === 'python') {
    switch (project.python_installer) {
      case 'poetry':
        return ['poetry', 'add', 'seam']
      case 'uv':
        return ['uv', 'add', 'seam']
      default:
        return ['pip', 'install', 'seam']
    }
  }
  if (sdk === 'ruby') {
    return project.ruby_installer === 'bundler'
      ? ['bundle', 'add', 'seam']
      : ['gem', 'install', 'seam']
  }
  if (sdk === 'php') {
    // The Composer package is seamapi/seam (unlike the bare `seam` npm/gem name).
    return ['composer', 'require', 'seamapi/seam']
  }
  switch (project.js_package_manager) {
    case 'pnpm':
      return ['pnpm', 'add', 'seam']
    case 'yarn':
      return ['yarn', 'add', 'seam']
    case 'bun':
      return ['bun', 'add', 'seam']
    default:
      return ['npm', 'install', 'seam']
  }
}
