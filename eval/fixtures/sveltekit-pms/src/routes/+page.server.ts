import { fail } from '@sveltejs/kit'

import { createReservation, listSpaceAvailability } from '$lib/server/actions'
import { listSpaces } from '$lib/server/queries'
import { bookingInput } from '$lib/schemas'
import type { Actions, PageServerLoad } from './$types'

/**
 * The booking form's availability picker depends on the chosen dates + party
 * size, which the page keeps in the URL query. The load re-runs whenever they
 * change, so availability is always computed on the server.
 */
export const load: PageServerLoad = ({ url }) => {
  const checkIn = url.searchParams.get('check_in') ?? ''
  const checkOut = url.searchParams.get('check_out') ?? ''
  const partySize = Number(url.searchParams.get('party_size') ?? '1') || 1

  const datesReady = checkIn !== '' && checkOut !== '' && checkOut > checkIn

  return {
    checkIn,
    checkOut,
    partySize,
    datesReady,
    spaces: datesReady
      ? listSpaceAvailability({ checkIn, checkOut, partySize })
      : [],
  }
}

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData()
    const values = {
      guestName: String(form.get('guestName') ?? ''),
      email: String(form.get('email') ?? ''),
      phone: String(form.get('phone') ?? ''),
      checkIn: String(form.get('checkIn') ?? ''),
      checkOut: String(form.get('checkOut') ?? ''),
      partySize: String(form.get('partySize') ?? '1'),
      notes: String(form.get('notes') ?? ''),
      spaceId: String(form.get('spaceId') ?? ''),
    }

    const parsed = bookingInput.safeParse({
      ...values,
      spaceId: values.spaceId === '' ? null : Number(values.spaceId),
    })
    if (!parsed.success) {
      return fail(400, { values, errors: fieldErrors(parsed.error.issues) })
    }

    try {
      const reservation = createReservation(parsed.data)
      const spaceName =
        reservation.spaceId === null
          ? null
          : (listSpaces().find((space) => space.id === reservation.spaceId)
              ?.name ?? null)

      return {
        success: true,
        reservation: {
          id: reservation.id,
          guestName: reservation.guestName,
          spaceName,
        },
      }
    } catch (err) {
      // Availability is re-checked here, so a race (someone booked the space
      // first) surfaces with a usable message.
      return fail(400, {
        values,
        formError:
          err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Please try again.',
      })
    }
  },
}

/** Collapse Zod issues to the first message per field. */
function fieldErrors(
  issues: Array<{ path: Array<PropertyKey>; message: string }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !out[key]) out[key] = issue.message
  }
  return out
}
