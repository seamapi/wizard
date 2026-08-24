import { z } from 'zod'

import { SPACE_KINDS } from './space-kinds'

// Shared validation schemas. Kept free of any database import so the same schema
// validates on the client (inline in the booking form) and on the server (in
// the route handlers). Coercions handle the string values HTML inputs produce.

// The public booking form.
export const bookingInput = z
  .object({
    guestName: z.string().trim().min(1, 'Please enter your name'),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().min(5, 'Enter a valid phone number'),
    checkIn: z.string().min(1, 'Choose a check-in date'),
    checkOut: z.string().min(1, 'Choose a check-out date'),
    partySize: z.coerce.number().int().min(1).max(20),
    notes: z.string().trim().max(1000).optional(),
    // Empty string (the "let the front desk assign a space later" option)
    // becomes null.
    spaceId: z
      .union([z.coerce.number().int().positive(), z.literal('')])
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .default(null),
  })
  .refine((value) => value.checkOut > value.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  })

export type BookingInput = z.infer<typeof bookingInput>

export const statusInput = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled']),
})

export const assignInput = z.object({
  spaceId: z
    .union([z.coerce.number().int().positive(), z.literal('')])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .default(null),
})

// The space create / edit form.
export const spaceInput = z.object({
  name: z.string().trim().min(1, 'Give the space a name').max(80),
  kind: z.enum(SPACE_KINDS),
  capacity: z.coerce.number().int().min(1, 'At least 1').max(40),
  // Nightly rate in whole currency units; blank means "no rate set".
  rate: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
})

export type SpaceInput = z.infer<typeof spaceInput>

export const setSpaceStatusInput = z.object({
  status: z.enum(['active', 'archived']),
})

// The availability check behind the booking form's space picker.
export const availabilityInput = z.object({
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  partySize: z.coerce.number().int().min(1),
})

export type AvailabilityInput = z.infer<typeof availabilityInput>
