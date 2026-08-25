<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use Illuminate\View\View;

/**
 * The derived guests page: unique guests (deduped by email), with how many
 * reservations each has. There is no guests table — this view is computed from
 * reservations on the fly.
 */
class GuestController extends Controller
{
    public function index(): View
    {
        $reservations = Reservation::query()
            ->orderByDesc('created_at')
            ->get();

        $byEmail = [];
        foreach ($reservations as $reservation) {
            $key = strtolower(trim($reservation->email));

            if (isset($byEmail[$key])) {
                $byEmail[$key]['reservation_count']++;
            } else {
                // rows are newest-first, so the first hit is the guest's latest details
                $byEmail[$key] = [
                    'name' => $reservation->guest_name,
                    'email' => $reservation->email,
                    'phone' => $reservation->phone,
                    'reservation_count' => 1,
                ];
            }
        }

        return view('guests', ['guests' => array_values($byEmail)]);
    }
}
