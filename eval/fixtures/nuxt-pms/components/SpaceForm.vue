<script setup lang="ts">
import { reactive, ref } from 'vue'

import { spaceInput } from '#shared/schemas'
import type { SpaceInput } from '#shared/schemas'
import { messageFromError } from '#shared/errors'
import { SPACE_KINDS, SPACE_KIND_LABELS } from '#shared/space-kinds'
import type { SpaceKind } from '#shared/space-kinds'

// Add / edit form for a space. The parent owns the actual write (create vs
// update) and passes it in as `onSave`; the form validates with the shared zod
// schema, then hands over the parsed payload and surfaces any error inline.
interface SpaceFormState {
  name: string
  kind: SpaceKind
  capacity: string
  rate: string
  notes: string
}

const props = defineProps<{
  title: string
  submitLabel: string
  initial?: SpaceFormState
  onSave: (payload: SpaceInput) => Promise<void>
  onCancel?: () => void
}>()

const emptyForm: SpaceFormState = {
  name: '',
  kind: 'room',
  capacity: '2',
  rate: '',
  notes: '',
}

const form = reactive<SpaceFormState>({ ...emptyForm, ...props.initial })
const errors = reactive<Record<string, string>>({})
const saving = ref(false)

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

// Form strings → the shape `spaceInput` expects (blank rate/notes → null).
function toPayload(state: SpaceFormState) {
  return {
    name: state.name,
    kind: state.kind,
    capacity: state.capacity,
    rate: state.rate.trim() === '' ? null : state.rate,
    notes: state.notes.trim() === '' ? null : state.notes,
  }
}

async function onSubmit() {
  clearErrors()

  const parsed = spaceInput.safeParse(toPayload(form))
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && errors[key] == null)
        errors[key] = issue.message
    }
    return
  }

  saving.value = true
  try {
    await props.onSave(parsed.data)
    if (props.initial == null) Object.assign(form, emptyForm)
  } catch (err) {
    errors.form = messageFromError(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="panel stack" novalidate @submit.prevent="onSubmit">
    <h2 class="title-sm">{{ title }}</h2>

    <div class="grid-2">
      <label class="field">
        <span class="field-label">Name</span>
        <input
          v-model="form.name"
          class="input"
          placeholder="Seagrass Suite"
        />
        <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
      </label>
      <label class="field">
        <span class="field-label">Kind</span>
        <select v-model="form.kind" class="select">
          <option v-for="kind in SPACE_KINDS" :key="kind" :value="kind">
            {{ SPACE_KIND_LABELS[kind] }}
          </option>
        </select>
      </label>
    </div>

    <div class="grid-2">
      <label class="field">
        <span class="field-label">Sleeps</span>
        <input
          v-model="form.capacity"
          class="input"
          type="number"
          min="1"
          max="40"
        />
        <span v-if="errors.capacity" class="field-error">
          {{ errors.capacity }}
        </span>
      </label>
      <label class="field">
        <span class="field-label">Nightly rate (optional)</span>
        <input
          v-model="form.rate"
          class="input"
          type="number"
          min="0"
          step="0.01"
          placeholder="240"
        />
        <span v-if="errors.rate" class="field-error">{{ errors.rate }}</span>
      </label>
    </div>

    <label class="field">
      <span class="field-label">Notes (optional)</span>
      <textarea
        v-model="form.notes"
        class="textarea"
        placeholder="Ocean view, walk-in shower, ground floor…"
      />
      <span v-if="errors.notes" class="field-error">{{ errors.notes }}</span>
    </label>

    <p v-if="errors.form" class="form-error">{{ errors.form }}</p>

    <div class="actions-row">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        {{ saving ? 'Saving…' : submitLabel }}
      </button>
      <button
        v-if="onCancel"
        type="button"
        class="btn btn-ghost"
        @click="onCancel"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
