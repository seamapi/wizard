import { Router } from 'express'

import { assertSpaceBookable } from '../availability.js'
import { db } from '../db.js'
import { listSpaces } from '../queries.js'
import { bookingInput } from '../schemas.js'

// The public booking flow: the landing page and the form that creates a stay.
export const bookingsRouter = Router()

bookingsRouter.get('/', (_req, res) => {
  const spaces = listSpaces().filter((space) => space.status === 'active')
  res.render('index', { spaces, error: null })
})

bookingsRouter.post('/book', (req, res) => {
  const parsed = bookingInput.safeParse(req.body)
  if (!parsed.success) {
    const spaces = listSpaces().filter((space) => space.status === 'active')
    res.status(422).render('index', {
      spaces,
      error: parsed.error.issues[0]?.message ?? 'That booking looks invalid.',
    })
    return
  }
  const data = parsed.data

  if (data.spaceId != null) {
    try {
      assertSpaceBookable({
        spaceId: data.spaceId,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        partySize: data.partySize,
      })
    } catch (error) {
      const spaces = listSpaces().filter((space) => space.status === 'active')
      res.status(409).render('index', {
        spaces,
        error: error instanceof Error ? error.message : 'Could not book that space.',
      })
      return
    }
  }

  db.prepare(
    `INSERT INTO reservations
       (guest_name, email, phone, check_in, check_out, party_size, notes, space_id)
     VALUES (@guestName, @email, @phone, @checkIn, @checkOut, @partySize, @notes, @spaceId)`,
  ).run({
    guestName: data.guestName,
    email: data.email,
    phone: data.phone,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    partySize: data.partySize,
    notes: data.notes ?? null,
    spaceId: data.spaceId,
  })

  res.redirect('/reservations')
})
