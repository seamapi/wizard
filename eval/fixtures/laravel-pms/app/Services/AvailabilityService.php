<?php

namespace App\Services;

use App\Exceptions\BookingException;
use App\Models\Reservation;
use App\Models\Space;

/**
 * Availability helpers shared by booking and front-desk reassignment.
 */
class AvailabilityService
{
    /**
     * Space ids already held for the given range, excluding one reservation.
     *
     * Reservations hold a space for the half-open interval [check_in, check_out),
     * so a same-day turnover (one guest out, the next in) is not a conflict.
     * Cancelled reservations release the space.
     *
     * @return list<int>
     */
    public function bookedSpaceIds(
        string $checkIn,
        string $checkOut,
        ?int $excludeReservationId = null,
    ): array {
        $query = Reservation::query()
            ->whereNotNull('space_id')
            ->where('status', '!=', 'cancelled')
            // ISO YYYY-MM-DD sorts lexicographically, so text compare is date compare.
            ->where('check_in', '<', $checkOut)
            ->where('check_out', '>', $checkIn);

        if ($excludeReservationId !== null) {
            $query->where('id', '!=', $excludeReservationId);
        }

        return $query->pluck('space_id')
            ->filter(fn ($spaceId) => $spaceId !== null)
            ->map(fn ($spaceId) => (int) $spaceId)
            ->all();
    }

    /**
     * Assert a space can take a stay, throwing BookingException if not.
     */
    public function assertSpaceBookable(
        int $spaceId,
        string $checkIn,
        string $checkOut,
        int $partySize,
        ?int $excludeReservationId = null,
    ): Space {
        $space = Space::find($spaceId);

        if ($space === null) {
            throw new BookingException('That space no longer exists.');
        }
        if ($space->status !== 'active') {
            throw new BookingException("{$space->name} is archived and can't be booked.");
        }
        if ($partySize > $space->capacity) {
            throw new BookingException(
                "{$space->name} sleeps {$space->capacity}, but this stay is for {$partySize}."
            );
        }

        $booked = $this->bookedSpaceIds($checkIn, $checkOut, $excludeReservationId);
        if (in_array($spaceId, $booked, true)) {
            throw new BookingException("{$space->name} is already booked for those dates.");
        }

        return $space;
    }
}
