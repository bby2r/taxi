<?php

namespace Tests\Unit\Services;

use App\Services\GeoService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GeoServiceTest extends TestCase
{
    private GeoService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new GeoService;
    }

    #[Test]
    public function test_distance_km_between_same_point(): void
    {
        $distance = $this->service->distanceKm(42.8746, 74.5698, 42.8746, 74.5698);

        $this->assertSame(0.0, $distance);
    }

    #[Test]
    public function test_distance_km_between_known_points(): void
    {
        // Bishkek center to Ala-Too Square (~2.8 km)
        $distance = $this->service->distanceKm(42.8746, 74.5698, 42.8747, 74.6042);

        $this->assertEqualsWithDelta(3.0, $distance, 0.5);
    }

    #[Test]
    public function test_distance_km_between_distant_points(): void
    {
        // Bishkek to Osh (~299 km straight line)
        $distance = $this->service->distanceKm(42.8746, 74.5698, 40.5283, 72.7985);

        $this->assertEqualsWithDelta(299.0, $distance, 10.0);
    }
}
