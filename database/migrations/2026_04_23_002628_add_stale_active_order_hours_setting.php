<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Setting::updateOrCreate(
            ['key' => 'stale_active_order_hours'],
            [
                'value' => '2',
                'description' => 'Auto-cancel orders stuck in Accepted/Arrived longer than this many hours (0 disables).',
            ],
        );
    }

    public function down(): void
    {
        Setting::where('key', 'stale_active_order_hours')->delete();
    }
};
