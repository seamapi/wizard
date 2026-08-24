// GET /api/guests — unique guests, deduped by email, with a reservation count.
export default defineEventHandler(() => listGuests())
