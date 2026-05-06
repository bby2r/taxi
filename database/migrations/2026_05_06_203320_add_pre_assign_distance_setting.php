<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Setting::updateOrCreate(
            ['key' => 'pre_assign_distance_km'],
            [
                'value' => '1.5',
                'description' => 'Pre-assign new orders to drivers in InProgress when their distance to current dropoff is below this many km (0 disables).',
            ],
        );
    }

    public function down(): void
    {
        Setting::where('key', 'pre_assign_distance_km')->delete();
    }
};
