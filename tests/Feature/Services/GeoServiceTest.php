<?php

namespace Tests\Feature\Services;

use App\Enums\OrderStatus;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\Setting;
use App\Services\GeoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GeoServiceTest extends TestCase
{
    use RefreshDatabase;

    private GeoService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new GeoService;
    }

    #[Test]
    public function test_find_nearest_drivers_returns_online_drivers_only(): void
    {
        DriverProfile::factory()->online()->count(2)->create();
        DriverProfile::factory()->create(); // offline

        $result = $this->service->findNearestDrivers(42.8746, 74.5698, [], 10, 999.0);

        $this->assertCount(2, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_sorted_by_distance(): void
    {
        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Far driver (~2.8 km away)
        DriverProfile::factory()->atLocation(42.8747, 74.6042)->create();
        // Close driver (~0.5 km away)
        DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        // Medium driver (~1.5 km away)
        DriverProfile::factory()->atLocation(42.8746, 74.5880)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1]);

        $this->assertCount(3, $result);
        $this->assertLessThanOrEqual(
            $result[1]->distance_km,
            $result[0]->distance_km,
        );
        $this->assertLessThanOrEqual(
            $result[2]->distance_km,
            $result[1]->distance_km,
        );
    }

    #[Test]
    public function test_find_nearest_drivers_excludes_ids(): void
    {
        $profiles = DriverProfile::factory()->online()->count(3)->create();
        $excludeUserId = $profiles->first()->user_id;

        $result = $this->service->findNearestDrivers(42.8746, 74.5698, [$excludeUserId], 10, 999.0);

        $this->assertCount(2, $result);
        $this->assertFalse($result->contains('user_id', $excludeUserId));
    }

    #[Test]
    public function test_find_nearest_drivers_respects_limit(): void
    {
        DriverProfile::factory()->online()->count(5)->create();

        $result = $this->service->findNearestDrivers(42.8746, 74.5698, [], 3, 999.0);

        $this->assertCount(3, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_returns_empty_when_no_drivers(): void
    {
        // Only offline drivers
        DriverProfile::factory()->count(2)->create();

        $result = $this->service->findNearestDrivers(42.8746, 74.5698);

        $this->assertTrue($result->isEmpty());
    }

    #[Test]
    public function test_find_nearest_drivers_filters_by_max_radius_parameter(): void
    {
        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Close driver (~0.5 km away)
        DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        // Far driver (~2.8 km away)
        DriverProfile::factory()->atLocation(42.8747, 74.6042)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 1.0);

        $this->assertCount(1, $result);
        $this->assertLessThanOrEqual(1.0, $result->first()->distance_km);
    }

    #[Test]
    public function test_find_nearest_drivers_uses_setting_for_max_radius(): void
    {
        Setting::create(['key' => 'max_search_radius_km', 'value' => '1']);

        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Close driver (~0.5 km away)
        DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        // Far driver (~2.8 km away)
        DriverProfile::factory()->atLocation(42.8747, 74.6042)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1]);

        $this->assertCount(1, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_appends_distance_km(): void
    {
        DriverProfile::factory()->atLocation(42.8747, 74.6042)->create();

        $result = $this->service->findNearestDrivers(42.8746, 74.5698);

        $this->assertCount(1, $result);
        $this->assertIsFloat($result->first()->distance_km);
        $this->assertGreaterThan(0, $result->first()->distance_km);
    }

    #[Test]
    public function test_find_nearest_drivers_excludes_drivers_beyond_default_radius(): void
    {
        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Driver at ~15km away (significant latitude offset)
        DriverProfile::factory()->atLocation(42.8746, 74.7700)->create();

        // No settings seeded — default radius is 10km
        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1]);

        $this->assertCount(0, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_includes_drivers_within_default_radius(): void
    {
        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Driver at ~5km away
        DriverProfile::factory()->atLocation(42.8746, 74.6300)->create();

        // No settings seeded — default radius is 10km
        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1]);

        $this->assertCount(1, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_reads_radius_from_settings(): void
    {
        Setting::create(['key' => 'max_search_radius_km', 'value' => '20']);

        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Driver at ~15km away — beyond default 10km but within 20km setting
        DriverProfile::factory()->atLocation(42.8746, 74.7700)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1]);

        $this->assertCount(1, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_override_radius_parameter(): void
    {
        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Driver at ~15km away
        DriverProfile::factory()->atLocation(42.8746, 74.7700)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 20.0);

        $this->assertCount(1, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_override_radius_ignores_setting_value(): void
    {
        Setting::create(['key' => 'max_search_radius_km', 'value' => '5']);

        $pickup = [42.8746, 74.5698]; // Bishkek center

        // Driver at ~15km away — beyond setting of 5km but within override of 20km
        DriverProfile::factory()->atLocation(42.8746, 74.7700)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 20.0);

        $this->assertCount(1, $result);
    }

    // ──────────────────────────────────────────────────────────────
    // Pre-assign next order (driver in InProgress, near dropoff)
    // ──────────────────────────────────────────────────────────────

    #[Test]
    public function test_find_nearest_drivers_excludes_driver_with_active_order_when_far_from_dropoff(): void
    {
        // Pre-assign threshold of 1.5 km, driver is 5 km from their dropoff
        Setting::updateOrCreate(['key' => 'pre_assign_distance_km'], ['value' => '1.5']);

        $pickup = [42.8746, 74.5698];

        $profile = DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        Order::factory()->create([
            'driver_id' => $profile->user_id,
            'status' => OrderStatus::InProgress,
            'dropoff_latitude' => 42.9200, // ~5 km north
            'dropoff_longitude' => 74.5750,
            'in_progress_at' => now(),
        ]);

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 999.0);

        $this->assertCount(0, $result);
    }

    #[Test]
    public function test_find_nearest_drivers_includes_in_progress_driver_within_pre_assign_distance(): void
    {
        Setting::updateOrCreate(['key' => 'pre_assign_distance_km'], ['value' => '1.5']);

        $pickup = [42.8746, 74.5698];

        // Driver currently at (42.8746, 74.5750), dropoff is ~150m away
        $profile = DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        Order::factory()->create([
            'driver_id' => $profile->user_id,
            'status' => OrderStatus::InProgress,
            'dropoff_latitude' => 42.8747,
            'dropoff_longitude' => 74.5760, // ~80m away
            'in_progress_at' => now(),
        ]);

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 999.0);

        $this->assertCount(1, $result);
        $this->assertSame($profile->user_id, $result->first()->user_id);
    }

    #[Test]
    public function test_find_nearest_drivers_excludes_driver_in_accepted_status_even_if_close_to_dropoff(): void
    {
        // Pre-assign only applies to InProgress (driver is en-route to dropoff).
        // A driver in Accepted hasn't even picked up yet — must not get a second order.
        Setting::updateOrCreate(['key' => 'pre_assign_distance_km'], ['value' => '1.5']);

        $pickup = [42.8746, 74.5698];

        $profile = DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        Order::factory()->create([
            'driver_id' => $profile->user_id,
            'status' => OrderStatus::Accepted,
            'dropoff_latitude' => 42.8747,
            'dropoff_longitude' => 74.5760,
            'accepted_at' => now(),
        ]);

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 999.0);

        $this->assertCount(0, $result);
    }

    #[Test]
    public function test_pre_assign_disabled_excludes_in_progress_driver_even_if_close(): void
    {
        Setting::updateOrCreate(['key' => 'pre_assign_distance_km'], ['value' => '0']);

        $pickup = [42.8746, 74.5698];

        $profile = DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        Order::factory()->create([
            'driver_id' => $profile->user_id,
            'status' => OrderStatus::InProgress,
            'dropoff_latitude' => 42.8747,
            'dropoff_longitude' => 74.5760,
            'in_progress_at' => now(),
        ]);

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 999.0);

        $this->assertCount(0, $result);
    }

    #[Test]
    public function test_pre_assign_skipped_when_active_order_has_no_dropoff(): void
    {
        // Inter-village orders may have no dropoff; pre-assign cannot evaluate ETA → exclude
        Setting::updateOrCreate(['key' => 'pre_assign_distance_km'], ['value' => '1.5']);

        $pickup = [42.8746, 74.5698];

        $profile = DriverProfile::factory()->atLocation(42.8746, 74.5750)->create();
        Order::factory()->create([
            'driver_id' => $profile->user_id,
            'status' => OrderStatus::InProgress,
            'dropoff_latitude' => null,
            'dropoff_longitude' => null,
            'in_progress_at' => now(),
        ]);

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 10, 999.0);

        $this->assertCount(0, $result);
    }

    #[Test]
    public function test_fairness_tie_break_prefers_driver_with_fewer_rides_today(): void
    {
        $pickup = [42.8746, 74.5698];

        // Two drivers at essentially the same spot (both within the default
        // 0.5km fairness radius of each other). The "busy" one already has
        // a completed ride today — the fresh one should win the offer.
        // (atLocation alone sets is_online=true; calling ->online() after
        // would re-roll the coordinates back to random.)
        $busy = DriverProfile::factory()->atLocation(42.8748, 74.5700)->create();
        $fresh = DriverProfile::factory()->atLocation(42.8746, 74.5702)->create();

        Order::factory()->completed($busy->user)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 1);

        $this->assertCount(1, $result);
        $this->assertSame($fresh->user_id, $result->first()->user_id);
    }

    #[Test]
    public function test_meaningfully_closer_driver_wins_even_with_more_rides(): void
    {
        $pickup = [42.8746, 74.5698];

        // The "loaded" driver is right at the pickup; the "fresh" driver is
        // well outside the fairness bucket (~2.8km away). Distance should
        // override the ride-count balance — otherwise the client gets a
        // far-away driver just for fairness.
        $loadedNearby = DriverProfile::factory()->atLocation(42.8746, 74.5700)->create();
        DriverProfile::factory()->atLocation(42.8747, 74.6042)->create();

        Order::factory()->completed($loadedNearby->user)->create();
        Order::factory()->completed($loadedNearby->user)->create();

        $result = $this->service->findNearestDrivers($pickup[0], $pickup[1], [], 1);

        $this->assertCount(1, $result);
        $this->assertSame($loadedNearby->user_id, $result->first()->user_id);
    }
}
