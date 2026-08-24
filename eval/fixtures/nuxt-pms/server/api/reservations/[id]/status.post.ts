import { statusInput } from '#shared/schemas'

// POST /api/reservations/:id/status — change a reservation's status.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const parsed = statusInput.safeParse(await readBody(event))
  if (!Number.isInteger(id) || !parsed.success) {
    const message = 'Invalid request.'
    throw createError({ statusCode: 422, message, data: { message } })
  }

  try {
    return updateReservationStatus(id, parsed.data.status)
  } catch (err) {
    throw toClientError(err)
  }
})
