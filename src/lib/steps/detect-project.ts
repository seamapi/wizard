import { existsSync } from "node:fs"
import { join } from "node:path"

export type Sdk = "javascript" | "python"
export type JsPackageManager = "npm" | "pnpm" | "yarn" | "bun"
export type PythonInstaller = "pip" | "poetry" | "uv"

export interface ProjectInfo {
  root: string
  detected_sdk: Sdk | null
  js_package_manager: JsPackageManager
  python_installer: PythonInstaller
}

export function detectProject(cwd: string): ProjectInfo {
  return {
    root: cwd,
    detected_sdk: detectSdk(cwd),
    js_package_manager: detectJsPackageManager(cwd),
    python_installer: detectPythonInstaller(cwd),
  }
}

// null when the project is ambiguous (both or neither) — the wizard then asks.
function detectSdk(cwd: string): Sdk | null {
  const is_javascript = existsSync(join(cwd, "package.json"))
  const is_python = ["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"].some(
    (marker) => existsSync(join(cwd, marker))
  )
  if (is_javascript && !is_python) return "javascript"
  if (is_python && !is_javascript) return "python"
  return null
}

function detectJsPackageManager(cwd: string): JsPackageManager {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm"
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn"
  if (existsSync(join(cwd, "bun.lockb"))) return "bun"
  return "npm"
}

function detectPythonInstaller(cwd: string): PythonInstaller {
  if (existsSync(join(cwd, "poetry.lock"))) return "poetry"
  if (existsSync(join(cwd, "uv.lock"))) return "uv"
  return "pip"
}

export function installSeamSdkCommand(sdk: Sdk, project: ProjectInfo): string[] {
  if (sdk === "python") {
    switch (project.python_installer) {
      case "poetry":
        return ["poetry", "add", "seam"]
      case "uv":
        return ["uv", "add", "seam"]
      default:
        return ["pip", "install", "seam"]
    }
  }
  switch (project.js_package_manager) {
    case "pnpm":
      return ["pnpm", "add", "seam"]
    case "yarn":
      return ["yarn", "add", "seam"]
    case "bun":
      return ["bun", "add", "seam"]
    default:
      return ["npm", "install", "seam"]
  }
}
