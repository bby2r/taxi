<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Флаг is_intercity_only разделяет «сервисные» села (где живут
 * клиенты — Кировка, Покровка) от «межгород-направлений» (Бишкек,
 * Талас): destination-only регионы видны только в админке межгорода
 * и не засоряют матрицу межсёлами + не показываются клиенту как
 * «куда ехать» внутри обычного такси.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->boolean('is_intercity_only')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('regions', function (Blueprint $table) {
            $table->dropColumn('is_intercity_only');
        });
    }
};
