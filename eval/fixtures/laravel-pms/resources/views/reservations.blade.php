@extends('layouts.app')

@section('title', 'Reservations · Laravel PMS')

@section('content')
  <h1>Reservations</h1>
  <p>{{ $reservations->count() }} total</p>

  @if ($reservations->isEmpty())
    <div class="card">No reservations yet. Once guests book, they'll show up here.</div>
  @else
    @foreach ($reservations as $reservation)
      <article class="card">
        <div>
          <strong>{{ $reservation->guest_name }}</strong>
          <span
            class="badge"
            style="background: @if ($reservation->status === 'confirmed') #d1fae5 @elseif ($reservation->status === 'cancelled') #fee2e2 @else #fef3c7 @endif"
          >
            {{ $reservation->status }}
          </span>
          <span>#{{ $reservation->id }}</span>
        </div>
        <div>
          <a href="mailto:{{ $reservation->email }}">{{ $reservation->email }}</a> ·
          <a href="tel:{{ $reservation->phone }}">{{ $reservation->phone }}</a> ·
          {{ $reservation->party_size }} guest(s)
        </div>
        <div>{{ $reservation->check_in }} → {{ $reservation->check_out }}</div>
        @if ($reservation->notes)
          <p><em>"{{ $reservation->notes }}"</em></p>
        @endif

        <form method="post" action="/reservations/{{ $reservation->id }}/assign">
          @csrf
          <label for="space-{{ $reservation->id }}">Space</label>
          <select id="space-{{ $reservation->id }}" name="space_id" onchange="this.form.submit()">
            <option value="">Unassigned</option>
            @foreach ($spaces as $space)
              @if ($space->status === 'active' || $space->id === $reservation->space_id)
                <option value="{{ $space->id }}" {{ $space->id === $reservation->space_id ? 'selected' : '' }}>
                  {{ $space->name }} · {{ \App\SpaceKinds::label($space->kind) }} · sleeps {{ $space->capacity }}@if ($space->status === 'archived') (archived)@endif
                </option>
              @endif
            @endforeach
          </select>
        </form>

        <div>
          @if ($reservation->status !== 'confirmed')
            <form method="post" action="/reservations/{{ $reservation->id }}/status" style="display: inline">
              @csrf
              <input type="hidden" name="status" value="confirmed" />
              <button type="submit">Confirm</button>
            </form>
          @endif
          @if ($reservation->status !== 'cancelled')
            <form method="post" action="/reservations/{{ $reservation->id }}/status" style="display: inline">
              @csrf
              <input type="hidden" name="status" value="cancelled" />
              <button type="submit">Cancel</button>
            </form>
          @endif
          <form method="post" action="/reservations/{{ $reservation->id }}/delete" style="display: inline">
            @csrf
            <button type="submit">Delete</button>
          </form>
        </div>
      </article>
    @endforeach
  @endif
@endsection
