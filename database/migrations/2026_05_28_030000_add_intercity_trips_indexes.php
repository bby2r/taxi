<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hot-path запросы:
 *   - /driver/intercity/available и /client/intercity/slots: WHERE status=Open
 *     AND departure_at > now() ORDER BY departure_at (поллится каждые 8–15с)
 *   - intercity:expire-stale-slots: WHERE status IN (Open,Claimed) AND
 *     departure_at < cutoff (cron hourly)
 *   - generateSlotsForDate exists(): WHERE schedule_id=? AND departure_date=?
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intercity_trips', function (Blueprint $table) {
            $table->index(['status', 'departure_at']);
            $table->index(['schedule_id', 'departure_date']);
        });
    }

    public function down(): void
    {
        Schema::table('intercity_trips', function (Blueprint $table) {
            $table->dropIndex(['status', 'departure_at']);
            $table->dropIndex(['schedule_id', 'departure_date']);
        });
    }
};
