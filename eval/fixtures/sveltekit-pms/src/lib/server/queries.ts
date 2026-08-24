import { db } from '$lib/server/db'
import type { Reservation, Space } from '$lib/server/db'
import type { SpaceKind } from '$lib/space-kinds'

/**
 * Server-only read queries, called from each route's `+page.server.ts` load.
 */

const SPACE_COLUMNS = `
  id, name, kind, capacity, rate_cents AS rateCents, status, notes,
  created_at AS createdAt
`

const RESERVATION_COLUMNS = `
  id, guest_name AS guestName, email, phone, check_in AS checkIn,
  check_out AS checkOut, party_size AS partySize, notes, space_id AS spaceId,
  status, created_at AS createdAt
`

/** A reservation plus the display fields of its assigned space. */
export type ReservationRow = Reservation & {
  spaceName: string | null
  spaceKind: SpaceKind | null
}

/** All reservations, newest first, with the assigned space joined in. */
export function listReservations(): Array<ReservationRow> {
  return db
    .prepare(
      `SELECT
         reservations.id AS id,
         reservations.guest_name AS guestName,
         reservations.email AS email,
         reservations.phone AS phone,
         reservations.check_in AS checkIn,
         reservations.check_out AS checkOut,
         reservations.party_size AS partySize,
         reservations.notes AS notes,
         reservations.space_id AS spaceId,
         reservations.status AS status,
         reservations.created_at AS createdAt,
         spaces.name AS spaceName,
         spaces.kind AS spaceKind
       FROM reservations
       LEFT JOIN spaces ON spaces.id = reservations.space_id
       ORDER BY reservations.created_at DESC, reservations.id DESC`,
    )
    .all() as Array<ReservationRow>
}

export type Guest = {
  name: string
  email: string
  phone: string
  reservationCount: number
}

/** Unique guests (deduped by email), with how many reservations each has. */
export function listGuests(): Array<Guest> {
  const all = db
    .prepare(
      `SELECT ${RESERVATION_COLUMNS} FROM reservations
       ORDER BY created_at DESC, id DESC`,
    )
    .all() as Array<Reservation>

  const byEmail = new Map<string, Guest>()
  for (const reservation of all) {
    const key = reservation.email.trim().toLowerCase()
    const existing = byEmail.get(key)
    if (existing) {
      existing.reservationCount += 1
    } else {
      // rows are newest-first, so the first hit is the guest's latest details
      byEmail.set(key, {
        name: reservation.guestName,
        email: reservation.email,
        phone: reservation.phone,
        reservationCount: 1,
      })
    }
  }
  return [...byEmail.values()]
}

/** Every space, active first then alphabetical. */
export function listSpaces(): Array<Space> {
  return db
    .prepare(`SELECT ${SPACE_COLUMNS} FROM spaces ORDER BY status ASC, name ASC`)
    .all() as Array<Space>
}
