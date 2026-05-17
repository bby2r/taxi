<?php

namespace App\Services;

use App\Enums\DeclineReason;
use App\Enums\OrderStatus;
use App\Events\OrderAccepted;
use App\Events\OrderCancelled;
use App\Events\OrderCompleted;
use App\Events\OrderDriverArrived;
use App\Events\OrderInProgress;
use App\Events\OrderOfferedToDriver;
use App\Jobs\OfferTimeoutJob;
use App\Jobs\SearchDriversJob;
use App\Models\Order;
use App\Models\OrderDecline;
use App\Models\Region;
use App\Models\Setting;
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
        ?int $regionId = null,
    ): Order {
        $activeOrder = Order::forClient($client->id)->active()->first();
        if ($activeOrder) {
            throw new \RuntimeException('Client already has an active order.');
        }

        $price = $regionId
            ? Region::findOrFail($regionId)->getCurrentPrice()
            : $this->tariffService->getCurrentPrice();

        $order = Order::create([
            'client_id' => $client->id,
            'client_snapshot' => [
                'name' => $client->name,
                'phone' => $client->phone,
            ],
            'status' => OrderStatus::Searching,
            'pickup_latitude' => $pickupLat,
            'pickup_longitude' => $pickupLon,
            'pickup_address' => $pickupAddress,
            'dropoff_latitude' => $dropoffLat,
            'dropoff_longitude' => $dropoffLon,
            'dropoff_address' => $dropoffAddress,
            'price' => $price,
            'region_id' => $regionId,
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
        // Guard: declineOrder calls this with a freshly refreshed order, but
        // by the time we get here the order may have been moved out of
        // Searching by another concurrent flow (server-side timeout job,
        // client cancel, system cancel). Without this check we'd end up
        // calling cancelOrder() on a non-cancellable order and throwing
        // a 500 to whoever triggered the chain (the driver tapping
        // "Отказаться" from the notification shade was the report).
        if ($order->status !== OrderStatus::Searching) {
            return;
        }

        $drivers = $this->geoService->findNearestDrivers(
            (float) $order->pickup_latitude,
            (float) $order->pickup_longitude,
            $order->getDeclinedDriverIds(),
            limit: 1,
        );

        if ($drivers->isEmpty()) {
            $maxAttempts = 3;

            if ($order->search_attempts < $maxAttempts) {
                $order->increment('search_attempts');

                SearchDriversJob::dispatch($order->id)
                    ->delay(now()->addSeconds(15));

                return;
            }

            $this->cancelOrder($order, 'system');

            return;
        }

        $driver = $drivers->first();

        $order->update([
            'offered_driver_id' => $driver->user_id,
            'offered_at' => now(),
        ]);

        $timeout = $order->region_id ? 45 : 30;

        OfferTimeoutJob::dispatch($order->id, $driver->user_id)
            ->delay(now()->addSeconds($timeout));

        event(new OrderOfferedToDriver($order, $driver->user_id));

        $driverUser = User::find($driver->user_id);
        if ($driverUser) {
            $body = $order->pickup_address
                ? "Подача: {$order->pickup_address} · {$order->price} сом"
                : "Новый заказ · {$order->price} сом";

            $this->pushService->sendOfferToDriver(
                $driverUser,
                'Новый заказ',
                $body,
                [
                    'order_id' => $order->id,
                    'type' => 'new_order',
                    'expires_in' => $timeout,
                    // Used by the driver app's background notification task
                    // to populate the SYSTEM_ALERT_WINDOW overlay without a
                    // round-trip to /orders/pending-offer (which the OS may
                    // not let a brief background JS task complete in time).
                    'pickup_address' => $order->pickup_address,
                    'price' => (int) $order->price,
                ],
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

            $driver->loadMissing('driverProfile');

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
                'offered_driver_id' => null,
                'offered_at' => null,
            ]);

            event(new OrderAccepted($order));

            return $order;
        });

        $client = User::find($order->client_id);
        $driverProfile = $driver->driverProfile;

        if ($client) {
            $car = $driverProfile?->car_model;
            $body = $car
                ? "{$driver->name} едет к вам на {$car}"
                : "{$driver->name} едет к вам";

            $this->pushService->sendToUser(
                $client,
                'Водитель найден',
                $body,
                ['order_id' => $order->id, 'type' => 'order_accepted'],
            );
        }

        return $order;
    }

    /**
     * Decline an order and offer it to the next nearest driver.
     */
    public function declineOrder(Order $order, User $driver, ?string $reason = null): void
    {
        $reason ??= DeclineReason::Personal->value;

        DB::transaction(function () use ($order, $driver, $reason) {
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

            OrderDecline::create([
                'order_id' => $order->id,
                'driver_id' => $driver->id,
                'reason' => $reason,
            ]);

            $this->applyDeclinePenalty($driver, $reason);
        });

        $this->offerToNextDriver($order->refresh());
    }

    /**
     * Increment the driver's shift decline counter and block them
     * once they hit the configured threshold. Timeouts do not count.
     */
    private function applyDeclinePenalty(User $driver, string $reason): void
    {
        if ($reason === DeclineReason::Timeout->value) {
            return;
        }

        $profile = $driver->driverProfile()->lockForUpdate()->first();
        if (! $profile) {
            return;
        }

        $threshold = (int) Setting::getValue('decline_block_threshold', 5);
        $blockHours = (int) Setting::getValue('decline_block_hours', 2);
        $newCount = $profile->shift_declines_count + 1;

        $update = ['shift_declines_count' => $newCount];
        if ($newCount >= $threshold) {
            $update['blocked_until'] = now()->addHours($blockHours);
            $update['is_online'] = false;
        }

        $profile->update($update);
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
                'Водитель ожидает вас',
                "{$driver->name} прибыл в точку подачи",
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

            // Lock the operator commission onto the order at completion time
            // so future rate changes don't rewrite history. Only completed
            // orders generate commission — cancellations and the
            // cancellation_fee don't.
            $rate = (int) Setting::getValue('commission_rate', 7);
            $commission = (int) round(($order->price * $rate) / 100);

            $order->update([
                'status' => OrderStatus::Completed,
                'completed_at' => now(),
                'commission_amount' => $commission,
            ]);

            event(new OrderCompleted($order));

            return $order;
        });

        $client = User::find($order->client_id);

        if ($client) {
            $this->pushService->sendToUser(
                $client,
                'Поездка завершена',
                "К оплате: {$order->price} сом",
                ['order_id' => $order->id, 'type' => 'order_completed'],
            );
        }

        $this->pushService->sendToUser(
            $driver,
            'Поездка завершена',
            "Заработано: {$order->price} сом",
            ['order_id' => $order->id, 'type' => 'order_completed'],
        );

        return $order;
    }

    /**
     * Cancel the order. Applies cancellation fee if client cancels after driver accepted.
     */
    public function cancelOrder(Order $order, string $cancelledBy, ?string $reason = null): Order
    {
        $order = DB::transaction(function () use ($order, $cancelledBy, $reason) {
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
                'cancellation_reason' => $reason,
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
                'Заказ отменён',
                'Ваш заказ был отменён',
                ['order_id' => $order->id, 'type' => 'order_cancelled'],
            );
        }

        if ($driver) {
            $this->pushService->sendToUser(
                $driver,
                'Заказ отменён',
                'Заказ был отменён',
                ['order_id' => $order->id, 'type' => 'order_cancelled'],
            );
        }

        return $order;
    }

    /**
     * Cancel an active order from the driver side (client did not show up,
     * not answering, etc.). No cancellation fee. Only valid while the order
     * is in Accepted or Arrived status — InProgress is the actual ride and
     * cannot be cancelled this way.
     */
    public function cancelByDriver(Order $order, User $driver, string $reason): Order
    {
        $order = Order::findOrFail($order->id);

        if ($order->driver_id !== $driver->id) {
            throw new \RuntimeException('Not assigned to this driver.');
        }

        if (! in_array($order->status, [OrderStatus::Accepted, OrderStatus::Arrived], true)) {
            throw new \RuntimeException('Order cannot be cancelled in its current state.');
        }

        return $this->cancelOrder($order, 'driver', $reason);
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
            $this->declineOrder($order, $driver, DeclineReason::Timeout->value);
        }
    }
}
