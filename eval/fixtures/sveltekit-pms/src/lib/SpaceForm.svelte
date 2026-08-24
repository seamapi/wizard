<script lang="ts">
  import { enhance } from '$app/forms'

  import { SPACE_KINDS, SPACE_KIND_LABELS } from '$lib/space-kinds'
  import type { SpaceKind } from '$lib/space-kinds'
  import type { Space } from '$lib/server/db'

  /**
   * The add / edit space form, shared by both so the two always match. It posts
   * to a SvelteKit form action (`?/create` or `?/update`) and enhances the
   * submit; validation errors come back down as props from the page's `form`
   * result.
   */
  let {
    action,
    title,
    submitLabel,
    space = null,
    errors = {},
    formError = null,
    oncancel = null,
  }: {
    action: string
    title: string
    submitLabel: string
    space?: Space | null
    errors?: Record<string, string>
    formError?: string | null
    oncancel?: (() => void) | null
  } = $props()

  let name = $state(space?.name ?? '')
  let kind = $state<SpaceKind>(space?.kind ?? 'room')
  let capacity = $state(space ? String(space.capacity) : '2')
  let rate = $state(
    space && space.rateCents !== null ? String(space.rateCents / 100) : '',
  )
  let notes = $state(space?.notes ?? '')
  let saving = $state(false)

  function reset() {
    name = ''
    kind = 'room'
    capacity = '2'
    rate = ''
    notes = ''
  }
</script>

<form
  method="POST"
  {action}
  class="island-shell stack space-form"
  use:enhance={() => {
    saving = true
    return async ({ update, result }) => {
      await update()
      saving = false
      if (result.type === 'success') {
        if (space === null) reset()
        oncancel?.()
      }
    }
  }}
>
  {#if space}
    <input type="hidden" name="id" value={space.id} />
  {/if}

  <h2 class="display-title form-title">{title}</h2>

  <div class="grid grid-2">
    <label class="field">
      <span class="field-label">Name</span>
      <input class="input" name="name" bind:value={name} placeholder="Seagrass Suite" />
      {#if errors.name}<span class="error-text">{errors.name}</span>{/if}
    </label>
    <label class="field">
      <span class="field-label">Kind</span>
      <select class="input" name="kind" bind:value={kind}>
        {#each SPACE_KINDS as option (option)}
          <option value={option}>{SPACE_KIND_LABELS[option]}</option>
        {/each}
      </select>
      {#if errors.kind}<span class="error-text">{errors.kind}</span>{/if}
    </label>
  </div>

  <div class="grid grid-2">
    <label class="field">
      <span class="field-label">Sleeps</span>
      <input
        class="input"
        type="number"
        name="capacity"
        min="1"
        max="40"
        bind:value={capacity}
      />
      {#if errors.capacity}<span class="error-text">{errors.capacity}</span>{/if}
    </label>
    <label class="field">
      <span class="field-label">Nightly rate (optional)</span>
      <input
        class="input"
        type="number"
        name="rate"
        min="0"
        step="0.01"
        bind:value={rate}
        placeholder="240"
      />
      {#if errors.rate}<span class="error-text">{errors.rate}</span>{/if}
    </label>
  </div>

  <label class="field">
    <span class="field-label">Notes (optional)</span>
    <textarea
      class="input"
      name="notes"
      bind:value={notes}
      placeholder="Ocean view, walk-in shower, ground floor…"
    ></textarea>
    {#if errors.notes}<span class="error-text">{errors.notes}</span>{/if}
  </label>

  {#if formError}
    <p class="error-text">{formError}</p>
  {/if}

  <div class="form-actions">
    <button type="submit" class="btn btn-primary" disabled={saving}>
      {saving ? 'Saving…' : submitLabel}
    </button>
    {#if oncancel}
      <button type="button" class="btn btn-ghost" onclick={() => oncancel?.()}>
        Cancel
      </button>
    {/if}
  </div>
</form>

<style>
  .space-form {
    margin-top: 2rem;
    padding: 1.5rem;
  }
  @media (min-width: 640px) {
    .space-form {
      padding: 2rem;
    }
  }
  .form-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sea-ink);
  }
  .form-actions {
    display: flex;
    gap: 0.75rem;
  }
</style>
