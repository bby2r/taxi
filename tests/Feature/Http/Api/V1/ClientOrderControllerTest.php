<?php

namespace Tests\Feature\Http\Api\V1;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClientOrderControllerTest extends TestCase
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

    // ──────────────────────────────────────────────────────────────
    // store (create order)
    // ──────────────────────────────────────────────────────────────

    public function test_create_order_returns201(): void
    {
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'searching');
    }

    public function test_create_order_validates_pickup_latitude(): void
    {
        $response = $this->postJson('/api/v1/client/orders', [
            'pickup_longitude' => $this->pickupLon,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('pickup_latitude');
    }

    public function test_create_order_validates_pickup_longitude(): void
    {
        $response = $this->postJson('/api/v1/client/orders', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => 999,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('pickup_longitude');
    }

    public function test_create_order_returns_price_in_response(): void
    {
        $this->createNearbyDriver();

        $response = $this->postJson('/api/v1/client/orders', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure(['data' => ['price']]);
        $this->assertNotNull($response->json('data.price'));
    }

    public function test_create_order_rejects422_when_active_order_exists(): void
    {
        $this->createNearbyDriver();

        Order::factory()->create([
            'client_id' => $this->client->id,
            'status' => OrderStatus::Searching,
        ]);

        $response = $this->postJson('/api/v1/client/orders', [
            'pickup_latitude' => $this->pickupLat,
            'pickup_longitude' => $this->pickupLon,
        ]);

        $response->assertStatus(422);
    }

    // ──────────────────────────────────────────────────────────────
    // index (list orders)
    // ──────────────────────────────────────────────────────────────

    public function test_list_orders_returns_paginated(): void
    {
        Order::factory()->count(25)->completed()->create([
            'client_id' => $this->client->id,
        ]);

        $response = $this->getJson('/api/v1/client/orders');

        $response->assertOk();
        $response->assertJsonCount(20, 'data');
        $response->assertJsonStructure(['meta' => ['current_page', 'last_page']]);
    }

    public function test_list_orders_only_shows_own_orders(): void
    {
        Order::factory()->count(3)->completed()->create([
            'client_id' => $this->client->id,
        ]);

        $otherClient = User::factory()->create(['role' => UserRole::Client]);
        Order::factory()->count(2)->completed()->create([
            'client_id' => $otherClient->id,
        ]);

        $response = $this->getJson('/api/v1/client/orders');

        $response->assertOk();
        $response->assertJsonCount(3, 'data');
    }

    // ──────────────────────────────────────────────────────────────
    // show
    // ──────────────────────────────────────────────────────────────

    public function test_show_order_returns_order(): void
    {
        $order = Order::factory()->create([
            'client_id' => $this->client->id,
        ]);

        $response = $this->getJson("/api/v1/client/orders/{$order->id}");

        $response->assertOk();
        $response->assertJsonPath('data.id', $order->id);
    }

    public function test_show_order_forbids_other_client(): void
    {
        $otherClient = User::factory()->create(['role' => UserRole::Client]);
        $order = Order::factory()->create([
            'client_id' => $otherClient->id,
        ]);

        $response = $this->getJson("/api/v1/client/orders/{$order->id}");

        $response->assertStatus(403);
    }

    // ──────────────────────────────────────────────────────────────
    // cancel
    // ──────────────────────────────────────────────────────────────

    public function test_cancel_order_from_searching(): void
    {
        $order = Order::factory()->create([
            'client_id' => $this->client->id,
            'status' => OrderStatus::Searching,
        ]);

        $response = $this->postJson("/api/v1/client/orders/{$order->id}/cancel");

        $response->assertOk();
        $response->assertJsonPath('data.status', 'cancelled');
        $this->assertNull($response->json('data.cancellation_fee'));
    }

    public function test_cancel_order_from_accepted_has_penalty(): void
    {
        $driver = User::factory()->driver()->create();
        $order = Order::factory()->accepted($driver)->create([
            'client_id' => $this->client->id,
        ]);

        $response = $this->postJson("/api/v1/client/orders/{$order->id}/cancel");

        $response->assertOk();
        $response->assertJsonPath('data.status', 'cancelled');
        $response->assertJsonPath('data.cancellation_fee', 50);
    }

    public function test_cancel_order_rejects_completed_order(): void
    {
        $driver = User::factory()->driver()->create();
        $order = Order::factory()->completed($driver)->create([
            'client_id' => $this->client->id,
        ]);

        $response = $this->postJson("/api/v1/client/orders/{$order->id}/cancel");

        $response->assertStatus(422);
    }

    // ──────────────────────────────────────────────────────────────
    // active
    // ──────────────────────────────────────────────────────────────

    public function test_active_order_returns_current_order(): void
    {
        $order = Order::factory()->create([
            'client_id' => $this->client->id,
            'status' => OrderStatus::Searching,
        ]);

        $response = $this->getJson('/api/v1/client/orders/active');

        $response->assertOk();
        $response->assertJsonPath('data.id', $order->id);
    }

    public function test_active_order_returns404_when_none(): void
    {
        $response = $this->getJson('/api/v1/client/orders/active');

        $response->assertStatus(404);
    }

    // ──────────────────────────────────────────────────────────────
    // role guard
    // ──────────────────────────────────────────────────────────────

    public function test_driver_cannot_access_client_routes(): void
    {
        $driver = User::factory()->driver()->create();
        Sanctum::actingAs($driver);

        $response = $this->getJson('/api/v1/client/orders');

        $response->assertStatus(403);
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
