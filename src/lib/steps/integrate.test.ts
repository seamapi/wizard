import { expect, test } from 'vitest'

import { buildSystemAppend } from './integrate.js'

test('buildSystemAppend bootstraps the Wizard prompt with implementation context', () => {
  const frameworks = [
    ['javascript', 'Next.js'],
    ['python', 'Django'],
    ['php', 'Laravel'],
    ['ruby', 'Rails'],
  ] as const

  for (const [sdk, framework] of frameworks) {
    for (const mode of ['customer_portal', 'full_api'] as const) {
      const prompt = buildSystemAppend(sdk, 'Test Workspace', framework, mode)

      expect(prompt).toContain(JSON.stringify({ framework, sdk, mode }))
      expect(prompt).toContain('mcp__seam__get_prompt with no arguments')
      expect(prompt).not.toMatch(
        /search_prompts|get_prompt_context|list_example_apps|get_example_app|list_context_packs|get_context_pack/,
      )
    }
  }
})

test('buildSystemAppend keeps an unsupported framework as selection context', () => {
  const prompt = buildSystemAppend(
    'javascript',
    'Test Workspace',
    'Express',
    'full_api',
  )

  expect(prompt).toContain(
    JSON.stringify({
      framework: 'Express',
      sdk: 'javascript',
      mode: 'full_api',
    }),
  )
})
