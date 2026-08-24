import { z } from 'zod'

import { SPACE_KINDS } from '@/lib/space-kinds'

/**
 * Shared validation schemas. Kept free of any database import so they can be
 * used for inline validation in client components AND re-validation inside
 * server actions.
 */

/** Shape of the public booking form, validated on both client and server. */
export const bookingInput = z
  .object({
    guestName: z.string().trim().min(1, 'Please enter your name'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().min(5, 'Enter a valid phone number'),
    checkIn: z.string().min(1, 'Choose a check-in date'),
    checkOut: z.string().min(1, 'Choose a check-out date'),
    partySize: z.coerce.number().int().min(1).max(20),
    notes: z.string().trim().max(1000).optional(),
    /** null = let the front desk assign a space later. */
    spaceId: z.number().int().positive().nullable().default(null),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  })

export type BookingInput = z.infer<typeof bookingInput>

export const statusInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(['pending', 'confirmed', 'cancelled']),
})

export const assignInput = z.object({
  id: z.number().int().positive(),
  spaceId: z.number().int().positive().nullable(),
})

export const idInput = z.object({ id: z.number().int().positive() })

/** Shape of the space create / edit form, validated on both client and server. */
export const spaceInput = z.object({
  name: z.string().trim().min(1, 'Give the space a name').max(80),
  kind: z.enum(SPACE_KINDS),
  capacity: z.coerce.number().int().min(1, 'At least 1').max(40),
  /** Nightly rate in whole currency units; blank means "no rate set". */
  rate: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
})

export type SpaceInput = z.infer<typeof spaceInput>

export const spaceUpdateInput = spaceInput.extend({
  id: z.number().int().positive(),
})

export const setSpaceStatusInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(['active', 'archived']),
})

export const availabilityInput = z.object({
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  partySize: z.coerce.number().int().min(1),
})
