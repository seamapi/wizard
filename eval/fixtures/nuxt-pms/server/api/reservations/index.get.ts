// GET /api/reservations — all reservations, newest first, with the assigned
// space joined in. This is the front-desk list.
export default defineEventHandler(() => listReservations())
