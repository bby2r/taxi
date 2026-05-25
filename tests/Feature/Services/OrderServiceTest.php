<?php

namespace Tests\Feature\Services;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Events\OrderAccepted;
use App\Events\OrderCancelled;
use App\Jobs\SearchDriversJob;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\Region;
use App\Models\RegionRoute;
use App\Models\Setting;
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

    private Region $village;

    /** Pickup coordinates near Bishkek center */
    private float $pickupLat = 42.8746;

    private float $pickupLon = 74.5698;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();
        Setting::updateOrCreate(
            ['key' => 'district_detection_max_km'],
            ['value' => '5'],
        );

        $this->service = app(OrderService::class);
        $this->client = User::factory()->create(['role' => UserRole::Client]);
        // Сервисный район с центром на pickupLat/pickupLon, чтобы
        // GPS-определение нашло его. In-village цена 80/120 — все
        // тесты ниже работают «внутри этого района». Конкретные
        // межсельные цены живут в DistrictPricingTest.
        $this->village = Region::factory()->create([
            'name' => 'TestVillage',
            'center_latitude' => $this->pickupLat,
            'center_longitude' => $this->pickupLon,
        ]);
        RegionRoute::create([
            'from_region_id' => $this->village->id,
            'to_region_id' => $this->village->id,
            'day_price' => 80,
            'night_price' => 120,
        ]);
    }

    private function createOrder(?User $client = null): Order
    {
        return $this->service->createOrder(
            client: $client ?? $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            toRegionId: $this->village->id,
        );
    }

    // ──────────────────────────────────────────────────────────────
    // createOrder tests (6)
    // ──────────────────────────────────────────────────────────────

    public function test_create_order_sets_searching_status(): void
    {
        $this->createNearbyDriver();

        $order = $this->createOrder();

        $this->assertSame(OrderStatus::Searching, $order->status);
    }

    public function test_create_order_locks_day_price(): void
    {
        $this->createNearbyDriver();

        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC')); // 10:00 Asia/Bishkek (UTC+6)

        $order = $this->createOrder();

        $this->assertSame(80, $order->price);
    }

    public function test_create_order_locks_night_price(): void
    {
        $this->createNearbyDriver();

        Carbon::setTestNow(Carbon::create(2026, 4, 7, 16, 0, 0, 'UTC')); // 22:00 Asia/Bishkek (UTC+6)

        $order = $this->createOrder();

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

        $this->createOrder();
    }

    public function test_create_order_offers_to_nearest_driver(): void
    {
        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($driverUser)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();

        $order = $this->createOrder();

        $this->assertSame($driverUser->id, $order->offered_driver_id);
    }

    public function test_create_order_retries_search_if_no_drivers(): void
    {
        Queue::fake();

        $order = $this->createOrder();

        $this->assertSame(OrderStatus::Searching, $order->status);
        $this->assertSame(1, $order->fresh()->search_attempts);

        Queue::assertPushed(SearchDriversJob::class, function ($job) use ($order) {
            return $job->orderId === $order->id;
        });
    }

    public function test_create_order_cancels_after_max_search_attempts(): void
    {
        $order = $this->createOrder();
        $order->update(['search_attempts' => 3]);

        $this->service->offerToNextDriver($order);

        $order->refresh();
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

    public function test_create_order_snapshots_client_identity(): void
    {
        $this->createNearbyDriver();

        $order = $this->createOrder();

        $this->assertIsArray($order->client_snapshot);
        $this->assertSame($this->client->name, $order->client_snapshot['name']);
        $this->assertSame($this->client->phone, $order->client_snapshot['phone']);
    }

    public function test_accept_order_snapshots_driver_identity(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $driverUser->loadMissing('driverProfile');

        $order = $this->service->acceptOrder($order, $driverUser);

        $this->assertIsArray($order->driver_snapshot);
        $this->assertSame($driverUser->name, $order->driver_snapshot['name']);
        $this->assertSame($driverUser->phone, $order->driver_snapshot['phone']);
        $this->assertSame($driverUser->driverProfile?->car_model, $order->driver_snapshot['car_model']);
        $this->assertSame($driverUser->driverProfile?->car_number, $order->driver_snapshot['car_number']);
    }

    public function test_snapshots_survive_driver_deletion(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();
        $order = $this->service->acceptOrder($order, $driverUser);

        $expectedName = $driverUser->name;
        $expectedPhone = $driverUser->phone;
        $driverUser->delete();

        $order->refresh();

        $this->assertNull($order->driver_id, 'FK set null preserves order row');
        $this->assertSame($expectedName, $order->driver_snapshot['name']);
        $this->assertSame($expectedPhone, $order->driver_snapshot['phone']);
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

        $order = $this->createOrder();

        // Should be offered to the nearest driver first
        $this->assertSame($nearDriver->id, $order->offered_driver_id);

        // Decline by near driver
        $this->service->declineOrder($order, $nearDriver);
        $order->refresh();

        // Should now be offered to the far driver
        $this->assertSame($farDriver->id, $order->offered_driver_id);
    }

    public function test_decline_order_retries_search_if_no_more_drivers(): void
    {
        Queue::fake();

        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->declineOrder($order, $driverUser);

        $order->refresh();
        $this->assertSame(OrderStatus::Searching, $order->status);
        $this->assertSame(1, $order->search_attempts);

        Queue::assertPushed(SearchDriversJob::class, function ($job) use ($order) {
            return $job->orderId === $order->id;
        });
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
    // Decline penalty / blocking
    // ──────────────────────────────────────────────────────────────

    public function test_decline_increments_shift_counter(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->declineOrder($order, $driverUser, 'too_far');

        $this->assertSame(1, $driverUser->driverProfile->fresh()->shift_declines_count);
    }

    public function test_timeout_decline_does_not_count_toward_block(): void
    {
        [$order, $driverUser] = $this->createOrderOfferedToDriver();

        $this->service->declineOrder($order, $driverUser, 'timeout');

        $this->assertSame(0, $driverUser->driverProfile->fresh()->shift_declines_count);
    }

    public function test_declines_increment_counter_without_hard_block(): void
    {
        // Used to assert a 2h block at the 5th decline; that hard cutoff
        // was punitive (offline for a slow afternoon) and got replaced
        // with a soft ranking signal in GeoService. The counter still
        // increments — admins can use it for thresholded actions and
        // dispatch uses it as a tie-break weight inside the fairness
        // bucket.
        [$driverUser] = $this->createNearbyDriver();
        $driverUser->driverProfile->update(['shift_declines_count' => 4]);

        $order = $this->createOrder();
        $this->service->declineOrder($order, $driverUser, 'too_far');

        $profile = $driverUser->driverProfile->fresh();
        $this->assertSame(5, $profile->shift_declines_count);
        $this->assertNull($profile->blocked_until, 'soft penalty model: no auto-block on decline');
        $this->assertTrue($profile->is_online, 'driver stays online — declines are a ranking signal');
    }

    public function test_blocked_driver_is_excluded_from_offers(): void
    {
        [$blockedDriver] = $this->createNearbyDriver();
        $blockedDriver->driverProfile->update(['blocked_until' => now()->addHour()]);

        $fallbackDriver = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($fallbackDriver)
            ->online()
            ->atLocation($this->pickupLat + 0.01, $this->pickupLon + 0.01)
            ->create();

        $order = $this->createOrder();

        $this->assertSame($fallbackDriver->id, $order->offered_driver_id);
    }

    public function test_driver_with_active_order_is_excluded_from_offers(): void
    {
        [$busyDriver] = $this->createNearbyDriver();

        // Give the nearer driver an in-progress order
        Order::factory()->create([
            'client_id' => $this->client->id,
            'driver_id' => $busyDriver->id,
            'status' => OrderStatus::InProgress,
        ]);

        $freeDriver = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($freeDriver)
            ->online()
            ->atLocation($this->pickupLat + 0.01, $this->pickupLon + 0.01)
            ->create();

        $otherClient = User::factory()->create(['role' => UserRole::Client]);
        $order = $this->createOrder($otherClient);

        $this->assertSame($freeDriver->id, $order->offered_driver_id);
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

        $order = $this->createOrder();

        return [$order, $driverUser];
    }
}
