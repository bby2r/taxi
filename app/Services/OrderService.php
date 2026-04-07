<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Events\OrderAccepted;
use App\Events\OrderCancelled;
use App\Events\OrderCompleted;
use App\Events\OrderDriverArrived;
use App\Events\OrderInProgress;
use App\Events\OrderOfferedToDriver;
use App\Jobs\OfferTimeoutJob;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class OrderService
{
    public function __construct(
        private readonly TariffService $tariffService,
        private readonly GeoService $geoService,
    ) {}

    /**
     * Create a new order for the given client and begin driver search.
     */
    public function createOrder(
        User $client,
        float $pickupLat,
        float $pickupLon,
        ?string $pickupAddress = null,
        ?float $dropoffLat = null,
        ?float $dropoffLon = null,
        ?string $dropoffAddress = null,
    ): Order {
        $activeOrder = Order::forClient($client->id)->active()->first();
        if ($activeOrder) {
            throw new \RuntimeException('Client already has an active order.');
        }

        $price = $this->tariffService->getCurrentPrice();

        $order = Order::create([
            'client_id' => $client->id,
            'status' => OrderStatus::Searching,
            'pickup_latitude' => $pickupLat,
            'pickup_longitude' => $pickupLon,
            'pickup_address' => $pickupAddress,
            'dropoff_latitude' => $dropoffLat,
            'dropoff_longitude' => $dropoffLon,
            'dropoff_address' => $dropoffAddress,
            'price' => $price,
            'declined_drivers' => [],
        ]);

        $this->offerToNextDriver($order);

        return $order->refresh();
    }

    /**
     * Find the nearest available driver and offer the order to them.
     */
    public function offerToNextDriver(Order $order): void
    {
        $drivers = $this->geoService->findNearestDrivers(
            (float) $order->pickup_latitude,
            (float) $order->pickup_longitude,
            $order->getDeclinedDriverIds(),
            limit: 1,
        );

        if ($drivers->isEmpty()) {
            $this->cancelOrder($order, 'system');

            return;
        }

        $driver = $drivers->first();

        $order->update([
            'offered_driver_id' => $driver->user_id,
            'offered_at' => now(),
        ]);

        OfferTimeoutJob::dispatch($order->id, $driver->user_id)
            ->delay(now()->addSeconds(10));

        event(new OrderOfferedToDriver($order, $driver->user_id));
    }

    /**
     * Accept an order that was offered to the given driver.
     */
    public function acceptOrder(Order $order, User $driver): Order
    {
        return DB::transaction(function () use ($order, $driver) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== OrderStatus::Searching) {
                throw new \RuntimeException('Order is no longer available.');
            }

            if ($order->offered_driver_id !== $driver->id) {
                throw new \RuntimeException('Order was not offered to this driver.');
            }

            $order->update([
                'status' => OrderStatus::Accepted,
                'driver_id' => $driver->id,
                'accepted_at' => now(),
                'offered_driver_id' => null,
                'offered_at' => null,
            ]);

            event(new OrderAccepted($order));

            return $order;
        });
    }

    /**
     * Decline an order and offer it to the next nearest driver.
     */
    public function declineOrder(Order $order, User $driver): void
    {
        DB::transaction(function () use ($order, $driver) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== OrderStatus::Searching) {
                return;
            }

            if ($order->offered_driver_id !== $driver->id) {
                return;
            }

            $declined = $order->getDeclinedDriverIds();
            $declined[] = $driver->id;

            $order->update([
                'declined_drivers' => $declined,
                'offered_driver_id' => null,
                'offered_at' => null,
            ]);
        });

        $this->offerToNextDriver($order->refresh());
    }

    /**
     * Mark the driver as arrived at the pickup location.
     */
    public function driverArrived(Order $order, User $driver): Order
    {
        return DB::transaction(function () use ($order, $driver) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== OrderStatus::Accepted || $order->driver_id !== $driver->id) {
                throw new \RuntimeException('Cannot mark arrival for this order.');
            }

            $order->update([
                'status' => OrderStatus::Arrived,
                'arrived_at' => now(),
            ]);

            event(new OrderDriverArrived($order));

            return $order;
        });
    }

    /**
     * Start the ride (transition from Arrived to InProgress).
     */
    public function startRide(Order $order, User $driver): Order
    {
        return DB::transaction(function () use ($order, $driver) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== OrderStatus::Arrived || $order->driver_id !== $driver->id) {
                throw new \RuntimeException('Cannot start ride for this order.');
            }

            $order->update([
                'status' => OrderStatus::InProgress,
                'in_progress_at' => now(),
            ]);

            event(new OrderInProgress($order));

            return $order;
        });
    }

    /**
     * Complete the order (transition from InProgress to Completed).
     */
    public function completeOrder(Order $order, User $driver): Order
    {
        return DB::transaction(function () use ($order, $driver) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== OrderStatus::InProgress || $order->driver_id !== $driver->id) {
                throw new \RuntimeException('Cannot complete this order.');
            }

            $order->update([
                'status' => OrderStatus::Completed,
                'completed_at' => now(),
            ]);

            event(new OrderCompleted($order));

            return $order;
        });
    }

    /**
     * Cancel the order. Applies cancellation fee if client cancels after driver accepted.
     */
    public function cancelOrder(Order $order, string $cancelledBy): Order
    {
        return DB::transaction(function () use ($order, $cancelledBy) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if (! $order->isCancellable()) {
                throw new \RuntimeException('Order cannot be cancelled.');
            }

            $cancellationFee = null;
            if ($cancelledBy === 'client' && $order->status !== OrderStatus::Searching) {
                $cancellationFee = $this->tariffService->getCancellationFee();
            }

            $order->update([
                'status' => OrderStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $cancelledBy,
                'cancellation_fee' => $cancellationFee,
                'offered_driver_id' => null,
                'offered_at' => null,
            ]);

            event(new OrderCancelled($order));

            return $order;
        });
    }

    /**
     * Handle offer timeout — auto-decline if the offer is still pending.
     */
    public function handleOfferTimeout(int $orderId, int $driverUserId): void
    {
        $order = Order::find($orderId);

        if (! $order || $order->status !== OrderStatus::Searching) {
            return;
        }

        if ($order->offered_driver_id !== $driverUserId) {
            return;
        }

        $driver = User::find($driverUserId);
        if ($driver) {
            $this->declineOrder($order, $driver);
        }
    }
}
