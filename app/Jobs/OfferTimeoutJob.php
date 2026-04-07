<?php

namespace App\Jobs;

use App\Services\OrderService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class OfferTimeoutJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public readonly int $orderId,
        public readonly int $driverUserId,
    ) {}

    /**
     * Execute the job.
     */
    public function handle(OrderService $orderService): void
    {
        $orderService->handleOfferTimeout($this->orderId, $this->driverUserId);
    }
}
