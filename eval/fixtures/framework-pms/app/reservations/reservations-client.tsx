'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { SPACE_KIND_LABELS } from '@/lib/space-kinds'
import {
  assignReservationSpace,
  deleteReservation,
  updateReservationStatus,
} from '@/lib/actions'
import type { ReservationRow } from '@/lib/queries'
import type { Space } from '@/db/schema'

type Status = ReservationRow['status']

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: {
    label: 'Pending',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  confirmed: {
    label: 'Confirmed',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'bg-rose-100 text-rose-700 border-rose-200',
  },
}

export function ReservationsClient({
  reservations,
  spaces,
}: {
  reservations: Array<ReservationRow>
  spaces: Array<Space>
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rowError, setRowError] = useState<{
    id: number
    message: string
  } | null>(null)

  const upcoming = reservations.filter((r) => r.status !== 'cancelled').length
  const unassigned = reservations.filter(
    (r) => r.status !== 'cancelled' && r.spaceId === null,
  ).length

  /** Run a mutation for one row, surfacing its error inline. */
  async function run(id: number, action: () => Promise<unknown>) {
    setBusyId(id)
    setRowError(null)
    try {
      await action()
      router.refresh()
    } catch (err) {
      setRowError({
        id,
        message:
          err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const setStatus = (id: number, status: Status) =>
    run(id, () => updateReservationStatus({ id, status }))

  const setSpace = (id: number, spaceId: number | null) =>
    run(id, () => assignReservationSpace({ id, spaceId }))

  function remove(id: number) {
    if (!confirm(`Delete reservation #${id}? This cannot be undone.`)) return
    return run(id, () => deleteReservation({ id }))
  }

  return (
    <div className='page-wrap py-12'>
      <div className='rise-in flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='island-kicker'>Front desk</p>
          <h1 className='display-title mt-2 text-4xl font-bold text-[var(--sea-ink)]'>
            Reservations
          </h1>
          <p className='mt-2 text-[var(--sea-ink-soft)]'>
            {reservations.length} total · {upcoming} active
            {unassigned ? ` · ${unassigned} awaiting a space` : ''}
          </p>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Link
            href='/spaces'
            className='rounded-xl border border-[var(--line)] bg-white/70 px-5 py-2.5 font-semibold text-[var(--sea-ink)] no-underline hover:bg-white'
          >
            Manage spaces
          </Link>
          <Link
            href='/guests'
            className='rounded-xl border border-[var(--line)] bg-white/70 px-5 py-2.5 font-semibold text-[var(--sea-ink)] no-underline hover:bg-white'
          >
            See all guests
          </Link>
          <Link
            href='/'
            className='rounded-xl bg-[var(--lagoon-deep)] px-5 py-2.5 font-semibold !text-white no-underline hover:opacity-90'
          >
            + New reservation
          </Link>
        </div>
      </div>

      {reservations.length === 0 ? (
        <div className='island-shell rise-in mt-8 rounded-2xl p-12 text-center text-[var(--sea-ink-soft)]'>
          No reservations yet. Once guests book, they&apos;ll show up here.
        </div>
      ) : (
        <div className='rise-in mt-8 grid gap-4'>
          {reservations.map((r) => (
            <article
              key={r.id}
              className='feature-card rounded-2xl border border-[var(--line)] p-5'
            >
              <div className='flex flex-wrap items-start justify-between gap-4'>
                <div>
                  <div className='flex flex-wrap items-center gap-3'>
                    <h2 className='text-lg font-bold text-[var(--sea-ink)]'>
                      {r.guestName}
                    </h2>
                    <StatusBadge status={r.status} />
                    <span className='text-sm text-[var(--sea-ink-soft)]'>
                      #{r.id}
                    </span>
                  </div>
                  <div className='mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--sea-ink-soft)]'>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                    <a href={`tel:${r.phone}`}>{r.phone}</a>
                    <span>
                      {r.partySize} guest{r.partySize === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className='mt-2 text-sm font-medium text-[var(--sea-ink)]'>
                    {fmt(r.checkIn)} → {fmt(r.checkOut)}{' '}
                    <span className='font-normal text-[var(--sea-ink-soft)]'>
                      ({nights(r.checkIn, r.checkOut)} night
                      {nights(r.checkIn, r.checkOut) === 1 ? '' : 's'})
                    </span>
                  </p>
                  {r.notes ? (
                    <p className='mt-2 max-w-prose text-sm italic text-[var(--sea-ink-soft)]'>
                      “{r.notes}”
                    </p>
                  ) : null}

                  <SpaceSelect
                    reservation={r}
                    spaces={spaces}
                    busy={busyId === r.id}
                    onChange={(spaceId) => setSpace(r.id, spaceId)}
                  />

                  {rowError?.id === r.id ? (
                    <p className='mt-2 text-sm font-medium text-[var(--destructive)]'>
                      {rowError.message}
                    </p>
                  ) : null}
                </div>

                <div className='flex shrink-0 flex-col items-end gap-2'>
                  {r.status !== 'confirmed' ? (
                    <button
                      type='button'
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, 'confirmed')}
                      className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50'
                    >
                      Confirm
                    </button>
                  ) : null}
                  {r.status !== 'cancelled' ? (
                    <button
                      type='button'
                      disabled={busyId === r.id}
                      onClick={() => setStatus(r.id, 'cancelled')}
                      className='rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink-soft)] hover:bg-black/5 disabled:opacity-50'
                    >
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type='button'
                    disabled={busyId === r.id}
                    onClick={() => remove(r.id)}
                    className='rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--destructive)] hover:bg-rose-50 disabled:opacity-50'
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function SpaceSelect({
  reservation,
  spaces,
  busy,
  onChange,
}: {
  reservation: ReservationRow
  spaces: Array<Space>
  busy: boolean
  onChange: (spaceId: number | null) => void
}) {
  // Archived spaces stay selectable only where they're already assigned, so an
  // existing booking isn't silently reassigned by rendering the dropdown.
  const options = spaces.filter(
    (s) => s.status === 'active' || s.id === reservation.spaceId,
  )

  return (
    <div className='mt-3 flex flex-wrap items-center gap-2'>
      <span className='island-kicker'>Space</span>
      <select
        value={reservation.spaceId === null ? '' : String(reservation.spaceId)}
        disabled={busy}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className='rounded-lg border border-[var(--line)] bg-white/80 px-2.5 py-1.5 text-sm font-semibold text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon-deep)] disabled:opacity-50'
      >
        <option value=''>Unassigned</option>
        {options.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name} · {SPACE_KIND_LABELS[s.kind]} · sleeps {s.capacity}
            {s.status === 'archived' ? ' (archived)' : ''}
          </option>
        ))}
      </select>
      {reservation.spaceId === null ? (
        <span className='text-sm text-[var(--sea-ink-soft)]'>
          Not assigned yet
        </span>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${meta.cls}`}
    >
      {meta.label}
    </span>
  )
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

// Deterministic formatting (no locale / no `new Date`) so the server-rendered
// markup matches the client on hydration.
function fmt(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

function nights(checkIn: string, checkOut: string) {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.max(
    0,
    Math.round((toUtc(checkOut) - toUtc(checkIn)) / 86_400_000),
  )
}
