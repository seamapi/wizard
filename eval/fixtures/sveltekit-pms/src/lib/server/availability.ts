import { db } from '$lib/server/db'
import type { Space } from '$lib/server/db'

/**
 * Availability helpers shared by booking and the front desk.
 *
 * Reservations hold a space for the half-open interval [checkIn, checkOut), so
 * a same-day turnover (one guest out, the next in) is not a conflict. Cancelled
 * reservations release the space. ISO `YYYY-MM-DD` dates sort lexicographically,
 * so a text compare is a date compare.
 */

/** Space ids already held for the given range, excluding one reservation. */
export function bookedSpaceIds(
  checkIn: string,
  checkOut: string,
  excludeReservationId?: number,
): Set<number> {
  let sql = `
    SELECT DISTINCT space_id AS spaceId
    FROM reservations
    WHERE space_id IS NOT NULL
      AND status != 'cancelled'
      AND check_in < ?
      AND check_out > ?
  `
  const params: Array<string | number> = [checkOut, checkIn]

  if (excludeReservationId !== undefined) {
    sql += ' AND id != ?'
    params.push(excludeReservationId)
  }

  const held = db.prepare(sql).all(...params) as Array<{ spaceId: number }>
  return new Set(held.map((row) => row.spaceId))
}

/**
 * Assert a space can take a stay, throwing a guest-readable message if not.
 * Used by both booking and front-desk reassignment.
 */
export function assertSpaceBookable({
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
}): Space {
  const space = db
    .prepare(
      `SELECT id, name, kind, capacity, rate_cents AS rateCents, status, notes,
              created_at AS createdAt
       FROM spaces WHERE id = ?`,
    )
    .get(spaceId) as Space | undefined

  if (!space) throw new Error('That space no longer exists.')
  if (space.status !== 'active')
    throw new Error(`${space.name} is archived and can't be booked.`)
  if (partySize > space.capacity)
    throw new Error(
      `${space.name} sleeps ${space.capacity}, but this stay is for ${partySize}.`,
    )

  const booked = bookedSpaceIds(checkIn, checkOut, excludeReservationId)
  if (booked.has(spaceId))
    throw new Error(`${space.name} is already booked for those dates.`)

  return space
}
