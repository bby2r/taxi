<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Расчётное время прибытия водителя к pickup'у. Записывается один раз
            // после accept, когда водительское приложение построит первый маршрут
            // через ORS/OSRM. Используется для индикатора «не успевает»
            // на стороне водителя (красный обратный отсчёт) и в админке.
            $table->timestamp('expected_arrival_at')->nullable()->after('accepted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('expected_arrival_at');
        });
    }
};
