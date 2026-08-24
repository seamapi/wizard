<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { bookingInput } from '#shared/schemas'
import { messageFromError } from '#shared/errors'
import { formatRate } from '#shared/format'
import { SPACE_KIND_LABELS } from '#shared/space-kinds'
import type { SpaceAvailability } from '#shared/types'

useHead({ title: 'Harbor PMS · Book a stay' })

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  guestName: '',
  email: '',
  phone: '',
  checkIn: '',
  checkOut: '',
  partySize: '1',
  notes: '',
  // '' = let the front desk assign a space later.
  spaceId: '',
}

const form = reactive({ ...emptyForm })
const errors = reactive<Record<string, string>>({})
const submitting = ref(false)
const confirmed = ref<{
  id: number
  guestName: string
  spaceName: string | null
} | null>(null)

const availability = ref<SpaceAvailability[]>([])
const loadingSpaces = ref(false)

const partySize = computed(() => Number(form.partySize) || 1)
const datesReady = computed(
  () =>
    form.checkIn !== '' &&
    form.checkOut !== '' &&
    form.checkOut > form.checkIn,
)
const openCount = computed(
  () => availability.value.filter((space) => space.available).length,
)

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

// Availability depends on the dates and the party size, so re-check whenever any
// of them change. A token guards against an out-of-order response overwriting a
// newer one.
let availabilityToken = 0
watch(
  [() => form.checkIn, () => form.checkOut, partySize],
  async () => {
    if (!datesReady.value) {
      availability.value = []
      return
    }
    const token = ++availabilityToken
    loadingSpaces.value = true
    try {
      const rows = await $fetch<SpaceAvailability[]>(
        '/api/spaces/availability',
        {
          query: {
            checkIn: form.checkIn,
            checkOut: form.checkOut,
            partySize: partySize.value,
          },
        },
      )
      if (token === availabilityToken) availability.value = rows
    } catch {
      if (token === availabilityToken) availability.value = []
    } finally {
      if (token === availabilityToken) loadingSpaces.value = false
    }
  },
)

// Drop a pick that the latest dates / party size made unbookable.
watch(availability, () => {
  if (form.spaceId === '') return
  const picked = availability.value.find(
    (space) => String(space.id) === form.spaceId,
  )
  if (picked == null || !picked.available) form.spaceId = ''
})

async function onSubmit() {
  clearErrors()

  const parsed = bookingInput.safeParse({ ...form })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && errors[key] == null)
        errors[key] = issue.message
    }
    return
  }

  const pickedName =
    availability.value.find((space) => space.id === parsed.data.spaceId)?.name ??
    null

  submitting.value = true
  try {
    const row = await $fetch<{ id: number; guest_name: string }>('/api/book', {
      method: 'POST',
      body: parsed.data,
    })
    confirmed.value = {
      id: row.id,
      guestName: row.guest_name,
      spaceName: pickedName,
    }
    Object.assign(form, emptyForm)
    availability.value = []
  } catch (err) {
    // Availability is re-checked on the server, so a race (someone booked the
    // space first) surfaces here with a usable message.
    errors.form = messageFromError(err)
  } finally {
    submitting.value = false
  }
}

function selectSpace(value: string) {
  form.spaceId = value
}
</script>

<template>
  <div class="page">
    <div v-if="confirmed" class="page-wrap">
      <div class="panel confirm">
        <div class="confirm-mark">✓</div>
        <p class="kicker">Reservation received</p>
        <h1 class="title">Thanks, {{ confirmed.guestName }}!</h1>
        <p class="subtitle">
          Your reservation <strong>#{{ confirmed.id }}</strong> is pending
          confirmation.
          <template v-if="confirmed.spaceName">
            We're holding <strong>{{ confirmed.spaceName }}</strong> for you.
          </template>
          We'll be in touch by email shortly.
        </p>
        <button
          type="button"
          class="btn btn-primary"
          style="margin-top: 1.5rem"
          @click="confirmed = null"
        >
          Book another stay
        </button>
      </div>
    </div>

    <div v-else class="page-wrap" style="max-width: 42rem">
      <p class="kicker">Reserve your stay</p>
      <h1 class="title">Book a reservation</h1>
      <p class="subtitle">
        Tell us who's coming and when. No account needed — just your details.
      </p>

      <form class="panel stack" novalidate @submit.prevent="onSubmit">
        <label class="field">
          <span class="field-label">Full name</span>
          <input
            v-model="form.guestName"
            class="input"
            placeholder="Jane Traveler"
            autocomplete="name"
          />
          <span v-if="errors.guestName" class="field-error">
            {{ errors.guestName }}
          </span>
        </label>

        <div class="grid-2">
          <label class="field">
            <span class="field-label">Email</span>
            <input
              v-model="form.email"
              class="input"
              type="email"
              placeholder="jane@example.com"
              autocomplete="email"
            />
            <span v-if="errors.email" class="field-error">
              {{ errors.email }}
            </span>
          </label>
          <label class="field">
            <span class="field-label">Phone</span>
            <input
              v-model="form.phone"
              class="input"
              type="tel"
              placeholder="+1 555 123 4567"
              autocomplete="tel"
            />
            <span v-if="errors.phone" class="field-error">
              {{ errors.phone }}
            </span>
          </label>
        </div>

        <div class="grid-3">
          <label class="field">
            <span class="field-label">Check-in</span>
            <input
              v-model="form.checkIn"
              class="input"
              type="date"
              :min="today()"
            />
            <span v-if="errors.checkIn" class="field-error">
              {{ errors.checkIn }}
            </span>
          </label>
          <label class="field">
            <span class="field-label">Check-out</span>
            <input
              v-model="form.checkOut"
              class="input"
              type="date"
              :min="form.checkIn || today()"
            />
            <span v-if="errors.checkOut" class="field-error">
              {{ errors.checkOut }}
            </span>
          </label>
          <label class="field">
            <span class="field-label">Guests</span>
            <input
              v-model="form.partySize"
              class="input"
              type="number"
              min="1"
              max="20"
            />
            <span v-if="errors.partySize" class="field-error">
              {{ errors.partySize }}
            </span>
          </label>
        </div>

        <fieldset class="picker">
          <legend class="picker-legend">
            Space
            <span class="muted">
              <template
                v-if="datesReady && !loadingSpaces && availability.length > 0"
              >
                — {{ openCount }} of {{ availability.length }} open
              </template>
              <template v-else>(optional)</template>
            </span>
          </legend>

          <p v-if="!datesReady" class="picker-hint">
            Pick your dates to see what's available.
          </p>
          <p v-else-if="loadingSpaces" class="picker-hint">
            Checking availability…
          </p>
          <p v-else-if="availability.length === 0" class="picker-hint">
            No spaces are set up yet — we'll assign one and confirm by email.
          </p>
          <template v-else>
            <label
              v-for="space in availability"
              :key="space.id"
              class="option"
              :class="{
                'is-selected': form.spaceId === String(space.id),
                'is-disabled': !space.available,
              }"
            >
              <input
                type="radio"
                name="spaceId"
                :value="String(space.id)"
                :checked="form.spaceId === String(space.id)"
                :disabled="!space.available"
                @change="selectSpace(String(space.id))"
              />
              <span class="option-body">
                <span class="option-name">
                  {{ space.name }}
                  <span class="muted">
                    · {{ SPACE_KIND_LABELS[space.kind] }} · sleeps
                    {{ space.capacity }}
                  </span>
                </span>
                <span v-if="space.reason" class="option-reason">
                  {{ space.reason }}
                </span>
              </span>
              <span v-if="formatRate(space.rate_cents)" class="option-rate">
                {{ formatRate(space.rate_cents) }}<span class="muted">/night</span>
              </span>
            </label>

            <label
              class="option"
              :class="{ 'is-selected': form.spaceId === '' }"
            >
              <input
                type="radio"
                name="spaceId"
                value=""
                :checked="form.spaceId === ''"
                @change="selectSpace('')"
              />
              <span class="option-name">
                No preference
                <span class="muted">— let the front desk choose</span>
              </span>
            </label>
          </template>
        </fieldset>

        <label class="field">
          <span class="field-label">Notes (optional)</span>
          <textarea
            v-model="form.notes"
            class="textarea"
            placeholder="Anything we should know? Arrival time, accessibility needs…"
          />
          <span v-if="errors.notes" class="field-error">
            {{ errors.notes }}
          </span>
        </label>

        <p v-if="errors.form" class="form-error">{{ errors.form }}</p>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="submitting"
        >
          {{ submitting ? 'Sending…' : 'Request reservation' }}
        </button>
      </form>
    </div>
  </div>
</template>
