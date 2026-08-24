// GET /api/spaces — every space, active first then alphabetical.
export default defineEventHandler(() => listSpaces())
