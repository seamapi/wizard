<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatRate } from '#shared/format'
import type { SpaceInput } from '#shared/schemas'
import { SPACE_KIND_LABELS } from '#shared/space-kinds'
import type { Space } from '#shared/types'

useHead({ title: 'Harbor PMS · Spaces' })

const { data: spacesData, refresh } = await useFetch<Space[]>('/api/spaces', {
  default: () => [],
})
const spaces = computed(() => spacesData.value ?? [])

const editingId = ref<number | null>(null)
const busyId = ref<number | null>(null)

const active = computed(() => spaces.value.filter((s) => s.status === 'active'))
const archived = computed(
  () => spaces.value.filter((s) => s.status === 'archived'),
)
const beds = computed(() => active.value.reduce((n, s) => n + s.capacity, 0))

async function createSpace(payload: SpaceInput) {
  await $fetch('/api/spaces', { method: 'POST', body: payload })
  await refresh()
}

async function updateSpace(id: number, payload: SpaceInput) {
  await $fetch(`/api/spaces/${id}`, { method: 'PUT', body: payload })
  editingId.value = null
  await refresh()
}

async function toggleStatus(space: Space) {
  busyId.value = space.id
  try {
    await $fetch(`/api/spaces/${space.id}/status`, {
      method: 'POST',
      body: { status: space.status === 'active' ? 'archived' : 'active' },
    })
    await refresh()
  } finally {
    busyId.value = null
  }
}

function initialFor(space: Space) {
  return {
    name: space.name,
    kind: space.kind,
    capacity: String(space.capacity),
    rate: space.rate_cents === null ? '' : String(space.rate_cents / 100),
    notes: space.notes ?? '',
  }
}
</script>

<template>
  <div class="page page-wrap">
    <div class="page-head">
      <div>
        <p class="kicker">Inventory</p>
        <h1 class="title">Spaces</h1>
        <p class="subtitle">
          {{ active.length }} bookable · sleeps {{ beds }}<template
            v-if="archived.length"
          >
            · {{ archived.length }} archived</template
          >
        </p>
      </div>
      <NuxtLink to="/reservations" class="btn btn-ghost">
        View reservations
      </NuxtLink>
    </div>

    <div style="margin-top: 2rem">
      <SpaceForm
        title="Add a space"
        submit-label="Add space"
        :on-save="createSpace"
      />
    </div>

    <div v-if="spaces.length === 0" class="panel empty">
      No spaces yet. Add your first room above — guests can't be assigned one
      until you do.
    </div>

    <div v-else class="stack" style="margin-top: 2rem">
      <template v-for="space in spaces" :key="space.id">
        <SpaceForm
          v-if="editingId === space.id"
          :title="`Edit ${space.name}`"
          submit-label="Save changes"
          :initial="initialFor(space)"
          :on-save="(payload) => updateSpace(space.id, payload)"
          :on-cancel="() => (editingId = null)"
        />
        <article v-else class="card" :class="{ 'is-muted': space.status === 'archived' }">
          <div class="card-head">
            <div>
              <div class="chip-row">
                <h2 class="card-title">{{ space.name }}</h2>
                <span class="badge badge-kind">
                  {{ SPACE_KIND_LABELS[space.kind] }}
                </span>
                <span v-if="space.status === 'archived'" class="badge">
                  Archived
                </span>
              </div>
              <div class="meta-row">
                <span>
                  Sleeps {{ space.capacity }} guest{{
                    space.capacity === 1 ? '' : 's'
                  }}
                </span>
                <span>
                  {{
                    formatRate(space.rate_cents)
                      ? `${formatRate(space.rate_cents)} / night`
                      : 'No rate set'
                  }}
                </span>
              </div>
              <p v-if="space.notes" class="note">{{ space.notes }}</p>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                @click="editingId = space.id"
              >
                Edit
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                :disabled="busyId === space.id"
                @click="toggleStatus(space)"
              >
                {{ space.status === 'archived' ? 'Restore' : 'Archive' }}
              </button>
            </div>
          </div>
        </article>
      </template>
    </div>
  </div>
</template>
