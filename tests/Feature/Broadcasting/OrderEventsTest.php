<?php

namespace Tests\Feature\Broadcasting;

use App\Enums\UserRole;
use App\Events\OrderAccepted;
use App\Events\OrderCancelled;
use App\Events\OrderCompleted;
use App\Events\OrderOfferedToDriver;
use App\Models\Order;
use App\Models\User;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\Broadcaster;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Tests\TestCase;

class OrderEventsTest extends TestCase
{
    use RefreshDatabase;

    // ──────────────────────────────────────────────────────────────
    // broadcastOn() tests
    // ──────────────────────────────────────────────────────────────

    public function test_order_offered_broadcasts_to_driver_channel(): void
    {
        $order = Order::factory()->create();
        $driverId = 42;

        $event = new OrderOfferedToDriver($order, $driverId);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame('private-driver.42', $channels[0]->name);
    }

    public function test_order_accepted_broadcasts_to_client_channel(): void
    {
        $client = User::factory()->create();
        $order = Order::factory()->create(['client_id' => $client->id]);

        $event = new OrderAccepted($order);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame("private-client.{$client->id}", $channels[0]->name);
    }

    public function test_order_completed_broadcasts_to_both_channels(): void
    {
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();
        $order = Order::factory()->completed($driver)->create([
            'client_id' => $client->id,
        ]);

        $event = new OrderCompleted($order);
        $channels = $event->broadcastOn();

        $this->assertCount(2, $channels);

        $channelNames = array_map(fn (PrivateChannel $ch) => $ch->name, $channels);
        $this->assertContains("private-client.{$client->id}", $channelNames);
        $this->assertContains("private-driver.{$driver->id}", $channelNames);
    }

    public function test_order_cancelled_broadcasts_to_client_only(): void
    {
        $client = User::factory()->create();
        $order = Order::factory()->cancelled()->create([
            'client_id' => $client->id,
            'driver_id' => null,
        ]);

        $event = new OrderCancelled($order);
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertSame("private-client.{$client->id}", $channels[0]->name);
    }

    public function test_order_cancelled_broadcasts_to_driver_if_assigned(): void
    {
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();
        $order = Order::factory()->cancelled()->create([
            'client_id' => $client->id,
            'driver_id' => $driver->id,
        ]);

        $event = new OrderCancelled($order);
        $channels = $event->broadcastOn();

        $this->assertCount(2, $channels);

        $channelNames = array_map(fn (PrivateChannel $ch) => $ch->name, $channels);
        $this->assertContains("private-client.{$client->id}", $channelNames);
        $this->assertContains("private-driver.{$driver->id}", $channelNames);
    }

    // ──────────────────────────────────────────────────────────────
    // broadcastWith() test
    // ──────────────────────────────────────────────────────────────

    public function test_broadcast_with_data_contains_order_id(): void
    {
        $client = User::factory()->create();
        $driver = User::factory()->driver()->create();
        $order = Order::factory()->completed($driver)->create([
            'client_id' => $client->id,
        ]);

        $events = [
            new OrderOfferedToDriver($order, $driver->id),
            new OrderAccepted($order),
            new OrderCompleted($order),
            new OrderCancelled($order),
        ];

        foreach ($events as $event) {
            $data = $event->broadcastWith();
            $this->assertArrayHasKey('order_id', $data, sprintf(
                '%s::broadcastWith() must include order_id',
                $event::class,
            ));
            $this->assertSame($order->id, $data['order_id']);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Channel authorization tests
    // ──────────────────────────────────────────────────────────────

    public function test_client_channel_authorizes_correct_user(): void
    {
        $user = User::factory()->create();

        $this->assertTrue(
            $this->channelAuthResult($user, 'private-client.'.$user->id),
            'User should be able to access their own client channel',
        );
    }

    public function test_client_channel_rejects_wrong_user(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $this->expectException(AccessDeniedHttpException::class);

        $this->channelAuthResult($user, 'private-client.'.$otherUser->id);
    }

    public function test_driver_channel_requires_driver_role(): void
    {
        $clientUser = User::factory()->create(['role' => UserRole::Client]);

        $this->expectException(AccessDeniedHttpException::class);

        $this->channelAuthResult($clientUser, 'private-driver.'.$clientUser->id);
    }

    /**
     * Verify channel authorization by calling verifyUserCanAccessChannel on the broadcaster.
     *
     * This bypasses the Pusher SDK's authorizeChannel (which needs real credentials)
     * and directly tests the channel callbacks registered in routes/channels.php.
     *
     * @return bool True when the user is authorized.
     *
     * @throws AccessDeniedHttpException When the user is not authorized.
     */
    private function channelAuthResult(User $user, string $channelName): bool
    {
        $broadcaster = app(Broadcaster::class);

        $request = request();
        $request->merge(['channel_name' => $channelName]);
        $request->setUserResolver(fn () => $user);

        // Strip the private- prefix to get the normalized channel name
        $normalizedName = preg_replace('/^private-/', '', $channelName);

        // Call the protected verifyUserCanAccessChannel method
        $method = new \ReflectionMethod($broadcaster, 'verifyUserCanAccessChannel');

        // This throws AccessDeniedHttpException if unauthorized.
        // If it returns without throwing, the user is authorized.
        $method->invoke($broadcaster, $request, $normalizedName);

        return true;
    }
}
