---
phase: 3
title: "Core Business Logic — Tariff, Geo, Order Service, Broadcasting"
status: pending
depends_on: [1, 2]
---

# Phase 3: Core Business Logic — Tariff, Geo, Order Service, Broadcasting

Implement pricing engine, driver proximity calculation, order lifecycle management with cascade logic, and real-time broadcasting via Pusher.

**Pre-flight**: Run `search-docs` for "broadcasting Pusher", "database transactions pessimistic locking", "job dispatching", "scheduled commands", "events" before starting.

---

### 3.1 Tariff Service — Day/Night Pricing

**Complexity**: simple
**Requires**: Phase 1 (timezone config)

**Implementation**:

- **Service `app/Services/TariffService.php`**: Create with `php artisan make:class --no-interaction Services/TariffService`
  ```php
  class TariffService
  {
      private const int DAY_PRICE = 80;
      private const int NIGHT_PRICE = 120;
      private const int DAY_START_HOUR = 7;   // 07:00
      private const int NIGHT_START_HOUR = 21; // 21:00
      private const int CANCELLATION_FEE = 50;

      /**
       * Get current price based on time of day in Asia/Bishkek timezone.
       * Day: 07:00-20:59 = 80 som. Night: 21:00-06:59 = 120 som.
       */
      public function getCurrentPrice(?Carbon $at = null): int
      {
          $time = ($at ?? now())->timezone('Asia/Bishkek');
          $hour = $time->hour;

          return ($hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR)
              ? self::DAY_PRICE
              : self::NIGHT_PRICE;
      }

      public function isDayTime(?Carbon $at = null): bool
      {
          $time = ($at ?? now())->timezone('Asia/Bishkek');
          $hour = $time->hour;

          return $hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR;
      }

      public function getCancellationFee(): int
      {
          return self::CANCELLATION_FEE;
      }

      public function getDayPrice(): int
      {
          return self::DAY_PRICE;
      }

      public function getNightPrice(): int
      {
          return self::NIGHT_PRICE;
      }
  }
  ```

- **Tests (PHPUnit)**:
  - Unit: `tests/Unit/Services/TariffServiceTest.php` — `php artisan make:test --phpunit --unit Services/TariffServiceTest`
    - `testDayPriceAt8Am` — `Carbon::parse('2026-04-06 08:00', 'Asia/Bishkek')`, assert price is 80
    - `testDayPriceAt7Am` — boundary: 07:00 exactly, assert 80
    - `testDayPriceAt2059` — 20:59, assert 80
    - `testNightPriceAt9Pm` — 21:00 exactly, assert 120
    - `testNightPriceAt11Pm` — 23:00, assert 120
    - `testNightPriceAt3Am` — 03:00, assert 120
    - `testNightPriceAt659Am` — 06:59, assert 120
    - `testIsDayTimeReturnsTrue` — 12:00, assert true
    - `testIsDayTimeReturnsFalse` — 22:00, assert false
    - `testCancellationFeeIs50` — assert `getCancellationFee() === 50`
    - `testGetCurrentPriceUsesNowWhenNoArgument` — freeze time at 10:00, assert 80; freeze at 22:00, assert 120. Use `$this->travelTo()`.

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: Always pass timezone explicitly in `getCurrentPrice`. The app timezone is Asia/Bishkek but be defensive. Price is determined at order CREATION time and stored — it does not change after.

:white_check_mark: Done when: TariffService returns correct prices for all boundary hours, all tests pass.

---

### 3.2 Geo Service — Driver Proximity & Distance Calculation

**Complexity**: medium
**Requires**: Phase 1 (DriverProfile model)

**Implementation**:

- **Service `app/Services/GeoService.php`**: Create with `php artisan make:class --no-interaction Services/GeoService`
  ```php
  class GeoService
  {
      /**
       * Calculate distance between two points using Haversine formula.
       * Returns distance in kilometers.
       */
      public function distanceKm(
          float $lat1,
          float $lon1,
          float $lat2,
          float $lon2,
      ): float {
          $earthRadiusKm = 6371.0;

          $dLat = deg2rad($lat2 - $lat1);
          $dLon = deg2rad($lon2 - $lon1);

          $a = sin($dLat / 2) * sin($dLat / 2)
              + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
              * sin($dLon / 2) * sin($dLon / 2);

          $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

          return round($earthRadiusKm * $c, 2);
      }

      /**
       * Find online drivers sorted by distance from a pickup point.
       * Excludes drivers in the $excludeIds array.
       * Returns a Collection of DriverProfile models with a `distance_km` attribute appended.
       *
       * @param  array<int>  $excludeIds  User IDs to exclude (declined drivers)
       * @return \Illuminate\Support\Collection<int, DriverProfile>
       */
      public function findNearestDrivers(
          float $pickupLat,
          float $pickupLon,
          array $excludeIds = [],
          int $limit = 10,
      ): Collection {
          $drivers = DriverProfile::online()
              ->withCoordinates()
              ->when(count($excludeIds) > 0, fn ($q) => $q->whereNotIn('user_id', $excludeIds))
              ->get();

          return $drivers->map(function (DriverProfile $profile) use ($pickupLat, $pickupLon) {
              $profile->distance_km = $this->distanceKm(
                  $pickupLat,
                  $pickupLon,
                  (float) $profile->latitude,
                  (float) $profile->longitude,
              );

              return $profile;
          })->sortBy('distance_km')->take($limit)->values();
      }
  }
  ```

- **Tests (PHPUnit)**:
  - Unit: `tests/Unit/Services/GeoServiceTest.php` — `php artisan make:test --phpunit --unit Services/GeoServiceTest`
    - `testDistanceKmBetweenSamePoint` — same coords, assert 0.0
    - `testDistanceKmBetweenKnownPoints` — Bishkek center (42.8746, 74.5698) to Ala-Too Square (42.8747, 74.6042), assert approximately 3.0 km (within 0.5 delta)
    - `testDistanceKmBetweenDistantPoints` — Bishkek to Osh (~600 km), assert within reasonable range

  - Feature: `tests/Feature/Services/GeoServiceTest.php` — `php artisan make:test --phpunit Services/GeoServiceTest`
    - `testFindNearestDriversReturnsOnlineDriversOnly` — create 2 online + 1 offline driver profiles, call `findNearestDrivers()`, assert count is 2
    - `testFindNearestDriversSortedByDistance` — create drivers at known distances, assert first result is closest
    - `testFindNearestDriversExcludesIds` — create 3 online drivers, exclude 1 by user_id, assert count is 2
    - `testFindNearestDriversRespectsLimit` — create 5 online drivers, limit 3, assert count is 3
    - `testFindNearestDriversReturnsEmptyWhenNoDrivers` — no online drivers, assert empty collection
    - `testFindNearestDriversAppendDistanceKm` — assert returned profiles have `distance_km` attribute

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: For SQLite, the Haversine calculation is done in PHP, not SQL. This is acceptable for village-scale (small number of drivers). If scaling, move to PostGIS or MySQL spatial queries.

:white_check_mark: Done when: GeoService calculates distances correctly, finds nearest drivers sorted, all tests pass.

---

### 3.3 Order Service — Create, Accept, Complete, Cancel with Cascade

**Complexity**: complex
**Requires**: 3.1, 3.2, Phase 1 (Order model), Phase 2 (User model with Sanctum)

**Implementation**:

- **Service `app/Services/OrderService.php`**: Create with `php artisan make:class --no-interaction Services/OrderService`
  ```php
  class OrderService
  {
      public function __construct(
          private readonly TariffService $tariffService,
          private readonly GeoService $geoService,
      ) {}

      /**
       * Create a new order. Price is locked at creation time.
       * Immediately starts the driver cascade by offering to nearest driver.
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
          // Check client doesn't have an active order
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

          // Start cascade
          $this->offerToNextDriver($order);

          return $order->refresh();
      }

      /**
       * Offer order to the nearest available driver.
       * If no drivers available, cancel the order automatically.
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

          // Dispatch job to handle timeout (10 seconds)
          OfferTimeoutJob::dispatch($order->id, $driver->user_id)
              ->delay(now()->addSeconds(10));

          // Broadcast to driver (implemented in 3.4)
          event(new OrderOfferedToDriver($order, $driver->user_id));
      }

      /**
       * Driver accepts the order. Uses pessimistic locking.
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
       * Driver declines the order. Adds to declined list, offers to next driver.
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

          // Offer to next driver (outside transaction)
          $this->offerToNextDriver($order->refresh());
      }

      /**
       * Driver signals arrival at pickup.
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
       * Start the ride (driver begins trip).
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
       * Complete the order.
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
       * Cancel the order. If cancelled after acceptance, apply cancellation fee.
       *
       * @param  string  $cancelledBy  'client', 'driver', or 'system'
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
       * Handle offer timeout. If order still offered to same driver, treat as decline.
       */
      public function handleOfferTimeout(int $orderId, int $driverUserId): void
      {
          $order = Order::find($orderId);

          if (! $order || $order->status !== OrderStatus::Searching) {
              return;
          }

          if ($order->offered_driver_id !== $driverUserId) {
              return; // Already handled (accepted or declined manually)
          }

          $this->declineOrder($order, User::find($driverUserId));
      }
  }
  ```

- **Job `app/Jobs/OfferTimeoutJob.php`**: `php artisan make:job --no-interaction OfferTimeoutJob`
  ```php
  class OfferTimeoutJob implements ShouldQueue
  {
      use Queueable;

      public function __construct(
          public readonly int $orderId,
          public readonly int $driverUserId,
      ) {}

      public function handle(OrderService $orderService): void
      {
          $orderService->handleOfferTimeout($this->orderId, $this->driverUserId);
      }
  }
  ```

- **Events** — create all event classes. Each event contains the `Order` model:
  - `php artisan make:event --no-interaction OrderOfferedToDriver` — constructor: `public Order $order, public int $driverUserId`
  - `php artisan make:event --no-interaction OrderAccepted` — constructor: `public Order $order`
  - `php artisan make:event --no-interaction OrderDriverArrived` — constructor: `public Order $order`
  - `php artisan make:event --no-interaction OrderInProgress` — constructor: `public Order $order`
  - `php artisan make:event --no-interaction OrderCompleted` — constructor: `public Order $order`
  - `php artisan make:event --no-interaction OrderCancelled` — constructor: `public Order $order`

  These events will be made broadcastable in sub-task 3.4. For now they are plain event classes.

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Services/OrderServiceTest.php` — `php artisan make:test --phpunit Services/OrderServiceTest`

    **createOrder tests:**
    - `testCreateOrderSetsSearchingStatus` — create order, assert status is `Searching`
    - `testCreateOrderLocksDayPrice` — freeze time at 10:00, create order, assert price is 80
    - `testCreateOrderLocksNightPrice` — freeze time at 22:00, create order, assert price is 120
    - `testCreateOrderThrowsIfClientHasActiveOrder` — create active order for client, try creating another, expect `RuntimeException`
    - `testCreateOrderOffersToNearestDriver` — create online driver near pickup, create order, assert `offered_driver_id` is set
    - `testCreateOrderCancelsIfNoDrivers` — no online drivers, create order, assert status is `Cancelled`, `cancelled_by` is `'system'`

    **acceptOrder tests:**
    - `testAcceptOrderSetsAcceptedStatus` — offer to driver, accept, assert status `Accepted`, `driver_id` set, `accepted_at` not null
    - `testAcceptOrderThrowsIfNotOfferedToDriver` — offer to driver A, driver B tries accepting, expect exception
    - `testAcceptOrderThrowsIfNotSearchingStatus` — accept order, try accepting again, expect exception
    - `testAcceptOrderFiresEvent` — use `Event::fake()`, accept, assert `OrderAccepted` dispatched

    **declineOrder tests:**
    - `testDeclineOrderAddsToDeclinedList` — decline, assert driver ID in `declined_drivers`
    - `testDeclineOrderOffersToNextDriver` — 2 online drivers, create order (offered to nearest), decline, assert `offered_driver_id` changed to second driver
    - `testDeclineOrderCancelsIfNoMoreDrivers` — 1 online driver, create order, decline, assert order cancelled by system

    **driverArrived tests:**
    - `testDriverArrivedSetsArrivedStatus` — accept then arrive, assert status `Arrived`, `arrived_at` set
    - `testDriverArrivedThrowsIfNotAccepted` — try arriving on Searching order, expect exception

    **startRide tests:**
    - `testStartRideSetsInProgressStatus` — arrive then start, assert status `InProgress`, `in_progress_at` set
    - `testStartRideThrowsIfNotArrived` — try starting from Accepted, expect exception

    **completeOrder tests:**
    - `testCompleteOrderSetsCompletedStatus` — start ride then complete, assert status `Completed`, `completed_at` set
    - `testCompleteOrderThrowsIfNotInProgress` — try completing from Arrived, expect exception

    **cancelOrder tests:**
    - `testCancelOrderFromSearchingNoPenalty` — cancel by client while Searching, assert `cancellation_fee` is null
    - `testCancelOrderFromAcceptedWithPenalty` — accept then cancel by client, assert `cancellation_fee` is 50
    - `testCancelOrderFromArrivedWithPenalty` — arrive then cancel by client, assert `cancellation_fee` is 50
    - `testCancelOrderThrowsIfCompleted` — complete order, try cancelling, expect exception
    - `testCancelOrderSetsCancelledBy` — cancel by `'driver'`, assert `cancelled_by` is `'driver'`
    - `testCancelOrderFiresEvent` — use `Event::fake()`, cancel, assert `OrderCancelled` dispatched

    **handleOfferTimeout tests:**
    - `testHandleOfferTimeoutDeclinesIfStillOffered` — create order offered to driver, call `handleOfferTimeout`, assert driver added to declined list
    - `testHandleOfferTimeoutNoOpIfAlreadyAccepted` — accept order, call timeout, assert no change

    **Important test setup**: In all tests, mock or fake events to prevent broadcasting errors. Use `Event::fake()` or `Event::fake([SpecificEvent::class])`. Create online drivers using `DriverProfile::factory()->online()->atLocation(...)`.

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: All state transitions MUST use `DB::transaction()` + `lockForUpdate()` to prevent race conditions. The `OfferTimeoutJob` must be dispatched with `->delay(now()->addSeconds(10))`. Events are created as plain classes now — broadcasting is added in 3.4.

:white_check_mark: Done when: Full order lifecycle works (create → offer → accept → arrive → start → complete), cancellation with penalty works, cascade to next driver works, auto-cancel when no drivers works, all tests pass.

---

### 3.4 Broadcasting Setup — Pusher Channels & Event Broadcasting

**Complexity**: medium
**Requires**: 3.3

**Implementation**:

- **Pusher config**: Add to `.env.example` and `.env`:
  ```
  BROADCAST_CONNECTION=pusher
  PUSHER_APP_ID=
  PUSHER_APP_KEY=
  PUSHER_APP_SECRET=
  PUSHER_APP_CLUSTER=ap1
  ```
  Verify `config/broadcasting.php` has Pusher driver configured.

- **Install Pusher**: `composer require pusher/pusher-php-server --no-interaction` (if not already installed).

- **Make events broadcastable**: Update each event to implement `ShouldBroadcast` and define channels:

  **`OrderOfferedToDriver`**:
  ```php
  class OrderOfferedToDriver implements ShouldBroadcast
  {
      use Dispatchable, InteractsWithSockets, SerializesModels;

      public function __construct(
          public readonly Order $order,
          public readonly int $driverUserId,
      ) {}

      public function broadcastOn(): array
      {
          return [
              new PrivateChannel('driver.' . $this->driverUserId),
          ];
      }

      public function broadcastWith(): array
      {
          return [
              'order_id' => $this->order->id,
              'pickup_latitude' => $this->order->pickup_latitude,
              'pickup_longitude' => $this->order->pickup_longitude,
              'pickup_address' => $this->order->pickup_address,
              'price' => $this->order->price,
          ];
      }

      public function broadcastAs(): string
      {
          return 'order.offered';
      }
  }
  ```

  **`OrderAccepted`**:
  ```php
  class OrderAccepted implements ShouldBroadcast
  {
      use Dispatchable, InteractsWithSockets, SerializesModels;

      public function __construct(public readonly Order $order) {}

      public function broadcastOn(): array
      {
          return [
              new PrivateChannel('client.' . $this->order->client_id),
          ];
      }

      public function broadcastWith(): array
      {
          return [
              'order_id' => $this->order->id,
              'driver_id' => $this->order->driver_id,
              'driver_name' => $this->order->driver?->name,
              'car_model' => $this->order->driver?->driverProfile?->car_model,
              'car_number' => $this->order->driver?->driverProfile?->car_number,
          ];
      }

      public function broadcastAs(): string
      {
          return 'order.accepted';
      }
  }
  ```

  **`OrderDriverArrived`**:
  ```php
  class OrderDriverArrived implements ShouldBroadcast
  {
      use Dispatchable, InteractsWithSockets, SerializesModels;

      public function __construct(public readonly Order $order) {}

      public function broadcastOn(): array
      {
          return [new PrivateChannel('client.' . $this->order->client_id)];
      }

      public function broadcastWith(): array
      {
          return ['order_id' => $this->order->id];
      }

      public function broadcastAs(): string
      {
          return 'order.driver_arrived';
      }
  }
  ```

  **`OrderInProgress`**:
  ```php
  class OrderInProgress implements ShouldBroadcast
  {
      use Dispatchable, InteractsWithSockets, SerializesModels;

      public function __construct(public readonly Order $order) {}

      public function broadcastOn(): array
      {
          return [new PrivateChannel('client.' . $this->order->client_id)];
      }

      public function broadcastWith(): array
      {
          return ['order_id' => $this->order->id];
      }

      public function broadcastAs(): string
      {
          return 'order.in_progress';
      }
  }
  ```

  **`OrderCompleted`**:
  ```php
  class OrderCompleted implements ShouldBroadcast
  {
      use Dispatchable, InteractsWithSockets, SerializesModels;

      public function __construct(public readonly Order $order) {}

      public function broadcastOn(): array
      {
          return [
              new PrivateChannel('client.' . $this->order->client_id),
              new PrivateChannel('driver.' . $this->order->driver_id),
          ];
      }

      public function broadcastWith(): array
      {
          return [
              'order_id' => $this->order->id,
              'price' => $this->order->price,
          ];
      }

      public function broadcastAs(): string
      {
          return 'order.completed';
      }
  }
  ```

  **`OrderCancelled`**:
  ```php
  class OrderCancelled implements ShouldBroadcast
  {
      use Dispatchable, InteractsWithSockets, SerializesModels;

      public function __construct(public readonly Order $order) {}

      public function broadcastOn(): array
      {
          $channels = [new PrivateChannel('client.' . $this->order->client_id)];

          if ($this->order->driver_id) {
              $channels[] = new PrivateChannel('driver.' . $this->order->driver_id);
          }

          return $channels;
      }

      public function broadcastWith(): array
      {
          return [
              'order_id' => $this->order->id,
              'cancelled_by' => $this->order->cancelled_by,
              'cancellation_fee' => $this->order->cancellation_fee,
          ];
      }

      public function broadcastAs(): string
      {
          return 'order.cancelled';
      }
  }
  ```

- **Broadcast auth channel**: In `routes/channels.php`:
  ```php
  use App\Models\User;

  Broadcast::channel('client.{userId}', function (User $user, int $userId) {
      return $user->id === $userId;
  });

  Broadcast::channel('driver.{userId}', function (User $user, int $userId) {
      return $user->id === $userId && $user->isDriver();
  });
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Broadcasting/OrderEventsTest.php` — `php artisan make:test --phpunit Broadcasting/OrderEventsTest`
    - `testOrderOfferedBroadcastsToDriverChannel` — use `Event::fake()`, fire event, assert dispatched with correct data. Alternatively, instantiate event and assert `broadcastOn()` returns correct channel.
    - `testOrderAcceptedBroadcastsToClientChannel` — instantiate event, assert channel is `private-client.{id}`
    - `testOrderCompletedBroadcastsToBothChannels` — assert 2 channels (client + driver)
    - `testOrderCancelledBroadcastsToClientOnly` — order with no driver, assert only client channel
    - `testOrderCancelledBroadcastsToDriverIfAssigned` — order with driver, assert both channels
    - `testBroadcastWithDataContainsOrderId` — for each event, assert `broadcastWith()` includes `order_id`
    - `testClientChannelAuthorizesCorrectUser` — test channel auth (user can access their own channel)
    - `testClientChannelRejectsWrongUser` — user cannot access another user's channel
    - `testDriverChannelRequiresDriverRole` — client user cannot access driver channel

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: Use `Event::fake()` in OrderService tests (3.3) to prevent actual broadcasting during tests. For broadcasting tests (3.4), test the event classes directly by instantiating them and checking `broadcastOn()`, `broadcastWith()`, `broadcastAs()`. Do NOT require actual Pusher credentials in tests.

:white_check_mark: Done when: All events implement `ShouldBroadcast`, channels are defined with auth, broadcast data is correct, all tests pass.
