<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderAccepted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Create a new event instance.
     */
    public function __construct(
        public Order $order,
    ) {}

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("client.{$this->order->client_id}"),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'order.accepted';
    }

    /**
     * Get the data to broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $this->order->loadMissing(['driver.driverProfile']);

        $profile = $this->order->driver?->driverProfile;

        return [
            'order_id' => $this->order->id,
            'driver_id' => $this->order->driver_id,
            'driver_name' => $this->order->driver?->name,
            'car_model' => $profile?->car_model,
            'car_number' => $profile?->car_number,
            // Сразу прокидываем последнюю известную позицию водителя.
            // Раньше клиент дёргал refetch order на event, но если
            // первый driver.location event ещё не прилетел, маркер
            // машины не появлялся 1-3 секунды после «Принято». Теперь
            // показываем сразу с момента принятия.
            'latitude' => $profile?->latitude !== null ? (float) $profile->latitude : null,
            'longitude' => $profile?->longitude !== null ? (float) $profile->longitude : null,
        ];
    }
}
