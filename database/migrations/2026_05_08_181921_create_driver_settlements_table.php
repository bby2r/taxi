<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->foreignId('recorded_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->unsignedInteger('amount');
            $table->string('notes')->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();

            $table->index(['driver_id', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_settlements');
    }
};
