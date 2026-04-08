<?php

namespace Tests\Feature\Http\Api\V1;

use App\Enums\UserRole;
use App\Models\Region;
use App\Models\Setting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RegionControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->create(['role' => UserRole::Client]);
        Sanctum::actingAs($this->client);
    }

    public function test_list_regions_returns_active_only(): void
    {
        Region::factory()->count(2)->create(['is_active' => true]);
        Region::factory()->inactive()->create();

        $response = $this->getJson('/api/v1/client/regions');

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
    }

    public function test_list_regions_returns_day_price_during_day(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 10:00', 'Asia/Bishkek'));

        Region::factory()->withPrices(90, 140)->create();

        $response = $this->getJson('/api/v1/client/regions');

        $response->assertOk();
        $response->assertJsonPath('data.0.price', 90);
    }

    public function test_list_regions_returns_night_price_during_night(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 22:00', 'Asia/Bishkek'));

        Region::factory()->withPrices(90, 140)->create();

        $response = $this->getJson('/api/v1/client/regions');

        $response->assertOk();
        $response->assertJsonPath('data.0.price', 140);
    }

    public function test_list_regions_ordered_by_sort_order(): void
    {
        Region::factory()->create(['name' => 'Third', 'sort_order' => 3]);
        Region::factory()->create(['name' => 'First', 'sort_order' => 1]);
        Region::factory()->create(['name' => 'Second', 'sort_order' => 2]);

        $response = $this->getJson('/api/v1/client/regions');

        $response->assertOk();
        $response->assertJsonPath('data.0.name', 'First');
        $response->assertJsonPath('data.1.name', 'Second');
        $response->assertJsonPath('data.2.name', 'Third');
    }

    public function test_list_regions_response_structure(): void
    {
        Region::factory()->create();

        $response = $this->getJson('/api/v1/client/regions');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                '*' => ['id', 'name', 'price'],
            ],
        ]);
    }

    public function test_list_regions_requires_authentication(): void
    {
        // Reset auth so no user is acting
        $this->app['auth']->forgetGuards();

        $response = $this->getJson('/api/v1/client/regions');

        $response->assertStatus(401);
    }

    public function test_current_price_endpoint_returns_day_price(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 10:00', 'Asia/Bishkek'));

        Setting::create(['key' => 'day_price', 'value' => '80']);

        $response = $this->getJson('/api/v1/client/price');

        $response->assertOk();
        $response->assertJsonPath('price', 80);
    }
}
