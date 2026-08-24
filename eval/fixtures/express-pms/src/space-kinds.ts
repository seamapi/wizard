// The kinds of bookable space a property can offer, plus their display labels.

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
