import { fail } from '@sveltejs/kit'

import {
  assignReservationSpace,
  deleteReservation,
  updateReservationStatus,
} from '$lib/server/actions'
import { listReservations, listSpaces } from '$lib/server/queries'
import { assignInput, idInput, statusInput } from '$lib/schemas'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({
  reservations: listReservations(),
  spaces: listSpaces(),
})

export const actions: Actions = {
  updateStatus: async ({ request }) => {
    const form = await request.formData()
    const id = Number(form.get('id'))
    const parsed = statusInput.safeParse({
      id,
      status: String(form.get('status') ?? ''),
    })
    if (!parsed.success)
      return fail(400, { errorId: id, message: 'Invalid status change.' })

    try {
      updateReservationStatus(parsed.data)
      return { ok: true }
    } catch (err) {
      return rowError(id, err)
    }
  },

  assignSpace: async ({ request }) => {
    const form = await request.formData()
    const id = Number(form.get('id'))
    const raw = String(form.get('spaceId') ?? '')
    const parsed = assignInput.safeParse({
      id,
      spaceId: raw === '' ? null : Number(raw),
    })
    if (!parsed.success)
      return fail(400, { errorId: id, message: 'Invalid space selection.' })

    try {
      assignReservationSpace(parsed.data)
      return { ok: true }
    } catch (err) {
      return rowError(id, err)
    }
  },

  delete: async ({ request }) => {
    const form = await request.formData()
    const id = Number(form.get('id'))
    const parsed = idInput.safeParse({ id })
    if (!parsed.success)
      return fail(400, { errorId: id, message: 'Invalid reservation.' })

    try {
      deleteReservation(parsed.data)
      return { ok: true }
    } catch (err) {
      return rowError(id, err)
    }
  },
}

function rowError(id: number, err: unknown) {
  return fail(400, {
    errorId: id,
    message:
      err instanceof Error && err.message
        ? err.message
        : 'Something went wrong. Please try again.',
  })
}
