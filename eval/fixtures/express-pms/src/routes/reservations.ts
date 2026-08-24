import { Router } from 'express'

import { assertSpaceBookable } from '../availability.js'
import { db } from '../db.js'
import type { Reservation } from '../db.js'
import { listGuests, listReservations, listSpaces } from '../queries.js'
import { assignInput, statusInput } from '../schemas.js'

// The front desk: list reservations, change status, assign a space, delete.
// Also serves the derived guests page.
export const reservationsRouter = Router()

function getReservation(id: number): Reservation | undefined {
  return db.prepare<[number]>('SELECT * FROM reservations WHERE id = ?').get(id) as
    | Reservation
    | undefined
}

reservationsRouter.get('/reservations', (_req, res) => {
  res.render('reservations', {
    reservations: listReservations(),
    spaces: listSpaces(),
  })
})

reservationsRouter.get('/guests', (_req, res) => {
  res.render('guests', { guests: listGuests() })
})

reservationsRouter.post('/reservations/:id/status', (req, res) => {
  const id = Number(req.params.id)
  const parsed = statusInput.safeParse(req.body)
  const reservation = getReservation(id)
  if (!parsed.success || reservation == null) {
    res.redirect('/reservations')
    return
  }

  // Cancelling releases the space, so reviving a cancelled stay has to win its
  // space back — someone else may have taken it in the meantime.
  if (
    reservation.status === 'cancelled' &&
    parsed.data.status !== 'cancelled' &&
    reservation.space_id != null
  ) {
    try {
      assertSpaceBookable({
        spaceId: reservation.space_id,
        checkIn: reservation.check_in,
        checkOut: reservation.check_out,
        partySize: reservation.party_size,
        excludeReservationId: reservation.id,
      })
    } catch {
      res.redirect('/reservations')
      return
    }
  }

  db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run(
    parsed.data.status,
    id,
  )
  res.redirect('/reservations')
})

reservationsRouter.post('/reservations/:id/assign', (req, res) => {
  const id = Number(req.params.id)
  const parsed = assignInput.safeParse(req.body)
  const reservation = getReservation(id)
  if (!parsed.success || reservation == null) {
    res.redirect('/reservations')
    return
  }

  if (parsed.data.spaceId != null) {
    try {
      assertSpaceBookable({
        spaceId: parsed.data.spaceId,
        checkIn: reservation.check_in,
        checkOut: reservation.check_out,
        partySize: reservation.party_size,
        excludeReservationId: reservation.id,
      })
    } catch {
      res.redirect('/reservations')
      return
    }
  }

  db.prepare('UPDATE reservations SET space_id = ? WHERE id = ?').run(
    parsed.data.spaceId,
    id,
  )
  res.redirect('/reservations')
})

reservationsRouter.post('/reservations/:id/delete', (req, res) => {
  db.prepare('DELETE FROM reservations WHERE id = ?').run(Number(req.params.id))
  res.redirect('/reservations')
})
