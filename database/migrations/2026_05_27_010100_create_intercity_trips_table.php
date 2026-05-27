<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Межгород-поездка. Создаётся в момент когда водитель принимает
     * batch заявок (sum(seats) >= route.max_seats). Содержит снапшоты
     * водителя/тарифа на момент принятия — чтобы поздние изменения
     * профиля/цены не влияли на уже принятый рейс.
     */
    public function up(): void
    {
        Schema::create('intercity_trips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained('intercity_routes')->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained('users')->cascadeOnDelete();
            $table->date('departure_date');

            // Snapshots на момент accept — защита от изменений в админке.
            $table->unsignedSmallInteger('max_seats');
            $table->unsignedInteger('price_per_seat');

            // Driver snapshot — чтобы данные водителя/машины сохранились
            // даже если водитель потом удалит профиль.
            $table->string('driver_name')->nullable();
            $table->string('driver_phone')->nullable();
            $table->string('car_model')->nullable();
            $table->string('car_number')->nullable();

            $table->string('status', 20)->default('matched');
            $table->unsignedInteger('commission_amount')->nullable();

            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('departed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_by', 20)->nullable();
            $table->timestamps();

            $table->index(['driver_id', 'status']);
            $table->index(['route_id', 'departure_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intercity_trips');
    }
};
