<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Бронь места(-ов) клиентом. Создаётся со status=pending. Когда
     * накапливается max_seats по route+date — рассылается водителям;
     * первый принявший привязывает старейшие brokings к своему trip
     * (trip_id), статус становится matched.
     */
    public function up(): void
    {
        Schema::create('intercity_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('route_id')->constrained('intercity_routes')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('trip_id')->nullable()->constrained('intercity_trips')->nullOnDelete();

            $table->date('departure_date');
            $table->unsignedTinyInteger('seats_count');
            $table->string('pickup_address')->nullable();

            // Client snapshot — для отображения водителю даже если
            // клиент удалил аккаунт.
            $table->string('client_name')->nullable();
            $table->string('client_phone')->nullable();

            $table->string('status', 20)->default('pending');
            $table->string('cancelled_by', 20)->nullable();

            $table->timestamp('matched_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['route_id', 'departure_date', 'status']);
            $table->index(['client_id', 'status']);
            $table->index('trip_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intercity_bookings');
    }
};
