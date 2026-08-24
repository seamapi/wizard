<script lang="ts">
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'

  import { formatRate } from '$lib/format'
  import { SPACE_KIND_LABELS } from '$lib/space-kinds'
  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()

  const today = new Date().toISOString().slice(0, 10)

  let guestName = $state('')
  let email = $state('')
  let phone = $state('')
  let checkIn = $state(data.checkIn)
  let checkOut = $state(data.checkOut)
  let partySize = $state(String(data.partySize))
  let notes = $state('')
  /** '' = let the front desk assign a space later. */
  let spaceId = $state('')
  let submitting = $state(false)

  const datesReady = $derived(
    checkIn !== '' && checkOut !== '' && checkOut > checkIn,
  )
  const openCount = $derived(data.spaces.filter((s) => s.available).length)

  // Availability lives in the URL query so the server load recomputes it; push
  // the current dates / party size there whenever they change.
  $effect(() => {
    const target = datesReady
      ? `/?check_in=${checkIn}&check_out=${checkOut}&party_size=${partySize}`
      : '/'
    if (page.url.pathname + page.url.search !== target) {
      goto(target, { replaceState: true, keepFocus: true, noScroll: true })
    }
  })

  // Drop a pick that the latest dates / party size made unbookable.
  $effect(() => {
    if (spaceId === '') return
    const picked = data.spaces.find((s) => String(s.id) === spaceId)
    if (!picked || !picked.available) spaceId = ''
  })
</script>

{#if form?.success}
  <div class="page-wrap" style="padding-block: 4rem;">
    <div class="island-shell rise-in confirm-card">
      <div class="confirm-check">✓</div>
      <p class="island-kicker">Reservation received</p>
      <h1 class="display-title confirm-title">
        Thanks, {form.reservation.guestName}!
      </h1>
      <p class="muted" style="margin-top: 0.75rem;">
        Your reservation
        <strong>#{form.reservation.id}</strong>
        is pending confirmation.
        {#if form.reservation.spaceName}
          We're holding <strong>{form.reservation.spaceName}</strong> for you.
        {/if}
        We'll be in touch by email shortly.
      </p>
      <a href="/" class="btn btn-primary" style="margin-top: 2rem;">
        Book another stay
      </a>
    </div>
  </div>
{:else}
  <div class="page-wrap" style="padding-block: 3rem;">
    <div class="rise-in booking-intro">
      <p class="island-kicker">Reserve your stay</p>
      <h1 class="display-title booking-title">Book a reservation</h1>
      <p class="muted" style="margin-top: 0.75rem;">
        Tell us who's coming and when. No account needed — just your details.
      </p>

      <form
        method="POST"
        class="island-shell stack booking-form"
        use:enhance={() => {
          submitting = true
          return async ({ update }) => {
            await update()
            submitting = false
          }
        }}
      >
        <label class="field">
          <span class="field-label">Full name</span>
          <input
            class="input"
            name="guestName"
            bind:value={guestName}
            placeholder="Jane Traveler"
            autocomplete="name"
          />
          {#if form?.errors?.guestName}
            <span class="error-text">{form.errors.guestName}</span>
          {/if}
        </label>

        <div class="grid grid-2">
          <label class="field">
            <span class="field-label">Email</span>
            <input
              class="input"
              type="email"
              name="email"
              bind:value={email}
              placeholder="jane@example.com"
              autocomplete="email"
            />
            {#if form?.errors?.email}
              <span class="error-text">{form.errors.email}</span>
            {/if}
          </label>
          <label class="field">
            <span class="field-label">Phone</span>
            <input
              class="input"
              type="tel"
              name="phone"
              bind:value={phone}
              placeholder="+1 555 123 4567"
              autocomplete="tel"
            />
            {#if form?.errors?.phone}
              <span class="error-text">{form.errors.phone}</span>
            {/if}
          </label>
        </div>

        <div class="grid grid-3">
          <label class="field">
            <span class="field-label">Check-in</span>
            <input
              class="input"
              type="date"
              name="checkIn"
              min={today}
              bind:value={checkIn}
            />
            {#if form?.errors?.checkIn}
              <span class="error-text">{form.errors.checkIn}</span>
            {/if}
          </label>
          <label class="field">
            <span class="field-label">Check-out</span>
            <input
              class="input"
              type="date"
              name="checkOut"
              min={checkIn || today}
              bind:value={checkOut}
            />
            {#if form?.errors?.checkOut}
              <span class="error-text">{form.errors.checkOut}</span>
            {/if}
          </label>
          <label class="field">
            <span class="field-label">Guests</span>
            <input
              class="input"
              type="number"
              name="partySize"
              min="1"
              max="20"
              bind:value={partySize}
            />
            {#if form?.errors?.partySize}
              <span class="error-text">{form.errors.partySize}</span>
            {/if}
          </label>
        </div>

        <fieldset class="field picker">
          <legend class="field-label">
            Space
            <span class="muted" style="font-weight: 400;">
              {#if datesReady && data.spaces.length > 0}
                — {openCount} of {data.spaces.length} open
              {:else}
                (optional)
              {/if}
            </span>
          </legend>

          {#if !datesReady}
            <p class="picker-hint">Pick your dates to see what's available.</p>
          {:else if data.spaces.length === 0}
            <p class="picker-hint">
              No spaces are set up yet — we'll assign one and confirm by email.
            </p>
          {:else}
            <div class="picker-options">
              {#each data.spaces as space (space.id)}
                {@const rate = formatRate(space.rateCents)}
                <label
                  class="picker-option"
                  class:selected={spaceId === String(space.id)}
                  class:unavailable={!space.available}
                >
                  <input
                    type="radio"
                    name="spaceId"
                    value={String(space.id)}
                    disabled={!space.available}
                    bind:group={spaceId}
                  />
                  <span class="picker-body">
                    <span class="picker-name">
                      {space.name}
                      <span class="muted" style="font-weight: 400;">
                        · {SPACE_KIND_LABELS[space.kind]} · sleeps {space.capacity}
                      </span>
                    </span>
                    {#if space.reason}
                      <span class="picker-reason">{space.reason}</span>
                    {/if}
                  </span>
                  {#if rate}
                    <span class="picker-rate">
                      {rate}<span class="muted" style="font-weight: 400;"
                        >/night</span
                      >
                    </span>
                  {/if}
                </label>
              {/each}

              <label
                class="picker-option"
                class:selected={spaceId === ''}
              >
                <input type="radio" name="spaceId" value="" bind:group={spaceId} />
                <span class="picker-name">
                  No preference
                  <span class="muted" style="font-weight: 400;">
                    — let the front desk choose
                  </span>
                </span>
              </label>
            </div>
          {/if}
        </fieldset>

        <label class="field">
          <span class="field-label">Notes (optional)</span>
          <textarea
            class="input"
            name="notes"
            bind:value={notes}
            placeholder="Anything we should know? Arrival time, accessibility needs…"
          ></textarea>
          {#if form?.errors?.notes}
            <span class="error-text">{form.errors.notes}</span>
          {/if}
        </label>

        {#if form?.formError}
          <p class="error-text">{form.formError}</p>
        {/if}

        <button type="submit" class="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Sending…' : 'Request reservation'}
        </button>
      </form>
    </div>
  </div>
{/if}

<style>
  .booking-intro {
    max-width: 42rem;
    margin-inline: auto;
  }
  .booking-title {
    margin-top: 0.5rem;
    font-size: 2.25rem;
    font-weight: 700;
    color: var(--sea-ink);
  }
  .booking-form {
    margin-top: 2rem;
    padding: 1.5rem;
  }
  @media (min-width: 640px) {
    .booking-form {
      padding: 2rem;
    }
  }
  .confirm-card {
    max-width: 36rem;
    margin-inline: auto;
    padding: 2.5rem;
    text-align: center;
  }
  .confirm-check {
    margin: 0 auto 1rem;
    display: grid;
    place-items: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 999px;
    background: var(--palm);
    color: white;
    font-size: 1.5rem;
  }
  .confirm-title {
    margin-top: 0.5rem;
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--sea-ink);
  }
  .picker {
    border: none;
    padding: 0;
    margin: 0;
  }
  .picker-hint {
    border: 1px dashed var(--line);
    border-radius: 0.75rem;
    padding: 0.75rem 0.875rem;
    font-size: 0.875rem;
    color: var(--sea-ink-soft);
  }
  .picker-options {
    display: grid;
    gap: 0.5rem;
  }
  .picker-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    padding: 0.75rem 0.875rem;
    background: rgba(255, 255, 255, 0.6);
    cursor: pointer;
  }
  .picker-option:hover {
    background: rgba(255, 255, 255, 0.9);
  }
  .picker-option.selected {
    border-color: var(--lagoon-deep);
    background: rgba(79, 184, 178, 0.1);
  }
  .picker-option.unavailable {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .picker-body {
    min-width: 0;
    flex: 1;
  }
  .picker-name {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sea-ink);
  }
  .picker-reason {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sea-ink-soft);
  }
  .picker-rate {
    flex-shrink: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sea-ink);
  }
</style>
