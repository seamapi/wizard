import { db } from '$lib/server/db'
import type { Reservation, Space } from '$lib/server/db'
import { assertSpaceBookable, bookedSpaceIds } from '$lib/server/availability'
import {
  assignInput,
  availabilityInput,
  bookingInput,
  idInput,
  setSpaceStatusInput,
  spaceInput,
  spaceUpdateInput,
  statusInput,
} from '$lib/schemas'
import type { BookingInput, SpaceInput } from '$lib/schemas'

/**
 * The write path (plus the availability read that booking depends on). Each
 * `+page.server.ts` form action builds a plain object from `FormData` and hands
 * it here; these functions re-validate and mutate the database. Keeping them in
 * `$lib/server/` means the DB never leaks into the client bundle.
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

export type SpaceAvailability = Space & {
  available: boolean
  /** Why it can't be booked, when `available` is false. */
  reason: string | null
}

/** Active spaces annotated with whether they can take the given stay. */
export function listSpaceAvailability(input: {
  checkIn: string
  checkOut: string
  partySize: number
}): Array<SpaceAvailability> {
  const data = availabilityInput.parse(input)

  const active = db
    .prepare(
      `SELECT ${SPACE_COLUMNS} FROM spaces WHERE status = 'active' ORDER BY name ASC`,
    )
    .all() as Array<Space>
  const booked = bookedSpaceIds(data.checkIn, data.checkOut)

  return active.map((space) => {
    if (booked.has(space.id))
      return { ...space, available: false, reason: 'Booked for these dates' }
    if (data.partySize > space.capacity)
      return { ...space, available: false, reason: `Sleeps ${space.capacity}` }
    return { ...space, available: true, reason: null }
  })
}

/** Create a reservation from the public booking form. */
export function createReservation(input: BookingInput): Reservation {
  const data = bookingInput.parse(input)

  if (data.spaceId !== null) {
    assertSpaceBookable({
      spaceId: data.spaceId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      partySize: data.partySize,
    })
  }

  return db
    .prepare(
      `INSERT INTO reservations
         (guest_name, email, phone, check_in, check_out, party_size, notes, space_id)
       VALUES (@guestName, @email, @phone, @checkIn, @checkOut, @partySize, @notes, @spaceId)
       RETURNING ${RESERVATION_COLUMNS}`,
    )
    .get({
      guestName: data.guestName,
      email: data.email,
      phone: data.phone,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      partySize: data.partySize,
      notes: data.notes || null,
      spaceId: data.spaceId,
    }) as Reservation
}

/** Update a reservation's status (front desk). */
export function updateReservationStatus(input: {
  id: number
  status: 'pending' | 'confirmed' | 'cancelled'
}): Reservation {
  const data = statusInput.parse(input)

  const current = db
    .prepare(`SELECT ${RESERVATION_COLUMNS} FROM reservations WHERE id = ?`)
    .get(data.id) as Reservation | undefined
  if (!current) throw new Error('That reservation no longer exists.')

  // Cancelling releases the space, so reviving a cancelled stay has to win its
  // space back — someone else may have taken it in the meantime.
  if (
    current.status === 'cancelled' &&
    data.status !== 'cancelled' &&
    current.spaceId !== null
  ) {
    assertSpaceBookable({
      spaceId: current.spaceId,
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      partySize: current.partySize,
      excludeReservationId: current.id,
    })
  }

  return db
    .prepare(
      `UPDATE reservations SET status = ? WHERE id = ? RETURNING ${RESERVATION_COLUMNS}`,
    )
    .get(data.status, data.id) as Reservation
}

/** Assign, move, or clear a reservation's space (front desk). */
export function assignReservationSpace(input: {
  id: number
  spaceId: number | null
}): Reservation {
  const data = assignInput.parse(input)

  const current = db
    .prepare(`SELECT ${RESERVATION_COLUMNS} FROM reservations WHERE id = ?`)
    .get(data.id) as Reservation | undefined
  if (!current) throw new Error('That reservation no longer exists.')

  if (data.spaceId !== null) {
    assertSpaceBookable({
      spaceId: data.spaceId,
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      partySize: current.partySize,
      excludeReservationId: current.id,
    })
  }

  return db
    .prepare(
      `UPDATE reservations SET space_id = ? WHERE id = ? RETURNING ${RESERVATION_COLUMNS}`,
    )
    .get(data.spaceId, data.id) as Reservation
}

/** Delete a reservation (front desk). */
export function deleteReservation(input: { id: number }): { id: number } {
  const data = idInput.parse(input)
  db.prepare('DELETE FROM reservations WHERE id = ?').run(data.id)
  return { id: data.id }
}

export function createSpace(input: SpaceInput): Space {
  const data = spaceInput.parse(input)
  try {
    return db
      .prepare(
        `INSERT INTO spaces (name, kind, capacity, rate_cents, notes)
         VALUES (@name, @kind, @capacity, @rateCents, @notes)
         RETURNING ${SPACE_COLUMNS}`,
      )
      .get(toRow(data)) as Space
  } catch (err) {
    rethrowNameCollision(err, data.name)
  }
}

export function updateSpace(input: SpaceInput & { id: number }): Space {
  const { id, ...rest } = spaceUpdateInput.parse(input)
  try {
    return db
      .prepare(
        `UPDATE spaces
         SET name = @name, kind = @kind, capacity = @capacity,
             rate_cents = @rateCents, notes = @notes
         WHERE id = @id
         RETURNING ${SPACE_COLUMNS}`,
      )
      .get({ ...toRow(rest), id }) as Space
  } catch (err) {
    rethrowNameCollision(err, rest.name)
  }
}

/**
 * Archive or restore a space. Archiving keeps it out of the booking picker
 * without touching the reservations that already reference it.
 */
export function setSpaceStatus(input: {
  id: number
  status: 'active' | 'archived'
}): Space {
  const data = setSpaceStatusInput.parse(input)
  return db
    .prepare(
      `UPDATE spaces SET status = ? WHERE id = ? RETURNING ${SPACE_COLUMNS}`,
    )
    .get(data.status, data.id) as Space
}

function toRow(data: SpaceInput) {
  return {
    name: data.name,
    kind: data.kind,
    capacity: data.capacity,
    rateCents: data.rate === null ? null : Math.round(data.rate * 100),
    notes: data.notes || null,
  }
}

/** Names are unique, so surface the collision instead of a raw SQLite error. */
function rethrowNameCollision(err: unknown, name: string): never {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('UNIQUE') && message.includes('name'))
    throw new Error(`A space named “${name}” already exists.`)
  throw err instanceof Error ? err : new Error(String(err))
}
