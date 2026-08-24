'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Field, inputCls } from '@/components/form'
import { formatRate } from '@/lib/format'
import { SPACE_KINDS, SPACE_KIND_LABELS } from '@/lib/space-kinds'
import { createSpace, setSpaceStatus, updateSpace } from '@/lib/actions'
import { spaceInput } from '@/lib/schemas'
import type { SpaceInput } from '@/lib/schemas'
import type { Space } from '@/db/schema'

type FormState = {
  name: string
  kind: Space['kind']
  capacity: string
  rate: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  kind: 'room',
  capacity: '2',
  rate: '',
  notes: '',
}

/** Form strings → the shape `spaceInput` expects. */
function toPayload(form: FormState) {
  return {
    name: form.name,
    kind: form.kind,
    capacity: form.capacity,
    rate: form.rate.trim() === '' ? null : form.rate,
    notes: form.notes.trim() === '' ? null : form.notes,
  }
}

function fieldErrors(issues: Array<{ path: Array<unknown>; message: string }>) {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !out[key]) out[key] = issue.message
  }
  return out
}

export function SpacesClient({ spaces }: { spaces: Array<Space> }) {
  const router = useRouter()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const active = spaces.filter((s) => s.status === 'active')
  const archived = spaces.filter((s) => s.status === 'archived')
  const beds = active.reduce((n, s) => n + s.capacity, 0)

  async function toggleStatus(space: Space) {
    setBusyId(space.id)
    try {
      await setSpaceStatus({
        id: space.id,
        status: space.status === 'active' ? 'archived' : 'active',
      })
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className='page-wrap py-12'>
      <div className='rise-in flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='island-kicker'>Inventory</p>
          <h1 className='display-title mt-2 text-4xl font-bold text-[var(--sea-ink)]'>
            Spaces
          </h1>
          <p className='mt-2 text-[var(--sea-ink-soft)]'>
            {active.length} bookable · sleeps {beds}
            {archived.length ? ` · ${archived.length} archived` : ''}
          </p>
        </div>
        <Link
          href='/reservations'
          className='rounded-xl border border-[var(--line)] bg-white/70 px-5 py-2.5 font-semibold text-[var(--sea-ink)] no-underline hover:bg-white'
        >
          View reservations
        </Link>
      </div>

      <SpaceForm
        title='Add a space'
        submitLabel='Add space'
        onSave={async (payload) => {
          await createSpace(payload)
        }}
      />

      {spaces.length === 0 ? (
        <div className='island-shell rise-in mt-8 rounded-2xl p-12 text-center text-[var(--sea-ink-soft)]'>
          No spaces yet. Add your first room above — guests can&apos;t be
          assigned one until you do.
        </div>
      ) : (
        <div className='rise-in mt-8 grid gap-4'>
          {spaces.map((space) =>
            editingId === space.id ? (
              <SpaceForm
                key={space.id}
                title={`Edit ${space.name}`}
                submitLabel='Save changes'
                initial={{
                  name: space.name,
                  kind: space.kind,
                  capacity: String(space.capacity),
                  rate:
                    space.rateCents === null
                      ? ''
                      : String(space.rateCents / 100),
                  notes: space.notes ?? '',
                }}
                onCancel={() => setEditingId(null)}
                onSave={async (payload) => {
                  await updateSpace({ ...payload, id: space.id })
                  setEditingId(null)
                }}
              />
            ) : (
              <SpaceCard
                key={space.id}
                space={space}
                busy={busyId === space.id}
                onEdit={() => setEditingId(space.id)}
                onToggleStatus={() => toggleStatus(space)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function SpaceCard({
  space,
  busy,
  onEdit,
  onToggleStatus,
}: {
  space: Space
  busy: boolean
  onEdit: () => void
  onToggleStatus: () => void
}) {
  const rate = formatRate(space.rateCents)
  const archived = space.status === 'archived'

  return (
    <article
      className={`feature-card rounded-2xl border border-[var(--line)] p-5 ${
        archived ? 'opacity-60' : ''
      }`}
    >
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <div className='flex flex-wrap items-center gap-3'>
            <h2 className='text-lg font-bold text-[var(--sea-ink)]'>
              {space.name}
            </h2>
            <span className='rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--kicker)]'>
              {SPACE_KIND_LABELS[space.kind]}
            </span>
            {archived ? (
              <span className='rounded-full border border-[var(--line)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--sea-ink-soft)]'>
                Archived
              </span>
            ) : null}
          </div>
          <div className='mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--sea-ink-soft)]'>
            <span>
              Sleeps {space.capacity} guest{space.capacity === 1 ? '' : 's'}
            </span>
            <span>{rate ? `${rate} / night` : 'No rate set'}</span>
          </div>
          {space.notes ? (
            <p className='mt-2 max-w-prose text-sm italic text-[var(--sea-ink-soft)]'>
              {space.notes}
            </p>
          ) : null}
        </div>

        <div className='flex shrink-0 flex-col items-end gap-2'>
          <button
            type='button'
            onClick={onEdit}
            className='rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink)] hover:bg-black/5'
          >
            Edit
          </button>
          <button
            type='button'
            disabled={busy}
            onClick={onToggleStatus}
            className='rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink-soft)] hover:bg-black/5 disabled:opacity-50'
          >
            {archived ? 'Restore' : 'Archive'}
          </button>
        </div>
      </div>
    </article>
  )
}

function SpaceForm({
  title,
  submitLabel,
  initial,
  onSave,
  onCancel,
}: {
  title: string
  submitLabel: string
  initial?: FormState
  onSave: (payload: SpaceInput) => Promise<void>
  onCancel?: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initial ?? emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const parsed = spaceInput.safeParse(toPayload(form))
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues))
      return
    }

    setSaving(true)
    try {
      await onSave(parsed.data)
      if (!initial) setForm(emptyForm)
      router.refresh()
    } catch (err) {
      setErrors({
        form:
          err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className='island-shell rise-in mt-8 space-y-5 rounded-2xl p-6 sm:p-8'
      noValidate
    >
      <h2 className='display-title text-xl font-bold text-[var(--sea-ink)]'>
        {title}
      </h2>

      <div className='grid gap-5 sm:grid-cols-2'>
        <Field label='Name' error={errors.name}>
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder='Seagrass Suite'
          />
        </Field>
        <Field label='Kind' error={errors.kind}>
          <select
            className={inputCls}
            value={form.kind}
            onChange={(e) => set('kind', e.target.value as FormState['kind'])}
          >
            {SPACE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {SPACE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className='grid gap-5 sm:grid-cols-2'>
        <Field label='Sleeps' error={errors.capacity}>
          <input
            className={inputCls}
            type='number'
            min={1}
            max={40}
            value={form.capacity}
            onChange={(e) => set('capacity', e.target.value)}
          />
        </Field>
        <Field label='Nightly rate (optional)' error={errors.rate}>
          <input
            className={inputCls}
            type='number'
            min={0}
            step='0.01'
            value={form.rate}
            onChange={(e) => set('rate', e.target.value)}
            placeholder='240'
          />
        </Field>
      </div>

      <Field label='Notes (optional)' error={errors.notes}>
        <textarea
          className={`${inputCls} min-h-20 resize-y`}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder='Ocean view, walk-in shower, ground floor…'
        />
      </Field>

      {errors.form ? (
        <p className='text-sm font-medium text-[var(--destructive)]'>
          {errors.form}
        </p>
      ) : null}

      <div className='flex gap-3'>
        <button
          type='submit'
          disabled={saving}
          className='rounded-xl bg-[var(--lagoon-deep)] px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60'
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button
            type='button'
            onClick={onCancel}
            className='rounded-xl border border-[var(--line)] px-6 py-3 font-semibold text-[var(--sea-ink)] hover:bg-black/5'
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
