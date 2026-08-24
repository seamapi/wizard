import { spaceInput } from '#shared/schemas'

// PUT /api/spaces/:id — edit a space's details.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const parsed = spaceInput.safeParse(await readBody(event))
  if (!Number.isInteger(id) || !parsed.success) {
    const message = parsed.success
      ? 'Invalid space id.'
      : (parsed.error.issues[0]?.message ?? 'That space looks invalid.')
    throw createError({ statusCode: 422, message, data: { message } })
  }

  try {
    return updateSpace(id, parsed.data)
  } catch (err) {
    throw toClientError(err)
  }
})
