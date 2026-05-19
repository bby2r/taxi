<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Setting::updateOrCreate(
            ['key' => 'live_heartbeat_seconds'],
            [
                'value' => '60',
                'description' => 'Max seconds since driver location ping before they are excluded from dispatch (is_online stays). Lower = faster dead-driver detection; higher = tolerant of background pauses.',
            ],
        );
    }

    public function down(): void
    {
        Setting::where('key', 'live_heartbeat_seconds')->delete();
    }
};
