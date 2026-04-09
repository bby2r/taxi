---
phase: 2
title: "Admin Panel — Drivers Status, Clients, Settings & Regions"
status: pending
depends_on: [1]
sub_tasks: 4
---

# Phase 2: Admin Panel Updates

## 2.1: Add is_online Status Column to Drivers List

### Implementation

Modify `resources/views/admin/drivers/index.blade.php` to add a "Status" column between "Plate" and "Joined". No controller changes needed — `driverProfile` is already eager-loaded.

The badge uses the same rounded-pill pattern found elsewhere in the admin views. Access the value via `$driver->driverProfile?->is_online`.

### Artifacts

**Modified: `resources/views/admin/drivers/index.blade.php`**

Add header after "Plate":
```blade
<th class="px-6 py-3">Status</th>
```

Add cell after the plate `<td>`:
```blade
<td class="whitespace-nowrap px-6 py-4">
    @if ($driver->driverProfile?->is_online)
        <span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Online</span>
    @else
        <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Offline</span>
    @endif
</td>
```

Update the empty-state `colspan` from `6` to `7`.

### Test Spec

**File: `tests/Feature/Admin/DriverManagementTest.php`** (add to existing file)

- `test_driver_index_shows_online_status_badge` — Create a driver with `is_online = true` on their profile. GET `admin.drivers.index`. Assert response contains `Online`. Create a second driver with `is_online = false`. Assert response contains `Offline`.

---

## 2.2: Clients Page

### Implementation

Create `Admin\ClientController` with a single `index()` method. Query `User::clients()` with `withCount('clientOrders')` and `latest()->paginate(15)`. Register a GET route at `admin/clients` named `admin.clients.index`. Add a "Clients" nav link to the sidebar in `layouts/admin.blade.php`.

### Artifacts

**New: `app/Http/Controllers/Admin/ClientController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\View\View;

class ClientController extends Controller
{
    /**
     * Display a listing of clients.
     */
    public function index(): View
    {
        $clients = User::clients()
            ->withCount('clientOrders')
            ->latest()
            ->paginate(15);

        return view('admin.clients.index', compact('clients'));
    }
}
```

**New: `resources/views/admin/clients/index.blade.php`**

Follows the exact same structure as `admin/drivers/index.blade.php` and `admin/orders/index.blade.php`:
- `@extends('layouts.admin')`, `@section('title', 'Clients')`, `@section('heading', 'Clients')`
- Header row: `<p class="text-sm text-gray-600">Total: {{ $clients->total() }} clients</p>` (no "Add" button)
- Table inside `rounded-xl border border-gray-200 bg-white shadow-sm` wrapper with `overflow-x-auto`
- Table classes: `w-full text-left text-sm`
- Thead: `border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500`
- Columns: **Name** (`font-medium text-gray-900`), **Phone** (`text-gray-700`), **Total Orders** (`text-gray-700`, display `$client->client_orders_count`), **Joined** (`text-gray-500`, format `M d, Y`)
- Empty state: `No clients found.` with `colspan="4"`
- Pagination: `{{ $clients->links() }}`

**Modified: `resources/views/layouts/admin.blade.php`**

Add nav link after the Drivers link, before Orders. Use `request()->routeIs('admin.clients.*')` for active state. Icon: Heroicon `users` (outline) — distinct from the `user-group` icon used for Drivers.

```blade
<a
    href="{{ route('admin.clients.index') }}"
    class="{{ request()->routeIs('admin.clients.*') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700' }} flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
>
    {{-- Heroicon: user (outline) --}}
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
    Clients
</a>
```

**Modified: `routes/web.php`**

Add inside the admin auth middleware group, after drivers resource:
```php
use App\Http\Controllers\Admin\ClientController;

Route::get('clients', [ClientController::class, 'index'])->name('clients.index');
```

### Test Spec

**New: `tests/Feature/Admin/ClientManagementTest.php`**

Use `RefreshDatabase`. Create `$admin` in `setUp()` via `User::factory()->admin()->create()`.

- `test_client_index_page_loads_successfully` — GET `admin.clients.index` as admin. Assert 200. Assert see `Clients`.
- `test_client_index_shows_client_data` — Create 3 client users. Create some orders for one client. GET index. Assert each client name is visible. Assert the order count is displayed.
- `test_client_index_does_not_show_drivers` — Create a driver user. GET index. Assert the driver name is NOT visible on the page.
- `test_non_admin_cannot_access_client_index` — Acting as a client user, GET `admin.clients.index`. Assert redirect (403/302).
- `test_guest_cannot_access_client_index` — GET without auth. Assert redirect to `admin.login`.

---

## 2.3: Settings Page

### Implementation

Create `Admin\SettingController` with `index()` and `update(Request)` methods. The `index()` loads all settings from the `settings` table (created in Phase 1) keyed by `key`, and passes them to the view. The `update()` validates and saves each setting.

Phase 1 creates the `Setting` model with columns: `id`, `key` (unique string), `value` (string), `description` (nullable string), `timestamps`. The model has a static helper `Setting::getValue(string $key, mixed $default = null): mixed`.

### Artifacts

**New: `app/Http/Controllers/Admin/SettingController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SettingController extends Controller
{
    /**
     * Display the settings form with current values.
     */
    public function index(): View
    {
        $settings = Setting::all()->keyBy('key');

        return view('admin.settings.index', compact('settings'));
    }

    /**
     * Update all settings.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'day_price' => 'required|integer|min:0',
            'night_price' => 'required|integer|min:0',
            'cancellation_fee' => 'required|integer|min:0',
            'max_search_radius_km' => 'required|numeric|min:0',
        ]);

        foreach ($validated as $key => $value) {
            Setting::where('key', $key)->update(['value' => (string) $value]);
        }

        return redirect()->route('admin.settings.index')
            ->with('success', 'Settings updated successfully.');
    }
}
```

**New: `resources/views/admin/settings/index.blade.php`**

Structure:
- `@extends('layouts.admin')`, title/heading: `Settings`
- Flash messages (same pattern as drivers index — green `bg-green-50` for success)
- Form wrapper: `<div class="mx-auto max-w-2xl">` with `rounded-xl border border-gray-200 bg-white p-6 shadow-sm` (same as drivers/create)
- `<form method="POST" action="{{ route('admin.settings.update') }}">` with `@csrf` and `@method('PUT')`
- Each setting field follows the exact same pattern as drivers/create inputs:
  - `<div class="mb-5">` wrapper
  - `<label>` with `mb-1.5 block text-sm font-medium text-gray-700`
  - `<input type="number">` with `w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400`
  - `<p class="mt-1 text-xs text-gray-500">` for description (pulled from `$settings['key']->description ?? ''`)
  - `@error` block with `mt-1 text-sm text-red-600`
  - Input value: `old('day_price', $settings['day_price']->value ?? '')`

Fields:
1. **Day Price (KGS)** — `name="day_price"`, `step="1"`, description from DB
2. **Night Price (KGS)** — `name="night_price"`, `step="1"`, description from DB
3. **Cancellation Fee (KGS)** — `name="cancellation_fee"`, `step="1"`, description from DB
4. **Max Search Radius (km)** — `name="max_search_radius_km"`, `step="0.1"`, description from DB

Submit button: `Save Settings` with same amber style as drivers create. No cancel link needed.

**Modified: `resources/views/layouts/admin.blade.php`**

Add "Settings" link at the bottom of the nav (after Tickets), before closing `</nav>`. Use `request()->routeIs('admin.settings.*')` for active state. Icon: Heroicon `cog-6-tooth` (outline).

```blade
<a
    href="{{ route('admin.settings.index') }}"
    class="{{ request()->routeIs('admin.settings.*') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700' }} flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
>
    {{-- Heroicon: cog-6-tooth (outline) --}}
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
    Settings
</a>
```

**Modified: `routes/web.php`**

Add inside the admin auth middleware group:
```php
use App\Http\Controllers\Admin\SettingController;

Route::get('settings', [SettingController::class, 'index'])->name('settings.index');
Route::put('settings', [SettingController::class, 'update'])->name('settings.update');
```

### Test Spec

**New: `tests/Feature/Admin/SettingManagementTest.php`**

Use `RefreshDatabase`. Create `$admin` in `setUp()`. Seed settings in setUp via `Setting::create(...)` for each of the 4 keys with known values.

- `test_settings_page_loads_with_current_values` — GET `admin.settings.index` as admin. Assert 200. Assert see each setting's current value in the response.
- `test_admin_can_update_settings` — PUT `admin.settings.update` with valid data (`day_price => 200, night_price => 300, cancellation_fee => 50, max_search_radius_km => 15.5`). Assert redirect to `admin.settings.index`. Assert session has `success`. Assert database has updated values for each setting.
- `test_settings_update_validates_required_fields` — PUT with empty payload. Assert session has errors for all 4 fields.
- `test_settings_update_validates_numeric_types` — PUT with `day_price => 'abc'`. Assert session has errors for `day_price`.
- `test_settings_update_validates_min_zero` — PUT with `day_price => -10`. Assert session has errors.
- `test_max_search_radius_accepts_decimal` — PUT with `max_search_radius_km => 7.5` and other valid integers. Assert redirect (no validation error). Assert DB value is `7.5`.
- `test_non_admin_cannot_access_settings` — Acting as client. GET settings index. Assert redirect.
- `test_guest_cannot_access_settings` — GET without auth. Assert redirect.

---

## 2.4: Regions Management Page

### Implementation

Create `Admin\RegionController` with full resource methods: `index`, `create`, `store`, `edit`, `update`, `destroy`. Phase 1 creates the `Region` model with columns: `id`, `name` (string, unique), `day_price` (integer), `night_price` (integer), `is_active` (boolean, default true), `sort_order` (integer, default 0), `timestamps`.

### Artifacts

**New: `app/Http/Controllers/Admin/RegionController.php`**

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Region;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class RegionController extends Controller
{
    /**
     * Display a listing of regions.
     */
    public function index(): View
    {
        $regions = Region::orderBy('sort_order')
            ->orderBy('name')
            ->paginate(15);

        return view('admin.regions.index', compact('regions'));
    }

    /**
     * Show the form for creating a new region.
     */
    public function create(): View
    {
        return view('admin.regions.create');
    }

    /**
     * Store a newly created region.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:regions',
            'day_price' => 'required|integer|min:0',
            'night_price' => 'required|integer|min:0',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        $validated['is_active'] = $request->boolean('is_active');

        Region::create($validated);

        return redirect()->route('admin.regions.index')
            ->with('success', 'Region created successfully.');
    }

    /**
     * Show the form for editing the specified region.
     */
    public function edit(Region $region): View
    {
        return view('admin.regions.edit', compact('region'));
    }

    /**
     * Update the specified region.
     */
    public function update(Request $request, Region $region): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:regions,name,' . $region->id,
            'day_price' => 'required|integer|min:0',
            'night_price' => 'required|integer|min:0',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        $validated['is_active'] = $request->boolean('is_active');

        $region->update($validated);

        return redirect()->route('admin.regions.index')
            ->with('success', 'Region updated successfully.');
    }

    /**
     * Remove the specified region.
     */
    public function destroy(Region $region): RedirectResponse
    {
        $region->delete();

        return redirect()->route('admin.regions.index')
            ->with('success', 'Region deleted successfully.');
    }
}
```

**New: `resources/views/admin/regions/index.blade.php`**

Same structure as `admin/drivers/index.blade.php`:
- `@extends('layouts.admin')`, title/heading: `Regions`
- Header: total count + "Add Region" button (amber, with plus icon) linking to `admin.regions.create`
- Flash messages (success green, error red — same pattern)
- Table columns: **Name** (`font-medium text-gray-900`), **Day Price** (`text-gray-700`, display `{{ number_format($region->day_price) }} KGS`), **Night Price** (`text-gray-700`, same format), **Status** (badge — green `Active` or gray `Inactive`, same badge style as driver online/offline), **Sort Order** (`text-gray-500`), **Actions** (Edit link + Delete form, exact same markup as drivers index)
- Empty state: `No regions found.` with `colspan="6"`
- Pagination

**New: `resources/views/admin/regions/create.blade.php`**

Same form structure as `admin/drivers/create.blade.php`:
- `@extends('layouts.admin')`, title/heading: `Add Region`
- `mx-auto max-w-2xl` > `rounded-xl border border-gray-200 bg-white p-6 shadow-sm`
- POST to `admin.regions.store`
- Fields (each in `mb-5` div with label, input, @error):
  1. **Name** — `type="text"`, `name="name"`, `value="{{ old('name') }}"`
  2. **Day Price (KGS)** — `type="number"`, `name="day_price"`, `step="1"`, `min="0"`, `value="{{ old('day_price') }}"`
  3. **Night Price (KGS)** — `type="number"`, `name="night_price"`, `step="1"`, `min="0"`, `value="{{ old('night_price') }}"`
  4. **Sort Order** — `type="number"`, `name="sort_order"`, `step="1"`, `min="0"`, `value="{{ old('sort_order', 0) }}"`
  5. **Active** — checkbox: `<label class="flex items-center gap-2">` with `<input type="checkbox" name="is_active" value="1" {{ old('is_active', true) ? 'checked' : '' }} class="rounded border-gray-300 text-amber-500 focus:ring-amber-400">` and `<span class="text-sm text-gray-700">Region is active</span>`
- Actions: "Create Region" submit button + "Cancel" link to `admin.regions.index`

**New: `resources/views/admin/regions/edit.blade.php`**

Same as create but:
- Title/heading: `Edit Region`
- PUT to `admin.regions.update` with `@method('PUT')`
- Input values use `old('name', $region->name)` etc.
- Checkbox: `old('is_active', $region->is_active) ? 'checked' : ''`
- Submit button text: `Update Region`

**Modified: `resources/views/layouts/admin.blade.php`**

Add "Regions" link after Clients, before Orders. Use `request()->routeIs('admin.regions.*')` for active state. Icon: Heroicon `map` (outline).

```blade
<a
    href="{{ route('admin.regions.index') }}"
    class="{{ request()->routeIs('admin.regions.*') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700' }} flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
>
    {{-- Heroicon: map (outline) --}}
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    </svg>
    Regions
</a>
```

**Modified: `routes/web.php`**

Add inside the admin auth middleware group:
```php
use App\Http\Controllers\Admin\RegionController;

Route::resource('regions', RegionController::class);
```

### Test Spec

**New: `tests/Feature/Admin/RegionManagementTest.php`**

Use `RefreshDatabase`. Create `$admin` in `setUp()`.

**Index tests:**
- `test_region_index_page_loads` — GET `admin.regions.index` as admin. Assert 200.
- `test_region_index_shows_regions` — Create 3 regions via factory. GET index. Assert each region name is visible.
- `test_region_index_shows_active_inactive_badges` — Create one active region, one inactive. GET index. Assert response contains `Active` and `Inactive`.

**Create tests:**
- `test_region_create_page_loads` — GET `admin.regions.create`. Assert 200. Assert see `Add Region`.
- `test_admin_can_create_region` — POST to `admin.regions.store` with valid data (`name => 'Bishkek', day_price => 150, night_price => 200, is_active => 1, sort_order => 1`). Assert redirect to index. Assert DB has the region.
- `test_create_region_validates_required_fields` — POST with empty payload. Assert session errors for `name`, `day_price`, `night_price`.
- `test_create_region_validates_unique_name` — Create region with name `Osh`. POST another with same name. Assert session error on `name`.

**Edit/Update tests:**
- `test_region_edit_page_loads_with_data` — Create region. GET edit route. Assert 200. Assert see region name.
- `test_admin_can_update_region` — Create region. PUT with new data. Assert redirect. Assert DB has updated values.
- `test_update_region_allows_same_name_for_same_record` — Create region `Bishkek`. PUT update with same name. Assert no validation error (redirect success).
- `test_update_region_validates_unique_name_against_other_records` — Create `Bishkek` and `Osh`. PUT update `Osh` with name `Bishkek`. Assert session error.

**Delete tests:**
- `test_admin_can_delete_region` — Create region. DELETE. Assert redirect. Assert DB missing.

**Authorization tests:**
- `test_non_admin_cannot_access_region_routes` — Acting as client. GET index, GET create, POST store. Assert redirect for each.
- `test_guest_cannot_access_region_routes` — GET index without auth. Assert redirect.

---

## Execution Order

1. **2.1** first — smallest change, modifies existing view only
2. **2.2** next — new controller + view + route + sidebar link
3. **2.3** next — depends on Setting model from Phase 1
4. **2.4** last — depends on Region model from Phase 1, most artifacts

## Sidebar Nav Final Order

After all sub-tasks, the sidebar links top-to-bottom:
1. Dashboard
2. Drivers (existing)
3. Clients (2.2)
4. Regions (2.4)
5. Orders (existing)
6. Tickets (existing)
7. Settings (2.3)
