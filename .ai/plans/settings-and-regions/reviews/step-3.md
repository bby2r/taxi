---
step: "3"
verdict: PASS
date: 2026-04-09
---

# Step 3 Review: Backend API

## Checklist

### 3.1: TariffService refactor
- [x] Hardcoded price constants removed
- [x] Reads from `Setting::getValue()` with correct fallbacks (day=80, night=120, cancellation=50)
- [x] `DAY_START_HOUR=7` and `NIGHT_START_HOUR=21` kept as typed constants (`private const int`)
- [x] Request-lifecycle caching via `??=` on nullable properties (`$cachedDayPrice`, `$cachedNightPrice`, `$cachedCancellationFee`)
- [x] `getCurrentPrice()`, `isDayTime()`, `getDayPrice()`, `getNightPrice()`, `getCancellationFee()` all present with correct return types

### 3.2: Max radius in GeoService
- [x] `findNearestDrivers()` has `?float $maxRadiusKm = null` parameter
- [x] Reads from `Setting::getValue('max_search_radius_km', 10)` when null
- [x] Filters drivers beyond radius via `->filter()` after distance calculation
- [x] Explicit `$maxRadiusKm` parameter overrides setting value

### 3.3: Region API endpoints
- [x] `RegionResource` returns `id`, `name`, `price` (via `getCurrentPrice()`)
- [x] `RegionController::index()` returns active regions ordered by `sort_order` then `name`
- [x] `RegionController::currentPrice()` returns TariffService price as JSON
- [x] Route `GET /api/v1/client/regions` registered with name `api.v1.client.regions`
- [x] Route `GET /api/v1/client/price` registered with name `api.v1.client.price`
- [x] Routes protected by `auth:sanctum` and `role:client` middleware

### 3.4: Regional order support
- [x] Migration adds `region_id` as nullable FK on `orders` table with `nullOnDelete`
- [x] `Order` model: `region_id` in `#[Fillable]`, `region()` BelongsTo relation with PHPDoc
- [x] `OrderResource`: conditional `region` block using `$this->when($this->region_id, ...)`
- [x] `OrderFactory`: `regional()` state accepting optional `Region`
- [x] `OrderService::createOrder()`: `?int $regionId = null` parameter, region pricing via `Region::findOrFail()->getCurrentPrice()`, fallback to TariffService
- [x] `OrderService::offerToNextDriver()`: 30s timeout for regional orders, 10s for standard
- [x] `CreateRegionalOrderRequest`: validates `region_id` required + exists + is_active custom rule
- [x] `ClientOrderController::storeRegional()`: creates regional order, eager loads `region`
- [x] Route `POST /api/v1/client/orders/regional` registered with name `api.v1.client.orders.store-regional`
- [x] All existing eager loading updated to include `region` (index, show, cancel, active)

## Test Results

- `TariffServiceTest` (4 tests) -- PASS
- `GeoServiceTest` (12 tests) -- PASS
- `RegionControllerTest` (6 tests) -- PASS
- `ClientRegionalOrderTest` (7 tests) -- PASS
- `OrderResourceTest` (5 tests) -- PASS (unit)
- `ClientOrderControllerTest` (existing, 18 tests) -- PASS
- `OrderServiceTest` (existing, 24 tests) -- PASS

Total: 80 tests, 173 assertions, 0 failures.

## Issues

None

## Notes

- The implementation cleanly separates concerns: TariffService for global pricing, Region model for regional pricing, and OrderService orchestrates the choice based on `regionId` presence.
- The `??=` caching pattern in TariffService is appropriate for request-scoped instances (Laravel creates a new service per request by default since TariffService is not registered as a singleton).
- The `CreateRegionalOrderRequest` uses a closure-based custom rule to check `is_active`, which correctly prevents orders against deactivated regions even if the region record exists.
- Region eager loading was added to all relevant ClientOrderController methods, not just `storeRegional`, ensuring consistency.
