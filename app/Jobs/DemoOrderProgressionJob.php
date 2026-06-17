<?php

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Events\OrderAccepted;
use App\Events\OrderCompleted;
use App\Events\OrderDriverArrived;
use App\Events\OrderInProgress;
use App\Models\Order;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DemoOrderProgressionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Бот-водитель проматывает весь жизненный цикл заказа от демо-клиента:
     * searching → accepted → arrived → in_progress → completed. Запускается
     * из OrderService::createOrder когда client.isDemo(). Ревьюер видит
     * полный happy path независимо от того, есть ли реальные водители в
     * зоне.
     *
     * Каждая фаза рекурсивно ставит следующую в очередь — отдельный Job с
     * delay вместо одного с sleep(), чтобы корректно работать на воркерах
     * с короткими таймаутами.
     */
    public function __construct(
        public readonly int $orderId,
        public readonly string $phase,
    ) {}

    public function handle(): void
    {
        $order = Order::find($this->orderId);
        if (! $order) {
            return;
        }

        if ($order->status === OrderStatus::Cancelled) {
            return;
        }

        $driver = User::where('phone', config('demo.driver_phone'))->first();
        if (! $driver) {
            return;
        }

        match ($this->phase) {
            'accept' => $this->accept($order, $driver),
            'arrived' => $this->arrived($order),
            'in_progress' => $this->inProgress($order),
            'completed' => $this->completed($order),
            default => null,
        };
    }

    private function accept(Order $order, User $driver): void
    {
        // Демо-водитель «выходит на линию» рядом с pickup-точкой ревьюера.
        // Без обновления driverProfile клиент не увидел бы маркер машины
        // на карте после accept.
        $driver->driverProfile?->update([
            'is_online' => true,
            'latitude' => (float) $order->pickup_latitude + 0.002,
            'longitude' => (float) $order->pickup_longitude + 0.002,
            'location_updated_at' => now(),
        ]);

        $order->update([
            'status' => OrderStatus::Accepted,
            'driver_id' => $driver->id,
            'driver_snapshot' => [
                'name' => $driver->name,
                'phone' => $driver->phone,
                'car_model' => $driver->driverProfile?->car_model,
                'car_number' => $driver->driverProfile?->car_number,
            ],
            'accepted_at' => now(),
        ]);
        event(new OrderAccepted($order));

        self::dispatch($this->orderId, 'arrived')->delay(now()->addSeconds(10));
    }

    private function arrived(Order $order): void
    {
        $order->update([
            'status' => OrderStatus::Arrived,
            'arrived_at' => now(),
        ]);
        event(new OrderDriverArrived($order));

        self::dispatch($this->orderId, 'in_progress')->delay(now()->addSeconds(10));
    }

    private function inProgress(Order $order): void
    {
        $order->update([
            'status' => OrderStatus::InProgress,
            'in_progress_at' => now(),
        ]);
        event(new OrderInProgress($order));

        self::dispatch($this->orderId, 'completed')->delay(now()->addSeconds(10));
    }

    private function completed(Order $order): void
    {
        $order->update([
            'status' => OrderStatus::Completed,
            'completed_at' => now(),
        ]);
        event(new OrderCompleted($order));
    }
}
