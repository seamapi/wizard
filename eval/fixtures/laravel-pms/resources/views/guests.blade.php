@extends('layouts.app')

@section('title', 'Guests · Laravel PMS')

@section('content')
  <h1>Guests</h1>
  <p>{{ count($guests) }} unique guest(s)</p>

  @if (empty($guests))
    <div class="card">No guests yet.</div>
  @else
    @foreach ($guests as $guest)
      <article class="card">
        <strong>{{ $guest['name'] }}</strong>
        <div>
          <a href="mailto:{{ $guest['email'] }}">{{ $guest['email'] }}</a> ·
          <a href="tel:{{ $guest['phone'] }}">{{ $guest['phone'] }}</a>
        </div>
        <div>{{ $guest['reservation_count'] }} reservation(s)</div>
      </article>
    @endforeach
  @endif
@endsection
