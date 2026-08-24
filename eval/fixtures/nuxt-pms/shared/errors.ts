// Pull a guest-readable message out of a failed `$fetch` call. The server
// routes throw `createError({ statusCode, message })`, which h3 serializes into
// the response body — so on the client the message lands on `error.data.message`.
export function messageFromError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (err != null && typeof err === 'object') {
    const data = (err as { data?: { message?: unknown } }).data
    if (data != null && typeof data.message === 'string' && data.message !== '')
      return data.message

    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message !== '') return message
  }
  return fallback
}
