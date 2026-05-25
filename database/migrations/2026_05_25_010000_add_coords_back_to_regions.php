<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Возвращаем координаты центров районов. Логика:
     *
     * - Регион с заполненными координатами = «сервисный район»: клиент
     *   физически в нём (GPS в радиусе district_detection_max_km), может
     *   делать заказы. Pickup detection идёт через эти координаты.
     *
     * - Регион без координат = «только направление»: клиенты в нём не
     *   живут (не определяется по GPS), но можно ехать туда межсёлами
     *   из сервисного района. Это позволяет оператору добавлять
     *   сёла-направления (Манас, Бакаир и т.д.) без расширения зоны
     *   обслуживания.
     */
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->decimal('center_latitude', 10, 7)->nullable();
            $table->decimal('center_longitude', 10, 7)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->dropColumn(['center_latitude', 'center_longitude']);
        });
    }
};
