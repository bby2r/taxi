<?php

namespace Tests\Feature\Services;

use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Region;
use App\Models\RegionRoute;
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
 * Матрица цен «откуда → куда». Клиент явно выбирает оба района
 * (без GPS-определения). from == to → in-village цена (диагональ
 * матрицы); from != to → межсёлами цена пары. Нет записи в матрице
 * → RuntimeException, чтобы заказ не ушёл в работу с ценой 0.
 */
class DistrictPricingTest extends TestCase
{
    use RefreshDatabase;

    private OrderService $service;

    private User $client;

    private float $pickupLat = 42.5228;

    private float $pickupLon = 72.2425;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();

        $this->service = app(OrderService::class);
        $this->client = User::factory()->create(['role' => UserRole::Client]);
    }

    public function test_in_village_uses_diagonal_price(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC')); // 10:00 Bishkek = day

        $pokrovka = Region::factory()->create(['name' => 'Покровка']);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $pokrovka->id,
            'day_price' => 80,
            'night_price' => 120,
        ]);

        $this->createNearbyDriver();

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            fromRegionId: $pokrovka->id,
            toRegionId: $pokrovka->id,
        );

        $this->assertSame(80, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
        $this->assertNull($order->region_id); // in-village ⇒ region_id остаётся null
    }

    public function test_inter_village_uses_matrix_price(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create(['name' => 'Покровка']);
        $talas = Region::factory()->create(['name' => 'Талас']);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver();

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            fromRegionId: $pokrovka->id,
            toRegionId: $talas->id,
        );

        $this->assertSame(200, $order->price);
        $this->assertSame($pokrovka->id, $order->pickup_region_id);
        $this->assertSame($talas->id, $order->region_id); // inter-village ⇒ region_id = to
    }

    public function test_matrix_is_directional(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create(['name' => 'Покровка']);
        $talas = Region::factory()->create(['name' => 'Талас']);
        // Только Покровка → Талас; обратное не задано.
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Тариф для этого направления не настроен');

        $this->service->createOrder(
            client: $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            fromRegionId: $talas->id,   // обратное направление
            toRegionId: $pokrovka->id,
        );
    }

    public function test_missing_route_rejects_order(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $a = Region::factory()->create(['name' => 'A']);
        $b = Region::factory()->create(['name' => 'B']);
        // Никаких записей в матрице.

        $this->createNearbyDriver();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Тариф для этого направления не настроен');

        $this->service->createOrder(
            client: $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            fromRegionId: $a->id,
            toRegionId: $b->id,
        );
    }

    public function test_night_price_used_after_21(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 16, 0, 0, 'UTC')); // 22:00 Bishkek

        $pokrovka = Region::factory()->create(['name' => 'Покровка']);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $pokrovka->id,
            'day_price' => 80,
            'night_price' => 120,
        ]);

        $this->createNearbyDriver();

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            fromRegionId: $pokrovka->id,
            toRegionId: $pokrovka->id,
        );

        $this->assertSame(120, $order->price);
    }

    public function test_round_trip_surcharge_applied(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 7, 4, 0, 0, 'UTC'));

        $pokrovka = Region::factory()->create(['name' => 'Покровка']);
        $talas = Region::factory()->create(['name' => 'Талас']);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);

        $this->createNearbyDriver();

        $order = $this->service->createOrder(
            client: $this->client,
            pickupLat: $this->pickupLat,
            pickupLon: $this->pickupLon,
            fromRegionId: $pokrovka->id,
            toRegionId: $talas->id,
            isRoundTrip: true,
        );

        // 200 + 70 % = 340
        $this->assertSame(340, $order->price);
    }

    public function test_tariffs_endpoint_returns_matrix(): void
    {
        $pokrovka = Region::factory()->create(['name' => 'Покровка']);
        $talas = Region::factory()->create(['name' => 'Талас']);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $talas->id,
            'day_price' => 200,
            'night_price' => 300,
        ]);
        RegionRoute::create([
            'from_region_id' => $pokrovka->id,
            'to_region_id' => $pokrovka->id,
            'day_price' => 80,
            'night_price' => 120,
        ]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/tariffs');

        $response->assertOk()
            ->assertJsonCount(2, 'routes')
            ->assertJsonFragment([
                'from_region_id' => $pokrovka->id,
                'to_region_id' => $talas->id,
                'day_price' => 200,
                'night_price' => 300,
            ]);
    }

    public function test_regions_endpoint_returns_active_only(): void
    {
        $active = Region::factory()->create(['name' => 'Талас', 'is_active' => true]);
        Region::factory()->create(['name' => 'Архив', 'is_active' => false]);

        Sanctum::actingAs($this->client);
        $response = $this->getJson('/api/v1/client/regions');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonFragment(['id' => $active->id, 'name' => 'Талас']);
    }

    private function createNearbyDriver(): void
    {
        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()
            ->for($driverUser)
            ->online()
            ->atLocation($this->pickupLat + 0.001, $this->pickupLon + 0.001)
            ->create();
    }
}
