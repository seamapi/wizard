import { availabilityInput } from '#shared/schemas'

// GET /api/spaces/availability?checkIn=&checkOut=&partySize= — active spaces
// annotated with whether they can take the given stay. Returns an empty list
// for an incomplete query so the booking form can call it freely as the user
// fills in dates.
export default defineEventHandler((event) => {
  const parsed = availabilityInput.safeParse(getQuery(event))
  if (!parsed.success) return []
  return listSpaceAvailability(parsed.data)
})
