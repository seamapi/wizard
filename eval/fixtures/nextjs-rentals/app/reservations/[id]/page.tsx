import { getReservation } from '../../../lib/reservations'

// The existing reservation detail page. A Seam integration should surface the
// guest's access (e.g. the PIN code) here, not on a new standalone page.
export default function ReservationPage({
  params,
}: {
  params: { id: string }
}) {
  const reservation = getReservation(params.id)
  if (reservation == null) {
    return <main>Reservation not found.</main>
  }

  return (
    <main>
      <h1>Reservation {reservation.id}</h1>
      <p>Guest: {reservation.guestName}</p>
      <p>Unit: {reservation.unitId}</p>
      <p>
        {reservation.checkIn} → {reservation.checkOut}
      </p>
      <p>Status: {reservation.status}</p>
    </main>
  )
}
