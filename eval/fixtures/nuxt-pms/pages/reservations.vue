<script setup lang="ts">
import { computed, ref } from 'vue'

import { messageFromError } from '#shared/errors'
import { SPACE_KIND_LABELS } from '#shared/space-kinds'
import type {
  ReservationRow,
  ReservationStatus,
  Space,
} from '#shared/types'

useHead({ title: 'Harbor PMS · Reservations' })

// The front desk: every reservation with its guest, status, dates, and assigned
// space. This is where a smart-lock integration would later surface access for a
// stay — issuing a PIN or a mobile key once a reservation is confirmed.
const { data: reservationsData, refresh: refreshReservations } = await useFetch<
  ReservationRow[]
>('/api/reservations', { default: () => [] })
const { data: spacesData } = await useFetch<Space[]>('/api/spaces', {
  default: () => [],
})

const reservations = computed(() => reservationsData.value ?? [])
const spaces = computed(() => spacesData.value ?? [])

const busyId = ref<number | null>(null)
const rowError = ref<{ id: number; message: string } | null>(null)

const upcoming = computed(
  () => reservations.value.filter((r) => r.status !== 'cancelled').length,
)
const unassigned = computed(
  () =>
    reservations.value.filter(
      (r) => r.status !== 'cancelled' && r.space_id === null,
    ).length,
)

const STATUS_META: Record<ReservationStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'badge-pending' },
  confirmed: { label: 'Confirmed', cls: 'badge-confirmed' },
  cancelled: { label: 'Cancelled', cls: 'badge-cancelled' },
}

// Run a mutation for one row, surfacing its error inline.
async function run(id: number, action: () => Promise<unknown>) {
  busyId.value = id
  rowError.value = null
  try {
    await action()
    await refreshReservations()
  } catch (err) {
    rowError.value = { id, message: messageFromError(err) }
  } finally {
    busyId.value = null
  }
}

function setStatus(id: number, status: ReservationStatus) {
  return run(id, () =>
    $fetch(`/api/reservations/${id}/status`, { method: 'POST', body: { status } }),
  )
}

function setSpace(id: number, spaceId: number | null) {
  return run(id, () =>
    $fetch(`/api/reservations/${id}/space`, {
      method: 'POST',
      body: { spaceId },
    }),
  )
}

function onSpaceChange(id: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  setSpace(id, value === '' ? null : Number(value))
}

function remove(id: number) {
  if (!window.confirm(`Delete reservation #${id}? This cannot be undone.`))
    return
  return run(id, () =>
    $fetch(`/api/reservations/${id}`, { method: 'DELETE' }),
  )
}

// Archived spaces stay selectable only where they're already assigned, so an
// existing booking isn't silently reassigned by rendering the dropdown.
function spaceOptions(reservation: ReservationRow): Space[] {
  return spaces.value.filter(
    (space) => space.status === 'active' || space.id === reservation.space_id,
  )
}

// Deterministic formatting (no locale) so SSR and client markup match.
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
  return Math.max(0, Math.round((toUtc(checkOut) - toUtc(checkIn)) / 86_400_000))
}
</script>

<template>
  <div class="page page-wrap">
    <div class="page-head">
      <div>
        <p class="kicker">Front desk</p>
        <h1 class="title">Reservations</h1>
        <p class="subtitle">
          {{ reservations.length }} total · {{ upcoming }} active<template
            v-if="unassigned"
          >
            · {{ unassigned }} awaiting a space</template
          >
        </p>
      </div>
      <div class="actions-row">
        <NuxtLink to="/spaces" class="btn btn-ghost">Manage spaces</NuxtLink>
        <NuxtLink to="/guests" class="btn btn-ghost">See all guests</NuxtLink>
        <NuxtLink to="/" class="btn btn-primary">+ New reservation</NuxtLink>
      </div>
    </div>

    <div v-if="reservations.length === 0" class="panel empty">
      No reservations yet. Once guests book, they'll show up here.
    </div>

    <div v-else class="stack" style="margin-top: 2rem">
      <article v-for="r in reservations" :key="r.id" class="card">
        <div class="card-head">
          <div>
            <div class="chip-row">
              <h2 class="card-title">{{ r.guest_name }}</h2>
              <span class="badge" :class="STATUS_META[r.status].cls">
                {{ STATUS_META[r.status].label }}
              </span>
              <span class="muted">#{{ r.id }}</span>
            </div>

            <div class="meta-row">
              <a :href="`mailto:${r.email}`">{{ r.email }}</a>
              <a :href="`tel:${r.phone}`">{{ r.phone }}</a>
              <span>{{ r.party_size }} guest{{ r.party_size === 1 ? '' : 's' }}</span>
            </div>

            <p style="margin-top: 0.5rem; font-size: 0.9rem; font-weight: 500">
              {{ fmt(r.check_in) }} → {{ fmt(r.check_out) }}
              <span class="muted">
                ({{ nights(r.check_in, r.check_out) }} night{{
                  nights(r.check_in, r.check_out) === 1 ? '' : 's'
                }})
              </span>
            </p>

            <p v-if="r.notes" class="note">"{{ r.notes }}"</p>

            <div class="space-select">
              <span class="kicker">Space</span>
              <select
                class="select"
                :value="r.space_id === null ? '' : String(r.space_id)"
                :disabled="busyId === r.id"
                @change="onSpaceChange(r.id, $event)"
              >
                <option value="">Unassigned</option>
                <option
                  v-for="space in spaceOptions(r)"
                  :key="space.id"
                  :value="String(space.id)"
                >
                  {{ space.name }} · {{ SPACE_KIND_LABELS[space.kind] }} · sleeps
                  {{ space.capacity
                  }}{{ space.status === 'archived' ? ' (archived)' : '' }}
                </option>
              </select>
              <span v-if="r.space_id === null" class="muted">
                Not assigned yet
              </span>
            </div>

            <p v-if="rowError?.id === r.id" class="form-error" style="margin-top: 0.5rem">
              {{ rowError.message }}
            </p>
          </div>

          <div class="card-actions">
            <button
              v-if="r.status !== 'confirmed'"
              type="button"
              class="btn btn-sm btn-confirm"
              :disabled="busyId === r.id"
              @click="setStatus(r.id, 'confirmed')"
            >
              Confirm
            </button>
            <button
              v-if="r.status !== 'cancelled'"
              type="button"
              class="btn btn-sm btn-ghost"
              :disabled="busyId === r.id"
              @click="setStatus(r.id, 'cancelled')"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              :disabled="busyId === r.id"
              @click="remove(r.id)"
            >
              Delete
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
