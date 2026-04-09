---
phase: 3
title: "Backend API — Settings Integration, Max Radius & Regional Orders"
status: pending
depends_on: [1, 2]
sub_tasks: 4
---

# Phase 3: Backend API — Settings Integration, Max Radius & Regional Orders

Refactor TariffService and GeoService to read from DB settings, add region listing endpoint, and implement regional order creation.

**Pre-flight**: Run `search-docs` for "eloquent caching", "form request validation", "API resources", "database migrations foreign keys" before starting.

---

### 3.1 Refactor TariffService to Use DB Settings

**Complexity**: medium
**Requires**: Phase 1 (Setting model with `getValue()`)

**Implementation**:

- **Modify `app/Services/TariffService.php`**:
  - Remove hardcoded `DAY_PRICE`, `NIGHT_PRICE`, `CANCELLATION_FEE` constants
  - Keep `DAY_START_HOUR = 7` and `NIGHT_START_HOUR = 21` as constants (time boundaries are not configurable)
  - Add private nullable properties for request-lifecycle caching: `?int $cachedDayPrice`, `?int $cachedNightPrice`, `?int $cachedCancellationFee`
  - Read values from `Setting::getValue()` with fallback defaults matching current values (80, 120, 50)
  - Cache in properties so repeated calls within one request do not re-query

  ```php
  class TariffService
  {
      private const int DAY_START_HOUR = 7;

      private const int NIGHT_START_HOUR = 21;

      private ?int $cachedDayPrice = null;

      private ?int $cachedNightPrice = null;

      private ?int $cachedCancellationFee = null;

      /**
       * Get current price based on time of day in Asia/Bishkek timezone.
       * Day: 07:00-20:59. Night: 21:00-06:59.
       */
      public function getCurrentPrice(?Carbon $at = null): int
      {
          $time = ($at ?? now())->timezone('Asia/Bishkek');
          $hour = $time->hour;

          return ($hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR)
              ? $this->getDayPrice()
              : $this->getNightPrice();
      }

      public function isDayTime(?Carbon $at = null): bool
      {
          $time = ($at ?? now())->timezone('Asia/Bishkek');
          $hour = $time->hour;

          return $hour >= self::DAY_START_HOUR && $hour < self::NIGHT_START_HOUR;
      }

      public function getCancellationFee(): int
      {
          return $this->cachedCancellationFee ??= (int) Setting::getValue('cancellation_fee', 50);
      }

      public function getDayPrice(): int
      {
          return $this->cachedDayPrice ??= (int) Setting::getValue('day_price', 80);
      }

      public function getNightPrice(): int
      {
          return $this->cachedNightPrice ??= (int) Setting::getValue('night_price', 120);
      }
  }
  ```

- **Update existing tests**: `tests/Unit/Services/TariffServiceTest.php`
  - This test currently does `new TariffService` directly. Since `Setting::getValue()` is a static call on an Eloquent model, the unit test now needs `RefreshDatabase` to work with the DB.
  - Convert to a Feature test at `tests/Feature/Services/TariffServiceTest.php` (or add `RefreshDatabase` to the existing unit test — follow existing convention; the GeoService tests use Feature for DB-dependent tests).
  - Seed settings in `setUp()` for explicit control, or rely on fallback defaults for the "no settings in DB" scenario.
  - Adjust `setUp()`: resolve service from container instead of `new TariffService` since it now depends on the Setting model.

- **New/updated tests** in `tests/Feature/Services/TariffServiceTest.php`:
  - `testGetCurrentPriceReadsDayPriceFromSettings` — seed `Setting::create(['key' => 'day_price', 'value' => '100'])`, freeze time at 10:00, assert price is 100
  - `testGetCurrentPriceReadsNightPriceFromSettings` — seed `Setting::create(['key' => 'night_price', 'value' => '150'])`, freeze time at 22:00, assert price is 150
  - `testGetCancellationFeeReadsFromSettings` — seed `Setting::create(['key' => 'cancellation_fee', 'value' => '75'])`, assert `getCancellationFee()` returns 75
  - `testFallbackDefaultsWhenNoSettingsExist` — no settings seeded, assert day=80, night=120, fee=50
  - `testSettingsAreCachedWithinSameInstance` — seed day_price=100, call `getDayPrice()` twice, assert same result (verify with query count if desired)
  - Keep all existing boundary tests (they still pass using fallback defaults since no settings are seeded)

- **Update `tests/Feature/Services/OrderServiceTest.php`**: The cancellation fee assertions (`assertSame(50, ...)`) still pass via fallback defaults. No changes needed unless we want explicit setting seeds — leave as-is for now since defaults match.

- **Update `tests/Feature/Http/Api/V1/ClientOrderControllerTest.php`**: Same — cancellation fee test (`assertJsonPath('data.cancellation_fee', 50)`) still passes via defaults.

**Artifacts**:
| File | Action |
|---|---|
| `app/Services/TariffService.php` | Modify — remove price constants, add Setting reads with caching |
| `tests/Feature/Services/TariffServiceTest.php` | Create — DB-dependent tariff tests |
| `tests/Unit/Services/TariffServiceTest.php` | Keep — existing boundary tests still pass with defaults |

> Run `vendor/bin/pint --dirty --format agent` after changes.

**Done when**: TariffService reads prices from Setting model, falls back to defaults, caches within request, all existing + new tests pass.

---

### 3.2 Add Max Radius Filter to GeoService

**Complexity**: simple
**Requires**: Phase 1 (Setting model)

**Implementation**:

- **Modify `app/Services/GeoService.php`** — update `findNearestDrivers()` signature and logic:
  - Add optional `?float $maxRadiusKm = null` parameter after `$limit`
  - Read `max_search_radius_km` from `Setting::getValue('max_search_radius_km', 10)` if `$maxRadiusKm` is null
  - After mapping distances, filter out drivers where `distance_km > $maxRadiusKm` before sorting and taking limit

  ```php
  public function findNearestDrivers(
      float $pickupLat,
      float $pickupLon,
      array $excludeIds = [],
      int $limit = 10,
      ?float $maxRadiusKm = null,
  ): Collection {
      $maxRadiusKm ??= (float) Setting::getValue('max_search_radius_km', 10);

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
      })
          ->filter(fn (DriverProfile $profile) => $profile->distance_km <= $maxRadiusKm)
          ->sortBy('distance_km')
          ->take($limit)
          ->values();
  }
  ```

- **New tests** in `tests/Feature/Services/GeoServiceTest.php` — add to existing file:
  - `testFindNearestDriversExcludesDriversBeyondDefaultRadius` — create driver at ~15 km away (use coordinates ~0.135 degrees offset from pickup), no settings seeded (default 10 km), assert empty result
  - `testFindNearestDriversIncludesDriversWithinDefaultRadius` — create driver at ~5 km away (~0.045 degrees offset), no settings seeded, assert driver is returned
  - `testFindNearestDriversReadsRadiusFromSettings` — seed `Setting::create(['key' => 'max_search_radius_km', 'value' => '20'])`, create driver at ~15 km, assert driver IS returned (within 20 km setting)
  - `testFindNearestDriversOverrideRadiusParameter` — create driver at ~15 km, pass `maxRadiusKm: 20`, assert driver is returned despite default being 10
  - `testFindNearestDriversOverrideRadiusIgnoresSettingValue` — seed setting to 5, pass `maxRadiusKm: 20`, create driver at ~15 km, assert driver is returned (override takes precedence)

- **Update existing tests**: Existing `GeoServiceTest` tests create drivers using `atLocation()` factory with small offsets (0.001 degrees ~ 0.1 km), well within 10 km default. All existing tests continue to pass without changes.

**Artifacts**:
| File | Action |
|---|---|
| `app/Services/GeoService.php` | Modify — add max radius filtering |
| `tests/Feature/Services/GeoServiceTest.php` | Modify — add radius filter tests |

> Run `vendor/bin/pint --dirty --format agent` after changes.

**Done when**: Drivers beyond max radius are excluded, default 10 km works, override parameter works, setting override works, all tests pass.

---

### 3.3 Region API Endpoints

**Complexity**: simple
**Requires**: Phase 1 (Region model with `scopeActive()`, `getCurrentPrice()`)

**Implementation**:

- **Create `RegionResource`**: `php artisan make:resource --no-interaction V1/RegionResource`
  - File: `app/Http/Resources/V1/RegionResource.php`

  ```php
  namespace App\Http\Resources\V1;

  use Illuminate\Http\Request;
  use Illuminate\Http\Resources\Json\JsonResource;

  class RegionResource extends JsonResource
  {
      /**
       * Transform the resource into an array.
       *
       * @return array<string, mixed>
       */
      public function toArray(Request $request): array
      {
          return [
              'id' => $this->id,
              'name' => $this->name,
              'price' => $this->getCurrentPrice(),
          ];
      }
  }
  ```

- **Create `RegionController`**: `php artisan make:controller --no-interaction Api/V1/RegionController`
  - File: `app/Http/Controllers/Api/V1/RegionController.php`

  ```php
  namespace App\Http\Controllers\Api\V1;

  use App\Http\Controllers\Controller;
  use App\Http\Resources\V1\RegionResource;
  use App\Models\Region;
  use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

  class RegionController extends Controller
  {
      /**
       * List active regions with current prices.
       */
      public function index(): AnonymousResourceCollection
      {
          $regions = Region::active()
              ->orderBy('sort_order')
              ->orderBy('name')
              ->get();

          return RegionResource::collection($regions);
      }

      /**
       * Get the current in-village tariff price.
       */
      public function currentPrice(TariffService $tariffService): JsonResponse
      {
          return response()->json([
              'price' => $tariffService->getCurrentPrice(),
          ]);
      }
  }
  ```

- **Register routes** in `routes/api.php`:
  - Add inside the `v1/client` middleware group:
    ```php
    Route::get('/regions', [RegionController::class, 'index'])->name('api.v1.client.regions');
    Route::get('/price', [RegionController::class, 'currentPrice'])->name('api.v1.client.price');
    ```
  - Add `use App\Http\Controllers\Api\V1\RegionController;` import at top.

- **Tests**: `tests/Feature/Http/Api/V1/RegionControllerTest.php` — `php artisan make:test --phpunit Http/Api/V1/RegionControllerTest`

  ```php
  class RegionControllerTest extends TestCase
  {
      use RefreshDatabase;

      private User $client;

      protected function setUp(): void
      {
          parent::setUp();

          $this->client = User::factory()->create(['role' => UserRole::Client]);
          Sanctum::actingAs($this->client);
      }
  ```

  - `testListRegionsReturnsActiveOnly` — create 2 active + 1 inactive regions, GET `/api/v1/client/regions`, assert count 2
  - `testListRegionsReturnsDayPriceDuringDay` — freeze time at 10:00, create region with day_price=90, night_price=140, GET endpoint, assert `data.0.price` is 90
  - `testListRegionsReturnsNightPriceDuringNight` — freeze time at 22:00, create region with day_price=90, night_price=140, assert `data.0.price` is 140
  - `testListRegionsOrderedBySortOrder` — create regions with sort_order 3, 1, 2, assert response order matches sort_order 1, 2, 3
  - `testListRegionsResponseStructure` — assert each item has `id`, `name`, `price` keys
  - `testListRegionsRequiresAuthentication` — unauthenticated request returns 401 (create separate test method that does NOT use `Sanctum::actingAs`)
  - `testDriverCannotAccessClientRegions` — authenticate as driver, assert 403

**Artifacts**:
| File | Action |
|---|---|
| `app/Http/Resources/V1/RegionResource.php` | Create |
| `app/Http/Controllers/Api/V1/RegionController.php` | Create |
| `routes/api.php` | Modify — add region route |
| `tests/Feature/Http/Api/V1/RegionControllerTest.php` | Create |

> Run `vendor/bin/pint --dirty --format agent` after changes.

**Done when**: GET `/api/v1/client/regions` returns active regions with time-dependent prices, all tests pass.

---

### 3.4 Regional Order Support

**Complexity**: complex
**Requires**: 3.1, 3.2, 3.3, Phase 1 (Region model)

**Implementation**:

#### Migration

- **Create migration**: `php artisan make:migration --no-interaction add_region_id_to_orders_table --table=orders`
  ```php
  public function up(): void
  {
      Schema::table('orders', function (Blueprint $table) {
          $table->foreignId('region_id')->nullable()->after('price')->constrained()->nullOnDelete();
      });
  }

  public function down(): void
  {
      Schema::table('orders', function (Blueprint $table) {
          $table->dropForeign(['region_id']);
          $table->dropColumn('region_id');
      });
  }
  ```

#### Model Updates

- **Modify `app/Models/Order.php`**:
  - Add `region_id` to the `#[Fillable]` attribute array
  - Add `region()` BelongsTo relationship:
    ```php
    /**
     * @return BelongsTo<Region, $this>
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
    ```

- **Modify `app/Http/Resources/V1/OrderResource.php`**:
  - Add region data when present:
    ```php
    'region' => $this->when($this->region_id, fn () => [
        'id' => $this->region->id,
        'name' => $this->region->name,
    ]),
    ```

- **Modify `database/factories/OrderFactory.php`**:
  - Add `region_id => null` to `definition()` array
  - Add `regional()` factory state:
    ```php
    /**
     * Indicate that the order is a regional order.
     */
    public function regional(?Region $region = null): static
    {
        return $this->state(fn (array $attributes) => [
            'region_id' => $region?->id ?? Region::factory(),
        ]);
    }
    ```

#### OrderService Changes

- **Modify `app/Services/OrderService.php`** — update `createOrder()` method:
  - Add optional `?int $regionId = null` parameter (no timeout parameter — timeout is derived from order):
    ```php
    public function createOrder(
        User $client,
        float $pickupLat,
        float $pickupLon,
        ?string $pickupAddress = null,
        ?float $dropoffLat = null,
        ?float $dropoffLon = null,
        ?string $dropoffAddress = null,
        ?int $regionId = null,
    ): Order
    ```
  - When `$regionId` is provided, get price from `Region::findOrFail($regionId)->getCurrentPrice()` instead of `$this->tariffService->getCurrentPrice()`
  - Include `region_id` in the `Order::create()` array
  - Existing callers (ClientOrderController::store) are unaffected since `$regionId` has a default

- **Modify `offerToNextDriver()`** — derive timeout from order:
  - Read timeout directly from the order: `$timeout = $order->region_id ? 30 : 10;`
  - Use: `OfferTimeoutJob::dispatch($order->id, $driver->user_id)->delay(now()->addSeconds($timeout));`
  - This approach means ALL call sites (including `declineOrder` → `offerToNextDriver`) automatically get the correct timeout without parameter threading

#### FormRequest

- **Create `CreateRegionalOrderRequest`**: `php artisan make:request --no-interaction Api/V1/CreateRegionalOrderRequest`
  - File: `app/Http/Requests/Api/V1/CreateRegionalOrderRequest.php`

  ```php
  namespace App\Http\Requests\Api\V1;

  use Illuminate\Foundation\Http\FormRequest;

  class CreateRegionalOrderRequest extends FormRequest
  {
      public function authorize(): bool
      {
          return true;
      }

      /**
       * @return array<string, array<mixed>>
       */
      public function rules(): array
      {
          return [
              'pickup_latitude' => ['required', 'numeric', 'between:-90,90'],
              'pickup_longitude' => ['required', 'numeric', 'between:-180,180'],
              'pickup_address' => ['nullable', 'string', 'max:500'],
              'region_id' => ['required', 'integer', 'exists:regions,id'],
          ];
      }
  }
  ```

  - Note: Additional validation that the region is active should be done via a custom rule or in the controller. Use a closure rule:
    ```php
    'region_id' => [
        'required',
        'integer',
        'exists:regions,id',
        function (string $attribute, mixed $value, \Closure $fail) {
            $region = \App\Models\Region::find($value);
            if ($region && ! $region->is_active) {
                $fail('The selected region is not active.');
            }
        },
    ],
    ```

#### Controller

- **Modify `app/Http/Controllers/Api/V1/ClientOrderController.php`**:
  - Add `storeRegional()` method:

  ```php
  use App\Http\Requests\Api\V1\CreateRegionalOrderRequest;

  /**
   * Create a new regional order for the authenticated client.
   */
  public function storeRegional(CreateRegionalOrderRequest $request): JsonResponse
  {
      try {
          $order = $this->orderService->createOrder(
              client: $request->user(),
              pickupLat: (float) $request->validated('pickup_latitude'),
              pickupLon: (float) $request->validated('pickup_longitude'),
              pickupAddress: $request->validated('pickup_address'),
              regionId: (int) $request->validated('region_id'),
          );

          $order->load(['client', 'driver.driverProfile', 'region']);

          return (new OrderResource($order))
              ->response()
              ->setStatusCode(201);
      } catch (\RuntimeException $e) {
          return response()->json(['message' => $e->getMessage()], 422);
      }
  }
  ```

#### Route

- **Modify `routes/api.php`**:
  - Add inside the `v1/client` middleware group, before the existing order routes:
    ```php
    Route::post('/orders/regional', [ClientOrderController::class, 'storeRegional'])
        ->name('api.v1.client.orders.store-regional');
    ```
  - Place BEFORE `/orders/{order}` routes to avoid route parameter conflict.

#### Eager Loading Update

- **Modify `ClientOrderController`** — update `index()`, `show()`, `active()` methods:
  - Add `'region'` to the `with()` calls: `->with(['client', 'driver.driverProfile', 'region'])`

#### Tests

- **Create `tests/Feature/Http/Api/V1/ClientRegionalOrderTest.php`**: `php artisan make:test --phpunit Http/Api/V1/ClientRegionalOrderTest`

  ```php
  class ClientRegionalOrderTest extends TestCase
  {
      use RefreshDatabase;

      private User $client;
      private float $pickupLat = 42.8746;
      private float $pickupLon = 74.5698;

      protected function setUp(): void
      {
          parent::setUp();

          Event::fake();
          Queue::fake();

          $this->client = User::factory()->create(['role' => UserRole::Client]);
          Sanctum::actingAs($this->client);
      }
  ```

  - `testCreateRegionalOrderReturns201` — create active region, create nearby driver, POST `/api/v1/client/orders/regional` with pickup coords + region_id, assert 201
  - `testRegionalOrderPriceComesFromRegion` — create region with day_price=90, freeze time at 10:00, create nearby driver, POST, assert `data.price` is 90
  - `testRegionalOrderPriceUsesNightPriceAtNight` — create region with night_price=150, freeze time at 22:00, POST, assert `data.price` is 150
  - `testRegionalOrderIncludesRegionInResponse` — POST, assert `data.region.id` and `data.region.name` present
  - `testRegionalOrderRejectsInactiveRegion` — create inactive region, POST with that region_id, assert 422 with validation error on region_id
  - `testRegionalOrderRejectsNonExistentRegion` — POST with region_id=99999, assert 422
  - `testRegionalOrderRequiresRegionId` — POST without region_id, assert 422 validation error
  - `testRegionalOrderRequiresPickupCoordinates` — POST without pickup_latitude, assert 422
  - `testRegionalOrderCancelsIfNoDrivers` — create active region, no nearby drivers, POST, assert order created with `cancelled` status
  - `testRegionalOrderUsesLongerTimeoutForDriverOffer` — create active region + nearby driver, POST, assert `OfferTimeoutJob` dispatched with 30-second delay (use `Queue::fake()` and `Queue::assertPushed()` with delay assertion)

- **Modify `tests/Feature/Services/OrderServiceTest.php`** — add regional order tests:
  - `testCreateRegionalOrderUsesPriceFromRegion` — create region with day_price=90, freeze time at 10:00, call `createOrder()` with regionId, assert price is 90
  - `testCreateRegionalOrderSetsRegionId` — create order with regionId, assert `$order->region_id` is set
  - `testRegionalOrderUsesLongerOfferTimeout` — verify OfferTimeoutJob dispatched with 30s delay for regional order

- **Modify `tests/Unit/Http/Resources/OrderResourceTest.php`** — add:
  - `testOrderResourceIncludesRegionWhenPresent` — create order with region_id, assert resource output contains `region` key with `id` and `name`
  - `testOrderResourceExcludesRegionWhenNull` — order without region_id, assert `region` key absent

**Artifacts**:
| File | Action |
|---|---|
| `database/migrations/xxxx_add_region_id_to_orders_table.php` | Create (via artisan) |
| `app/Models/Order.php` | Modify — add region_id fillable, region() relation |
| `app/Http/Resources/V1/OrderResource.php` | Modify — add region data |
| `database/factories/OrderFactory.php` | Modify — add region_id default, regional() state |
| `app/Services/OrderService.php` | Modify — regionId param, region pricing, 30s timeout |
| `app/Http/Requests/Api/V1/CreateRegionalOrderRequest.php` | Create |
| `app/Http/Controllers/Api/V1/ClientOrderController.php` | Modify — add storeRegional(), update eager loading |
| `routes/api.php` | Modify — add regional order route |
| `tests/Feature/Http/Api/V1/ClientRegionalOrderTest.php` | Create |
| `tests/Feature/Services/OrderServiceTest.php` | Modify — add regional tests |
| `tests/Unit/Http/Resources/OrderResourceTest.php` | Modify — add region tests |

> Run `vendor/bin/pint --dirty --format agent` after changes.

**Done when**: Regional orders use region pricing, 30s timeout, region appears in response, inactive regions rejected, all tests pass.

---

## Full Artifact Summary

| File | Sub-task | Action |
|---|---|---|
| `app/Services/TariffService.php` | 3.1 | Modify |
| `tests/Feature/Services/TariffServiceTest.php` | 3.1 | Create |
| `app/Services/GeoService.php` | 3.2 | Modify |
| `tests/Feature/Services/GeoServiceTest.php` | 3.2 | Modify |
| `app/Http/Resources/V1/RegionResource.php` | 3.3 | Create |
| `app/Http/Controllers/Api/V1/RegionController.php` | 3.3 | Create |
| `routes/api.php` | 3.3, 3.4 | Modify |
| `tests/Feature/Http/Api/V1/RegionControllerTest.php` | 3.3 | Create |
| `database/migrations/xxxx_add_region_id_to_orders_table.php` | 3.4 | Create |
| `app/Models/Order.php` | 3.4 | Modify |
| `app/Http/Resources/V1/OrderResource.php` | 3.4 | Modify |
| `database/factories/OrderFactory.php` | 3.4 | Modify |
| `app/Services/OrderService.php` | 3.4 | Modify |
| `app/Http/Requests/Api/V1/CreateRegionalOrderRequest.php` | 3.4 | Create |
| `app/Http/Controllers/Api/V1/ClientOrderController.php` | 3.4 | Modify |
| `tests/Feature/Http/Api/V1/ClientRegionalOrderTest.php` | 3.4 | Create |
| `tests/Feature/Services/OrderServiceTest.php` | 3.4 | Modify |
| `tests/Unit/Http/Resources/OrderResourceTest.php` | 3.4 | Modify |

## Test Spec Summary

| Test File | Test Count | Sub-task |
|---|---|---|
| `tests/Feature/Services/TariffServiceTest.php` | 5 | 3.1 |
| `tests/Feature/Services/GeoServiceTest.php` | +5 | 3.2 |
| `tests/Feature/Http/Api/V1/RegionControllerTest.php` | 7 | 3.3 |
| `tests/Feature/Http/Api/V1/ClientRegionalOrderTest.php` | 10 | 3.4 |
| `tests/Feature/Services/OrderServiceTest.php` | +3 | 3.4 |
| `tests/Unit/Http/Resources/OrderResourceTest.php` | +2 | 3.4 |
| **Total new tests** | **32** | |
