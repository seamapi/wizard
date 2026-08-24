import { listGuests } from '$lib/server/queries'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({
  guests: listGuests(),
})
