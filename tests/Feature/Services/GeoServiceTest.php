<?php

namespace Tests\Feature\Services;

use App\Models\DriverProfile;
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

        $result = $this->service->findNearestDrivers(42.8746, 74.5698);

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

        $result = $this->service->findNearestDrivers(42.8746, 74.5698, [$excludeUserId]);

        $this->assertCount(2, $result);
        $this->assertFalse($result->contains('user_id', $excludeUserId));
    }

    #[Test]
    public function test_find_nearest_drivers_respects_limit(): void
    {
        DriverProfile::factory()->online()->count(5)->create();

        $result = $this->service->findNearestDrivers(42.8746, 74.5698, [], 3);

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
    public function test_find_nearest_drivers_appends_distance_km(): void
    {
        DriverProfile::factory()->atLocation(42.8747, 74.6042)->create();

        $result = $this->service->findNearestDrivers(42.8746, 74.5698);

        $this->assertCount(1, $result);
        $this->assertIsFloat($result->first()->distance_km);
        $this->assertGreaterThan(0, $result->first()->distance_km);
    }
}
