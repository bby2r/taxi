<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();

        Setting::factory()->create(['key' => 'day_price', 'value' => '80']);
        Setting::factory()->create(['key' => 'night_price', 'value' => '120']);
        Setting::factory()->create(['key' => 'cancellation_fee', 'value' => '50']);
        Setting::factory()->create(['key' => 'max_search_radius_km', 'value' => '10']);
    }

    public function test_settings_page_loads_with_current_values(): void
    {
        $response = $this->actingAs($this->admin)->get(route('admin.settings.index'));

        $response->assertOk();
        $response->assertSee('80');
        $response->assertSee('120');
        $response->assertSee('50');
        $response->assertSee('10');
    }

    public function test_admin_can_update_settings(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.settings.update'), [
            'day_price' => 200,
            'night_price' => 300,
            'cancellation_fee' => 50,
            'max_search_radius_km' => 15,
        ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertEquals('200', Setting::getValue('day_price'));
        $this->assertEquals('300', Setting::getValue('night_price'));
        $this->assertEquals('50', Setting::getValue('cancellation_fee'));
        $this->assertEquals('15', Setting::getValue('max_search_radius_km'));
    }

    public function test_settings_update_validates_required_fields(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.settings.update'), []);

        $response->assertSessionHasErrors(['day_price', 'night_price', 'cancellation_fee', 'max_search_radius_km']);
    }

    public function test_settings_update_validates_numeric_types(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.settings.update'), [
            'day_price' => 'abc',
            'night_price' => 300,
            'cancellation_fee' => 50,
            'max_search_radius_km' => 15,
        ]);

        $response->assertSessionHasErrors(['day_price']);
    }

    public function test_settings_update_validates_min_zero(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.settings.update'), [
            'day_price' => -10,
            'night_price' => 300,
            'cancellation_fee' => 50,
            'max_search_radius_km' => 15,
        ]);

        $response->assertSessionHasErrors(['day_price']);
    }

    public function test_max_search_radius_accepts_decimal(): void
    {
        $response = $this->actingAs($this->admin)->put(route('admin.settings.update'), [
            'day_price' => 80,
            'night_price' => 120,
            'cancellation_fee' => 50,
            'max_search_radius_km' => 7.5,
        ]);

        $response->assertRedirect();
        $this->assertEquals('7.5', Setting::getValue('max_search_radius_km'));
    }

    public function test_non_admin_cannot_access_settings(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        $response = $this->actingAs($client)->get(route('admin.settings.index'));

        $response->assertRedirect();
    }

    public function test_guest_cannot_access_settings(): void
    {
        $response = $this->get(route('admin.settings.index'));

        $this->assertNotEquals(200, $response->getStatusCode());
    }
}
