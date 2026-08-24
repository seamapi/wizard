import type { Space } from '#shared/types'

// Availability helpers shared by booking and front-desk reassignment.

// Reservations hold a space for the half-open interval [checkIn, checkOut), so a
// same-day turnover (one guest out, the next in) is not a conflict. Cancelled
// reservations release the space. ISO YYYY-MM-DD sorts lexicographically, so the
// text comparison below is a date comparison.
export function bookedSpaceIds(
  checkIn: string,
  checkOut: string,
  excludeReservationId?: number,
): Set<number> {
  const held = useDb()
    .prepare(
      `SELECT space_id FROM reservations
       WHERE space_id IS NOT NULL
         AND status != 'cancelled'
         AND check_in < ?
         AND check_out > ?
         AND id != ?`,
    )
    .all(checkOut, checkIn, excludeReservationId ?? -1) as Array<{
    space_id: number
  }>

  return new Set(held.map((row) => row.space_id))
}

// Assert a space can take a stay, throwing a guest-readable message if not.
// Used by both booking and front-desk reassignment.
export function assertSpaceBookable(args: {
  spaceId: number
  checkIn: string
  checkOut: string
  partySize: number
  excludeReservationId?: number
}): Space {
  const { spaceId, checkIn, checkOut, partySize, excludeReservationId } = args

  const space = getSpace(spaceId)
  if (space == null) throw new Error('That space no longer exists.')
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
