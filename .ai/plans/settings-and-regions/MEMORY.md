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
- Seeder uses `updateOrCreate` keyed on `'key'` for idempotency

## Region model
- Inter-village destinations with day/night pricing
- `getCurrentPrice(?Carbon $at)`: hour 7-20 = day_price, else night_price (Asia/Bishkek timezone)
- `scopeActive()` filters by is_active=true
- Factory states: `inactive()`, `withPrices(int $day, int $night)`

## Testing conventions
- PHPUnit v12 only (no Pest)
- Create with `php artisan make:test --phpunit Models/XTest --no-interaction`
- Use `fake()` helper, model factories with states
- Feature tests in `tests/Feature/Models/`

## Code style
- Run `vendor/bin/pint --dirty --format agent` after PHP changes
- Use `fake()` not `$this->faker`
- PHP 8 constructor promotion, explicit return types

## What's next
- Phase 2: Admin panel (drivers is_online, clients page, settings page, regions CRUD)
- Phase 3: Backend API (TariffService refactor, max radius, region endpoints, regional orders)
- Phase 4: Mobile (regions API, RegionSelector popup, HomeScreen updates)
