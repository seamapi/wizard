<script lang="ts">
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<div class="page-wrap" style="padding-block: 3rem;">
  <div class="rise-in header-row">
    <div>
      <p class="island-kicker">Directory</p>
      <h1 class="display-title page-title">Guests</h1>
      <p class="muted" style="margin-top: 0.5rem;">
        {data.guests.length} unique guest{data.guests.length === 1 ? '' : 's'}
      </p>
    </div>
    <a href="/reservations" class="btn btn-ghost">View reservations</a>
  </div>

  {#if data.guests.length === 0}
    <div class="island-shell rise-in empty-state">
      No guests yet. They'll appear here after the first booking.
    </div>
  {:else}
    <div class="island-shell rise-in table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th style="text-align: right;">Stays</th>
          </tr>
        </thead>
        <tbody>
          {#each data.guests as guest (guest.email)}
            <tr>
              <td style="font-weight: 600; color: var(--sea-ink);">
                {guest.name}
              </td>
              <td><a href="mailto:{guest.email}">{guest.email}</a></td>
              <td><a href="tel:{guest.phone}">{guest.phone}</a></td>
              <td style="text-align: right; font-weight: 600; color: var(--sea-ink);">
                {guest.reservationCount}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
  .table-wrap {
    margin-top: 2rem;
    overflow: hidden;
  }
</style>
