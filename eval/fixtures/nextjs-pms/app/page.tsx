'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Field, inputCls } from '@/components/form'
import { formatRate } from '@/lib/format'
import { SPACE_KIND_LABELS } from '@/lib/space-kinds'
import { createReservation, listSpaceAvailability } from '@/lib/actions'
import type { SpaceAvailability } from '@/lib/actions'
import { bookingInput } from '@/lib/schemas'

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  guestName: '',
  email: '',
  phone: '',
  checkIn: '',
  checkOut: '',
  partySize: '1',
  notes: '',
  /** '' = let the front desk assign a space later. */
  spaceId: '',
}

export default function Home() {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<{
    id: number
    guestName: string
    spaceName: string | null
  } | null>(null)

  const [availability, setAvailability] = useState<Array<SpaceAvailability>>([])
  const [loadingSpaces, setLoadingSpaces] = useState(false)

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const partySize = Number(form.partySize) || 1
  const datesReady =
    form.checkIn !== '' && form.checkOut !== '' && form.checkOut > form.checkIn

  // Availability depends on the dates and the party size, so re-check whenever
  // any of them change.
  useEffect(() => {
    if (!datesReady) {
      setAvailability([])
      return
    }
    let stale = false
    setLoadingSpaces(true)
    listSpaceAvailability({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      partySize,
    })
      .then((rows) => {
        if (!stale) setAvailability(rows)
      })
      .catch(() => {
        if (!stale) setAvailability([])
      })
      .finally(() => {
        if (!stale) setLoadingSpaces(false)
      })
    return () => {
      stale = true
    }
  }, [datesReady, form.checkIn, form.checkOut, partySize])

  // Drop a pick that the latest dates / party size made unbookable.
  useEffect(() => {
    if (form.spaceId === '') return
    const picked = availability.find((s) => String(s.id) === form.spaceId)
    if (!picked || !picked.available) setForm((f) => ({ ...f, spaceId: '' }))
  }, [availability, form.spaceId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const parsed = bookingInput.safeParse({
      ...form,
      spaceId: form.spaceId === '' ? null : Number(form.spaceId),
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !fieldErrors[key])
          fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    const pickedName =
      availability.find((s) => s.id === parsed.data.spaceId)?.name ?? null

    setSubmitting(true)
    try {
      const row = await createReservation(parsed.data)
      setConfirmed({
        id: row.id,
        guestName: row.guestName,
        spaceName: pickedName,
      })
      setForm(emptyForm)
      router.refresh()
    } catch (err) {
      // Availability is checked again on the server, so a race (someone booked
      // the space first) surfaces here with a usable message.
      setErrors({
        form:
          err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmed) {
    return (
      <div className='page-wrap py-16'>
        <div className='island-shell rise-in mx-auto max-w-xl rounded-2xl p-10 text-center'>
          <div className='mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[var(--palm)] text-2xl text-white'>
            ✓
          </div>
          <p className='island-kicker'>Reservation received</p>
          <h1 className='display-title mt-2 text-3xl font-bold text-[var(--sea-ink)]'>
            Thanks, {confirmed.guestName}!
          </h1>
          <p className='mt-3 text-[var(--sea-ink-soft)]'>
            Your reservation{' '}
            <span className='font-semibold text-[var(--sea-ink)]'>
              #{confirmed.id}
            </span>{' '}
            is pending confirmation.{' '}
            {confirmed.spaceName ? (
              <>
                We&apos;re holding{' '}
                <span className='font-semibold text-[var(--sea-ink)]'>
                  {confirmed.spaceName}
                </span>{' '}
                for you.{' '}
              </>
            ) : null}
            We&apos;ll be in touch by email shortly.
          </p>
          <button
            type='button'
            onClick={() => setConfirmed(null)}
            className='mt-8 rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 font-semibold text-white hover:opacity-90'
          >
            Book another stay
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='page-wrap py-12'>
      <div className='rise-in mx-auto max-w-2xl'>
        <p className='island-kicker'>Reserve your stay</p>
        <h1 className='display-title mt-2 text-4xl font-bold text-[var(--sea-ink)]'>
          Book a reservation
        </h1>
        <p className='mt-3 max-w-lg text-[var(--sea-ink-soft)]'>
          Tell us who&apos;s coming and when. No account needed — just your
          details.
        </p>

        <form
          onSubmit={onSubmit}
          className='island-shell mt-8 space-y-5 rounded-2xl p-6 sm:p-8'
          noValidate
        >
          <Field label='Full name' error={errors.guestName}>
            <input
              className={inputCls}
              value={form.guestName}
              onChange={(e) => set('guestName')(e.target.value)}
              placeholder='Jane Traveler'
              autoComplete='name'
            />
          </Field>

          <div className='grid gap-5 sm:grid-cols-2'>
            <Field label='Email' error={errors.email}>
              <input
                className={inputCls}
                type='email'
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                placeholder='jane@example.com'
                autoComplete='email'
              />
            </Field>
            <Field label='Phone' error={errors.phone}>
              <input
                className={inputCls}
                type='tel'
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value)}
                placeholder='+1 555 123 4567'
                autoComplete='tel'
              />
            </Field>
          </div>

          <div className='grid gap-5 sm:grid-cols-3'>
            <Field label='Check-in' error={errors.checkIn}>
              <input
                className={inputCls}
                type='date'
                min={today()}
                value={form.checkIn}
                onChange={(e) => set('checkIn')(e.target.value)}
              />
            </Field>
            <Field label='Check-out' error={errors.checkOut}>
              <input
                className={inputCls}
                type='date'
                min={form.checkIn || today()}
                value={form.checkOut}
                onChange={(e) => set('checkOut')(e.target.value)}
              />
            </Field>
            <Field label='Guests' error={errors.partySize}>
              <input
                className={inputCls}
                type='number'
                min={1}
                max={20}
                value={form.partySize}
                onChange={(e) => set('partySize')(e.target.value)}
              />
            </Field>
          </div>

          <SpacePicker
            datesReady={datesReady}
            loading={loadingSpaces}
            availability={availability}
            selected={form.spaceId}
            onSelect={set('spaceId')}
          />

          <Field label='Notes (optional)' error={errors.notes}>
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder='Anything we should know? Arrival time, accessibility needs…'
            />
          </Field>

          {errors.form ? (
            <p className='text-sm font-medium text-[var(--destructive)]'>
              {errors.form}
            </p>
          ) : null}

          <button
            type='submit'
            disabled={submitting}
            className='w-full rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60'
          >
            {submitting ? 'Sending…' : 'Request reservation'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SpacePicker({
  datesReady,
  loading,
  availability,
  selected,
  onSelect,
}: {
  datesReady: boolean
  loading: boolean
  availability: Array<SpaceAvailability>
  selected: string
  onSelect: (value: string) => void
}) {
  const openCount = availability.filter((s) => s.available).length

  return (
    <fieldset className='block'>
      <legend className='mb-1.5 block text-sm font-semibold text-[var(--sea-ink)]'>
        Space{' '}
        <span className='font-normal text-[var(--sea-ink-soft)]'>
          {datesReady && !loading && availability.length > 0
            ? `— ${openCount} of ${availability.length} open`
            : '(optional)'}
        </span>
      </legend>

      {!datesReady ? (
        <p className='rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-sm text-[var(--sea-ink-soft)]'>
          Pick your dates to see what&apos;s available.
        </p>
      ) : loading ? (
        <p className='rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-sm text-[var(--sea-ink-soft)]'>
          Checking availability…
        </p>
      ) : availability.length === 0 ? (
        <p className='rounded-xl border border-dashed border-[var(--line)] px-3.5 py-3 text-sm text-[var(--sea-ink-soft)]'>
          No spaces are set up yet — we&apos;ll assign one and confirm by email.
        </p>
      ) : (
        <div className='grid gap-2'>
          {availability.map((space) => {
            const rate = formatRate(space.rateCents)
            const isSelected = selected === String(space.id)
            return (
              <label
                key={space.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 ${
                  isSelected
                    ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon)]/10'
                    : 'border-[var(--line)] bg-white/60 hover:bg-white/90'
                } ${space.available ? '' : 'cursor-not-allowed opacity-55'}`}
              >
                <input
                  type='radio'
                  name='spaceId'
                  className='size-4 accent-[var(--lagoon-deep)]'
                  value={String(space.id)}
                  checked={isSelected}
                  disabled={!space.available}
                  onChange={() => onSelect(String(space.id))}
                />
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-semibold text-[var(--sea-ink)]'>
                    {space.name}{' '}
                    <span className='font-normal text-[var(--sea-ink-soft)]'>
                      · {SPACE_KIND_LABELS[space.kind]} · sleeps{' '}
                      {space.capacity}
                    </span>
                  </span>
                  {space.reason ? (
                    <span className='block text-xs font-medium text-[var(--sea-ink-soft)]'>
                      {space.reason}
                    </span>
                  ) : null}
                </span>
                {rate ? (
                  <span className='shrink-0 text-sm font-semibold text-[var(--sea-ink)]'>
                    {rate}
                    <span className='font-normal text-[var(--sea-ink-soft)]'>
                      /night
                    </span>
                  </span>
                ) : null}
              </label>
            )
          })}

          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 ${
              selected === ''
                ? 'border-[var(--lagoon-deep)] bg-[var(--lagoon)]/10'
                : 'border-[var(--line)] bg-white/60 hover:bg-white/90'
            }`}
          >
            <input
              type='radio'
              name='spaceId'
              className='size-4 accent-[var(--lagoon-deep)]'
              value=''
              checked={selected === ''}
              onChange={() => onSelect('')}
            />
            <span className='text-sm font-semibold text-[var(--sea-ink)]'>
              No preference{' '}
              <span className='font-normal text-[var(--sea-ink-soft)]'>
                — let the front desk choose
              </span>
            </span>
          </label>
        </div>
      )}
    </fieldset>
  )
}
