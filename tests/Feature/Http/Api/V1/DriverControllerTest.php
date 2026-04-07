<?php

namespace Tests\Feature\Http\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DriverControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $driver;

    private DriverProfile $driverProfile;

    /** Pickup coordinates near Bishkek center */
    private float $pickupLat = 42.8746;

    private float $pickupLon = 74.5698;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();

        $this->driver = User::factory()->driver()->create();
        $this->driverProfile = DriverProfile::factory()
            ->for($this->driver)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();
        Sanctum::actingAs($this->driver);
    }

    // ──────────────────────────────────────────────────────────────
    // go-online / go-offline
    // ──────────────────────────────────────────────────────────────

    public function test_go_online_sets_driver_online(): void
    {
        $this->driverProfile->update(['is_online' => false]);

        $response = $this->postJson('/api/v1/driver/go-online', [
            'latitude' => 42.87,
            'longitude' => 74.57,
        ]);

        $response->assertOk();
        $this->driverProfile->refresh();
        $this->assertTrue($this->driverProfile->is_online);
    }

    public function test_go_online_requires_latitude(): void
    {
        $response = $this->postJson('/api/v1/driver/go-online', [
            'longitude' => 74.57,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('latitude');
    }

    public function test_go_offline_sets_driver_offline(): void
    {
        $response = $this->postJson('/api/v1/driver/go-offline');

        $response->assertOk();
        $this->driverProfile->refresh();
        $this->assertFalse($this->driverProfile->is_online);
    }

    // ──────────────────────────────────────────────────────────────
    // location
    // ──────────────────────────────────────────────────────────────

    public function test_update_location_updates_coords(): void
    {
        $response = $this->postJson('/api/v1/driver/location', [
            'latitude' => 43.00,
            'longitude' => 75.00,
        ]);

        $response->assertOk();
        $this->driverProfile->refresh();
        $this->assertEquals(43.00, (float) $this->driverProfile->latitude);
        $this->assertEquals(75.00, (float) $this->driverProfile->longitude);
    }

    // ──────────────────────────────────────────────────────────────
    // accept / decline orders
    // ──────────────────────────────────────────────────────────────

    public function test_accept_order_returns_order(): void
    {
        $order = $this->createOrderOfferedToDriver();

        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/accept");

        $response->assertOk();
        $response->assertJsonPath('data.status', 'accepted');
    }

    public function test_accept_order_rejects_wrong_driver(): void
    {
        $order = $this->createOrderOfferedToDriver();

        $otherDriver = User::factory()->driver()->create();
        DriverProfile::factory()->for($otherDriver)->online()->atLocation(42.88, 74.58)->create();
        Sanctum::actingAs($otherDriver);

        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/accept");

        $response->assertStatus(422);
    }

    public function test_decline_order_returns_success(): void
    {
        $order = $this->createOrderOfferedToDriver();

        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/decline");

        $response->assertOk();
    }

    public function test_decline_order_triggers_next_offer(): void
    {
        // Create a second online driver further away
        $farDriver = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($farDriver)
            ->online()
            ->atLocation($this->pickupLat + 0.01, $this->pickupLon + 0.01)
            ->create();

        $order = $this->createOrderOfferedToDriver();

        // Order should be offered to our main driver (closer)
        $this->assertSame($this->driver->id, $order->offered_driver_id);

        // Decline
        $this->postJson("/api/v1/driver/orders/{$order->id}/decline");

        $order->refresh();
        // Should now be offered to the far driver
        $this->assertSame($farDriver->id, $order->offered_driver_id);
    }

    // ──────────────────────────────────────────────────────────────
    // status transitions
    // ──────────────────────────────────────────────────────────────

    public function test_arrived_updates_status(): void
    {
        $order = $this->createOrderOfferedToDriver();
        $this->postJson("/api/v1/driver/orders/{$order->id}/accept");

        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/arrived");

        $response->assertOk();
        $response->assertJsonPath('data.status', 'arrived');
    }

    public function test_start_ride_updates_status(): void
    {
        $order = $this->createOrderOfferedToDriver();
        $this->postJson("/api/v1/driver/orders/{$order->id}/accept");
        $this->postJson("/api/v1/driver/orders/{$order->id}/arrived");

        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/start");

        $response->assertOk();
        $response->assertJsonPath('data.status', 'in_progress');
    }

    public function test_complete_order_updates_status(): void
    {
        $order = $this->createOrderOfferedToDriver();
        $this->postJson("/api/v1/driver/orders/{$order->id}/accept");
        $this->postJson("/api/v1/driver/orders/{$order->id}/arrived");
        $this->postJson("/api/v1/driver/orders/{$order->id}/start");

        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/complete");

        $response->assertOk();
        $response->assertJsonPath('data.status', 'completed');
    }

    public function test_full_order_lifecycle(): void
    {
        $order = $this->createOrderOfferedToDriver();

        // Accept
        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/accept");
        $response->assertOk();
        $response->assertJsonPath('data.status', 'accepted');

        // Arrived
        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/arrived");
        $response->assertOk();
        $response->assertJsonPath('data.status', 'arrived');

        // Start
        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/start");
        $response->assertOk();
        $response->assertJsonPath('data.status', 'in_progress');

        // Complete
        $response = $this->postJson("/api/v1/driver/orders/{$order->id}/complete");
        $response->assertOk();
        $response->assertJsonPath('data.status', 'completed');

        // Verify final DB state
        $order->refresh();
        $this->assertSame(OrderStatus::Completed, $order->status);
        $this->assertNotNull($order->accepted_at);
        $this->assertNotNull($order->arrived_at);
        $this->assertNotNull($order->in_progress_at);
        $this->assertNotNull($order->completed_at);
    }

    // ──────────────────────────────────────────────────────────────
    // orders list
    // ──────────────────────────────────────────────────────────────

    public function test_driver_orders_list_only_shows_own_orders(): void
    {
        Order::factory()->count(3)->create([
            'driver_id' => $this->driver->id,
            'status' => OrderStatus::Completed,
        ]);

        $otherDriver = User::factory()->driver()->create();
        Order::factory()->count(2)->create([
            'driver_id' => $otherDriver->id,
            'status' => OrderStatus::Completed,
        ]);

        $response = $this->getJson('/api/v1/driver/orders');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
    }

    // ──────────────────────────────────────────────────────────────
    // active order
    // ──────────────────────────────────────────────────────────────

    public function test_active_order_returns_current_order(): void
    {
        $order = Order::factory()->accepted($this->driver)->create();

        $response = $this->getJson('/api/v1/driver/orders/active');

        $response->assertOk();
        $response->assertJsonPath('data.id', $order->id);
    }

    public function test_active_order_returns404_when_none(): void
    {
        $response = $this->getJson('/api/v1/driver/orders/active');

        $response->assertStatus(404);
    }

    // ──────────────────────────────────────────────────────────────
    // profile
    // ──────────────────────────────────────────────────────────────

    public function test_profile_returns_driver_info(): void
    {
        $response = $this->getJson('/api/v1/driver/profile');

        $response->assertOk();
        $response->assertJsonPath('data.id', $this->driver->id);
        $response->assertJsonStructure([
            'data' => ['id', 'name', 'phone', 'role', 'driver_profile' => ['car_model', 'car_number', 'is_online']],
        ]);
    }

    // ──────────────────────────────────────────────────────────────
    // role guard
    // ──────────────────────────────────────────────────────────────

    public function test_client_cannot_access_driver_routes(): void
    {
        $client = User::factory()->create(['role' => UserRole::Client]);
        Sanctum::actingAs($client);

        $response = $this->postJson('/api/v1/driver/go-online', [
            'latitude' => 42.87,
            'longitude' => 74.57,
        ]);

        $response->assertStatus(403);
    }

    // ──────────────────────────────────────────────────────────────
    // no driver profile
    // ──────────────────────────────────────────────────────────────

    public function test_go_online_returns404_without_profile(): void
    {
        $driverWithoutProfile = User::factory()->driver()->create();
        Sanctum::actingAs($driverWithoutProfile);

        $response = $this->postJson('/api/v1/driver/go-online', [
            'latitude' => 42.87,
            'longitude' => 74.57,
        ]);

        $response->assertStatus(404);
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Create an order offered to $this->driver via OrderService.
     */
    private function createOrderOfferedToDriver(): Order
    {
        $client = User::factory()->create(['role' => UserRole::Client]);

        /** @var OrderService $service */
        $service = app(OrderService::class);

        $order = $service->createOrder($client, $this->pickupLat, $this->pickupLon);

        // Verify it was offered to our driver
        $this->assertSame($this->driver->id, $order->offered_driver_id);

        return $order;
    }
}
