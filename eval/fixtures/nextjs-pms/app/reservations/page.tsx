import { listReservations, listSpaces } from '@/lib/queries'

import { ReservationsClient } from './reservations-client'

export const dynamic = 'force-dynamic'

export default async function ReservationsPage() {
  const [reservations, spaces] = await Promise.all([
    listReservations(),
    listSpaces(),
  ])

  return <ReservationsClient reservations={reservations} spaces={spaces} />
}
