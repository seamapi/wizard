// DELETE /api/reservations/:id — delete a reservation.
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    const message = 'Invalid reservation id.'
    throw createError({ statusCode: 422, message, data: { message } })
  }
  return deleteReservation(id)
})
