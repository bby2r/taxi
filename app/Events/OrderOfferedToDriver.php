<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderOfferedToDriver implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public Order $order,
        public int $driverUserId,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("driver.{$this->driverUserId}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'order.offered';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->order->id,
            'pickup_latitude' => $this->order->pickup_latitude,
            'pickup_longitude' => $this->order->pickup_longitude,
            'pickup_address' => $this->order->pickup_address,
            'price' => $this->order->price,
            // Mirror the FCM payload so the driver app's countdown stays
            // in sync with the server-side OfferTimeoutJob regardless of
            // whether the offer event arrives via Pusher or via FCM.
            'offered_at' => $this->order->offered_at?->toIso8601String(),
        ];
    }
}
