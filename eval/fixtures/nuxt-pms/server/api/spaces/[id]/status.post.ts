import { setSpaceStatusInput } from '#shared/schemas'

// POST /api/spaces/:id/status — archive or restore a space.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const parsed = setSpaceStatusInput.safeParse(await readBody(event))
  if (!Number.isInteger(id) || !parsed.success) {
    const message = 'Invalid request.'
    throw createError({ statusCode: 422, message, data: { message } })
  }

  try {
    return setSpaceStatus(id, parsed.data.status)
  } catch (err) {
    throw toClientError(err)
  }
})
