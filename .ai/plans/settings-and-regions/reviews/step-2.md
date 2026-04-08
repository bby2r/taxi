---
step: "2"
verdict: PASS
date: 2026-04-08
---

# Step 2 Review: Admin Panel

## Checklist

### 2.1: Drivers is_online column
- [x] "Status" th added to drivers index table header
- [x] Status td shows Online/Offline badge using `$driver->driverProfile?->is_online`
- [x] Green badge for Online, gray badge for Offline
- [x] colspan updated to 7 for empty state row
- [x] Test `test_driver_index_shows_online_status_badge` passes

### 2.2: Clients page
- [x] `ClientController::index()` uses `User::clients()->withCount('clientOrders')->latest()->paginate(15)`
- [x] View at `admin/clients/index.blade.php` with 4 columns: Name, Phone, Total Orders, Joined
- [x] Nav link in admin layout between Drivers and Orders
- [x] Route: GET `admin/clients` named `admin.clients.index`
- [x] Tests cover page load, client data display, driver exclusion, auth guards

### 2.3: Settings page
- [x] `SettingController::index()` loads all settings keyed by key
- [x] `SettingController::update()` validates 4 fields, updates each via `Setting::where`
- [x] View at `admin/settings/index.blade.php` with form containing 4 number inputs
- [x] Nav link at bottom of admin nav (after Tickets)
- [x] Routes: GET + PUT `admin/settings`
- [x] Tests cover load, update, validation (required, numeric, min:0), decimal radius, auth guards

### 2.4: Regions CRUD
- [x] `RegionController` has full CRUD (index, create, store, edit, update, destroy)
- [x] No `show` method — route resource uses `->except(['show'])`
- [x] Validates name unique, prices integer min:0, is_active boolean, sort_order integer
- [x] Update validates unique name excluding current record
- [x] Views: index (table with 6 columns), create (form), edit (form with PUT)
- [x] Nav link after Clients, before Orders
- [x] Tests cover index, create, unique name, edit, update, delete, auth guards

### Sidebar nav order
- [x] Dashboard, Drivers, Clients, Regions, Orders, Tickets, Settings

### Tests
- [x] All 39 tests pass (100 assertions)

## Issues

None.

## Notes

- `SettingController::update()` casts value to string before saving, which correctly handles the `max_search_radius_km` decimal case.
- Region forms use `$request->boolean('is_active')` to handle unchecked checkbox (sends no value), which is correct.
- The create form defaults `is_active` to checked and `sort_order` to 0, good UX defaults.
