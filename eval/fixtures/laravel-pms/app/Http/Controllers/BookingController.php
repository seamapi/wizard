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
 * The public booking flow: the landing page and the form that creates a stay.
 */
class BookingController extends Controller
{
    public function __construct(private readonly AvailabilityService $availability)
    {
    }

    /** The landing page with the booking form and the list of spaces. */
    public function home(): View
    {
        $spaces = Space::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        return view('book', ['spaces' => $spaces]);
    }

    /** Create a reservation from the public booking form. */
    public function book(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'guest_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email'],
            'phone' => ['required', 'string', 'min:5'],
            'check_in' => ['required', 'date'],
            'check_out' => ['required', 'date', 'after:check_in'],
            'party_size' => ['integer', 'min:1', 'max:20'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'space_id' => ['nullable', 'integer', 'exists:spaces,id'],
        ]);

        $spaceId = isset($data['space_id']) ? (int) $data['space_id'] : null;
        $partySize = (int) ($data['party_size'] ?? 1);

        if ($spaceId !== null) {
            try {
                $this->availability->assertSpaceBookable(
                    spaceId: $spaceId,
                    checkIn: $data['check_in'],
                    checkOut: $data['check_out'],
                    partySize: $partySize,
                );
            } catch (BookingException $error) {
                return back()->withInput()->with('error', $error->getMessage());
            }
        }

        Reservation::create([
            'guest_name' => $data['guest_name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'check_in' => $data['check_in'],
            'check_out' => $data['check_out'],
            'party_size' => $partySize,
            'notes' => $data['notes'] ?? null,
            'space_id' => $spaceId,
        ]);

        return redirect('/reservations');
    }
}
