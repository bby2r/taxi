<?php

namespace Database\Seeders;

use App\Models\Region;
use Illuminate\Database\Seeder;

/**
 * Three launch districts for the manual «откуда → куда» pricing model.
 * Цены задаются оператором в /admin/region-routes (включая диагональ —
 * «внутри села» цена). Этот сидер создаёт только структуру.
 *
 * Re-runnable: matches on name and updates the rest.
 */
class LaunchDistrictsSeeder extends Seeder
{
    public function run(): void
    {
        $districts = [
            ['name' => 'Талас', 'sort_order' => 10],
            ['name' => 'Кировка', 'sort_order' => 20],
            ['name' => 'Покровка', 'sort_order' => 30],
        ];

        foreach ($districts as $district) {
            Region::updateOrCreate(
                ['name' => $district['name']],
                [...$district, 'is_active' => true],
            );
        }
    }
}
