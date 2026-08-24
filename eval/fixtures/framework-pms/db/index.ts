import 'server-only'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'

type Db = BetterSQLite3Database<typeof schema>

let connection: Db | null = null

/**
 * Open (once) and return the database. Lazy on purpose: Next collects page
 * data by evaluating each route's module in several worker processes at build
 * time, and opening the same sqlite file from all of them at once races into
 * SQLITE_BUSY. Deferring the open until the first query keeps build-time module
 * evaluation free of any file access — the pages are `force-dynamic`, so the
 * real open happens per-request instead.
 */
function getDb(): Db {
  if (connection) return connection

  const db_path = process.env.DATABASE_URL ?? 'dev.db'
  const sqlite = new Database(db_path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 10000')

  // Self-contained dev database: create the tables on first use so `npm run
  // dev` works from a fresh clone with no separate migrate step. `npm run
  // db:push` (drizzle-kit) remains available for a schema-managed workflow.
  sqlite.exec(`
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
  const seeded = sqlite
    .prepare('SELECT count(*) AS count FROM spaces')
    .get() as { count: number }
  if (seeded.count === 0) {
    const insert = sqlite.prepare(
      'INSERT INTO spaces (name, kind, capacity, rate_cents, notes) VALUES (?, ?, ?, ?, ?)',
    )
    insert.run(
      'Seagrass Suite',
      'suite',
      4,
      24_000,
      'Ocean view, walk-in shower',
    )
    insert.run('Dune Cabin', 'cabin', 2, 16_000, null)
    insert.run('Harbor Room 101', 'room', 2, 12_000, null)
  }

  connection = drizzle(sqlite, { schema })
  return connection
}

/**
 * Lazy handle to the database. Property access initializes the connection on
 * first use and forwards to the real drizzle instance (methods stay bound to
 * it), so callers can `import { db }` and use it exactly as before.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb(), prop, receiver)
    return typeof value === 'function' ? value.bind(getDb()) : value
  },
})
