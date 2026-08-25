<?php

namespace App\Http\Controllers;

use App\Exceptions\BookingException;
use App\Models\Reservation;
use App\Models\Space;
use App\Services\AvailabilityService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * The front desk: list reservations, change status, assign a space, delete.
 */
class ReservationController extends Controller
{
    public function __construct(private readonly AvailabilityService $availability)
    {
    }

    /** The front-desk list, with the spaces available for reassignment. */
    public function index(): View
    {
        $reservations = Reservation::query()
            ->with('space')
            ->orderByDesc('created_at')
            ->get();

        $spaces = Space::query()
            ->orderBy('status')
            ->orderBy('name')
            ->get();

        return view('reservations', [
            'reservations' => $reservations,
            'spaces' => $spaces,
        ]);
    }

    /** Update a reservation's status (front desk). */
    public function updateStatus(Request $request, Reservation $reservation): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,confirmed,cancelled'],
        ]);

        // Cancelling releases the space, so reviving a cancelled stay has to win
        // its space back — someone else may have taken it in the meantime.
        if (
            $reservation->status === 'cancelled'
            && $data['status'] !== 'cancelled'
            && $reservation->space_id !== null
        ) {
            try {
                $this->availability->assertSpaceBookable(
                    spaceId: $reservation->space_id,
                    checkIn: $reservation->check_in,
                    checkOut: $reservation->check_out,
                    partySize: $reservation->party_size,
                    excludeReservationId: $reservation->id,
                );
            } catch (BookingException) {
                return redirect('/reservations');
            }
        }

        $reservation->update(['status' => $data['status']]);

        return redirect('/reservations');
    }

    /** Assign, move, or clear a reservation's space (front desk). */
    public function assign(Request $request, Reservation $reservation): RedirectResponse
    {
        $data = $request->validate([
            'space_id' => ['nullable', 'integer', 'exists:spaces,id'],
        ]);

        $spaceId = isset($data['space_id']) ? (int) $data['space_id'] : null;

        if ($spaceId !== null) {
            try {
                $this->availability->assertSpaceBookable(
                    spaceId: $spaceId,
                    checkIn: $reservation->check_in,
                    checkOut: $reservation->check_out,
                    partySize: $reservation->party_size,
                    excludeReservationId: $reservation->id,
                );
            } catch (BookingException) {
                return redirect('/reservations');
            }
        }

        $reservation->update(['space_id' => $spaceId]);

        return redirect('/reservations');
    }

    /** Delete a reservation (front desk). */
    public function destroy(Reservation $reservation): RedirectResponse
    {
        $reservation->delete();

        return redirect('/reservations');
    }
}
