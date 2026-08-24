/** Shared form primitives, so the booking form and the spaces admin match. */

export const inputCls =
  'w-full rounded-xl border border-[var(--line)] bg-white/80 px-3.5 py-2.5 text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)]/60 focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[var(--lagoon)]/30'

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className='block'>
      <span className='mb-1.5 block text-sm font-semibold text-[var(--sea-ink)]'>
        {label}
      </span>
      {children}
      {error ? (
        <span className='mt-1 block text-sm text-[var(--destructive)]'>
          {error}
        </span>
      ) : null}
    </label>
  )
}
