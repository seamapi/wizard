/**
 * The kinds of bookable space a property can offer, plus their labels.
 *
 * Kept free of any database import so both `+page.svelte` views and the
 * server-only query layer can share it.
 */
export const SPACE_KINDS = [
  'room',
  'suite',
  'cabin',
  'villa',
  'tent',
  'other',
] as const

export type SpaceKind = (typeof SPACE_KINDS)[number]

export const SPACE_KIND_LABELS: Record<SpaceKind, string> = {
  room: 'Room',
  suite: 'Suite',
  cabin: 'Cabin',
  villa: 'Villa',
  tent: 'Tent',
  other: 'Space',
}
