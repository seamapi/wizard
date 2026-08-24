import 'server-only'

import { and, eq, gt, isNotNull, lt, ne } from 'drizzle-orm'

import { db } from '@/db'
import { reservations, spaces } from '@/db/schema'

/**
 * Server-only availability helpers. Importing this module from a client
 * component would pull `db` (and better-sqlite3) into the browser bundle — the
 * `server-only` import turns that into a build-time error instead.
 */

/**
 * Reservations hold a space for the half-open interval [checkIn, checkOut),
 * so a same-day turnover (one guest out, the next in) is not a conflict.
 * Cancelled reservations release the space.
 */
function overlapWhere(checkIn: string, checkOut: string) {
  return and(
    isNotNull(reservations.spaceId),
    ne(reservations.status, 'cancelled'),
    // ISO YYYY-MM-DD sorts lexicographically, so text compare is date compare.
    lt(reservations.checkIn, checkOut),
    gt(reservations.checkOut, checkIn),
  )
}

/** Space ids already held for the given range, excluding one reservation. */
export async function bookedSpaceIds(
  checkIn: string,
  checkOut: string,
  excludeReservationId?: number,
) {
  const where = excludeReservationId
    ? and(
        overlapWhere(checkIn, checkOut),
        ne(reservations.id, excludeReservationId),
      )
    : overlapWhere(checkIn, checkOut)

  const held = await db
    .select({ spaceId: reservations.spaceId })
    .from(reservations)
    .where(where)

  return new Set(
    held.map((row) => row.spaceId).filter((id): id is number => !!id),
  )
}

/**
 * Assert a space can take a stay, throwing a guest-readable message if not.
 * Used by both booking and front-desk reassignment.
 */
export async function assertSpaceBookable({
  spaceId,
  checkIn,
  checkOut,
  partySize,
  excludeReservationId,
}: {
  spaceId: number
  checkIn: string
  checkOut: string
  partySize: number
  excludeReservationId?: number
}) {
  const space = await db.query.spaces.findFirst({
    where: eq(spaces.id, spaceId),
  })

  if (!space) throw new Error('That space no longer exists.')
  if (space.status !== 'active')
    throw new Error(`${space.name} is archived and can't be booked.`)
  if (partySize > space.capacity)
    throw new Error(
      `${space.name} sleeps ${space.capacity}, but this stay is for ${partySize}.`,
    )

  const booked = await bookedSpaceIds(checkIn, checkOut, excludeReservationId)
  if (booked.has(spaceId))
    throw new Error(`${space.name} is already booked for those dates.`)

  return space
}
