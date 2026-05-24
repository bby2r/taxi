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
 * Гео-A+ in-district pricing: client GPS → nearest district centre →
 * that district's in-district tariff. Inter-district orders (explicit
 * regionId) keep using the destination region's day/night tariff.
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

        $this->service = app(OrderService::class);
        $this->client = User::factory()->create(['role' => UserRole::Client]);
    }

    public function test_in_district_order_uses_detected_region_price(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC')); // 10:00 Bishkek = day

        // Pokrovka 80/120, Talas 100/150 — pickup sits inside Pokrovka.
        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
            'in_district_day_price' => 80,
            'in_district_night_price' => 120,
        ]);
        Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        $this->createNearbyDriver(42.5670, 71.9335);

        $order = $this->service->createOrder($this->client, 42.5670, 71.9335);

        $this->assertSame(80, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
        $this->assertNull($order->region_id);
    }

    public function test_in_district_order_picks_nearest_centre(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
            'in_district_day_price' => 80,
            'in_district_night_price' => 120,
        ]);
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        $this->createNearbyDriver(42.5230, 72.2427);

        $order = $this->service->createOrder($this->client, 42.5230, 72.2427);

        $this->assertSame(100, $order->price);
        $this->assertSame($talas->id, $order->pickup_region_id);
    }

    public function test_in_village_rejects_when_no_region_in_geofence(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));
        Setting::updateOrCreate(['key' => 'district_detection_max_km'], ['value' => '2']);

        // Талас далеко (>2 км). Клиент в Бакаире — без района в радиусе.
        Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        $this->createNearbyDriver(42.8746, 74.5698);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Вы вне зон обслуживания');

        $this->service->createOrder($this->client, 42.8746, 74.5698);
    }

    public function test_in_village_allowed_just_inside_geofence(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));
        Setting::updateOrCreate(['key' => 'district_detection_max_km'], ['value' => '2']);

        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        // ~150м от центра — внутри радиуса 2 км.
        $this->createNearbyDriver(42.5240, 72.2430);

        $order = $this->service->createOrder($this->client, 42.5240, 72.2430);

        $this->assertSame(100, $order->price);
        $this->assertSame($talas->id, $order->pickup_region_id);
    }

    public function test_inter_district_falls_back_to_destination_flat_without_matrix(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        $bishkek = Region::factory()->create([
            'name' => 'Бишкек',
            'day_price' => 2000,
            'night_price' => 2500,
        ]);

        $this->createNearbyDriver(42.5670, 71.9335);

        $order = $this->service->createOrder(
            $this->client,
            42.5670,
            71.9335,
            regionId: $bishkek->id,
        );

        $this->assertSame(2000, $order->price);
        $this->assertSame($bishkek->id, $order->region_id);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
    }

    public function test_inter_district_uses_matrix_when_route_exists(): void
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
            'day_price' => 1500,
            'night_price' => 1800,
        ]);

        // Pair-override: from Pokrovka to Talas — 200 day / 300 night
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver(42.5670, 71.9335);

        $order = $this->service->createOrder(
            $this->client,
            42.5670,
            71.9335,
            regionId: $talas->id,
        );

        $this->assertSame(200, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
    }

    public function test_matrix_route_is_directional(): void
    {
        // Pokrovka→Talas = 200, но Talas→Pokrovka не задан → fallback 1500.
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
            'day_price' => 1500,
            'night_price' => 1800,
        ]);
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'day_price' => 1500,
            'night_price' => 1800,
        ]);

        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver(42.5230, 72.2427);

        $order = $this->service->createOrder(
            $this->client,
            42.5230,
            72.2427,
            regionId: $pokrovka->id,
        );

        $this->assertSame(1500, $order->price); // fallback, обратное направление не задано
        $this->assertSame($talas->id, $order->pickup_region_id);
    }

    public function test_tariff_endpoint_returns_detected_district_for_gps(): void
    {
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/price?latitude=42.5230&longitude=72.2427');

        $response->assertOk()
            ->assertJson([
                'price' => 100,
                'district' => [
                    'id' => $talas->id,
                    'name' => 'Талас',
                ],
            ]);
    }

    public function test_tariff_endpoint_returns_null_district_without_gps(): void
    {
        Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/price');

        $response->assertOk()
            ->assertJsonPath('district', null)
            ->assertJsonPath('in_village_available', true);
    }

    public function test_tariff_endpoint_signals_out_of_geofence(): void
    {
        Setting::updateOrCreate(['key' => 'district_detection_max_km'], ['value' => '2']);
        Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'in_district_day_price' => 100,
            'in_district_night_price' => 150,
        ]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/price?latitude=42.8746&longitude=74.5698');

        $response->assertOk()
            ->assertJsonPath('district', null)
            ->assertJsonPath('in_village_available', false);
    }

    public function test_regions_endpoint_applies_matrix_for_pickup(): void
    {
        $pokrovka = Region::factory()->create([
            'name' => 'Покровка',
            'center_latitude' => 42.5667,
            'center_longitude' => 71.9333,
        ]);
        $talas = Region::factory()->create([
            'name' => 'Талас',
            'center_latitude' => 42.5228,
            'center_longitude' => 72.2425,
            'day_price' => 1500,
            'night_price' => 1800,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC')); // day in Bishkek

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/regions?latitude=42.5670&longitude=71.9335');

        $response->assertOk()
            // Покровка должен быть удалён из списка (это сам pickup-район).
            ->assertJsonMissing(['name' => 'Покровка'])
            ->assertJsonFragment(['name' => 'Талас', 'price' => 200]);
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
