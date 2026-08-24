import { fail } from '@sveltejs/kit'

import { createSpace, setSpaceStatus, updateSpace } from '$lib/server/actions'
import { listSpaces } from '$lib/server/queries'
import { setSpaceStatusInput, spaceInput, spaceUpdateInput } from '$lib/schemas'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({
  spaces: listSpaces(),
})

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData()
    const values = spaceValues(form)
    const parsed = spaceInput.safeParse(values)
    if (!parsed.success)
      return fail(400, {
        form: 'create',
        values,
        errors: fieldErrors(parsed.error.issues),
      })

    try {
      createSpace(parsed.data)
      return { ok: true }
    } catch (err) {
      return fail(400, { form: 'create', values, formError: message(err) })
    }
  },

  update: async ({ request }) => {
    const form = await request.formData()
    const id = Number(form.get('id'))
    const values = spaceValues(form)
    const parsed = spaceUpdateInput.safeParse({ ...values, id })
    if (!parsed.success)
      return fail(400, {
        form: 'update',
        id,
        values,
        errors: fieldErrors(parsed.error.issues),
      })

    try {
      updateSpace(parsed.data)
      return { ok: true }
    } catch (err) {
      return fail(400, { form: 'update', id, values, formError: message(err) })
    }
  },

  setStatus: async ({ request }) => {
    const form = await request.formData()
    const parsed = setSpaceStatusInput.safeParse({
      id: Number(form.get('id')),
      status: String(form.get('status') ?? ''),
    })
    if (!parsed.success) return fail(400, { formError: 'Invalid status change.' })

    setSpaceStatus(parsed.data)
    return { ok: true }
  },
}

/** Pull the space form fields off `FormData` into the shape `spaceInput` wants. */
function spaceValues(form: FormData) {
  const rate = String(form.get('rate') ?? '').trim()
  const notes = String(form.get('notes') ?? '').trim()
  return {
    name: String(form.get('name') ?? ''),
    kind: String(form.get('kind') ?? ''),
    capacity: String(form.get('capacity') ?? ''),
    rate: rate === '' ? null : rate,
    notes: notes === '' ? null : notes,
  }
}

function message(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : 'Something went wrong. Please try again.'
}

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
