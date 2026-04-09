<?php

namespace App\Jobs;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SearchDriversJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public readonly int $orderId,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(OrderService $orderService): void
    {
        $order = Order::find($this->orderId);

        if (! $order || $order->status !== OrderStatus::Searching) {
            return;
        }

        // Reset declined drivers for a fresh search round
        $order->update(['declined_drivers' => []]);

        $orderService->offerToNextDriver($order);
    }
}
