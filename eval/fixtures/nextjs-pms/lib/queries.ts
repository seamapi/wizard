import 'server-only'

import { asc, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { reservations, spaces } from '@/db/schema'
import type { SpaceKind } from '@/lib/space-kinds'

/**
 * Server-only read queries, called directly from server components (the App
 * Router equivalent of the old route loaders).
 */

/** A reservation plus the display fields of its assigned space. */
export type ReservationRow = {
  id: number
  guestName: string
  email: string
  phone: string
  checkIn: string
  checkOut: string
  partySize: number
  notes: string | null
  spaceId: number | null
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: Date | null
  spaceName: string | null
  spaceKind: SpaceKind | null
}

/** All reservations, newest first, with the assigned space joined in. */
export async function listReservations(): Promise<Array<ReservationRow>> {
  const joined = await db
    .select({
      reservation: reservations,
      spaceName: spaces.name,
      spaceKind: spaces.kind,
    })
    .from(reservations)
    .leftJoin(spaces, eq(reservations.spaceId, spaces.id))
    .orderBy(desc(reservations.createdAt))

  return joined.map(({ reservation, spaceName, spaceKind }) => ({
    ...reservation,
    spaceName,
    spaceKind,
  }))
}

export type Guest = {
  name: string
  email: string
  phone: string
  reservationCount: number
}

/** Unique guests (deduped by email), with how many reservations each has. */
export async function listGuests(): Promise<Array<Guest>> {
  const all = await db
    .select()
    .from(reservations)
    .orderBy(desc(reservations.createdAt))

  const byEmail = new Map<string, Guest>()
  for (const reservation of all) {
    const key = reservation.email.trim().toLowerCase()
    const existing = byEmail.get(key)
    if (existing) {
      existing.reservationCount += 1
    } else {
      // rows are newest-first, so the first hit is the guest's latest details
      byEmail.set(key, {
        name: reservation.guestName,
        email: reservation.email,
        phone: reservation.phone,
        reservationCount: 1,
      })
    }
  }
  return [...byEmail.values()]
}

/** Every space, active first then alphabetical. */
export async function listSpaces() {
  return db.select().from(spaces).orderBy(asc(spaces.status), asc(spaces.name))
}
