@extends('layouts.app')

@section('title', 'Book a stay · Laravel PMS')

@section('content')
  <h1>Book a stay</h1>

  @php($formError = session('error') ?? ($errors->any() ? $errors->first() : null))
  @if ($formError)
    <p class="error">{{ $formError }}</p>
  @endif

  <form method="post" action="/book" class="card">
    @csrf
    <label for="guest_name">Your name</label>
    <input id="guest_name" name="guest_name" value="{{ old('guest_name') }}" required />

    <label for="email">Email</label>
    <input id="email" name="email" type="email" value="{{ old('email') }}" required />

    <label for="phone">Phone</label>
    <input id="phone" name="phone" value="{{ old('phone') }}" required />

    <label for="check_in">Check in</label>
    <input id="check_in" name="check_in" type="date" value="{{ old('check_in') }}" required />

    <label for="check_out">Check out</label>
    <input id="check_out" name="check_out" type="date" value="{{ old('check_out') }}" required />

    <label for="party_size">Guests</label>
    <input id="party_size" name="party_size" type="number" min="1" max="20" value="{{ old('party_size', 1) }}" />

    <label for="space_id">Space</label>
    <select id="space_id" name="space_id">
      <option value="">Let the front desk assign one</option>
      @foreach ($spaces as $space)
        <option value="{{ $space->id }}" {{ (int) old('space_id') === $space->id ? 'selected' : '' }}>
          {{ $space->name }} · {{ \App\SpaceKinds::label($space->kind) }} · sleeps {{ $space->capacity }}
        </option>
      @endforeach
    </select>

    <label for="notes">Notes</label>
    <textarea id="notes" name="notes" rows="3">{{ old('notes') }}</textarea>

    <p><button type="submit">Request booking</button></p>
  </form>
@endsection
