<?php

namespace Tests\Feature\Services;

use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Region;
use App\Models\RegionRoute;
use App\Models\Setting;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

/**
 * Геозабор + матрица «откуда → куда». Pickup-район определяется
 * сервером по GPS клиента (radius district_detection_max_km вокруг
 * центра). Вне зоны → отказ. Внутри зоны → берётся pair-цена из
 * матрицы region_routes.
 */
class DistrictPricingTest extends TestCase
{
    use RefreshDatabase;

    private OrderService $service;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();
        Setting::updateOrCreate(['key' => 'district_detection_max_km'], ['value' => '5']);

        $this->service = app(OrderService::class);
        $this->client = User::factory()->create(['role' => UserRole::Client]);
    }

    public function test_in_village_uses_diagonal_price(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC')); // 10:00 Bishkek = day

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $pokrovka->id,
            'day_price' => 80,
            'night_price' => 120,
        ]);

        $this->createNearbyDriver(42.5670, 71.9335);

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.5670,
            pickupLon: 71.9335,
            toRegionId: $pokrovka->id,
        );

        $this->assertSame(80, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
        $this->assertNull($order->region_id); // in-village ⇒ region_id null
    }

    public function test_inter_village_uses_matrix_price(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver(42.5670, 71.9335);

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.5670, // в Покровке
            pickupLon: 71.9335,
            toRegionId: $talas->id,
        );

        $this->assertSame(200, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
        $this->assertSame($talas->id, $order->region_id);
    }

    public function test_inter_village_to_destination_only_region(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        // Бакаир — destination-only, без координат, GPS-определение
        // на нём не сработает, но как направление работает.
        $bakair = Region::factory()->create([
            'name' => 'Бакаир',
            'center_latitude' => null,
            'center_longitude' => null,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $bakair->id,
            'day_price' => 350,
            'night_price' => 450,
        ]);

        $this->createNearbyDriver(42.5670, 71.9335);

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.5670,
            pickupLon: 71.9335,
            toRegionId: $bakair->id,
        );

        $this->assertSame(350, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
        $this->assertSame($bakair->id, $order->region_id);
    }

    public function test_rejects_when_client_outside_service_area(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
        ]);
        RegionRoute::create([
            'from_region_id' => $talas->id,
            'to_region_id' => $talas->id,
            'day_price' => 100,
            'night_price' => 150,
        ]);

        $this->createNearbyDriver(42.8746, 74.5698);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Сервис пока недоступен в вашем районе');

        $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.8746, // Бишкек — далеко
            pickupLon: 74.5698,
            toRegionId: $talas->id,
        );
    }

    public function test_rejects_when_destination_only_region_has_no_coords_and_client_is_there(): void
    {
        // Edge case: клиент физически в Бакаире (направлении без
        // координат), но из-за отсутствия координат GPS не может
        // его «найти» как сервисную зону. Это правильно — Бакаир
        // не сервисный, оттуда заказывать нельзя.
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $bakair = Region::factory()->create([
            'name' => 'Бакаир',
            'center_latitude' => null,
            'center_longitude' => null,
        ]);

        $this->createNearbyDriver(42.6, 71.7);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Сервис пока недоступен');

        $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.6,
            pickupLon: 71.7,
            toRegionId: $bakair->id,
        );
    }

    public function test_missing_route_rejects_order(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $a = Region::factory()->create([
            'name' => 'A',
            'center_latitude' => 42.5,
            'center_longitude' => 72.0,
        ]);
        $b = Region::factory()->create(['name' => 'B']);

        $this->createNearbyDriver(42.5, 72.0);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Тариф для этого направления не настроен');

        $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.5,
            pickupLon: 72.0,
            toRegionId: $b->id,
        );
    }

    public function test_night_price_used_after_21(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 16, 0, 0, 'UTC')); // 22:00 Bishkek

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $pokrovka->id,
            'day_price' => 80,
            'night_price' => 120,
        ]);

        $this->createNearbyDriver(42.5667, 71.9333);

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.5667,
            pickupLon: 71.9333,
            toRegionId: $pokrovka->id,
        );

        $this->assertSame(120, $order->price);
    }

    public function test_round_trip_surcharge_applied(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver(42.5667, 71.9333);

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: 42.5667,
            pickupLon: 71.9333,
            toRegionId: $talas->id,
            isRoundTrip: true,
        );

        // 200 + 70 % = 340
        $this->assertSame(340, $order->price);
    }

    public function test_tariffs_endpoint_with_gps_returns_detected_village(): void
    {
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
        ]);
        RegionRoute::create([
            'from_region_id' => $talas->id,
            'to_region_id' => $talas->id,
            'day_price' => 100,
            'night_price' => 150,
        ]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/tariffs?latitude=42.5230&longitude=72.2427');

        $response->assertOk()
            ->assertJsonPath('detected_village.id', $talas->id)
            ->assertJsonPath('detected_village.name', 'Талас')
            ->assertJsonPath('in_service_area', true);
    }

    public function test_tariffs_endpoint_outside_zone_returns_in_service_area_false(): void
    {
        Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
        ]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/tariffs?latitude=42.8746&longitude=74.5698');

        $response->assertOk()
            ->assertJsonPath('detected_village', null)
            ->assertJsonPath('in_service_area', false);
    }

    public function test_tariffs_endpoint_without_gps_returns_null_service_area(): void
    {
        Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
        ]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/tariffs');

        $response->assertOk()
            ->assertJsonPath('detected_village', null)
            ->assertJsonPath('in_service_area', null);
    }

    private function createNearbyDriver(float $lat, float $lon): void
    {
        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($driverUser)
            ->online()
            ->atLocation($lat + 0.001, $lon + 0.001)
            ->create();
    }
}
