# Phase 1 Summary: Foundation — Setting & Region Models

**Completed**: 2026-04-08
**Commit**: `01f9d7c`

## What was built

### Setting model (sub-task 1.1)
- Migration: `settings` table (id, key unique, value, description nullable, timestamps)
- Model: `#[Fillable]`, `getValue()` static helper, `scopeForKey()`
- Factory: key=slug, value=randomNumber, description=sentence
- Seeder: 4 keys (day_price=80, night_price=120, cancellation_fee=50, max_search_radius_km=10) via updateOrCreate
- DatabaseSeeder updated to call SettingSeeder

### Region model (sub-task 1.2)
- Migration: `regions` table (id, name unique, day_price unsignedInt, night_price unsignedInt, is_active bool default true, sort_order unsignedInt default 0, timestamps, index on is_active)
- Model: `#[Fillable]`, casts (is_active→boolean, prices→integer), `scopeActive()`, `getCurrentPrice(?Carbon)` with Asia/Bishkek timezone
- Factory: `inactive()` and `withPrices(int, int)` states

## Tests
- `tests/Feature/Models/SettingModelTest.php` — 8 tests
- `tests/Feature/Models/RegionModelTest.php` — 11 tests
- **19 tests, 27 assertions, all passing**

## Key decisions
- `getCurrentPrice()` uses hour boundaries: 7-20 = day, else night (Asia/Bishkek)
- Prices stored as unsignedInteger (matching orders table convention)
- Setting values stored as strings; callers cast as needed
