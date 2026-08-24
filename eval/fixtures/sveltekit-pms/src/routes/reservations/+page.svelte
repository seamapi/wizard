<script lang="ts">
  import { enhance } from '$app/forms'

  import { formatDate, nights } from '$lib/format'
  import { SPACE_KIND_LABELS } from '$lib/space-kinds'
  import type { ReservationStatus } from '$lib/server/db'
  import type { ReservationRow } from '$lib/server/queries'
  import type { Space } from '$lib/server/db'
  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  let busyId = $state<number | null>(null)

  const STATUS_LABEL: Record<ReservationStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
  }

  const upcoming = $derived(
    data.reservations.filter((r) => r.status !== 'cancelled').length,
  )
  const unassigned = $derived(
    data.reservations.filter(
      (r) => r.status !== 'cancelled' && r.spaceId === null,
    ).length,
  )

  // Every mutation on this page is a small form action; this wires the shared
  // busy state + progressive enhancement, so an assignment race surfaces its
  // server message inline instead of reloading the page.
  const submit = (id: number) => () => {
    busyId = id
    return async ({ update }: { update: () => Promise<void> }) => {
      await update()
      busyId = null
    }
  }

  /**
   * Archived spaces stay selectable only where they're already assigned, so an
   * existing booking isn't silently reassigned by rendering the dropdown.
   */
  const spaceOptions = (reservation: ReservationRow): Array<Space> =>
    data.spaces.filter(
      (space) => space.status === 'active' || space.id === reservation.spaceId,
    )
</script>

<div class="page-wrap" style="padding-block: 3rem;">
  <div class="rise-in header-row">
    <div>
      <p class="island-kicker">Front desk</p>
      <h1 class="display-title page-title">Reservations</h1>
      <p class="muted" style="margin-top: 0.5rem;">
        {data.reservations.length} total · {upcoming} active{unassigned
          ? ` · ${unassigned} awaiting a space`
          : ''}
      </p>
    </div>
    <div class="header-actions">
      <a href="/spaces" class="btn btn-ghost">Manage spaces</a>
      <a href="/guests" class="btn btn-ghost">See all guests</a>
      <a href="/" class="btn btn-primary">+ New reservation</a>
    </div>
  </div>

  {#if data.reservations.length === 0}
    <div class="island-shell rise-in empty-state">
      No reservations yet. Once guests book, they'll show up here.
    </div>
  {:else}
    <div class="rise-in card-list">
      {#each data.reservations as reservation (reservation.id)}
        <article class="feature-card">
          <div class="card-top">
            <div class="card-main">
              <div class="card-heading">
                <h2 class="guest-name">{reservation.guestName}</h2>
                <span class="badge badge-{reservation.status}">
                  {STATUS_LABEL[reservation.status]}
                </span>
                <span class="muted reservation-id">#{reservation.id}</span>
              </div>

              <div class="card-contact muted">
                <a href="mailto:{reservation.email}">{reservation.email}</a>
                <a href="tel:{reservation.phone}">{reservation.phone}</a>
                <span>
                  {reservation.partySize} guest{reservation.partySize === 1
                    ? ''
                    : 's'}
                </span>
              </div>

              <p class="card-dates">
                {formatDate(reservation.checkIn)} → {formatDate(
                  reservation.checkOut,
                )}
                <span class="muted" style="font-weight: 400;">
                  ({nights(reservation.checkIn, reservation.checkOut)} night{nights(
                    reservation.checkIn,
                    reservation.checkOut,
                  ) === 1
                    ? ''
                    : 's'})
                </span>
              </p>

              {#if reservation.notes}
                <p class="card-notes muted">"{reservation.notes}"</p>
              {/if}

              <!-- Assigned space — where an integration later surfaces access
                   (e.g. a PIN code or mobile key for the guest's stay). -->
              <form
                method="POST"
                action="?/assignSpace"
                class="space-assign"
                use:enhance={submit(reservation.id)}
              >
                <input type="hidden" name="id" value={reservation.id} />
                <span class="island-kicker">Space</span>
                <select
                  name="spaceId"
                  class="input space-select"
                  value={reservation.spaceId === null
                    ? ''
                    : String(reservation.spaceId)}
                  disabled={busyId === reservation.id}
                  onchange={(event) => event.currentTarget.form?.requestSubmit()}
                >
                  <option value="">Unassigned</option>
                  {#each spaceOptions(reservation) as space (space.id)}
                    <option value={String(space.id)}>
                      {space.name} · {SPACE_KIND_LABELS[space.kind]} · sleeps {space.capacity}{space.status ===
                      'archived'
                        ? ' (archived)'
                        : ''}
                    </option>
                  {/each}
                </select>
                {#if reservation.spaceId === null}
                  <span class="muted" style="font-size: 0.875rem;"
                    >Not assigned yet</span
                  >
                {/if}
              </form>

              {#if form?.errorId === reservation.id && form.message}
                <p class="error-text" style="margin-top: 0.5rem;">
                  {form.message}
                </p>
              {/if}
            </div>

            <div class="card-actions">
              {#if reservation.status !== 'confirmed'}
                <form
                  method="POST"
                  action="?/updateStatus"
                  use:enhance={submit(reservation.id)}
                >
                  <input type="hidden" name="id" value={reservation.id} />
                  <input type="hidden" name="status" value="confirmed" />
                  <button
                    type="submit"
                    class="btn btn-sm btn-confirm"
                    disabled={busyId === reservation.id}
                  >
                    Confirm
                  </button>
                </form>
              {/if}
              {#if reservation.status !== 'cancelled'}
                <form
                  method="POST"
                  action="?/updateStatus"
                  use:enhance={submit(reservation.id)}
                >
                  <input type="hidden" name="id" value={reservation.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <button
                    type="submit"
                    class="btn btn-sm btn-ghost"
                    disabled={busyId === reservation.id}
                  >
                    Cancel
                  </button>
                </form>
              {/if}
              <form
                method="POST"
                action="?/delete"
                use:enhance={submit(reservation.id)}
                onsubmit={(event) => {
                  if (
                    !confirm(
                      `Delete reservation #${reservation.id}? This cannot be undone.`,
                    )
                  )
                    event.preventDefault()
                }}
              >
                <input type="hidden" name="id" value={reservation.id} />
                <button
                  type="submit"
                  class="btn btn-sm btn-danger"
                  disabled={busyId === reservation.id}
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </article>
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
  .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
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
  .guest-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sea-ink);
  }
  .reservation-id {
    font-size: 0.875rem;
  }
  .card-contact {
    margin-top: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    font-size: 0.875rem;
  }
  .card-dates {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sea-ink);
  }
  .card-notes {
    margin-top: 0.5rem;
    max-width: 60ch;
    font-size: 0.875rem;
    font-style: italic;
  }
  .space-assign {
    margin-top: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .space-select {
    width: auto;
    padding: 0.375rem 0.625rem;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .card-actions {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }
</style>
