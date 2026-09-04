import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test } from 'vitest'

import { upsertSeamMcp } from 'lib/steps/harness/pi.js'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true })
  }
})

test('upsertSeamMcp preserves existing servers and replaces only seam', () => {
  const root = mkdtempSync(join(tmpdir(), 'seam-pi-'))
  dirs.push(root)
  mkdirSync(join(root, '.pi'))
  writeFileSync(
    join(root, '.pi', 'mcp.json'),
    JSON.stringify({
      mcpServers: {
        existing: { command: 'existing' },
        seam: { command: 'old' },
      },
    }),
  )

  upsertSeamMcp(root)

  expect(
    JSON.parse(readFileSync(join(root, '.pi', 'mcp.json'), 'utf8')),
  ).toEqual({
    mcpServers: {
      existing: { command: 'existing' },
      seam: {
        url: 'https://mcp.seam.co/mcp?agent=wizard',
        lifecycle: 'eager',
      },
    },
  })
})
