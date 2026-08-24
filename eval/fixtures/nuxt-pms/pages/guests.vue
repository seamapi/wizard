<script setup lang="ts">
import { computed } from 'vue'

import type { Guest } from '#shared/types'

useHead({ title: 'Harbor PMS · Guests' })

const { data: guestsData } = await useFetch<Guest[]>('/api/guests', {
  default: () => [],
})
const guests = computed(() => guestsData.value ?? [])
</script>

<template>
  <div class="page page-wrap">
    <div class="page-head">
      <div>
        <p class="kicker">Directory</p>
        <h1 class="title">Guests</h1>
        <p class="subtitle">
          {{ guests.length }} unique guest{{ guests.length === 1 ? '' : 's' }}
        </p>
      </div>
      <NuxtLink to="/reservations" class="btn btn-ghost">
        View reservations
      </NuxtLink>
    </div>

    <div v-if="guests.length === 0" class="panel empty">
      No guests yet. They'll appear here after the first booking.
    </div>

    <div v-else class="panel table-wrap" style="padding: 0">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th class="text-right">Stays</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="guest in guests" :key="guest.email">
            <td style="font-weight: 600">{{ guest.name }}</td>
            <td><a :href="`mailto:${guest.email}`">{{ guest.email }}</a></td>
            <td><a :href="`tel:${guest.phone}`">{{ guest.phone }}</a></td>
            <td class="text-right" style="font-weight: 600">
              {{ guest.reservationCount }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
