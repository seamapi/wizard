import Database from 'better-sqlite3'

// A single shared connection. The schema is created on first import so the app
// runs against a fresh pms.db with no separate migration step.
export const db = new Database('pms.db')

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

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

// A bookable space (room, suite, cabin…). Spaces are archived rather than
// deleted so past reservations keep pointing at something real.
export interface Space {
  id: number
  name: string
  kind: string
  capacity: number
  rate_cents: number | null
  status: 'active' | 'archived'
  notes: string | null
  created_at: number
}

// A single reservation. Guest contact details are stored inline (no separate
// accounts / login) to keep the PMS minimal. space_id is nullable: a stay can be
// taken before the front desk has decided which space the guest gets.
export interface Reservation {
  id: number
  guest_name: string
  email: string
  phone: string
  check_in: string
  check_out: string
  party_size: number
  notes: string | null
  space_id: number | null
  status: 'pending' | 'confirmed' | 'cancelled'
  created_at: number
}
