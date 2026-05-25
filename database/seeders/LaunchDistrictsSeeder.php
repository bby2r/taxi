<?php

namespace Database\Seeders;

use App\Models\Region;
use Illuminate\Database\Seeder;

/**
 * Три «сервисных» района на старт: GPS-определение в радиусе ~5 км
 * вокруг центров позволит клиентам делать заказы. Координаты —
 * приблизительные центры; оператор может уточнить в /admin/regions
 * если знает точнее.
 *
 * Цены задаются отдельно в /admin/region-routes (матрица «откуда →
 * куда», включая диагональ для внутри-села тарифа).
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
                'sort_order' => 10,
            ],
            [
                'name' => 'Кировка',
                'center_latitude' => 42.6411000,
                'center_longitude' => 71.5806000,
                'sort_order' => 20,
            ],
            [
                'name' => 'Покровка',
                'center_latitude' => 42.5667000,
                'center_longitude' => 71.9333000,
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
