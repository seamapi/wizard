import type {
  Guest,
  Reservation,
  ReservationRow,
  Space,
} from '#shared/types'

// Read queries behind each page, plus the derived guest view and the
// single-row lookups the mutations reuse.

// All reservations, newest first, with the assigned space joined in.
export function listReservations(): ReservationRow[] {
  return useDb()
    .prepare(
      `SELECT reservations.*, spaces.name AS space_name, spaces.kind AS space_kind
       FROM reservations
       LEFT JOIN spaces ON spaces.id = reservations.space_id
       ORDER BY reservations.created_at DESC, reservations.id DESC`,
    )
    .all() as ReservationRow[]
}

// Unique guests (deduped by email), with how many reservations each has.
export function listGuests(): Guest[] {
  const all = useDb()
    .prepare(
      'SELECT guest_name, email, phone FROM reservations ORDER BY created_at DESC, id DESC',
    )
    .all() as Array<{ guest_name: string; email: string; phone: string }>

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
  return useDb()
    .prepare('SELECT * FROM spaces ORDER BY status ASC, name ASC')
    .all() as Space[]
}

export function getReservation(id: number): Reservation | undefined {
  return useDb().prepare('SELECT * FROM reservations WHERE id = ?').get(id) as
    | Reservation
    | undefined
}

export function getSpace(id: number): Space | undefined {
  return useDb().prepare('SELECT * FROM spaces WHERE id = ?').get(id) as
    | Space
    | undefined
}
