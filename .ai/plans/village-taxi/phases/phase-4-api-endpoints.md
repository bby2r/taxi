---
phase: 4
title: "API Endpoints — Client API, Driver API, EnsureUserRole Middleware"
status: pending
depends_on: [2, 3]
---

# Phase 4: API Endpoints — Client API, Driver API, EnsureUserRole Middleware

Build all REST API endpoints for the mobile app. Clients create/cancel orders and view history. Drivers go online/offline, update location, accept/decline orders, and progress through order states. Protected by Sanctum auth and role-based middleware.

**Pre-flight**: Run `search-docs` for "middleware", "API Resources", "form requests", "route model binding", "JSON responses" before starting.

---

### 4.1 EnsureUserRole Middleware & API Resources

**Complexity**: medium
**Requires**: Phase 2 (Sanctum auth), Phase 1 (UserRole enum)

**Implementation**:

- **Middleware `app/Http/Middleware/EnsureUserRole.php`**: `php artisan make:middleware --no-interaction EnsureUserRole`
  ```php
  class EnsureUserRole
  {
      /**
       * Handle an incoming request.
       *
       * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
       * @param  string  ...$roles  Role values (e.g., 'client', 'driver', 'admin')
       */
      public function handle(Request $request, Closure $next, string ...$roles): Response
      {
          $user = $request->user();

          if (! $user || ! in_array($user->role->value, $roles, true)) {
              return response()->json([
                  'message' => 'Forbidden. Required role: ' . implode(' or ', $roles) . '.',
              ], 403);
          }

          return $next($request);
      }
  }
  ```

- **Register middleware alias**: In `bootstrap/app.php`, inside the `withMiddleware` callback:
  ```php
  ->withMiddleware(function (Middleware $middleware) {
      $middleware->alias([
          'role' => \App\Http\Middleware\EnsureUserRole::class,
      ]);
  })
  ```

- **API Resource `app/Http/Resources/V1/OrderResource.php`**: `php artisan make:resource --no-interaction V1/OrderResource`
  ```php
  class OrderResource extends JsonResource
  {
      public function toArray(Request $request): array
      {
          return [
              'id' => $this->id,
              'status' => $this->status->value,
              'pickup_latitude' => $this->pickup_latitude,
              'pickup_longitude' => $this->pickup_longitude,
              'pickup_address' => $this->pickup_address,
              'dropoff_latitude' => $this->dropoff_latitude,
              'dropoff_longitude' => $this->dropoff_longitude,
              'dropoff_address' => $this->dropoff_address,
              'price' => $this->price,
              'cancellation_fee' => $this->cancellation_fee,
              'cancelled_by' => $this->cancelled_by,
              'client' => [
                  'id' => $this->client->id,
                  'name' => $this->client->name,
                  'phone' => $this->client->phone,
              ],
              'driver' => $this->when($this->driver_id, fn () => [
                  'id' => $this->driver->id,
                  'name' => $this->driver->name,
                  'phone' => $this->driver->phone,
                  'car_model' => $this->driver->driverProfile?->car_model,
                  'car_number' => $this->driver->driverProfile?->car_number,
              ]),
              'accepted_at' => $this->accepted_at?->toISOString(),
              'arrived_at' => $this->arrived_at?->toISOString(),
              'in_progress_at' => $this->in_progress_at?->toISOString(),
              'completed_at' => $this->completed_at?->toISOString(),
              'cancelled_at' => $this->cancelled_at?->toISOString(),
              'created_at' => $this->created_at->toISOString(),
          ];
      }
  }
  ```

- **API Resource `app/Http/Resources/V1/UserResource.php`**: `php artisan make:resource --no-interaction V1/UserResource`
  ```php
  class UserResource extends JsonResource
  {
      public function toArray(Request $request): array
      {
          return [
              'id' => $this->id,
              'name' => $this->name,
              'phone' => $this->phone,
              'role' => $this->role->value,
              'driver_profile' => $this->when($this->isDriver() && $this->relationLoaded('driverProfile'), fn () => [
                  'car_model' => $this->driverProfile->car_model,
                  'car_number' => $this->driverProfile->car_number,
                  'is_online' => $this->driverProfile->is_online,
              ]),
          ];
      }
  }
  ```

- **API Resource `app/Http/Resources/V1/DriverProfileResource.php`**: `php artisan make:resource --no-interaction V1/DriverProfileResource`
  ```php
  class DriverProfileResource extends JsonResource
  {
      public function toArray(Request $request): array
      {
          return [
              'car_model' => $this->car_model,
              'car_number' => $this->car_number,
              'is_online' => $this->is_online,
              'latitude' => $this->latitude,
              'longitude' => $this->longitude,
              'location_updated_at' => $this->location_updated_at?->toISOString(),
          ];
      }
  }
  ```

- **Tests (PHPUnit)**:
  - Feature: `tests/Feature/Http/Middleware/EnsureUserRoleTest.php` — `php artisan make:test --phpunit Http/Middleware/EnsureUserRoleTest`
    - `testClientCanAccessClientRoute` — create client user, authenticate, hit a route with `role:client` middleware, assert 200
    - `testDriverCannotAccessClientRoute` — create driver, authenticate, hit route with `role:client`, assert 403
    - `testDriverCanAccessDriverRoute` — create driver, authenticate, hit route with `role:driver`, assert 200
    - `testAdminCanAccessAdminRoute` — create admin, hit route with `role:admin`, assert 200
    - `testMultipleRolesAllowed` — create route with `role:client,driver`, test both can access
    - `testUnauthenticatedReturns401` — hit route without token (via `auth:sanctum` + `role:client`), assert 401
    - Setup: Define test routes in `setUp()` using `Route::middleware(['auth:sanctum', 'role:client'])->get('/test-role', fn () => response()->json(['ok' => true]))`

  - Unit: `tests/Unit/Http/Resources/OrderResourceTest.php` — `php artisan make:test --phpunit --unit Http/Resources/OrderResourceTest`
    - `testOrderResourceContainsExpectedKeys` — create order with factory, wrap in resource, assert `toArray()` has all expected keys
    - `testOrderResourceHidesDriverWhenNull` — order without driver, assert `driver` key absent
    - `testOrderResourceShowsDriverWhenPresent` — accepted order, assert driver data present with car info

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: The middleware must be registered as an alias (`role`) in `bootstrap/app.php`, NOT in a service provider. Laravel 13 uses the `bootstrap/app.php` middleware configuration. Use `search-docs` for "middleware alias" to verify the registration approach.

:white_check_mark: Done when: EnsureUserRole middleware blocks wrong roles with 403, all API resources format data correctly, all tests pass.

---

### 4.2 Client API & Driver API Controllers

**Complexity**: complex
**Requires**: 4.1, Phase 3 (OrderService, GeoService)

**Implementation**:

- **Form Request `app/Http/Requests/Api/V1/CreateOrderRequest.php`**: `php artisan make:request --no-interaction Api/V1/CreateOrderRequest`
  ```php
  public function authorize(): bool
  {
      return true;
  }

  public function rules(): array
  {
      return [
          'pickup_latitude' => ['required', 'numeric', 'between:-90,90'],
          'pickup_longitude' => ['required', 'numeric', 'between:-180,180'],
          'pickup_address' => ['nullable', 'string', 'max:500'],
          'dropoff_latitude' => ['nullable', 'numeric', 'between:-90,90'],
          'dropoff_longitude' => ['nullable', 'numeric', 'between:-180,180'],
          'dropoff_address' => ['nullable', 'string', 'max:500'],
      ];
  }
  ```

- **Form Request `app/Http/Requests/Api/V1/UpdateLocationRequest.php`**: `php artisan make:request --no-interaction Api/V1/UpdateLocationRequest`
  ```php
  public function authorize(): bool
  {
      return true;
  }

  public function rules(): array
  {
      return [
          'latitude' => ['required', 'numeric', 'between:-90,90'],
          'longitude' => ['required', 'numeric', 'between:-180,180'],
      ];
  }
  ```

- **Controller `app/Http/Controllers/Api/V1/ClientOrderController.php`**: `php artisan make:controller --no-interaction Api/V1/ClientOrderController`
  ```php
  class ClientOrderController extends Controller
  {
      public function __construct(
          private readonly OrderService $orderService,
      ) {}

      /**
       * GET /api/v1/client/orders
       * List client's orders (paginated, newest first).
       */
      public function index(Request $request): AnonymousResourceCollection
      {
          $orders = Order::forClient($request->user()->id)
              ->with(['driver.driverProfile', 'client'])
              ->latest()
              ->paginate(20);

          return OrderResource::collection($orders);
      }

      /**
       * POST /api/v1/client/orders
       * Create a new order.
       */
      public function store(CreateOrderRequest $request): JsonResponse
      {
          try {
              $order = $this->orderService->createOrder(
                  client: $request->user(),
                  pickupLat: $request->validated('pickup_latitude'),
                  pickupLon: $request->validated('pickup_longitude'),
                  pickupAddress: $request->validated('pickup_address'),
                  dropoffLat: $request->validated('dropoff_latitude'),
                  dropoffLon: $request->validated('dropoff_longitude'),
                  dropoffAddress: $request->validated('dropoff_address'),
              );

              $order->load(['client', 'driver.driverProfile']);

              return (new OrderResource($order))
                  ->response()
                  ->setStatusCode(201);
          } catch (\RuntimeException $e) {
              return response()->json(['message' => $e->getMessage()], 422);
          }
      }

      /**
       * GET /api/v1/client/orders/{order}
       * Show a specific order (must belong to client).
       */
      public function show(Request $request, Order $order): OrderResource|JsonResponse
      {
          if ($order->client_id !== $request->user()->id) {
              return response()->json(['message' => 'Forbidden.'], 403);
          }

          $order->load(['client', 'driver.driverProfile']);

          return new OrderResource($order);
      }

      /**
       * POST /api/v1/client/orders/{order}/cancel
       * Cancel an order.
       */
      public function cancel(Request $request, Order $order): OrderResource|JsonResponse
      {
          if ($order->client_id !== $request->user()->id) {
              return response()->json(['message' => 'Forbidden.'], 403);
          }

          try {
              $order = $this->orderService->cancelOrder($order, 'client');
              $order->load(['client', 'driver.driverProfile']);

              return new OrderResource($order);
          } catch (\RuntimeException $e) {
              return response()->json(['message' => $e->getMessage()], 422);
          }
      }

      /**
       * GET /api/v1/client/orders/active
       * Get client's current active order (if any).
       */
      public function active(Request $request): OrderResource|JsonResponse
      {
          $order = Order::forClient($request->user()->id)
              ->active()
              ->with(['client', 'driver.driverProfile'])
              ->first();

          if (! $order) {
              return response()->json(['message' => 'No active order.'], 404);
          }

          return new OrderResource($order);
      }
  }
  ```

- **Controller `app/Http/Controllers/Api/V1/DriverController.php`**: `php artisan make:controller --no-interaction Api/V1/DriverController`
  ```php
  class DriverController extends Controller
  {
      public function __construct(
          private readonly OrderService $orderService,
      ) {}

      /**
       * POST /api/v1/driver/go-online
       * Set driver as online with current location.
       */
      public function goOnline(UpdateLocationRequest $request): JsonResponse
      {
          $profile = $request->user()->driverProfile;

          if (! $profile) {
              return response()->json(['message' => 'Driver profile not found.'], 404);
          }

          $profile->update([
              'is_online' => true,
              'latitude' => $request->validated('latitude'),
              'longitude' => $request->validated('longitude'),
              'location_updated_at' => now(),
          ]);

          return response()->json([
              'message' => 'You are now online.',
              'profile' => new DriverProfileResource($profile),
          ]);
      }

      /**
       * POST /api/v1/driver/go-offline
       * Set driver as offline.
       */
      public function goOffline(Request $request): JsonResponse
      {
          $profile = $request->user()->driverProfile;

          if (! $profile) {
              return response()->json(['message' => 'Driver profile not found.'], 404);
          }

          $profile->update([
              'is_online' => false,
          ]);

          return response()->json([
              'message' => 'You are now offline.',
          ]);
      }

      /**
       * POST /api/v1/driver/location
       * Update driver's current location.
       */
      public function updateLocation(UpdateLocationRequest $request): JsonResponse
      {
          $profile = $request->user()->driverProfile;

          if (! $profile) {
              return response()->json(['message' => 'Driver profile not found.'], 404);
          }

          $profile->update([
              'latitude' => $request->validated('latitude'),
              'longitude' => $request->validated('longitude'),
              'location_updated_at' => now(),
          ]);

          return response()->json(['message' => 'Location updated.']);
      }

      /**
       * POST /api/v1/driver/orders/{order}/accept
       * Accept an offered order.
       */
      public function acceptOrder(Request $request, Order $order): OrderResource|JsonResponse
      {
          try {
              $order = $this->orderService->acceptOrder($order, $request->user());
              $order->load(['client', 'driver.driverProfile']);

              return new OrderResource($order);
          } catch (\RuntimeException $e) {
              return response()->json(['message' => $e->getMessage()], 422);
          }
      }

      /**
       * POST /api/v1/driver/orders/{order}/decline
       * Decline an offered order.
       */
      public function declineOrder(Request $request, Order $order): JsonResponse
      {
          $this->orderService->declineOrder($order, $request->user());

          return response()->json(['message' => 'Order declined.']);
      }

      /**
       * POST /api/v1/driver/orders/{order}/arrived
       * Signal arrival at pickup.
       */
      public function arrived(Request $request, Order $order): OrderResource|JsonResponse
      {
          try {
              $order = $this->orderService->driverArrived($order, $request->user());
              $order->load(['client', 'driver.driverProfile']);

              return new OrderResource($order);
          } catch (\RuntimeException $e) {
              return response()->json(['message' => $e->getMessage()], 422);
          }
      }

      /**
       * POST /api/v1/driver/orders/{order}/start
       * Start the ride.
       */
      public function startRide(Request $request, Order $order): OrderResource|JsonResponse
      {
          try {
              $order = $this->orderService->startRide($order, $request->user());
              $order->load(['client', 'driver.driverProfile']);

              return new OrderResource($order);
          } catch (\RuntimeException $e) {
              return response()->json(['message' => $e->getMessage()], 422);
          }
      }

      /**
       * POST /api/v1/driver/orders/{order}/complete
       * Complete the ride.
       */
      public function completeOrder(Request $request, Order $order): OrderResource|JsonResponse
      {
          try {
              $order = $this->orderService->completeOrder($order, $request->user());
              $order->load(['client', 'driver.driverProfile']);

              return new OrderResource($order);
          } catch (\RuntimeException $e) {
              return response()->json(['message' => $e->getMessage()], 422);
          }
      }

      /**
       * GET /api/v1/driver/orders
       * List driver's orders (paginated, newest first).
       */
      public function orders(Request $request): AnonymousResourceCollection
      {
          $orders = Order::forDriver($request->user()->id)
              ->with(['client', 'driver.driverProfile'])
              ->latest()
              ->paginate(20);

          return OrderResource::collection($orders);
      }

      /**
       * GET /api/v1/driver/orders/active
       * Get driver's current active order (if any).
       */
      public function activeOrder(Request $request): OrderResource|JsonResponse
      {
          $order = Order::forDriver($request->user()->id)
              ->active()
              ->with(['client', 'driver.driverProfile'])
              ->first();

          if (! $order) {
              return response()->json(['message' => 'No active order.'], 404);
          }

          return new OrderResource($order);
      }

      /**
       * GET /api/v1/driver/profile
       * Get current driver's profile.
       */
      public function profile(Request $request): JsonResponse
      {
          $user = $request->user()->load('driverProfile');

          return response()->json([
              'user' => new UserResource($user),
          ]);
      }
  }
  ```

- **Routes** in `routes/api.php` (add to the v1 prefix group):
  ```php
  use App\Http\Controllers\Api\V1\ClientOrderController;
  use App\Http\Controllers\Api\V1\DriverController;

  Route::prefix('v1')->middleware('auth:sanctum')->group(function () {

      // Client routes
      Route::prefix('client')->middleware('role:client')->group(function () {
          Route::get('/orders/active', [ClientOrderController::class, 'active'])
              ->name('api.v1.client.orders.active');
          Route::get('/orders', [ClientOrderController::class, 'index'])
              ->name('api.v1.client.orders.index');
          Route::post('/orders', [ClientOrderController::class, 'store'])
              ->name('api.v1.client.orders.store');
          Route::get('/orders/{order}', [ClientOrderController::class, 'show'])
              ->name('api.v1.client.orders.show');
          Route::post('/orders/{order}/cancel', [ClientOrderController::class, 'cancel'])
              ->name('api.v1.client.orders.cancel');
      });

      // Driver routes
      Route::prefix('driver')->middleware('role:driver')->group(function () {
          Route::post('/go-online', [DriverController::class, 'goOnline'])
              ->name('api.v1.driver.go-online');
          Route::post('/go-offline', [DriverController::class, 'goOffline'])
              ->name('api.v1.driver.go-offline');
          Route::post('/location', [DriverController::class, 'updateLocation'])
              ->name('api.v1.driver.location');
          Route::get('/profile', [DriverController::class, 'profile'])
              ->name('api.v1.driver.profile');
          Route::get('/orders/active', [DriverController::class, 'activeOrder'])
              ->name('api.v1.driver.orders.active');
          Route::get('/orders', [DriverController::class, 'orders'])
              ->name('api.v1.driver.orders.index');
          Route::post('/orders/{order}/accept', [DriverController::class, 'acceptOrder'])
              ->name('api.v1.driver.orders.accept');
          Route::post('/orders/{order}/decline', [DriverController::class, 'declineOrder'])
              ->name('api.v1.driver.orders.decline');
          Route::post('/orders/{order}/arrived', [DriverController::class, 'arrived'])
              ->name('api.v1.driver.orders.arrived');
          Route::post('/orders/{order}/start', [DriverController::class, 'startRide'])
              ->name('api.v1.driver.orders.start');
          Route::post('/orders/{order}/complete', [DriverController::class, 'completeOrder'])
              ->name('api.v1.driver.orders.complete');
      });
  });
  ```

  **IMPORTANT**: The `/orders/active` route must be defined BEFORE `/orders/{order}` to avoid route model binding conflict.

- **Tests (PHPUnit)**:

  **Client tests**: `tests/Feature/Http/Api/V1/ClientOrderControllerTest.php` — `php artisan make:test --phpunit Http/Api/V1/ClientOrderControllerTest`

  Setup helper: In `setUp()`, create a client user with Sanctum token using `$this->client = User::factory()->create()` and `$this->token = $this->client->createToken('test')->plainTextToken`. Use `$this->withHeaders(['Authorization' => 'Bearer ' . $this->token])` or `Sanctum::actingAs($this->client)`.

  - `testCreateOrderReturns201` — POST `/api/v1/client/orders` with valid pickup coords, assert 201, assert response has order data with `status: 'searching'`
  - `testCreateOrderValidatesPickupLatitude` — omit `pickup_latitude`, assert 422
  - `testCreateOrderValidatesPickupLongitude` — send invalid longitude (999), assert 422
  - `testCreateOrderReturnsPriceInResponse` — assert response includes `price` field (80 or 120)
  - `testCreateOrderRejects422WhenActiveOrderExists` — create active order, try creating another, assert 422
  - `testListOrdersReturnsPaginated` — create 25 orders, GET `/api/v1/client/orders`, assert paginated (20 per page), assert JSON structure
  - `testListOrdersOnlyShowsOwnOrders` — create orders for 2 different clients, assert each sees only their own
  - `testShowOrderReturnsOrder` — create order, GET `/api/v1/client/orders/{id}`, assert 200
  - `testShowOrderForbidsOtherClient` — client A's order, client B tries to view, assert 403
  - `testCancelOrderFromSearching` — create order, POST cancel, assert status `cancelled`, assert `cancellation_fee` null
  - `testCancelOrderFromAcceptedHasPenalty` — create accepted order, cancel, assert `cancellation_fee` is 50
  - `testCancelOrderRejectsCompletedOrder` — try cancelling completed order, assert 422
  - `testActiveOrderReturnsCurrentOrder` — create active order, GET `/api/v1/client/orders/active`, assert 200
  - `testActiveOrderReturns404WhenNone` — no active order, assert 404
  - `testDriverCannotAccessClientRoutes` — create driver, authenticate, GET `/api/v1/client/orders`, assert 403

  **Driver tests**: `tests/Feature/Http/Api/V1/DriverControllerTest.php` — `php artisan make:test --phpunit Http/Api/V1/DriverControllerTest`

  Setup: Create driver user + DriverProfile. Use `Sanctum::actingAs($driver)`.

  - `testGoOnlineSetsDriverOnline` — POST `/api/v1/driver/go-online` with coords, assert 200, assert profile `is_online` is true in DB
  - `testGoOnlineRequiresLatitude` — omit latitude, assert 422
  - `testGoOfflineSetsDriverOffline` — go online first, then POST `/api/v1/driver/go-offline`, assert `is_online` false
  - `testUpdateLocationUpdatesCoords` — POST `/api/v1/driver/location` with new coords, assert DB updated
  - `testAcceptOrderReturnsOrder` — create order offered to this driver, POST accept, assert 200, assert status `accepted`
  - `testAcceptOrderRejectsWrongDriver` — order offered to driver A, driver B tries accepting, assert 422
  - `testDeclineOrderReturnsSuccess` — decline offered order, assert 200
  - `testDeclineOrderTriggersNextOffer` — 2 online drivers, create order (offered to nearest), first declines, assert order now offered to second
  - `testArrivedUpdatesStatus` — accept order, POST arrived, assert status `arrived`
  - `testStartRideUpdatesStatus` — arrive, POST start, assert status `in_progress`
  - `testCompleteOrderUpdatesStatus` — start ride, POST complete, assert status `completed`
  - `testFullOrderLifecycle` — create → accept → arrive → start → complete, verify each status transition and timestamps
  - `testDriverOrdersListOnlyShowsOwnOrders` — create orders for 2 drivers, assert each sees only their own
  - `testActiveOrderReturnsCurrentOrder` — accept an order, GET `/api/v1/driver/orders/active`, assert 200
  - `testActiveOrderReturns404WhenNone` — no active order, assert 404
  - `testProfileReturnsDriverInfo` — GET `/api/v1/driver/profile`, assert response has user + car info
  - `testClientCannotAccessDriverRoutes` — create client, authenticate, POST `/api/v1/driver/go-online`, assert 403
  - `testGoOnlineReturns404WithoutProfile` — driver user without DriverProfile, assert 404

  **Important**: In all order-related tests, use `Event::fake()` to prevent broadcasting. Create online drivers near pickup using `DriverProfile::factory()->atLocation(42.87, 74.59)->create()`.

- **Browser Test**: N/A

> Run `vendor/bin/pint --dirty --format agent` after changes.

:warning: Warning: Route order matters — `/orders/active` must come before `/orders/{order}` otherwise `active` will be interpreted as a route model binding parameter. All routes use named routes for `route()` generation. Use `Sanctum::actingAs()` in tests instead of manually creating tokens (cleaner).

:white_check_mark: Done when: All client endpoints work (create, list, show, cancel, active), all driver endpoints work (online/offline, location, accept/decline/arrive/start/complete, orders list, active, profile), role middleware blocks unauthorized access, all tests pass. Run `php artisan route:list --path=api` to verify all routes registered correctly.
