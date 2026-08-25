<?php

use App\Http\Controllers\BookingController;
use App\Http\Controllers\GuestController;
use App\Http\Controllers\ReservationController;
use App\Http\Controllers\SpaceController;
use Illuminate\Support\Facades\Route;

// The public booking flow.
Route::get('/', [BookingController::class, 'home']);
Route::post('/book', [BookingController::class, 'book']);

// The front desk.
Route::get('/reservations', [ReservationController::class, 'index']);
Route::post('/reservations/{reservation}/status', [ReservationController::class, 'updateStatus']);
Route::post('/reservations/{reservation}/assign', [ReservationController::class, 'assign']);
Route::post('/reservations/{reservation}/delete', [ReservationController::class, 'destroy']);

// The derived guests page.
Route::get('/guests', [GuestController::class, 'index']);

// Space inventory.
Route::get('/spaces', [SpaceController::class, 'index']);
Route::post('/spaces', [SpaceController::class, 'store']);
Route::post('/spaces/{space}', [SpaceController::class, 'update']);
Route::post('/spaces/{space}/status', [SpaceController::class, 'setStatus']);
