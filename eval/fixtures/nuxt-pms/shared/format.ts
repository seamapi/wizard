// Nightly rate for display. Deterministic (no `Intl`/locale) so the
// server-rendered markup matches the client on hydration.
export function formatRate(rateCents: number | null): string | null {
  if (rateCents === null) return null
  const whole = Math.floor(rateCents / 100)
  const cents = rateCents % 100
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return cents === 0
    ? `$${grouped}`
    : `$${grouped}.${String(cents).padStart(2, '0')}`
}
