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
- Admin: `SettingController` with `index()` + `update()`, validates integer/numeric min:0
- Routes: GET/PUT `admin/settings` named `admin.settings.index` / `admin.settings.update`

## Region model
- Inter-village destinations with day/night pricing
- `getCurrentPrice(?Carbon $at)`: hour 7-20 = day_price, else night_price (Asia/Bishkek timezone)
- `scopeActive()` filters by is_active=true
- Factory states: `inactive()`, `withPrices(int $day, int $night)`
- Admin: `RegionController` full CRUD (except show), resource route
- Validates: name unique (self-exclusion on update), prices integer min:0, is_active boolean

## Admin panel patterns
- Controllers in `App\Http\Controllers\Admin\`
- Views extend `layouts.admin`, use consistent TailwindCSS classes
- Flash messages: `->with('success', ...)`, green bg-green-50 in views
- Tables: `rounded-xl border border-gray-200 bg-white shadow-sm` wrapper
- Forms: `mx-auto max-w-2xl` wrapper, amber-themed buttons
- Nav sidebar order: Dashboard, Drivers, Clients, Regions, Orders, Tickets, Settings
- Badge pattern: green `bg-green-100 text-green-700` / gray `bg-gray-100 text-gray-600`

## Testing conventions
- PHPUnit v12 only (no Pest)
- Create with `php artisan make:test --phpunit {path} --no-interaction`
- Use `fake()` helper, model factories with states
- Admin tests: setUp creates `$admin` via `User::factory()->admin()->create()`
- Test auth: `actingAs($this->admin)` for admin routes

## Code style
- Run `vendor/bin/pint --dirty --format agent` after PHP changes
- Use `fake()` not `$this->faker`
- PHP 8 constructor promotion, explicit return types

## What's next
- Phase 3: Backend API (TariffService refactor, max radius, region endpoints, regional orders)
- Phase 4: Mobile (regions API, RegionSelector popup, HomeScreen updates)
