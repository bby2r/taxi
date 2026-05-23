<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            // Two-stage stale-recovery state. MonitorStaleDriversJob reads
            // these to decide what (if anything) to send to a driver that's
            // gone quiet, and to make sure each escalation fires once per
            // stale episode rather than every minute the job runs.
            //
            // Both are reset to NULL on go-online so the next stale
            // episode starts clean.
            $table->timestamp('stale_silent_pinged_at')->nullable();
            $table->timestamp('stale_nudge_sent_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('driver_profiles', function (Blueprint $table) {
            $table->dropColumn(['stale_silent_pinged_at', 'stale_nudge_sent_at']);
        });
    }
};
