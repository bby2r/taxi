<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // DriverBalanceService::earningsForPeriod scans by
            // (driver_id, status, completed_at >= X). status+driver_id are
            // already indexed via Laravel defaults / fk; completed_at wasn't.
            // Add a composite that covers the weekly billing dashboards.
            $table->index(['driver_id', 'completed_at'], 'orders_driver_completed_at_idx');

            // Inter-district dispatch + admin filters look up by region_id.
            $table->index('region_id', 'orders_region_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex('orders_driver_completed_at_idx');
            $table->dropIndex('orders_region_id_idx');
        });
    }
};
