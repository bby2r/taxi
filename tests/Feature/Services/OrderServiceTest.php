<?php

namespace Tests\Feature\Services;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Events\OrderAccepted;
use App\Events\OrderCancelled;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

class OrderServiceTest extends TestCase
{
    use RefreshDatabase;

    private OrderService $service;

    private User $client;

    /** Pickup coordinates near Bishkek center */
    private float $pickupLat = 42.8746;

    private float $pickupLon = 74.5698;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();

        $this->service = app(OrderService::class);
        $this->client = User::factory()->create(['role' => UserRole::Client]);
    }

    // ──────────────────────────────────────────────────────────────
    // createOrder tests (6)
    // ──────────────────────────────────────────────────────────────

    public function test_create_order_sets_searching_status(): void
    {
        $this->createNearbyDriver();

        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        $this->assertSame(OrderStatus::Searching, $order->status);
    }

    public function test_create_order_locks_day_price(): void
    {
        $this->createNearbyDriver();

        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC')); // 10:00 Asia/Bishkek (UTC+6)

        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        $this->assertSame(80, $order->price);
    }

    public function test_create_order_locks_night_price(): void
    {
        $this->createNearbyDriver();

        Carbon::setTestNow(Carbon::create(2026, 4, 7, 16, 0, 0, 'UTC')); // 22:00 Asia/Bishkek (UTC+6)

        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        $this->assertSame(120, $order->price);
    }

    public function test_create_order_throws_if_client_has_active_order(): void
    {
        $this->createNearbyDriver();

        // Create an active order for the client
        Order::factory()->create([
            'client_id' => $this->client->id,
            'status' => OrderStatus::Searching,
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Client already has an active order.');

        $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);
    }

    public function test_create_order_offers_to_nearest_driver(): void
    {
        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($driverUser)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();

        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        $this->assertSame($driverUser->id, $order->offered_driver_id);
    }

    public function test_create_order_cancels_if_no_drivers(): void
    {
        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame('system', $order->cancelled_by);
    }

    // ──────────────────────────────────────────────────────────────
    // acceptOrder tests (4)
    // ──────────────────────────────────────────────────────────────

    public function test_accept_order_sets_accepted_status(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $order = $this->service->acceptOrder($order, $driverUser);

        $this->assertSame(OrderStatus::Accepted, $order->status);
        $this->assertSame($driverUser->id, $order->driver_id);
        $this->assertNotNull($order->accepted_at);
    }

    public function test_accept_order_throws_if_not_offered_to_driver(): void
    {
        [$order] = $this->createOrderOfferedToDriver();

        $otherDriver = User::factory()->driver()->create();

        $this->expectException(RuntimeException::class);

        $this->service->acceptOrder($order, $otherDriver);
    }

    public function test_accept_order_throws_if_not_searching_status(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        // Accept it first
        $this->service->acceptOrder($order, $driverUser);

        $this->expectException(RuntimeException::class);

        // Try accepting again
        $this->service->acceptOrder($order, $driverUser);
    }

    public function test_accept_order_fires_event(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->acceptOrder($order, $driverUser);

        Event::assertDispatched(OrderAccepted::class);
    }

    // ──────────────────────────────────────────────────────────────
    // declineOrder tests (3)
    // ──────────────────────────────────────────────────────────────

    public function test_decline_order_adds_to_declined_list(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->declineOrder($order, $driverUser);

        $order->refresh();
        $this->assertContains($driverUser->id, $order->getDeclinedDriverIds());
    }

    public function test_decline_order_offers_to_next_driver(): void
    {
        // Create two drivers: near and far
        $nearDriver = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($nearDriver)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();

        $farDriver = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($farDriver)
            ->online()
            ->atLocation($this->pickupLat + 0.01, $this->pickupLon + 0.01)
            ->create();

        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        // Should be offered to the nearest driver first
        $this->assertSame($nearDriver->id, $order->offered_driver_id);

        // Decline by near driver
        $this->service->declineOrder($order, $nearDriver);
        $order->refresh();

        // Should now be offered to the far driver
        $this->assertSame($farDriver->id, $order->offered_driver_id);
    }

    public function test_decline_order_cancels_if_no_more_drivers(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->declineOrder($order, $driverUser);

        $order->refresh();
        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame('system', $order->cancelled_by);
    }

    // ──────────────────────────────────────────────────────────────
    // driverArrived tests (2)
    // ──────────────────────────────────────────────────────────────

    public function test_driver_arrived_sets_arrived_status(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);

        $order = $this->service->driverArrived($order, $driverUser);

        $this->assertSame(OrderStatus::Arrived, $order->status);
        $this->assertNotNull($order->arrived_at);
    }

    public function test_driver_arrived_throws_if_not_accepted(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->expectException(RuntimeException::class);

        $this->service->driverArrived($order, $driverUser);
    }

    // ──────────────────────────────────────────────────────────────
    // startRide tests (2)
    // ──────────────────────────────────────────────────────────────

    public function test_start_ride_sets_in_progress_status(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);
        $order = $this->service->driverArrived($order, $driverUser);

        $order = $this->service->startRide($order, $driverUser);

        $this->assertSame(OrderStatus::InProgress, $order->status);
        $this->assertNotNull($order->in_progress_at);
    }

    public function test_start_ride_throws_if_not_arrived(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);

        $this->expectException(RuntimeException::class);

        $this->service->startRide($order, $driverUser);
    }

    // ──────────────────────────────────────────────────────────────
    // completeOrder tests (2)
    // ──────────────────────────────────────────────────────────────

    public function test_complete_order_sets_completed_status(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);
        $order = $this->service->driverArrived($order, $driverUser);
        $order = $this->service->startRide($order, $driverUser);

        $order = $this->service->completeOrder($order, $driverUser);

        $this->assertSame(OrderStatus::Completed, $order->status);
        $this->assertNotNull($order->completed_at);
    }

    public function test_complete_order_throws_if_not_in_progress(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);
        $order = $this->service->driverArrived($order, $driverUser);

        $this->expectException(RuntimeException::class);

        $this->service->completeOrder($order, $driverUser);
    }

    // ──────────────────────────────────────────────────────────────
    // cancelOrder tests (6)
    // ──────────────────────────────────────────────────────────────

    public function test_cancel_order_from_searching_no_penalty(): void
    {
        [$order] = $this->createOrderOfferedToDriver();

        $order = $this->service->cancelOrder($order, 'client');

        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertNull($order->cancellation_fee);
    }

    public function test_cancel_order_from_accepted_with_penalty(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);

        $order = $this->service->cancelOrder($order, 'client');

        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame(50, $order->cancellation_fee);
    }

    public function test_cancel_order_from_arrived_with_penalty(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);
        $order = $this->service->driverArrived($order, $driverUser);

        $order = $this->service->cancelOrder($order, 'client');

        $this->assertSame(OrderStatus::Cancelled, $order->status);
        $this->assertSame(50, $order->cancellation_fee);
    }

    public function test_cancel_order_throws_if_completed(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);
        $order = $this->service->driverArrived($order, $driverUser);
        $order = $this->service->startRide($order, $driverUser);
        $order = $this->service->completeOrder($order, $driverUser);

        $this->expectException(RuntimeException::class);

        $this->service->cancelOrder($order, 'client');
    }

    public function test_cancel_order_sets_cancelled_by(): void
    {
        [$order] = $this->createOrderOfferedToDriver();

        $order = $this->service->cancelOrder($order, 'driver');

        $this->assertSame('driver', $order->cancelled_by);
    }

    public function test_cancel_order_fires_event(): void
    {
        [$order] = $this->createOrderOfferedToDriver();

        $this->service->cancelOrder($order, 'client');

        Event::assertDispatched(OrderCancelled::class);
    }

    // ──────────────────────────────────────────────────────────────
    // handleOfferTimeout tests (2)
    // ──────────────────────────────────────────────────────────────

    public function test_handle_offer_timeout_declines_if_still_offered(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->handleOfferTimeout($order->id, $driverUser->id);

        $order->refresh();
        $this->assertContains($driverUser->id, $order->getDeclinedDriverIds());
    }

    public function test_handle_offer_timeout_no_op_if_already_accepted(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);

        $this->service->handleOfferTimeout($order->id, $driverUser->id);

        $order->refresh();
        $this->assertSame(OrderStatus::Accepted, $order->status);
        $this->assertSame($driverUser->id, $order->driver_id);
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Create an online driver near the pickup point.
     *
     * @return array{0: User, 1: DriverProfile}
     */
    private function createNearbyDriver(): array
    {
        $driverUser = User::factory()->driver()->create();
        $profile = DriverProfile::factory()
            ->for($driverUser)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();

        return [$driverUser, $profile];
    }

    /**
     * Create an order offered to a nearby driver (Searching status).
     *
     * @return array{0: Order, 1: User}
     */
    private function createOrderOfferedToDriver(): array
    {
        [$driverUser] = $this->createNearbyDriver();

        $order = $this->service->createOrder($this->client, $this->pickupLat, $this->pickupLon);

        return [$order, $driverUser];
    }
}
