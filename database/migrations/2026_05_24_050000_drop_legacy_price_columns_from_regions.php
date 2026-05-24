<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Все цены теперь живут в region_routes (матрица «откуда → куда»),
     * включая диагональ (from == to = цена внутри района). Координаты
     * центра больше не нужны — район выбирается клиентом вручную, без
     * автоопределения по GPS. Регион — это просто название.
     */
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->dropColumn([
                'day_price',
                'night_price',
                'in_district_day_price',
                'in_district_night_price',
                'center_latitude',
                'center_longitude',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->unsignedInteger('day_price')->default(0)->nullable();
            $table->unsignedInteger('night_price')->default(0)->nullable();
            $table->unsignedInteger('in_district_day_price')->nullable();
            $table->unsignedInteger('in_district_night_price')->nullable();
            $table->decimal('center_latitude', 10, 7)->nullable();
            $table->decimal('center_longitude', 10, 7)->nullable();
        });
    }
};
