<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\DriverProfile;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OrderPushNotificationTest extends TestCase
{
    use RefreshDatabase;

    private OrderService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Queue::fake();
        Http::fake(['*' => Http::response(['data' => [['status' => 'ok']]])]);

        $this->service = app(OrderService::class);
    }

    public function test_push_sent_when_order_accepted(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'expo_push_token' => 'ExponentPushToken[client-token]',
        ]);

        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()->for($driverUser)->online()->create();

        $order = Order::factory()->create([
            'client_id' => $client->id,
            'status' => OrderStatus::Searching,
            'offered_driver_id' => $driverUser->id,
        ]);

        $this->service->acceptOrder($order, $driverUser);

        Http::assertSent(function ($request) {
            $payload = $request->data()[0];

            return str_contains($payload['body'], 'on the way')
                && $payload['data']['type'] === 'order_accepted';
        });
    }

    public function test_push_sent_when_driver_arrived(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'expo_push_token' => 'ExponentPushToken[client-token]',
        ]);

        $driverUser = User::factory()->driver()->create();
        DriverProfile::factory()->for($driverUser)->online()->create();

        $order = Order::factory()->accepted($driverUser)->create([
            'client_id' => $client->id,
        ]);

        $this->service->driverArrived($order, $driverUser);

        Http::assertSent(function ($request) {
            $payload = $request->data()[0];

            return str_contains($payload['body'], 'arrived')
                && $payload['data']['type'] === 'driver_arrived';
        });
    }

    public function test_push_sent_to_both_when_order_completed(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'expo_push_token' => 'ExponentPushToken[client-token]',
        ]);

        $driverUser = User::factory()->driver()->create([
            'expo_push_token' => 'ExponentPushToken[driver-token]',
        ]);

        $order = Order::factory()->create([
            'client_id' => $client->id,
            'status' => OrderStatus::InProgress,
            'driver_id' => $driverUser->id,
            'accepted_at' => now()->subMinutes(10),
            'arrived_at' => now()->subMinutes(5),
            'in_progress_at' => now()->subMinutes(2),
        ]);

        $this->service->completeOrder($order, $driverUser);

        Http::assertSentCount(2);
    }

    public function test_push_sent_to_both_when_order_cancelled(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'expo_push_token' => 'ExponentPushToken[client-token]',
        ]);

        $driverUser = User::factory()->driver()->create([
            'expo_push_token' => 'ExponentPushToken[driver-token]',
        ]);

        $order = Order::factory()->accepted($driverUser)->create([
            'client_id' => $client->id,
        ]);

        $this->service->cancelOrder($order, 'client');

        Http::assertSentCount(2);
    }

    public function test_no_push_sent_when_user_has_no_token(): void
    {
        $client = User::factory()->create([
            'role' => UserRole::Client,
            'expo_push_token' => null,
        ]);

        $driverUser = User::factory()->driver()->create([
            'expo_push_token' => 'ExponentPushToken[driver-token]',
        ]);

        $order = Order::factory()->create([
            'client_id' => $client->id,
            'status' => OrderStatus::InProgress,
            'driver_id' => $driverUser->id,
            'accepted_at' => now()->subMinutes(10),
            'arrived_at' => now()->subMinutes(5),
            'in_progress_at' => now()->subMinutes(2),
        ]);

        $this->service->completeOrder($order, $driverUser);

        Http::assertSentCount(1);
    }
}
