<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->unsignedInteger('shift_declines_count')->default(0)->after('location_updated_at');
            $table->timestamp('blocked_until')->nullable()->after('shift_declines_count');
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dropColumn(['shift_declines_count', 'blocked_until']);
        });
    }
};
