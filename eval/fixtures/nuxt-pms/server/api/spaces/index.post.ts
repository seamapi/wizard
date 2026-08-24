import { spaceInput } from '#shared/schemas'

// POST /api/spaces — create a bookable space.
export default defineEventHandler(async (event) => {
  const parsed = spaceInput.safeParse(await readBody(event))
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'That space looks invalid.'
    throw createError({ statusCode: 422, message, data: { message } })
  }

  try {
    return createSpace(parsed.data)
  } catch (err) {
    throw toClientError(err)
  }
})
