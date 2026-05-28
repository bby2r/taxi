<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Шаблон расписания: оператор задаёт «Талас→Бишкек, ПН-ПТ, 7:00,
     * 12:00, 17:00, 7 мест по 600 сом». Каждое утро GenerateIntercity-
     * SlotsCommand создаёт по этим шаблонам пустые slot'ы на сегодня.
     * Водители их claim'ят.
     *
     * `days_of_week` — bitmask 0b1111111 (Пн..Вс), bit 0 = Понедельник.
     * Например 0b0011111 = 31 = Пн-Пт без выходных.
     */
    public function up(): void
    {
        Schema::create('intercity_route_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained('intercity_routes')->cascadeOnDelete();
            $table->unsignedTinyInteger('days_of_week');
            $table->time('departure_time');
            $table->unsignedSmallInteger('max_seats');
            $table->unsignedInteger('price_per_seat');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['route_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intercity_route_schedules');
    }
};
