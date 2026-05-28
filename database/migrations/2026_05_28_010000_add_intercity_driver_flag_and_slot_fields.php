<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            // Оператор отмечает водителей с подходящей машиной и
            // репутацией. Только они видят межгород-таб и могут
            // claim'ить слоты. По умолчанию false.
            $table->boolean('accepts_intercity')->default(false)->after('shift_declines_count');
            $table->index('accepts_intercity');
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dropIndex(['accepts_intercity']);
            $table->dropColumn('accepts_intercity');
        });
    }
};
