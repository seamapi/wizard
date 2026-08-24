import { db } from './db.js'
import type { Space } from './db.js'

// Read queries behind each page, plus the derived guest view.

// A reservation plus the display fields of its assigned space.
export interface ReservationRow {
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
  space_name: string | null
  space_kind: string | null
}

// All reservations, newest first, with the assigned space joined in.
export function listReservations(): ReservationRow[] {
  return db
    .prepare(
      `SELECT reservations.*, spaces.name AS space_name, spaces.kind AS space_kind
       FROM reservations
       LEFT JOIN spaces ON spaces.id = reservations.space_id
       ORDER BY reservations.created_at DESC`,
    )
    .all() as ReservationRow[]
}

export interface Guest {
  name: string
  email: string
  phone: string
  reservationCount: number
}

// Unique guests (deduped by email), with how many reservations each has.
export function listGuests(): Guest[] {
  const all = db
    .prepare('SELECT * FROM reservations ORDER BY created_at DESC')
    .all() as Array<{
    guest_name: string
    email: string
    phone: string
  }>

  const byEmail = new Map<string, Guest>()
  for (const reservation of all) {
    const key = reservation.email.trim().toLowerCase()
    const existing = byEmail.get(key)
    if (existing != null) {
      existing.reservationCount += 1
    } else {
      // rows are newest-first, so the first hit is the guest's latest details
      byEmail.set(key, {
        name: reservation.guest_name,
        email: reservation.email,
        phone: reservation.phone,
        reservationCount: 1,
      })
    }
  }
  return [...byEmail.values()]
}

// Every space, active first then alphabetical.
export function listSpaces(): Space[] {
  return db
    .prepare(
      `SELECT * FROM spaces ORDER BY status ASC, name ASC`,
    )
    .all() as Space[]
}
