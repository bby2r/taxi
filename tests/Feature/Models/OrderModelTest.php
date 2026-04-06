<?php

namespace Tests\Feature\Models;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_belongs_to_client(): void
    {
        $order = Order::factory()->create();

        $this->assertInstanceOf(User::class, $order->client);
        $this->assertEquals($order->client_id, $order->client->id);
    }

    public function test_order_belongs_to_driver(): void
    {
        $order = Order::factory()->accepted()->create();

        $this->assertInstanceOf(User::class, $order->driver);
        $this->assertEquals($order->driver_id, $order->driver->id);
    }

    public function test_order_belongs_to_offered_driver(): void
    {
        $driver = User::factory()->driver()->create();
        $order = Order::factory()->create([
            'offered_driver_id' => $driver->id,
        ]);

        $this->assertInstanceOf(User::class, $order->offeredDriver);
        $this->assertEquals($driver->id, $order->offeredDriver->id);
    }

    public function test_active_scope(): void
    {
        Order::factory()->create(['status' => OrderStatus::Searching]);
        Order::factory()->accepted()->create();
        Order::factory()->arrived()->create();
        Order::factory()->create([
            'status' => OrderStatus::InProgress,
            'driver_id' => User::factory()->driver(),
            'in_progress_at' => now(),
        ]);
        Order::factory()->completed()->create();
        Order::factory()->cancelled()->create();

        $this->assertEquals(4, Order::active()->count());
    }

    public function test_for_client_scope(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        Order::factory()->count(2)->create(['client_id' => $userA->id]);
        Order::factory()->create(['client_id' => $userB->id]);

        $this->assertEquals(2, Order::forClient($userA->id)->count());
    }

    public function test_is_active_helper(): void
    {
        $activeStatuses = [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
            OrderStatus::InProgress,
        ];

        $inactiveStatuses = [
            OrderStatus::Completed,
            OrderStatus::Cancelled,
        ];

        foreach ($activeStatuses as $status) {
            $order = Order::factory()->make(['status' => $status]);
            $this->assertTrue($order->isActive(), "Expected {$status->value} to be active");
        }

        foreach ($inactiveStatuses as $status) {
            $order = Order::factory()->make(['status' => $status]);
            $this->assertFalse($order->isActive(), "Expected {$status->value} to be inactive");
        }
    }

    public function test_is_cancellable_helper(): void
    {
        $cancellable = [
            OrderStatus::Searching,
            OrderStatus::Accepted,
            OrderStatus::Arrived,
        ];

        $notCancellable = [
            OrderStatus::InProgress,
            OrderStatus::Completed,
            OrderStatus::Cancelled,
        ];

        foreach ($cancellable as $status) {
            $order = Order::factory()->make(['status' => $status]);
            $this->assertTrue($order->isCancellable(), "Expected {$status->value} to be cancellable");
        }

        foreach ($notCancellable as $status) {
            $order = Order::factory()->make(['status' => $status]);
            $this->assertFalse($order->isCancellable(), "Expected {$status->value} to not be cancellable");
        }
    }

    public function test_declined_drivers_json_cast(): void
    {
        $order = Order::factory()->create([
            'declined_drivers' => [1, 2, 3],
        ]);

        $order->refresh();

        $this->assertIsArray($order->declined_drivers);
        $this->assertEquals([1, 2, 3], $order->declined_drivers);
    }

    public function test_status_casts_to_enum(): void
    {
        $order = Order::factory()->create();

        $this->assertInstanceOf(OrderStatus::class, $order->status);
    }

    public function test_accepted_factory_state(): void
    {
        $order = Order::factory()->accepted()->create();

        $this->assertEquals(OrderStatus::Accepted, $order->status);
        $this->assertNotNull($order->driver_id);
        $this->assertNotNull($order->accepted_at);
    }

    public function test_completed_factory_state(): void
    {
        $order = Order::factory()->completed()->create();

        $this->assertEquals(OrderStatus::Completed, $order->status);
        $this->assertNotNull($order->driver_id);
        $this->assertNotNull($order->accepted_at);
        $this->assertNotNull($order->arrived_at);
        $this->assertNotNull($order->in_progress_at);
        $this->assertNotNull($order->completed_at);
    }
}
