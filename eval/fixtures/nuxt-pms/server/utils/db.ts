import Database from 'better-sqlite3'
import type { Database as SqliteConnection } from 'better-sqlite3'

// A single lazily-opened connection, shared across every server route. The
// schema is created on first use so the app runs against a fresh SQLite file
// with no separate migration step. Auto-imported by Nuxt in the server context,
// so route handlers and the other server utils just call `useDb()`.
let connection: SqliteConnection | null = null

export function useDb(): SqliteConnection {
  if (connection != null) return connection

  const db_path = process.env.DATABASE_URL ?? 'dev.db'
  const db = new Database(db_path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 10000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'room',
      capacity INTEGER NOT NULL DEFAULT 2,
      rate_cents INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  seedSpaces(db)

  connection = db
  return connection
}

// Seed a few spaces the first time so the booking form's availability picker
// isn't empty on a fresh clone.
function seedSpaces(db: SqliteConnection): void {
  const seeded = db
    .prepare('SELECT count(*) AS count FROM spaces')
    .get() as { count: number }
  if (seeded.count > 0) return

  const insert = db.prepare(
    'INSERT INTO spaces (name, kind, capacity, rate_cents, notes) VALUES (?, ?, ?, ?, ?)',
  )
  insert.run('Seagrass Suite', 'suite', 4, 24_000, 'Ocean view, walk-in shower')
  insert.run('Dune Cabin', 'cabin', 2, 16_000, null)
  insert.run('Harbor Room 101', 'room', 2, 12_000, null)
}
