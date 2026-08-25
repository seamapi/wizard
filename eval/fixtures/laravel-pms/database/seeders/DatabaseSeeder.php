<?php

namespace Database\Seeders;

use App\Models\Space;
use Illuminate\Database\Seeder;

/**
 * Seed a few spaces so the booking form's picker isn't empty on a fresh clone.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $spaces = [
            [
                'name' => 'Seagrass Suite',
                'kind' => 'suite',
                'capacity' => 4,
                'rate_cents' => 24_000,
                'notes' => 'Ocean view, walk-in shower',
            ],
            [
                'name' => 'Dune Cabin',
                'kind' => 'cabin',
                'capacity' => 2,
                'rate_cents' => 16_000,
                'notes' => null,
            ],
            [
                'name' => 'Harbor Room 101',
                'kind' => 'room',
                'capacity' => 2,
                'rate_cents' => 12_000,
                'notes' => null,
            ],
        ];

        foreach ($spaces as $space) {
            Space::firstOrCreate(['name' => $space['name']], $space);
        }
    }
}
