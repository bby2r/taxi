<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Межгород-маршруты. Управляются оператором: «Талас→Бишкек,
     * 4 места по 600 сом». Pair (from, to) уникален.
     */
    public function up(): void
    {
        Schema::create('intercity_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_region_id')->constrained('regions')->cascadeOnDelete();
            $table->foreignId('to_region_id')->constrained('regions')->cascadeOnDelete();
            $table->unsignedSmallInteger('max_seats');
            $table->unsignedInteger('price_per_seat');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['from_region_id', 'to_region_id']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intercity_routes');
    }
};
