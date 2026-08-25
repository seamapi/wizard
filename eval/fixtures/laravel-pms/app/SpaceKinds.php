<?php

namespace App;

/**
 * The kinds of bookable space a property can offer, plus their display labels.
 *
 * Kept in one place so the booking form, the inventory page, and the front desk
 * all render the same labels.
 */
class SpaceKinds
{
    /** @var list<string> */
    public const KINDS = ['room', 'suite', 'cabin', 'villa', 'tent', 'other'];

    /** @var array<string, string> */
    public const LABELS = [
        'room' => 'Room',
        'suite' => 'Suite',
        'cabin' => 'Cabin',
        'villa' => 'Villa',
        'tent' => 'Tent',
        'other' => 'Space',
    ];

    /** Human label for a kind, falling back to the generic "Space". */
    public static function label(string $kind): string
    {
        return self::LABELS[$kind] ?? 'Space';
    }
}
