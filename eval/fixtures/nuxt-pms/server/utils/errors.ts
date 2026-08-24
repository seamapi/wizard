// Turn a caught Error (typically from `assertSpaceBookable` or a unique-name
// collision) into an h3 error with a 400 status and a guest-readable message.
// The message is placed both at the top level and under `data` so the client
// helper `messageFromError` can read it back off `error.data.message`.
export function toClientError(err: unknown) {
  const message =
    err instanceof Error ? err.message : 'Something went wrong. Please try again.'
  return createError({ statusCode: 400, message, data: { message } })
}
