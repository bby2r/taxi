# Phase 3 Summary: Backend API — Settings Integration, Max Radius & Regional Orders

**Completed**: 2026-04-09
**Commit**: `d73cdf2`

## What was built

### 3.1: TariffService refactor
- Removed hardcoded price constants, reads from `Setting::getValue()` with fallbacks (80, 120, 50)
- Kept time boundary constants (DAY_START_HOUR=7, NIGHT_START_HOUR=21)
- Request-lifecycle caching via `??=` on nullable properties

### 3.2: Max radius in GeoService
- Added `?float $maxRadiusKm = null` parameter to `findNearestDrivers()`
- Reads `max_search_radius_km` from settings when null (default 10km)
- Filters drivers beyond radius before sorting/limiting

### 3.3: Region API endpoints
- `RegionResource` — returns id, name, price (time-dependent)
- `RegionController::index()` — active regions ordered by sort_order
- `RegionController::currentPrice()` — in-village tariff via TariffService
- Routes: GET `/api/v1/client/regions`, GET `/api/v1/client/price`

### 3.4: Regional order support
- Migration: region_id nullable FK on orders table
- Order model: region_id fillable, region() BelongsTo
- OrderResource: conditional region block (id + name)
- OrderFactory: `regional()` state
- OrderService: regionId param → region pricing, 30s timeout for regional orders
- CreateRegionalOrderRequest: validates region_id exists + is active
- ClientOrderController: `storeRegional()` method, region eager loading on all methods
- Route: POST `/api/v1/client/orders/regional`

## Tests
- TariffServiceTest (feature) — 5 tests
- GeoServiceTest — 5 new tests (13 total)
- RegionControllerTest — 7 tests
- ClientRegionalOrderTest — 8 tests
- OrderResourceTest — 2 new tests
- **38 new tests, 99 assertions, all passing**
