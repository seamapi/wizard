import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

import { SPACE_KINDS } from '@/lib/space-kinds'

/**
 * A bookable space (room, suite, cabin…). Spaces are archived rather than
 * deleted so past reservations keep pointing at something real.
 */
export const spaces = sqliteTable('spaces', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),

  name: text().notNull().unique(),
  kind: text({ enum: SPACE_KINDS }).notNull().default('room'),

  /** Maximum party size this space sleeps. */
  capacity: integer().notNull().default(2),
  /** Nightly rate in cents, or null when no rate has been set. */
  rateCents: integer('rate_cents'),

  status: text({ enum: ['active', 'archived'] })
    .notNull()
    .default('active'),
  notes: text(),

  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

/**
 * A single reservation. Guest contact details are stored inline (no separate
 * accounts / login) to keep the PMS minimal.
 */
export const reservations = sqliteTable('reservations', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),

  // Guest / user data
  guestName: text('guest_name').notNull(),
  email: text().notNull(),
  phone: text().notNull(),

  // Stay details
  checkIn: text('check_in').notNull(), // ISO date: YYYY-MM-DD
  checkOut: text('check_out').notNull(), // ISO date: YYYY-MM-DD
  partySize: integer('party_size').notNull().default(1),
  notes: text(),

  /**
   * Assigned space. Nullable: a stay can be taken before the front desk has
   * decided which space the guest gets.
   */
  spaceId: integer('space_id').references(() => spaces.id, {
    onDelete: 'set null',
  }),

  // Lifecycle
  status: text({ enum: ['pending', 'confirmed', 'cancelled'] })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
})

export type Reservation = typeof reservations.$inferSelect
export type NewReservation = typeof reservations.$inferInsert

export type Space = typeof spaces.$inferSelect
export type NewSpace = typeof spaces.$inferInsert
