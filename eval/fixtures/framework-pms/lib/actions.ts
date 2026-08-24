'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { reservations, spaces } from '@/db/schema'
import type { Space } from '@/db/schema'
import { assertSpaceBookable, bookedSpaceIds } from '@/lib/availability'
import {
  assignInput,
  availabilityInput,
  bookingInput,
  idInput,
  setSpaceStatusInput,
  spaceInput,
  spaceUpdateInput,
  statusInput,
} from '@/lib/schemas'
import type { BookingInput, SpaceInput } from '@/lib/schemas'

export type SpaceAvailability = Space & {
  available: boolean
  /** Why it can't be booked, when `available` is false. */
  reason: string | null
}

/** Active spaces annotated with whether they can take the given stay. */
export async function listSpaceAvailability(input: {
  checkIn: string
  checkOut: string
  partySize: number
}): Promise<Array<SpaceAvailability>> {
  const data = availabilityInput.parse(input)

  const [active, booked] = await Promise.all([
    db
      .select()
      .from(spaces)
      .where(eq(spaces.status, 'active'))
      .orderBy(spaces.name),
    bookedSpaceIds(data.checkIn, data.checkOut),
  ])

  return active.map((space) => {
    if (booked.has(space.id))
      return { ...space, available: false, reason: 'Booked for these dates' }
    if (data.partySize > space.capacity)
      return { ...space, available: false, reason: `Sleeps ${space.capacity}` }
    return { ...space, available: true, reason: null }
  })
}

/** Create a reservation from the public booking form. */
export async function createReservation(input: BookingInput) {
  const data = bookingInput.parse(input)

  if (data.spaceId !== null) {
    await assertSpaceBookable({
      spaceId: data.spaceId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      partySize: data.partySize,
    })
  }

  const [row] = await db
    .insert(reservations)
    .values({
      guestName: data.guestName,
      email: data.email,
      phone: data.phone,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      partySize: data.partySize,
      notes: data.notes || null,
      spaceId: data.spaceId,
    })
    .returning()
  return row
}

/** Update a reservation's status (admin dashboard). */
export async function updateReservationStatus(input: {
  id: number
  status: 'pending' | 'confirmed' | 'cancelled'
}) {
  const data = statusInput.parse(input)

  const current = await db.query.reservations.findFirst({
    where: eq(reservations.id, data.id),
  })
  if (!current) throw new Error('That reservation no longer exists.')

  // Cancelling releases the space, so reviving a cancelled stay has to win its
  // space back — someone else may have taken it in the meantime.
  if (
    current.status === 'cancelled' &&
    data.status !== 'cancelled' &&
    current.spaceId !== null
  ) {
    await assertSpaceBookable({
      spaceId: current.spaceId,
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      partySize: current.partySize,
      excludeReservationId: current.id,
    })
  }

  const [row] = await db
    .update(reservations)
    .set({ status: data.status })
    .where(eq(reservations.id, data.id))
    .returning()
  return row
}

/** Assign, move, or clear a reservation's space (front desk). */
export async function assignReservationSpace(input: {
  id: number
  spaceId: number | null
}) {
  const data = assignInput.parse(input)

  const current = await db.query.reservations.findFirst({
    where: eq(reservations.id, data.id),
  })
  if (!current) throw new Error('That reservation no longer exists.')

  if (data.spaceId !== null) {
    await assertSpaceBookable({
      spaceId: data.spaceId,
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      partySize: current.partySize,
      excludeReservationId: current.id,
    })
  }

  const [row] = await db
    .update(reservations)
    .set({ spaceId: data.spaceId })
    .where(eq(reservations.id, data.id))
    .returning()
  return row
}

/** Delete a reservation (admin dashboard). */
export async function deleteReservation(input: { id: number }) {
  const data = idInput.parse(input)
  await db.delete(reservations).where(eq(reservations.id, data.id))
  return { id: data.id }
}

export async function createSpace(input: SpaceInput) {
  const data = spaceInput.parse(input)
  try {
    const [row] = await db.insert(spaces).values(toRow(data)).returning()
    return row
  } catch (err) {
    rethrowNameCollision(err, data.name)
  }
}

export async function updateSpace(input: SpaceInput & { id: number }) {
  const { id, ...rest } = spaceUpdateInput.parse(input)
  try {
    const [row] = await db
      .update(spaces)
      .set(toRow(rest))
      .where(eq(spaces.id, id))
      .returning()
    return row
  } catch (err) {
    rethrowNameCollision(err, rest.name)
  }
}

/**
 * Archive or restore a space. Archiving keeps it out of the booking picker
 * without touching the reservations that already reference it.
 */
export async function setSpaceStatus(input: {
  id: number
  status: 'active' | 'archived'
}) {
  const data = setSpaceStatusInput.parse(input)
  const [row] = await db
    .update(spaces)
    .set({ status: data.status })
    .where(eq(spaces.id, data.id))
    .returning()
  return row
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
