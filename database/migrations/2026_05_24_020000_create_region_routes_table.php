<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Origin-destination price matrix. When a row exists for the pair
        // (pickup_region → destination_region), inter-village orders use
        // its day/night price instead of destination's flat tariff —
        // solves "Бакаирец и Кировец платят одну цену до Таласа, хотя
        // расстояние в 3 раза разное". When the row is missing the
        // service falls back to destination.day_price/night_price.
        Schema::create('region_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_region_id')->constrained('regions')->cascadeOnDelete();
            $table->foreignId('to_region_id')->constrained('regions')->cascadeOnDelete();
            $table->unsignedInteger('day_price');
            $table->unsignedInteger('night_price');
            $table->timestamps();

            $table->unique(['from_region_id', 'to_region_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('region_routes');
    }
};
