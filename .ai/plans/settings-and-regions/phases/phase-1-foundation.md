---
phase: 1
title: "Foundation — Setting & Region Models"
status: pending
depends_on: []
sub_tasks: 2
---

# Phase 1: Foundation — Setting & Region Models

## Sub-task 1.1: Setting Model + Migration + Seeder

### Goal

Create a key-value `settings` table to replace hardcoded constants in `TariffService` (day_price, night_price, cancellation_fee) and store new configuration like `max_search_radius_km`. The model provides a static `getValue()` helper for easy retrieval throughout the app.

### Implementation

#### 1. Migration

Run: `php artisan make:migration create_settings_table --no-interaction`

Schema (`settings` table):

```php
Schema::create('settings', function (Blueprint $table) {
    $table->id();
    $table->string('key')->unique();
    $table->string('value');
    $table->string('description')->nullable();
    $table->timestamps();
});
```

#### 2. Model

Run: `php artisan make:model Setting --no-interaction`

File: `app/Models/Setting.php`

Follow existing conventions from `Order.php` and `DriverProfile.php`:

- Use `#[Fillable(['key', 'value', 'description'])]` attribute (not `$fillable` property)
- Use `/** @use HasFactory<SettingFactory> */` PHPDoc generic on the trait
- `casts()` method: no special casts needed (all strings)
- Static helper:

```php
/**
 * Get a setting value by key, with optional default.
 */
public static function getValue(string $key, mixed $default = null): ?string
{
    return static::where('key', $key)->value('value') ?? $default;
}
```

- Scope:

```php
/**
 * Scope to a specific setting key.
 *
 * @param  Builder<Setting>  $query
 * @return Builder<Setting>
 */
public function scopeForKey(Builder $query, string $key): Builder
{
    return $query->where('key', $key);
}
```

#### 3. Factory

Run: `php artisan make:factory SettingFactory --no-interaction`

File: `database/factories/SettingFactory.php`

```php
/** @extends Factory<Setting> */
class SettingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'key' => fake()->unique()->slug(2),
            'value' => (string) fake()->randomNumber(3),
            'description' => fake()->sentence(),
        ];
    }
}
```

Use `fake()` helper (not `$this->faker`) to match existing factory conventions in this project.

#### 4. Seeder

Run: `php artisan make:seeder SettingSeeder --no-interaction`

File: `database/seeders/SettingSeeder.php`

Use `updateOrCreate` keyed on `'key'` so the seeder is idempotent:

```php
public function run(): void
{
    $settings = [
        ['key' => 'day_price', 'value' => '80', 'description' => 'Day tariff (7:00-21:00) in som'],
        ['key' => 'night_price', 'value' => '120', 'description' => 'Night tariff (21:00-7:00) in som'],
        ['key' => 'cancellation_fee', 'value' => '50', 'description' => 'Cancellation fee in som'],
        ['key' => 'max_search_radius_km', 'value' => '10', 'description' => 'Maximum driver search radius in kilometers'],
    ];

    foreach ($settings as $setting) {
        Setting::updateOrCreate(
            ['key' => $setting['key']],
            ['value' => $setting['value'], 'description' => $setting['description']],
        );
    }
}
```

#### 5. Register in DatabaseSeeder

Add `$this->call(SettingSeeder::class);` inside `DatabaseSeeder::run()`.

#### 6. Run Pint

`vendor/bin/pint --dirty --format agent`

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| Migration | `database/migrations/YYYY_MM_DD_HHMMSS_create_settings_table.php` | Create |
| Model | `app/Models/Setting.php` | Create |
| Factory | `database/factories/SettingFactory.php` | Create |
| Seeder | `database/seeders/SettingSeeder.php` | Create |
| DatabaseSeeder | `database/seeders/DatabaseSeeder.php` | Modify (add `$this->call`) |

### Test Spec

Create test: `php artisan make:test --phpunit Models/SettingModelTest`

File: `tests/Feature/Models/SettingModelTest.php`

| Test Method | Description | Type |
|-------------|-------------|------|
| `test_setting_can_be_created_with_factory` | Create a Setting via factory, assert it exists in DB | Feature |
| `test_key_is_unique` | Create two settings with same key, assert DB exception | Feature |
| `test_get_value_returns_value_for_existing_key` | Seed a setting, call `Setting::getValue('key')`, assert correct value | Feature |
| `test_get_value_returns_default_for_missing_key` | Call `Setting::getValue('missing', 'fallback')`, assert returns `'fallback'` | Feature |
| `test_get_value_returns_null_for_missing_key_without_default` | Call `Setting::getValue('missing')`, assert returns `null` | Feature |
| `test_for_key_scope` | Create multiple settings, use `Setting::forKey('x')`, assert returns only the matching one | Feature |
| `test_setting_seeder_creates_expected_keys` | Run `SettingSeeder`, assert all 4 keys exist with correct values | Feature |
| `test_setting_seeder_is_idempotent` | Run `SettingSeeder` twice, assert count is still 4 | Feature |

---

## Sub-task 1.2: Region Model + Migration + Factory

### Goal

Create a `regions` table to store nearby village/town destinations with fixed day/night pricing. Each region has a `getCurrentPrice()` method that uses the same Asia/Bishkek timezone logic as `TariffService`.

### Implementation

#### 1. Migration

Run: `php artisan make:migration create_regions_table --no-interaction`

Schema (`regions` table):

```php
Schema::create('regions', function (Blueprint $table) {
    $table->id();
    $table->string('name')->unique();
    $table->unsignedInteger('day_price');
    $table->unsignedInteger('night_price');
    $table->boolean('is_active')->default(true);
    $table->unsignedInteger('sort_order')->default(0);
    $table->timestamps();

    $table->index('is_active');
});
```

Use `unsignedInteger` for prices (matching the `price` and `cancellation_fee` columns in `orders` table).

#### 2. Model

Run: `php artisan make:model Region --no-interaction`

File: `app/Models/Region.php`

Follow existing conventions:

- `#[Fillable(['name', 'day_price', 'night_price', 'is_active', 'sort_order'])]`
- `/** @use HasFactory<RegionFactory> */` PHPDoc generic

```php
protected function casts(): array
{
    return [
        'is_active' => 'boolean',
        'day_price' => 'integer',
        'night_price' => 'integer',
        'sort_order' => 'integer',
    ];
}
```

- Active scope:

```php
/**
 * Scope to only active regions.
 *
 * @param  Builder<Region>  $query
 * @return Builder<Region>
 */
public function scopeActive(Builder $query): Builder
{
    return $query->where('is_active', true);
}
```

- Price method (mirrors `TariffService::getCurrentPrice` logic):

```php
/**
 * Get the current price based on time of day in Asia/Bishkek timezone.
 * Day: 07:00-20:59. Night: 21:00-06:59.
 */
public function getCurrentPrice(?Carbon $at = null): int
{
    $time = ($at ?? now())->timezone('Asia/Bishkek');
    $hour = $time->hour;

    return ($hour >= 7 && $hour < 21)
        ? $this->day_price
        : $this->night_price;
}
```

#### 3. Factory

Run: `php artisan make:factory RegionFactory --no-interaction`

File: `database/factories/RegionFactory.php`

```php
/** @extends Factory<Region> */
class RegionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->city(),
            'day_price' => fake()->numberBetween(200, 500),
            'night_price' => fake()->numberBetween(300, 700),
            'is_active' => true,
            'sort_order' => 0,
        ];
    }

    /**
     * Indicate the region is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Set specific day and night prices.
     */
    public function withPrices(int $day, int $night): static
    {
        return $this->state(fn (array $attributes) => [
            'day_price' => $day,
            'night_price' => $night,
        ]);
    }
}
```

#### 4. Run Pint

`vendor/bin/pint --dirty --format agent`

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| Migration | `database/migrations/YYYY_MM_DD_HHMMSS_create_regions_table.php` | Create |
| Model | `app/Models/Region.php` | Create |
| Factory | `database/factories/RegionFactory.php` | Create |

### Test Spec

Create test: `php artisan make:test --phpunit Models/RegionModelTest`

File: `tests/Feature/Models/RegionModelTest.php`

| Test Method | Description | Type |
|-------------|-------------|------|
| `test_region_can_be_created_with_factory` | Create a Region via factory, assert it exists in DB with expected attributes | Feature |
| `test_active_scope_excludes_inactive_regions` | Create 2 active + 1 inactive region, assert `Region::active()->count()` is 2 | Feature |
| `test_active_scope_includes_all_active_regions` | Create 3 active regions, assert `Region::active()->count()` is 3 | Feature |
| `test_get_current_price_returns_day_price_during_day` | Create region with `withPrices(300, 500)`, call `getCurrentPrice()` with time at 12:00 Asia/Bishkek, assert 300 | Feature |
| `test_get_current_price_returns_night_price_during_night` | Same region, call `getCurrentPrice()` with time at 22:00 Asia/Bishkek, assert 500 | Feature |
| `test_get_current_price_at_boundary_7am_is_day` | Assert `getCurrentPrice()` at exactly 07:00 Asia/Bishkek returns day_price | Feature |
| `test_get_current_price_at_boundary_9pm_is_night` | Assert `getCurrentPrice()` at exactly 21:00 Asia/Bishkek returns night_price | Feature |
| `test_get_current_price_at_boundary_659am_is_night` | Assert `getCurrentPrice()` at 06:59 Asia/Bishkek returns night_price | Feature |
| `test_inactive_factory_state` | Create region with `->inactive()`, assert `is_active` is false | Feature |
| `test_with_prices_factory_state` | Create region with `->withPrices(250, 400)`, assert day_price=250 and night_price=400 | Feature |
| `test_casts_are_correct_types` | Create a region, assert `is_active` is bool, `day_price` is int, `night_price` is int | Feature |

---

## Execution Order

1. Implement sub-task 1.1 (Setting model, migration, factory, seeder)
2. Run migration: `php artisan migrate`
3. Run tests for 1.1: `php artisan test --compact tests/Feature/Models/SettingModelTest.php`
4. Implement sub-task 1.2 (Region model, migration, factory)
5. Run migration: `php artisan migrate`
6. Run tests for 1.2: `php artisan test --compact tests/Feature/Models/RegionModelTest.php`
7. Run full test suite: `php artisan test --compact`
8. Commit: `git commit -m "feat: add Setting and Region models with migrations and tests"`
