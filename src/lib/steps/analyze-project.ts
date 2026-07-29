import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ProjectInfo, Sdk } from "./detect-project.js"
import { ALL_BLOCKS, type BuildMode } from "./build-plan.js"
import { findExistingApiKey } from "../util/env-file.js"
import {
  callInferenceForText,
  type WizardOnboarding,
} from "../util/seam-api.js"

// A cheap classification model — the deep work happens in the integration
// agent, so the pre-analysis only needs a good recommendation, not deep
// reasoning.
const RECOMMENDATION_MODEL = "claude-haiku-4-5"

export interface ProjectSignals {
  sdk: Sdk | null
  framework: string | null
  package_name: string | null
  description: string | null
  keywords: string[]
  dependency_names: string[]
  readme_excerpt: string | null
  seam_already_setup: boolean
}

export interface Recommendation {
  mode: BuildMode
  selections: string[]
  app_type_guess: string | null
  rationale: string
  source: "llm" | "heuristic"
}

export interface ProjectAnalysis {
  signals: ProjectSignals
  recommendation: Recommendation
  used_onboarding: boolean
}

const VALID_BLOCK_IDS = new Set(ALL_BLOCKS.map((block) => block.id))

// Gather what the project reveals about itself, then recommend a mode + build
// blocks by combining those signals with the Console onboarding answers. The
// recommendation comes from a short LLM call, falling back to a deterministic
// heuristic if that call fails or returns something unusable.
export async function analyzeProject(args: {
  root: string
  project: ProjectInfo
  onboarding: WizardOnboarding | null
  inference: { base_url: string; token: string }
}): Promise<ProjectAnalysis> {
  const { root, project, onboarding, inference } = args
  const signals = gatherProjectSignals(root, project)

  let recommendation: Recommendation
  try {
    recommendation = await recommendViaLlm(signals, onboarding, inference)
  } catch {
    recommendation = heuristicRecommendation(signals, onboarding)
  }

  return {
    signals,
    recommendation,
    used_onboarding: onboarding != null,
  }
}

function gatherProjectSignals(
  root: string,
  project: ProjectInfo
): ProjectSignals {
  const package_json = readJsonIfExists(join(root, "package.json")) as {
    name?: string
    description?: string
    keywords?: string[]
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  } | null

  const dependency_names = [
    ...Object.keys(package_json?.dependencies ?? {}),
    ...Object.keys(package_json?.devDependencies ?? {}),
  ]

  return {
    sdk: project.detected_sdk,
    framework: detectFramework(root, project.detected_sdk, dependency_names),
    package_name: package_json?.name ?? null,
    description: package_json?.description ?? null,
    keywords: package_json?.keywords ?? [],
    dependency_names: dependency_names.slice(0, 40),
    readme_excerpt: readReadmeExcerpt(root),
    seam_already_setup:
      dependency_names.includes("seam") || findExistingApiKey(root) != null,
  }
}

function detectFramework(
  root: string,
  sdk: Sdk | null,
  dependency_names: string[]
): string | null {
  const has = (name: string): boolean => dependency_names.includes(name)

  if (sdk === "javascript") {
    if (has("next")) return "Next.js"
    if (has("@remix-run/react") || has("@remix-run/node")) return "Remix"
    if (has("nuxt")) return "Nuxt"
    if (has("@nestjs/core")) return "NestJS"
    if (has("fastify")) return "Fastify"
    if (has("express")) return "Express"
    if (has("react")) return "React"
    return null
  }

  if (sdk === "python") {
    if (existsSync(join(root, "manage.py")) || hasPythonDep(root, "django")) {
      return "Django"
    }
    if (hasPythonDep(root, "fastapi")) return "FastAPI"
    if (hasPythonDep(root, "flask")) return "Flask"
    return null
  }

  return null
}

function hasPythonDep(root: string, name: string): boolean {
  for (const marker of ["requirements.txt", "pyproject.toml", "Pipfile"]) {
    const path = join(root, marker)
    if (!existsSync(path)) continue
    try {
      if (readFileSync(path, "utf8").toLowerCase().includes(name)) return true
    } catch {
      // Unreadable dependency file — treat as absent.
    }
  }
  return false
}

function readReadmeExcerpt(root: string): string | null {
  for (const name of ["README.md", "README.MD", "readme.md", "README"]) {
    const path = join(root, name)
    if (!existsSync(path)) continue
    try {
      return readFileSync(path, "utf8").slice(0, 1200)
    } catch {
      return null
    }
  }
  return null
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

async function recommendViaLlm(
  signals: ProjectSignals,
  onboarding: WizardOnboarding | null,
  inference: { base_url: string; token: string }
): Promise<Recommendation> {
  const block_menu = ALL_BLOCKS.map(
    (block) => `  "${block.id}" — ${block.label}`
  ).join("\n")

  const system =
    "You help developers integrate Seam, an API for smart locks, access " +
    "control, and physical access. Given signals about a project, recommend " +
    "how to integrate Seam. Reply with ONLY a JSON object, no prose."

  const user = [
    "Project signals:",
    `- SDK: ${signals.sdk ?? "unknown"}`,
    `- Framework: ${signals.framework ?? "unknown"}`,
    `- Package: ${signals.package_name ?? "unknown"} — ${signals.description ?? ""}`,
    `- Keywords: ${signals.keywords.join(", ") || "none"}`,
    `- Dependencies: ${signals.dependency_names.join(", ") || "none"}`,
    `- Seam already set up: ${signals.seam_already_setup}`,
    `- README excerpt: ${signals.readme_excerpt ?? "none"}`,
    "",
    "Console onboarding answers (any may be null):",
    `- use_case: ${onboarding?.use_case ?? "null"}`,
    `- primary_goal: ${onboarding?.primary_goal ?? "null"}`,
    `- build_target: ${onboarding?.build_target ?? "null"}`,
    `- embed_customer_portal: ${onboarding?.embed_customer_portal ?? "null"}`,
    `- device_categories: ${onboarding?.device_categories?.join(", ") ?? "null"}`,
    "",
    "Decide:",
    '1) mode: "customer_portal" (Seam hosts the UI; the app calls ~2 endpoints)',
    '   or "full_api" (control everything via the API, build your own UI).',
    "   If embed_customer_portal is true, strongly prefer customer_portal.",
    '2) selections: building-block ids to scaffold — only for "full_api" (use',
    "   [] for customer_portal). Always include \"access_grants\" for full_api.",
    "   Valid ids:",
    block_menu,
    '3) app_type_guess: short phrase (e.g. "vacation rental", "coworking",',
    '   "property management", "unknown").',
    "4) rationale: one short sentence.",
    "",
    'Return exactly: {"mode":"...","selections":["..."],"app_type_guess":"...","rationale":"..."}',
  ].join("\n")

  const text = await callInferenceForText(inference, {
    model: RECOMMENDATION_MODEL,
    max_tokens: 400,
    system,
    user,
  })

  const parsed = parseRecommendationJson(text)
  if (parsed == null) return heuristicRecommendation(signals, onboarding)

  const mode: BuildMode =
    parsed.mode === "customer_portal" ? "customer_portal" : "full_api"
  const selections =
    mode === "customer_portal"
      ? []
      : normalizeSelections(parsed.selections ?? [])

  return {
    mode,
    selections,
    app_type_guess: parsed.app_type_guess ?? null,
    rationale: parsed.rationale ?? "",
    source: "llm",
  }
}

function parseRecommendationJson(text: string): {
  mode?: string
  selections?: unknown
  app_type_guess?: string
  rationale?: string
} | null {
  const match = /\{[\S\s]*\}/.exec(text)
  if (match == null) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// Keep only known ids, always guarantee access_grants for the full-API path.
function normalizeSelections(raw: unknown): string[] {
  const ids = Array.isArray(raw)
    ? raw.filter(
        (id): id is string => typeof id === "string" && VALID_BLOCK_IDS.has(id)
      )
    : []
  const unique = [...new Set(ids)]
  if (!unique.includes("access_grants")) unique.unshift("access_grants")
  return unique
}

function heuristicRecommendation(
  signals: ProjectSignals,
  onboarding: WizardOnboarding | null
): Recommendation {
  if (onboarding?.embed_customer_portal === true) {
    return {
      mode: "customer_portal",
      selections: [],
      app_type_guess: onboarding.use_case ?? onboarding.org_type ?? null,
      rationale: "You chose to embed the Customer Portal during onboarding.",
      source: "heuristic",
    }
  }

  const haystack = [
    onboarding?.use_case,
    onboarding?.primary_goal,
    onboarding?.org_type,
    signals.description,
    signals.package_name,
    ...signals.keywords,
  ]
    .filter((value): value is string => value != null)
    .join(" ")
    .toLowerCase()

  const mentions = (...terms: string[]): boolean =>
    terms.some((term) => haystack.includes(term))

  const selections = new Set<string>(["access_grants", "connect_device"])
  let app_type_guess: string | null = null

  if (
    mentions("hotel", "booking", "reservation", "vacation", "rental", "pms", "guest", "hospitality")
  ) {
    selections.add("reservations")
    app_type_guess = "hospitality / short-term rental"
  } else if (mentions("coworking", "tenant", "member", "property", "apartment", "resident")) {
    selections.add("user_identities")
    app_type_guess = "property / coworking"
  }

  return {
    mode: "full_api",
    selections: [...selections],
    app_type_guess,
    rationale: "Recommended from your project and onboarding answers.",
    source: "heuristic",
  }
}
