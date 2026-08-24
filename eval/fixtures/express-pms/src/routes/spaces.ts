import { Router } from 'express'

import { db } from '../db.js'
import { listSpaces } from '../queries.js'
import { setSpaceStatusInput, spaceInput } from '../schemas.js'
import { SPACE_KINDS } from '../space-kinds.js'
import type { SpaceInput } from '../schemas.js'

// Space inventory: create, edit, and archive/restore bookable spaces.
export const spacesRouter = Router()

function toRow(data: SpaceInput): {
  name: string
  kind: string
  capacity: number
  rate_cents: number | null
  notes: string | null
} {
  return {
    name: data.name,
    kind: data.kind,
    capacity: data.capacity,
    rate_cents: data.rate == null ? null : Math.round(data.rate * 100),
    notes: data.notes ?? null,
  }
}

// Names are unique, so surface the collision instead of a raw SQLite error.
function isNameCollision(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE')
}

spacesRouter.get('/spaces', (_req, res) => {
  res.render('spaces', { spaces: listSpaces(), kinds: SPACE_KINDS, error: null })
})

spacesRouter.post('/spaces', (req, res) => {
  const parsed = spaceInput.safeParse(req.body)
  if (!parsed.success) {
    renderError(res, parsed.error.issues[0]?.message ?? 'That space looks invalid.')
    return
  }
  const row = toRow(parsed.data)
  try {
    db.prepare(
      `INSERT INTO spaces (name, kind, capacity, rate_cents, notes)
       VALUES (@name, @kind, @capacity, @rate_cents, @notes)`,
    ).run(row)
  } catch (error) {
    if (isNameCollision(error)) {
      renderError(res, `A space named “${row.name}” already exists.`)
      return
    }
    throw error instanceof Error ? error : new Error(String(error))
  }
  res.redirect('/spaces')
})

spacesRouter.post('/spaces/:id', (req, res) => {
  const id = Number(req.params.id)
  const parsed = spaceInput.safeParse(req.body)
  if (!parsed.success) {
    renderError(res, parsed.error.issues[0]?.message ?? 'That space looks invalid.')
    return
  }
  const row = toRow(parsed.data)
  try {
    db.prepare(
      `UPDATE spaces
       SET name = @name, kind = @kind, capacity = @capacity,
           rate_cents = @rate_cents, notes = @notes
       WHERE id = @id`,
    ).run({ ...row, id })
  } catch (error) {
    if (isNameCollision(error)) {
      renderError(res, `A space named “${row.name}” already exists.`)
      return
    }
    throw error instanceof Error ? error : new Error(String(error))
  }
  res.redirect('/spaces')
})

// Archive or restore a space. Archiving keeps it out of the booking picker
// without touching the reservations that already reference it.
spacesRouter.post('/spaces/:id/status', (req, res) => {
  const parsed = setSpaceStatusInput.safeParse(req.body)
  if (parsed.success) {
    db.prepare('UPDATE spaces SET status = ? WHERE id = ?').run(
      parsed.data.status,
      Number(req.params.id),
    )
  }
  res.redirect('/spaces')
})

function renderError(
  res: import('express').Response,
  message: string,
): void {
  res
    .status(422)
    .render('spaces', { spaces: listSpaces(), kinds: SPACE_KINDS, error: message })
}
