// A tiny in-memory reservations store — the app's existing booking flow. A good
// Seam integration extends these handlers (grant access on create, revoke on
// cancel) rather than adding a separate Seam-only page.

export interface Reservation {
  id: string
  guestName: string
  guestEmail: string
  unitId: string
  checkIn: string
  checkOut: string
  status: 'confirmed' | 'cancelled'
}

const reservations = new Map<string, Reservation>()

export function createReservation(
  input: Omit<Reservation, 'id' | 'status'>,
): Reservation {
  const id = `res_${reservations.size + 1}`
  const reservation: Reservation = { id, status: 'confirmed', ...input }
  reservations.set(id, reservation)
  return reservation
}

export function cancelReservation(id: string): Reservation | undefined {
  const reservation = reservations.get(id)
  if (reservation == null) return undefined
  const cancelled: Reservation = { ...reservation, status: 'cancelled' }
  reservations.set(id, cancelled)
  return cancelled
}

export function getReservation(id: string): Reservation | undefined {
  return reservations.get(id)
}

export function listReservations(): Reservation[] {
  return [...reservations.values()]
}
