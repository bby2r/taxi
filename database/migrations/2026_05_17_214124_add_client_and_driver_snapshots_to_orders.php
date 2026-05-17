<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshot the client + driver identity onto each order so admin
     * history keeps working after a user is deleted (driver FK is
     * on_delete set null, client FK is cascade) or after a driver
     * edits their car / name in profile settings — historical orders
     * should reflect the data as-of the ride, not whatever the live
     * relation happens to return today.
     *
     * Stored as JSON for flexibility: { name, phone, car_model, car_number }
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->json('client_snapshot')->nullable()->after('client_id');
            $table->json('driver_snapshot')->nullable()->after('driver_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['client_snapshot', 'driver_snapshot']);
        });
    }
};
