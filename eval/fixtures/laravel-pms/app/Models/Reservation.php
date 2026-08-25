<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single reservation.
 *
 * Guest contact details are stored inline (no separate accounts / login) to
 * keep the PMS minimal. Check-in / check-out are ISO YYYY-MM-DD strings, which
 * sort as dates.
 *
 * @property int $id
 * @property string $guest_name
 * @property string $email
 * @property string $phone
 * @property string $check_in
 * @property string $check_out
 * @property int $party_size
 * @property string|null $notes
 * @property int|null $space_id
 * @property string $status
 */
class Reservation extends Model
{
    /** Only a created_at timestamp — the domain has no updated_at. */
    const UPDATED_AT = null;

    protected $fillable = [
        'guest_name',
        'email',
        'phone',
        'check_in',
        'check_out',
        'party_size',
        'notes',
        'space_id',
        'status',
    ];

    protected $attributes = [
        'party_size' => 1,
        'status' => 'pending',
    ];

    protected function casts(): array
    {
        return [
            'party_size' => 'integer',
            'space_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Assigned space. Nullable: a stay can be taken before the front desk has
     * decided which space the guest gets.
     *
     * @return BelongsTo<Space, $this>
     */
    public function space(): BelongsTo
    {
        return $this->belongsTo(Space::class);
    }
}
