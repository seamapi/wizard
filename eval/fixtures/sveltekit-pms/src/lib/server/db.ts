import Database from 'better-sqlite3'
import { env } from '$env/dynamic/private'

import type { SpaceKind } from '$lib/space-kinds'

/**
 * The single better-sqlite3 handle for the app. Everything that touches the
 * database lives under `$lib/server/`, so SvelteKit keeps it out of the client
 * bundle. The schema is created on import (see below) — a fresh clone can run
 * `npm run dev` with no separate migrate step.
 */

export type SpaceStatus = 'active' | 'archived'
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled'

/** A bookable space. Column names are aliased to camelCase in every query. */
export type Space = {
  id: number
  name: string
  kind: SpaceKind
  capacity: number
  rateCents: number | null
  status: SpaceStatus
  notes: string | null
  createdAt: number | null
}

/** A single reservation held against (optionally) a space. */
export type Reservation = {
  id: number
  guestName: string
  email: string
  phone: string
  checkIn: string
  checkOut: string
  partySize: number
  notes: string | null
  spaceId: number | null
  status: ReservationStatus
  createdAt: number | null
}

const databasePath = env.DATABASE_URL ?? 'dev.db'

export const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 10000')

/**
 * Spaces are archived rather than deleted so past reservations keep pointing at
 * something real; a reservation's space is nullable (ON DELETE SET NULL) so a
 * stay can be taken before the front desk has decided which space it gets.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'room',
    capacity INTEGER NOT NULL DEFAULT 2,
    rate_cents INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    party_size INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    space_id INTEGER REFERENCES spaces(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER DEFAULT (unixepoch())
  );
`)

// Seed a few spaces the first time so the booking form's availability picker
// isn't empty on a fresh clone.
const seeded = db.prepare('SELECT count(*) AS count FROM spaces').get() as {
  count: number
}
if (seeded.count === 0) {
  const insert = db.prepare(
    'INSERT INTO spaces (name, kind, capacity, rate_cents, notes) VALUES (?, ?, ?, ?, ?)',
  )
  insert.run('Seagrass Suite', 'suite', 4, 24_000, 'Ocean view, walk-in shower')
  insert.run('Dune Cabin', 'cabin', 2, 16_000, null)
  insert.run('Harbor Room 101', 'room', 2, 12_000, null)
}
