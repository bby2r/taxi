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
     * Создание заказа. Клиент явно указывает откуда (fromRegionId) и
     * куда (toRegionId) — без GPS-автоопределения. from == to ⇒ заказ
     * внутри одного села, from != to ⇒ межсёлами. Цена берётся из
     * матрицы region_routes; если пары в матрице нет — кидаем ошибку,
     * чтобы заказ не ушёл в работу с ценой 0.
     */
    public function createOrder(
        User $client,
        float $pickupLat,
        float $pickupLon,
        int $fromRegionId,
        int $toRegionId,
        ?string $pickupAddress = null,
        ?float $dropoffLat = null,
        ?float $dropoffLon = null,
        ?string $dropoffAddress = null,
        ?string $clientComment = null,
        bool $isRoundTrip = false,
    ): Order {
        $activeOrder = Order::forClient($client->id)->active()->first();
        if ($activeOrder) {
            throw new \RuntimeException('Client already has an active order.');
        }

        $from = Region::findOrFail($fromRegionId);
        $to = Region::findOrFail($toRegionId);

        $basePrice = $to->priceFrom($from);
        if ($basePrice <= 0) {
            throw new \RuntimeException(
                'Тариф для этого направления не настроен. Обратитесь в поддержку.'
            );
        }

        // Round-trip = driver waits at the destination and brings the
        // client back. Surcharge percent comes from Settings so the
        // operator can tune it without a redeploy; defaults to 70 %
        // (final price = base * 1.7). Applied here at creation time so
        // the orders.price column locks in the full amount — every
        // downstream consumer (dispatch FCM, billing snapshot, admin
        // history) gets the same number with zero special-casing.
        $price = $basePrice;
        if ($isRoundTrip) {
            $surchargePct = (int) Setting::getValue('round_trip_surcharge_percent', 70);
            $price = (int) round($basePrice * (1 + $surchargePct / 100));
        }

        // region_id хранит TO (направление) — совместимость с историей
        // и is_inter_district (region_id != null = межсёлами).
        // pickup_region_id хранит FROM. Для in-village оба совпадают;
        // is_inter_district становится (from != to), а не «есть region_id».
        $isInterVillage = $from->id !== $to->id;

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
            'client_comment' => $clientComment,
            'is_round_trip' => $isRoundTrip,
            'price' => $price,
            'region_id' => $isInterVillage ? $to->id : null,
            'pickup_region_id' => $from->id,
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
        $offeredAt = now();

        $order->update([
            'offered_driver_id' => $driver->user_id,
            'offered_at' => $offeredAt,
        ]);

        // 30 s offer window — back from a brief 45 s experiment.
        // Driver-side feedback was that 45 felt sluggish; 30 keeps the
        // dispatcher rotating offers fast enough for live traffic.
        $timeout = 30;

        OfferTimeoutJob::dispatch($order->id, $driver->user_id)
            ->delay(now()->addSeconds($timeout));

        // ETA driver → pickup at typical 30 km/h city speed. distance_km
        // is appended by GeoService.findNearestDrivers so no extra query.
        $etaMinutes = (int) max(1, round(((float) ($driver->distance_km ?? 0)) / 30 * 60));

        event(new OrderOfferedToDriver($order, $driver->user_id));

        $driverUser = User::find($driver->user_id);
        if ($driverUser) {
            // Inter-district = region_id is set. Order model has no
            // is_inter_district accessor, so checking $order->is_inter_district
            // silently always returned null and the dropoff text never
            // made it into the FCM payload — the original cause of the
            // "300 сом и всё" overlay report.
            $destinationName = $order->region_id !== null
                ? ($order->dropoff_address ?: $order->region?->name)
                : null;

            $body = $order->pickup_address
                ? "Подача: {$order->pickup_address}".($destinationName ? " → {$destinationName}" : '')." · {$order->price} сом · ~{$etaMinutes} мин"
                : ($destinationName
                    ? "→ {$destinationName} · {$order->price} сом · ~{$etaMinutes} мин"
                    : "Новый заказ · {$order->price} сом · ~{$etaMinutes} мин");

            $this->pushService->sendOfferToDriver(
                $driverUser,
                'Новый заказ',
                $body,
                [
                    'order_id' => $order->id,
                    'type' => 'new_order',
                    'expires_in' => $timeout,
                    // ISO timestamp the offer was made — driver app
                    // computes remaining = expires_in − (now − offered_at)
                    // so its countdown stays in sync with the server's
                    // OfferTimeoutJob (no longer "30 s on the card while
                    // 24 s left on the server").
                    'offered_at' => $offeredAt->toIso8601String(),
                    // Pickup address stays "pure" — just the pickup. The
                    // native overlay renders dropoff_text as a separate
                    // "Куда" line, so we don't need to compose them
                    // into one string anymore.
                    'pickup_address' => $order->pickup_address,
                    'dropoff_text' => $destinationName,
                    'client_comment' => $order->client_comment,
                    'is_round_trip' => $order->is_round_trip,
                    'price' => (int) $order->price,
                    'eta_minutes' => $etaMinutes,
                    'distance_km' => (float) ($driver->distance_km ?? 0),
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
     * Increment the driver's shift decline counter. Timeouts don't count
     * — they happen when the driver was unable to react in time, not
     * when they actively rejected a ride.
     *
     * Used to be a hard block at 5 declines (off-line for 2 h) but that
     * was punitive and shipped drivers home for a slow afternoon. The
     * counter is now strictly a ranking signal — GeoService.findNearestDrivers
     * deprioritises drivers with high recent declines within the same
     * fairness bucket, but they stay online and can still pick up the
     * next round of offers. The decline_block_threshold setting is kept
     * but only used as a soft sort weight by GeoService now; the
     * blocked_until hard cutoff is left for admin-imposed bans.
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

        $profile->update([
            'shift_declines_count' => $profile->shift_declines_count + 1,
        ]);
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
     *
     * For round-trip orders the driver gets a "клиент не вернулся"
     * option — `oneWayFallback=true` strips the round-trip surcharge
     * off the price before the commission is locked in. Without this,
     * the platform would skim a 7 % cut of a fare the driver only
     * earned half of, on top of the driver eating the lost return leg.
     */
    public function completeOrder(Order $order, User $driver, bool $oneWayFallback = false): Order
    {
        $order = DB::transaction(function () use ($order, $driver, $oneWayFallback) {
            $order = Order::lockForUpdate()->findOrFail($order->id);

            if ($order->status !== OrderStatus::InProgress || $order->driver_id !== $driver->id) {
                throw new \RuntimeException('Cannot complete this order.');
            }

            // If round-trip was sold but client didn't actually return,
            // back out the surcharge so commission is taken from the
            // real one-way amount. Also flip is_round_trip off — the
            // history row reflects what actually happened, not what
            // was originally quoted.
            $effectivePrice = (int) $order->price;
            $finalIsRoundTrip = (bool) $order->is_round_trip;
            if ($oneWayFallback && $order->is_round_trip) {
                $surchargePct = (int) Setting::getValue('round_trip_surcharge_percent', 70);
                if ($surchargePct > 0) {
                    $effectivePrice = (int) round($order->price / (1 + $surchargePct / 100));
                }
                $finalIsRoundTrip = false;
            }

            // Lock the operator commission onto the order at completion time
            // so future rate changes don't rewrite history. Only completed
            // orders generate commission — cancellations and the
            // cancellation_fee don't.
            $rate = (int) Setting::getValue('commission_rate', 7);
            $commission = (int) round(($effectivePrice * $rate) / 100);

            $order->update([
                'status' => OrderStatus::Completed,
                'completed_at' => now(),
                'price' => $effectivePrice,
                'is_round_trip' => $finalIsRoundTrip,
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
        // lockForUpdate inside the transaction so the ownership +
        // status check sees the same row that cancelOrder will mutate.
        // Before the lock, a concurrent acceptOrder / startRide could
        // win between the check and the write — driver gets a clean
        // 422 instead of a 500 race.
        return DB::transaction(function () use ($order, $driver, $reason) {
            $fresh = Order::lockForUpdate()->findOrFail($order->id);

            if ($fresh->driver_id !== $driver->id) {
                throw new \RuntimeException('Not assigned to this driver.');
            }

            if (! in_array($fresh->status, [OrderStatus::Accepted, OrderStatus::Arrived], true)) {
                throw new \RuntimeException('Order cannot be cancelled in its current state.');
            }

            return $this->cancelOrder($fresh, 'driver', $reason);
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
            $this->declineOrder($order, $driver, DeclineReason::Timeout->value);
        }
    }
}
