<?php

namespace Tests\Feature\Models;

use App\Models\Setting;
use Database\Seeders\SettingSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_setting_can_be_created_with_factory(): void
    {
        $setting = Setting::factory()->create();

        $this->assertDatabaseHas('settings', [
            'id' => $setting->id,
            'key' => $setting->key,
            'value' => $setting->value,
        ]);
    }

    public function test_key_is_unique(): void
    {
        Setting::factory()->create(['key' => 'duplicate_key']);

        $this->expectException(QueryException::class);

        Setting::factory()->create(['key' => 'duplicate_key']);
    }

    public function test_get_value_returns_value_for_existing_key(): void
    {
        Setting::factory()->create([
            'key' => 'test_key',
            'value' => '42',
        ]);

        $this->assertSame('42', Setting::getValue('test_key'));
    }

    public function test_get_value_returns_default_for_missing_key(): void
    {
        $this->assertSame('fallback', Setting::getValue('missing', 'fallback'));
    }

    public function test_get_value_returns_null_for_missing_key_without_default(): void
    {
        $this->assertNull(Setting::getValue('missing'));
    }

    public function test_for_key_scope(): void
    {
        Setting::factory()->create(['key' => 'alpha']);
        Setting::factory()->create(['key' => 'beta']);
        Setting::factory()->create(['key' => 'gamma']);

        $results = Setting::forKey('beta')->get();

        $this->assertCount(1, $results);
        $this->assertSame('beta', $results->first()->key);
    }

    public function test_setting_seeder_creates_expected_keys(): void
    {
        $this->seed(SettingSeeder::class);

        $this->assertDatabaseHas('settings', ['key' => 'day_price', 'value' => '80']);
        $this->assertDatabaseHas('settings', ['key' => 'night_price', 'value' => '120']);
        $this->assertDatabaseHas('settings', ['key' => 'cancellation_fee', 'value' => '50']);
        $this->assertDatabaseHas('settings', ['key' => 'max_search_radius_km', 'value' => '10']);
        $this->assertDatabaseHas('settings', ['key' => 'stale_active_order_hours', 'value' => '2']);
    }

    public function test_setting_seeder_is_idempotent(): void
    {
        $this->seed(SettingSeeder::class);
        $this->seed(SettingSeeder::class);

        $this->assertSame(5, Setting::count());
    }
}
