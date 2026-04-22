<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Setting;
use App\Services\OrderService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('orders:cancel-stale')]
#[Description('Cancel orders stuck in Accepted/Arrived longer than the configured threshold.')]
class CancelStaleActiveOrders extends Command
{
    public function handle(OrderService $orderService): int
    {
        $hours = (float) Setting::getValue('stale_active_order_hours', 2);

        if ($hours <= 0) {
            $this->info('Stale-order auto-cancel disabled (stale_active_order_hours <= 0).');

            return self::SUCCESS;
        }

        $threshold = now()->subMinutes((int) round($hours * 60));

        $stale = Order::query()
            ->whereIn('status', [OrderStatus::Accepted, OrderStatus::Arrived])
            ->where(function ($q) use ($threshold) {
                $q->where(function ($q2) use ($threshold) {
                    $q2->where('status', OrderStatus::Accepted)
                        ->where('accepted_at', '<', $threshold);
                })->orWhere(function ($q2) use ($threshold) {
                    $q2->where('status', OrderStatus::Arrived)
                        ->where('arrived_at', '<', $threshold);
                });
            })
            ->get();

        foreach ($stale as $order) {
            try {
                $orderService->cancelOrder($order, 'system');
                $this->info("Cancelled stale order #{$order->id} (driver={$order->driver_id}, status was {$order->status->value}).");
            } catch (\Throwable $e) {
                $this->warn("Skipped order #{$order->id}: {$e->getMessage()}");
            }
        }

        $this->info("Done. Cancelled {$stale->count()} stale order(s) older than {$hours}h.");

        return self::SUCCESS;
    }
}
