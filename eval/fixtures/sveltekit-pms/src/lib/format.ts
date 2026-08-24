/**
 * Nightly rate for display. Deterministic (no `Intl`/locale) so the
 * server-rendered markup matches the client on hydration.
 */
export function formatRate(rateCents: number | null): string | null {
  if (rateCents === null) return null
  const whole = Math.floor(rateCents / 100)
  const cents = rateCents % 100
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return cents === 0
    ? `$${grouped}`
    : `$${grouped}.${String(cents).padStart(2, '0')}`
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Format an ISO `YYYY-MM-DD` date without `new Date`/locale so the
 * server-rendered markup matches the client on hydration.
 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/** Whole nights between two ISO dates (half-open interval). */
export function nights(checkIn: string, checkOut: string): number {
  const toUtc = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.max(
    0,
    Math.round((toUtc(checkOut) - toUtc(checkIn)) / 86_400_000),
  )
}
