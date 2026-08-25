<?php

namespace App\Exceptions;

use Exception;

/**
 * A guest-readable reason a space can't take a stay (missing, archived, too
 * small, or already booked). Thrown by AvailabilityService and surfaced back to
 * the form as a friendly message.
 */
class BookingException extends Exception
{
}
