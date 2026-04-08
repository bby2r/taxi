# Plan Memory — Settings, Regions & Admin Improvements

## Model conventions
- `#[Fillable([...])]` attribute (not `$fillable` property)
- `/** @use HasFactory<XFactory> */` PHPDoc generic on trait
- `casts()` method returning array (not `$casts` property)
- Scopes: typed `Builder<Model>` in PHPDoc, return `Builder`
- Prices: `unsignedInteger` in migrations, cast to `integer` in model

## Setting model
- Key-value store: `Setting::getValue('key', $default)` returns `?string`
- 4 seeded keys: day_price (80), night_price (120), cancellation_fee (50), max_search_radius_km (10)
- TariffService reads from settings with fallback defaults, caches per instance

## Region model
- Inter-village destinations with day/night pricing
- `getCurrentPrice(?Carbon $at)`: hour 7-20 = day_price, else night_price (Asia/Bishkek)
- `scopeActive()` filters is_active=true
- Factory states: `inactive()`, `withPrices(int, int)`

## API endpoints (Phase 3)
- GET `/api/v1/client/regions` — active regions with time-dependent prices
- GET `/api/v1/client/price` — current in-village tariff
- POST `/api/v1/client/orders/regional` — create regional order (region_id required, must be active)
- Regional orders: price from Region::getCurrentPrice(), 30s driver timeout (vs 10s in-village)
- Order model has region_id FK, region() BelongsTo, OrderResource includes conditional region block

## Admin panel (Phase 2)
- Sidebar: Dashboard, Drivers, Clients, Regions, Orders, Tickets, Settings
- SettingController: GET/PUT admin/settings
- RegionController: full CRUD (except show)
- ClientController: read-only index

## Testing conventions
- PHPUnit v12 only, `fake()` helper, factories with states
- Admin tests: setUp creates admin via `User::factory()->admin()->create()`
- API tests: `Sanctum::actingAs()`, `Event::fake()`, `Queue::fake()`
- 1 pre-existing failure in MakeAdminCommandTest (unrelated)

## Code style
- Run `vendor/bin/pint --dirty --format agent` after PHP changes
- PHP 8 constructor promotion, explicit return types

## What's next
- Phase 4: Mobile (regions API integration, RegionSelector popup, HomeScreen updates)
