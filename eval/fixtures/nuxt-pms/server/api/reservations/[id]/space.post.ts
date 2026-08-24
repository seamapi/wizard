import { assignInput } from '#shared/schemas'

// POST /api/reservations/:id/space — assign, move, or clear a reservation's
// space. A null spaceId clears the assignment; a non-null one is re-checked for
// availability before it is applied.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const parsed = assignInput.safeParse(await readBody(event))
  if (!Number.isInteger(id) || !parsed.success) {
    const message = 'Invalid request.'
    throw createError({ statusCode: 422, message, data: { message } })
  }

  try {
    return assignReservationSpace(id, parsed.data.spaceId)
  } catch (err) {
    throw toClientError(err)
  }
})
