<?php

use App\Models\Setting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Setting::updateOrCreate(
            ['key' => 'commission_rate'],
            [
                'value' => '7',
                'description' => 'Operator commission percentage taken from each completed order (0-100). Locked onto orders at completion.',
            ],
        );
    }

    public function down(): void
    {
        Setting::where('key', 'commission_rate')->delete();
    }
};
