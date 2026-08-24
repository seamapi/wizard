import { bookingInput } from '#shared/schemas'

// POST /api/book — create a reservation from the public booking form. The same
// schema that validated the form on the client re-validates here, and the space
// (if one was picked) is re-checked for availability so a race surfaces as a
// guest-readable error rather than a double booking.
export default defineEventHandler(async (event) => {
  const parsed = bookingInput.safeParse(await readBody(event))
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'That booking looks invalid.'
    throw createError({ statusCode: 422, message, data: { message } })
  }

  try {
    return createReservation(parsed.data)
  } catch (err) {
    throw toClientError(err)
  }
})
