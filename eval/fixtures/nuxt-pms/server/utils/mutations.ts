import type { BookingInput, SpaceInput } from '#shared/schemas'
import type {
  Reservation,
  ReservationStatus,
  Space,
  SpaceAvailability,
  SpaceStatus,
} from '#shared/types'

// Write operations behind the API routes, mirroring the read queries. Each
// throws a guest-readable Error on a business-rule failure; the route handlers
// convert those into a 400 via `toClientError`.

// Active spaces annotated with whether they can take the given stay.
export function listSpaceAvailability(input: {
  checkIn: string
  checkOut: string
  partySize: number
}): SpaceAvailability[] {
  const active = useDb()
    .prepare("SELECT * FROM spaces WHERE status = 'active' ORDER BY name ASC")
    .all() as Space[]
  const booked = bookedSpaceIds(input.checkIn, input.checkOut)

  return active.map((space) => {
    if (booked.has(space.id))
      return { ...space, available: false, reason: 'Booked for these dates' }
    if (input.partySize > space.capacity)
      return { ...space, available: false, reason: `Sleeps ${space.capacity}` }
    return { ...space, available: true, reason: null }
  })
}

// Create a reservation from the public booking form.
export function createReservation(data: BookingInput): Reservation {
  if (data.spaceId != null) {
    assertSpaceBookable({
      spaceId: data.spaceId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      partySize: data.partySize,
    })
  }

  const info = useDb()
    .prepare(
      `INSERT INTO reservations
         (guest_name, email, phone, check_in, check_out, party_size, notes, space_id)
       VALUES
         (@guestName, @email, @phone, @checkIn, @checkOut, @partySize, @notes, @spaceId)`,
    )
    .run({
      guestName: data.guestName,
      email: data.email,
      phone: data.phone,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      partySize: data.partySize,
      notes: data.notes ?? null,
      spaceId: data.spaceId,
    })

  return requireReservation(Number(info.lastInsertRowid))
}

// Update a reservation's status (front desk).
export function updateReservationStatus(
  id: number,
  status: ReservationStatus,
): Reservation {
  const current = getReservation(id)
  if (current == null) throw new Error('That reservation no longer exists.')

  // Cancelling releases the space, so reviving a cancelled stay has to win its
  // space back — someone else may have taken it in the meantime.
  if (
    current.status === 'cancelled' &&
    status !== 'cancelled' &&
    current.space_id != null
  ) {
    assertSpaceBookable({
      spaceId: current.space_id,
      checkIn: current.check_in,
      checkOut: current.check_out,
      partySize: current.party_size,
      excludeReservationId: current.id,
    })
  }

  useDb()
    .prepare('UPDATE reservations SET status = ? WHERE id = ?')
    .run(status, id)
  return requireReservation(id)
}

// Assign, move, or clear a reservation's space (front desk).
export function assignReservationSpace(
  id: number,
  spaceId: number | null,
): Reservation {
  const current = getReservation(id)
  if (current == null) throw new Error('That reservation no longer exists.')

  if (spaceId != null) {
    assertSpaceBookable({
      spaceId,
      checkIn: current.check_in,
      checkOut: current.check_out,
      partySize: current.party_size,
      excludeReservationId: current.id,
    })
  }

  useDb()
    .prepare('UPDATE reservations SET space_id = ? WHERE id = ?')
    .run(spaceId, id)
  return requireReservation(id)
}

// Delete a reservation (front desk).
export function deleteReservation(id: number): { id: number } {
  useDb().prepare('DELETE FROM reservations WHERE id = ?').run(id)
  return { id }
}

export function createSpace(data: SpaceInput): Space {
  const row = toSpaceRow(data)
  try {
    const info = useDb()
      .prepare(
        `INSERT INTO spaces (name, kind, capacity, rate_cents, notes)
         VALUES (@name, @kind, @capacity, @rate_cents, @notes)`,
      )
      .run(row)
    return requireSpace(Number(info.lastInsertRowid))
  } catch (err) {
    rethrowNameCollision(err, row.name)
  }
}

export function updateSpace(id: number, data: SpaceInput): Space {
  const row = toSpaceRow(data)
  try {
    useDb()
      .prepare(
        `UPDATE spaces
         SET name = @name, kind = @kind, capacity = @capacity,
             rate_cents = @rate_cents, notes = @notes
         WHERE id = @id`,
      )
      .run({ ...row, id })
    return requireSpace(id)
  } catch (err) {
    rethrowNameCollision(err, row.name)
  }
}

// Archive or restore a space. Archiving keeps it out of the booking picker
// without touching the reservations that already reference it.
export function setSpaceStatus(id: number, status: SpaceStatus): Space {
  useDb().prepare('UPDATE spaces SET status = ? WHERE id = ?').run(status, id)
  return requireSpace(id)
}

function toSpaceRow(data: SpaceInput): {
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

function requireReservation(id: number): Reservation {
  const reservation = getReservation(id)
  if (reservation == null)
    throw new Error('Could not load the saved reservation.')
  return reservation
}

function requireSpace(id: number): Space {
  const space = getSpace(id)
  if (space == null) throw new Error('Could not load the saved space.')
  return space
}

// Names are unique, so surface the collision instead of a raw SQLite error.
function rethrowNameCollision(err: unknown, name: string): never {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('UNIQUE'))
    throw new Error(`A space named “${name}” already exists.`)
  throw err instanceof Error ? err : new Error(String(err))
}
