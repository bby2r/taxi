<?php

namespace Tests\Unit\Http\Resources;

use App\Http\Resources\V1\OrderResource;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderResourceTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Resolve an OrderResource to a plain array with MissingValue filtering applied.
     *
     * @return array<string, mixed>
     */
    private function resolveResource(Order $order): array
    {
        return (new OrderResource($order))->response()->getData(true)['data'];
    }

    public function test_order_resource_contains_expected_keys(): void
    {
        $client = User::factory()->create();
        $order = Order::factory()->create(['client_id' => $client->id]);
        $order->load('client');

        $resource = $this->resolveResource($order);

        $expectedKeys = [
            'id',
            'status',
            'pickup_latitude',
            'pickup_longitude',
            'pickup_address',
            'dropoff_latitude',
            'dropoff_longitude',
            'dropoff_address',
            'price',
            'cancellation_fee',
            'cancelled_by',
            'client',
            'accepted_at',
            'arrived_at',
            'in_progress_at',
            'completed_at',
            'cancelled_at',
            'created_at',
        ];

        foreach ($expectedKeys as $key) {
            $this->assertArrayHasKey($key, $resource, "Missing key: {$key}");
        }

        $this->assertSame($order->id, $resource['id']);
        $this->assertSame($order->status->value, $resource['status']);
        $this->assertSame($client->id, $resource['client']['id']);
    }

    public function test_order_resource_hides_driver_when_null(): void
    {
        $order = Order::factory()->create();
        $order->load('client');

        $resource = $this->resolveResource($order);

        $this->assertArrayNotHasKey('driver', $resource);
    }

    public function test_order_resource_shows_driver_when_present(): void
    {
        $driver = User::factory()->driver()->create();
        DriverProfile::factory()->for($driver)->create();

        $order = Order::factory()->accepted($driver)->create();
        $order->load(['client', 'driver.driverProfile']);

        $resource = $this->resolveResource($order);

        $this->assertArrayHasKey('driver', $resource);
        $this->assertSame($driver->id, $resource['driver']['id']);
        $this->assertSame($driver->name, $resource['driver']['name']);
        $this->assertSame($driver->phone, $resource['driver']['phone']);
        $this->assertArrayHasKey('car_model', $resource['driver']);
        $this->assertArrayHasKey('car_number', $resource['driver']);
    }
}
