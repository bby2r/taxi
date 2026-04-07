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
        private readonly ExpoPushService $pushService,
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

        $driverUser = User::find($driver->user_id);
        if ($driverUser) {
            $this->pushService->sendToUser(
                $driverUser,
                'New ride request',
                "A client is looking for a ride from {$order->pickup_address}",
                ['order_id' => $order->id, 'type' => 'new_order'],
            );
        }
    }

    /**
     * Accept an order that was offered to the given driver.
     */
    public function acceptOrder(Order $order, User $driver): Order
    {
        $order = DB::transaction(function () use ($order, $driver) {
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

        $client = User::find($order->client_id);
        $driverProfile = $driver->driverProfile;

        if ($client) {
            $this->pushService->sendToUser(
                $client,
                'Driver found!',
                "{$driver->name} is on the way in a {$driverProfile?->car_model}",
                ['order_id' => $order->id, 'type' => 'order_accepted'],
            );
        }

        return $order;
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
        $order = DB::transaction(function () use ($order, $driver) {
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

        $client = User::find($order->client_id);

        if ($client) {
            $this->pushService->sendToUser(
                $client,
                'Driver arrived',
                "{$driver->name} has arrived at your pickup point",
                ['order_id' => $order->id, 'type' => 'driver_arrived'],
            );
        }

        return $order;
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
        $order = DB::transaction(function () use ($order, $driver) {
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

        $client = User::find($order->client_id);

        if ($client) {
            $this->pushService->sendToUser(
                $client,
                'Ride completed',
                "Your ride is complete. Total: {$order->price} KGS",
                ['order_id' => $order->id, 'type' => 'order_completed'],
            );
        }

        $this->pushService->sendToUser(
            $driver,
            'Ride completed',
            "Ride completed. Earned: {$order->price} KGS",
            ['order_id' => $order->id, 'type' => 'order_completed'],
        );

        return $order;
    }

    /**
     * Cancel the order. Applies cancellation fee if client cancels after driver accepted.
     */
    public function cancelOrder(Order $order, string $cancelledBy): Order
    {
        $order = DB::transaction(function () use ($order, $cancelledBy) {
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

        $client = User::find($order->client_id);
        $driver = $order->driver_id ? User::find($order->driver_id) : null;

        if ($client) {
            $this->pushService->sendToUser(
                $client,
                'Ride cancelled',
                'Your ride has been cancelled',
                ['order_id' => $order->id, 'type' => 'order_cancelled'],
            );
        }

        if ($driver) {
            $this->pushService->sendToUser(
                $driver,
                'Ride cancelled',
                'The ride has been cancelled',
                ['order_id' => $order->id, 'type' => 'order_cancelled'],
            );
        }

        return $order;
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
