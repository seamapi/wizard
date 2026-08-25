<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A bookable space (room, suite, cabin…).
 *
 * Spaces are archived rather than deleted so past reservations keep pointing at
 * something real.
 *
 * @property int $id
 * @property string $name
 * @property string $kind
 * @property int $capacity
 * @property int|null $rate_cents
 * @property string $status
 * @property string|null $notes
 */
class Space extends Model
{
    /** Only a created_at timestamp — the domain has no updated_at. */
    const UPDATED_AT = null;

    protected $fillable = [
        'name',
        'kind',
        'capacity',
        'rate_cents',
        'status',
        'notes',
    ];

    protected $attributes = [
        'kind' => 'room',
        'capacity' => 2,
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'rate_cents' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
