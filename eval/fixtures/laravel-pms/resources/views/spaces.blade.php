@extends('layouts.app')

@section('title', 'Spaces · Laravel PMS')

@section('content')
  <h1>Spaces</h1>

  @php($formError = session('error') ?? ($errors->any() ? $errors->first() : null))
  @if ($formError)
    <p class="error">{{ $formError }}</p>
  @endif

  <form method="post" action="/spaces" class="card">
    @csrf
    <h2>Add a space</h2>
    <label for="name">Name</label>
    <input id="name" name="name" value="{{ old('name') }}" required />

    <label for="kind">Kind</label>
    <select id="kind" name="kind">
      @foreach ($kinds as $kind)
        <option value="{{ $kind }}" {{ old('kind') === $kind ? 'selected' : '' }}>
          {{ \App\SpaceKinds::label($kind) }}
        </option>
      @endforeach
    </select>

    <label for="capacity">Capacity</label>
    <input id="capacity" name="capacity" type="number" min="1" max="40" value="{{ old('capacity', 2) }}" />

    <label for="rate">Nightly rate</label>
    <input id="rate" name="rate" type="number" min="0" step="0.01" value="{{ old('rate') }}" />

    <label for="notes">Notes</label>
    <textarea id="notes" name="notes" rows="2">{{ old('notes') }}</textarea>

    <p><button type="submit">Add space</button></p>
  </form>

  @foreach ($spaces as $space)
    <article class="card">
      <strong>{{ $space->name }}</strong> · {{ \App\SpaceKinds::label($space->kind) }} · sleeps {{ $space->capacity }}
      <span class="badge" style="background: #e2e8f0">{{ $space->status }}</span>
      @if ($space->rate_cents)
        <div>Rate: {{ number_format($space->rate_cents / 100, 2) }} / night</div>
      @endif
      @if ($space->notes)
        <p><em>{{ $space->notes }}</em></p>
      @endif
      <form method="post" action="/spaces/{{ $space->id }}/status" style="display: inline">
        @csrf
        <input
          type="hidden"
          name="status"
          value="{{ $space->status === 'active' ? 'archived' : 'active' }}"
        />
        <button type="submit">{{ $space->status === 'active' ? 'Archive' : 'Restore' }}</button>
      </form>
    </article>
  @endforeach
@endsection
