<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $settings = [
            ['key' => 'day_price', 'value' => '80', 'description' => 'Day tariff (7:00-21:00) in som'],
            ['key' => 'night_price', 'value' => '120', 'description' => 'Night tariff (21:00-7:00) in som'],
            ['key' => 'cancellation_fee', 'value' => '50', 'description' => 'Cancellation fee in som'],
            ['key' => 'max_search_radius_km', 'value' => '10', 'description' => 'Maximum driver search radius in kilometers'],
            ['key' => 'stale_active_order_hours', 'value' => '2', 'description' => 'Auto-cancel orders stuck in Accepted/Arrived longer than this many hours (0 disables).'],
        ];

        foreach ($settings as $setting) {
            Setting::updateOrCreate(
                ['key' => $setting['key']],
                [
                    'value' => $setting['value'],
                    'description' => $setting['description'],
                ],
            );
        }
    }
}
