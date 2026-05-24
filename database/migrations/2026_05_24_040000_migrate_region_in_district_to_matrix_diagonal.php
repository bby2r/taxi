<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Перенос существующих in_district_day_price/in_district_night_price
     * в матрицу region_routes (диагональ from == to). Цены «в селе»
     * теперь живут только в матрице — единое место для всех тарифов.
     *
     * Запускается ДО drop-миграции колонок, чтобы данные не пропали.
     */
    public function up(): void
    {
        $regions = DB::table('regions')
            ->whereNotNull('in_district_day_price')
            ->orWhereNotNull('in_district_night_price')
            ->get(['id', 'in_district_day_price', 'in_district_night_price']);

        $now = now();

        foreach ($regions as $region) {
            // Если хотя бы одно поле задано — пишем диагональ. Берём заданное
            // значение или 0, чтобы NOT NULL constraint матрицы не упал.
            $day = $region->in_district_day_price ?? 0;
            $night = $region->in_district_night_price ?? 0;

            DB::table('region_routes')->updateOrInsert(
                ['from_region_id' => $region->id, 'to_region_id' => $region->id],
                [
                    'day_price' => $day,
                    'night_price' => $night,
                    'updated_at' => $now,
                    'created_at' => $now,
                ],
            );
        }
    }

    public function down(): void
    {
        // Удаляем только диагональные записи, добавленные этой миграцией.
        DB::statement('DELETE FROM region_routes WHERE from_region_id = to_region_id');
    }
};
