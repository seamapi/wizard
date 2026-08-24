import type { SpaceKind } from './space-kinds'

// Domain row shapes. These mirror the SQLite columns (snake_case) so the raw
// better-sqlite3 rows can be returned straight from the server routes and
// consumed by the pages without a mapping layer.

export type SpaceStatus = 'active' | 'archived'
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled'

// A bookable space (room, suite, cabin…). Spaces are archived rather than
// deleted so past reservations keep pointing at something real.
export interface Space {
  id: number
  name: string
  kind: SpaceKind
  capacity: number
  rate_cents: number | null
  status: SpaceStatus
  notes: string | null
  created_at: number
}

// A single reservation. Guest contact details are stored inline (no separate
// accounts / login) to keep the PMS minimal. `space_id` is nullable: a stay can
// be taken before the front desk has decided which space the guest gets.
export interface Reservation {
  id: number
  guest_name: string
  email: string
  phone: string
  check_in: string // ISO date: YYYY-MM-DD
  check_out: string // ISO date: YYYY-MM-DD
  party_size: number
  notes: string | null
  space_id: number | null
  status: ReservationStatus
  created_at: number
}

// A reservation plus the display fields of its assigned space (left join).
export interface ReservationRow extends Reservation {
  space_name: string | null
  space_kind: SpaceKind | null
}

// Derived view: unique guests, deduped by email, with a reservation count.
export interface Guest {
  name: string
  email: string
  phone: string
  reservationCount: number
}

// An active space annotated with whether it can take a given stay.
export interface SpaceAvailability extends Space {
  available: boolean
  // Why it can't be booked, when `available` is false.
  reason: string | null
}
