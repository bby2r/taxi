<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * day_price / night_price больше не редактируются через карточку
     * района — межсельные цены живут в region_routes (матрица «откуда →
     * куда»). Колонки остаются как технический fallback в Region::priceFrom()
     * на случай если оператор не заполнил ячейку: тогда вернётся 0
     * (вместо ошибки), и в матрице будет видно пустую клетку.
     *
     * Делаем nullable + default 0, чтобы создание района из админки
     * без этих полей не падало с NOT NULL constraint violation.
     */
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->unsignedInteger('day_price')->default(0)->nullable()->change();
            $table->unsignedInteger('night_price')->default(0)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->unsignedInteger('day_price')->default(0)->nullable(false)->change();
            $table->unsignedInteger('night_price')->default(0)->nullable(false)->change();
        });
    }
};
