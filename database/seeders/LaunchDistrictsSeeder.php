<?php

namespace Database\Seeders;

use App\Models\Region;
use Illuminate\Database\Seeder;

/**
 * Three launch districts for the Гео-A+ pricing rollout. Centre
 * coordinates are approximate village/town centres — used by the
 * nearest-centre haversine to map a client's GPS to "which district
 * is this?". Межсельные цены здесь не задаются — оператор заполняет
 * их в /admin/region-routes (матрица «откуда → куда»).
 *
 * Re-runnable: matches on name and updates the rest, so re-running
 * after manual edits overwrites them — call only on initial setup.
 */
class LaunchDistrictsSeeder extends Seeder
{
    public function run(): void
    {
        $districts = [
            [
                'name' => 'Талас',
                'center_latitude' => 42.5228000,
                'center_longitude' => 72.2425000,
                'in_district_day_price' => 100,
                'in_district_night_price' => 150,
                'sort_order' => 10,
            ],
            [
                'name' => 'Кировка',
                'center_latitude' => 42.6411000,
                'center_longitude' => 71.5806000,
                'in_district_day_price' => 80,
                'in_district_night_price' => 120,
                'sort_order' => 20,
            ],
            [
                'name' => 'Покровка',
                'center_latitude' => 42.5667000,
                'center_longitude' => 71.9333000,
                'in_district_day_price' => 80,
                'in_district_night_price' => 120,
                'sort_order' => 30,
            ],
        ];

        foreach ($districts as $district) {
            Region::updateOrCreate(
                ['name' => $district['name']],
                [...$district, 'is_active' => true],
            );
        }
    }
}
