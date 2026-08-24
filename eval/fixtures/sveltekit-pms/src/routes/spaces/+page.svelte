<script lang="ts">
  import { enhance } from '$app/forms'

  import SpaceForm from '$lib/SpaceForm.svelte'
  import { formatRate } from '$lib/format'
  import { SPACE_KIND_LABELS } from '$lib/space-kinds'
  import type { Space } from '$lib/server/db'
  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  let editingId = $state<number | null>(null)
  let busyId = $state<number | null>(null)

  const active = $derived(data.spaces.filter((s) => s.status === 'active'))
  const archived = $derived(data.spaces.filter((s) => s.status === 'archived'))
  const beds = $derived(active.reduce((total, s) => total + s.capacity, 0))

  // Route the last action's validation errors to the form that produced them.
  const createErrors = $derived(
    form?.form === 'create' ? (form.errors ?? {}) : {},
  )
  const createFormError = $derived(
    form?.form === 'create' ? (form.formError ?? null) : null,
  )
  const editErrors = (id: number) =>
    form?.form === 'update' && form.id === id ? (form.errors ?? {}) : {}
  const editFormError = (id: number) =>
    form?.form === 'update' && form.id === id ? (form.formError ?? null) : null

  const nextStatus = (space: Space) =>
    space.status === 'active' ? 'archived' : 'active'
</script>

<div class="page-wrap" style="padding-block: 3rem;">
  <div class="rise-in header-row">
    <div>
      <p class="island-kicker">Inventory</p>
      <h1 class="display-title page-title">Spaces</h1>
      <p class="muted" style="margin-top: 0.5rem;">
        {active.length} bookable · sleeps {beds}{archived.length
          ? ` · ${archived.length} archived`
          : ''}
      </p>
    </div>
    <a href="/reservations" class="btn btn-ghost">View reservations</a>
  </div>

  <SpaceForm
    action="?/create"
    title="Add a space"
    submitLabel="Add space"
    errors={createErrors}
    formError={createFormError}
  />

  {#if data.spaces.length === 0}
    <div class="island-shell rise-in empty-state">
      No spaces yet. Add your first room above — guests can't be assigned one
      until you do.
    </div>
  {:else}
    <div class="rise-in card-list">
      {#each data.spaces as space (space.id)}
        {#if editingId === space.id}
          <SpaceForm
            action="?/update"
            title={`Edit ${space.name}`}
            submitLabel="Save changes"
            {space}
            errors={editErrors(space.id)}
            formError={editFormError(space.id)}
            oncancel={() => (editingId = null)}
          />
        {:else}
          {@const rate = formatRate(space.rateCents)}
          <article class="feature-card" class:archived={space.status === 'archived'}>
            <div class="card-top">
              <div>
                <div class="card-heading">
                  <h2 class="space-name">{space.name}</h2>
                  <span class="badge badge-kind">
                    {SPACE_KIND_LABELS[space.kind]}
                  </span>
                  {#if space.status === 'archived'}
                    <span class="badge badge-archived">Archived</span>
                  {/if}
                </div>
                <div class="card-facts muted">
                  <span>
                    Sleeps {space.capacity} guest{space.capacity === 1 ? '' : 's'}
                  </span>
                  <span>{rate ? `${rate} / night` : 'No rate set'}</span>
                </div>
                {#if space.notes}
                  <p class="card-notes muted">{space.notes}</p>
                {/if}
              </div>

              <div class="card-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-ghost"
                  onclick={() => (editingId = space.id)}
                >
                  Edit
                </button>
                <form
                  method="POST"
                  action="?/setStatus"
                  use:enhance={() => {
                    busyId = space.id
                    return async ({ update }) => {
                      await update()
                      busyId = null
                    }
                  }}
                >
                  <input type="hidden" name="id" value={space.id} />
                  <input type="hidden" name="status" value={nextStatus(space)} />
                  <button
                    type="submit"
                    class="btn btn-sm btn-ghost"
                    disabled={busyId === space.id}
                  >
                    {space.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                </form>
              </div>
            </div>
          </article>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .header-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }
  .page-title {
    margin-top: 0.5rem;
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--sea-ink);
  }
  .empty-state {
    margin-top: 2rem;
    padding: 3rem;
    text-align: center;
    color: var(--sea-ink-soft);
  }
  .card-list {
    margin-top: 2rem;
    display: grid;
    gap: 1rem;
  }
  .feature-card.archived {
    opacity: 0.6;
  }
  .card-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .card-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .space-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sea-ink);
  }
  .card-facts {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    font-size: 0.875rem;
  }
  .card-notes {
    margin-top: 0.5rem;
    max-width: 60ch;
    font-size: 0.875rem;
    font-style: italic;
  }
  .card-actions {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }
</style>
