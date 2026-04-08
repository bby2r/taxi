<?php

namespace Tests\Feature\Http\Api\V1;

use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Region;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientRegionalOrderTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    /** Pickup coordinates near Bishkek center */
    private float $pickupLat = 42.8746;

    private float $pickupLon = 74.5698;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();

        $this->client = User::factory()->create(['role' => UserRole::Client]);
        Sanctum::actingAs($this->client);
    }

    public function test_create_regional_order_returns_201(): void
    {
        $region = Region::factory()->create();
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
            'region_id' => $region->id,
        ]);

        $response->assertStatus(201);
    }

    public function test_regional_order_price_comes_from_region(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 10:00', 'Asia/Bishkek'));

        $region = Region::factory()->withPrices(90, 150)->create();
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
            'region_id' => $region->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.price', 90);
    }

    public function test_regional_order_price_uses_night_price_at_night(): void
    {
        $this->travelTo(Carbon::parse('2026-04-06 22:00', 'Asia/Bishkek'));

        $region = Region::factory()->withPrices(90, 150)->create();
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
            'region_id' => $region->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.price', 150);
    }

    public function test_regional_order_includes_region_in_response(): void
    {
        $region = Region::factory()->create(['name' => 'Karakol']);
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
            'region_id' => $region->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.region.id', $region->id);
        $response->assertJsonPath('data.region.name', 'Karakol');
    }

    public function test_regional_order_rejects_inactive_region(): void
    {
        $region = Region::factory()->inactive()->create();
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
            'region_id' => $region->id,
        ]);

        $response->assertStatus(422);
    }

    public function test_regional_order_rejects_non_existent_region(): void
    {
        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
            'region_id' => 99999,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('region_id');
    }

    public function test_regional_order_requires_region_id(): void
    {
        $response = $this->postJson('/api/v1/client/orders/regional', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('region_id');
    }

    public function test_regional_order_requires_pickup_coordinates(): void
    {
        $region = Region::factory()->create();

        $response = $this->postJson('/api/v1/client/orders/regional', [
            'region_id' => $region->id,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('pickup_latitude');
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    private function createNearbyDriver(): User
    {
        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($driverUser)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();

        return $driverUser;
    }
}
