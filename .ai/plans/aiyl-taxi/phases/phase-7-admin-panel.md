---
phase: 7
title: "Admin Web Panel"
status: pending
depends_on: [1, 2, 3, 4]
---

# Phase 7 — Admin Web Panel

Blade + TailwindCSS 4 admin panel with session-based authentication, dashboard, driver management, and order listing. All routes are web routes (NOT API), all auth is session-based (NOT Sanctum tokens).

---

## Sub-task 7.1 — Admin Auth & Layout

### Objective

Session-based admin login/logout with a reusable Blade layout containing sidebar navigation and top bar. Non-admin users are rejected. Unauthenticated visitors are redirected to the login page.

### Routes

| Method | URI | Name | Controller Method |
|--------|-----|------|-------------------|
| GET | `/admin/login` | `admin.login` | `Admin\AuthController@showLogin` |
| POST | `/admin/login` | `admin.login.submit` | `Admin\AuthController@login` |
| POST | `/admin/logout` | `admin.logout` | `Admin\AuthController@logout` |
| GET | `/admin` | (redirect) | Redirects to `admin.dashboard` |

All `/admin/*` routes (except login) are wrapped in middleware: `auth` + `App\Http\Middleware\EnsureUserRole:admin`.

### Route File

Add an admin route group in `routes/web.php`:

```php
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DriverController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Middleware\EnsureUserRole;

// Admin auth (guest-only)
Route::prefix('admin')->name('admin.')->group(function () {
    Route::middleware('guest')->group(function () {
        Route::get('login', [AuthController::class, 'showLogin'])->name('login');
        Route::post('login', [AuthController::class, 'login'])->name('login.submit');
    });

    Route::middleware(['auth', EnsureUserRole::class . ':admin'])->group(function () {
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
        Route::get('/', fn () => redirect()->route('admin.dashboard'));
        // Phase 7.2-7.4 routes registered here
    });
});
```

### Controller

**File**: `app/Http/Controllers/Admin/AuthController.php`
Create via: `php artisan make:controller Admin/AuthController --no-interaction`

```
showLogin(): View
    - Return view 'admin.auth.login'

login(Request $request): RedirectResponse
    - Validate: phone (required|string), password (required|string)
    - Auth::attempt(['phone' => $request->phone, 'password' => $request->password])
    - After successful auth, check Auth::user()->role === UserRole::Admin
      - If not admin: Auth::logout(), redirect back with error "Access denied."
    - Regenerate session
    - Redirect to route('admin.dashboard')
    - On failure: redirect back with error "Invalid credentials."

logout(Request $request): RedirectResponse
    - Auth::logout()
    - $request->session()->invalidate()
    - $request->session()->regenerateToken()
    - Redirect to route('admin.login')
```

### Middleware

Reuse the existing `EnsureUserRole` middleware. Verify it:
- Checks `$request->user()->role->value` against the parameter
- Returns 403 or redirects to `/admin/login` for web requests (check `$request->expectsJson()`)
- If the middleware only aborts with 403, update it to redirect web requests: `return redirect()->route('admin.login')` when `!$request->expectsJson()`.

### Views

**`resources/views/admin/auth/login.blade.php`** (standalone, no layout):

```
- Full-page centered card on #F9FAFB background
- Card: white, rounded-xl, shadow-lg, max-w-sm, p-8
- Logo/Title: "Alif Taxi Admin" in #1F2937, text-2xl font-bold, centered
- Subtitle: "Sign in to your account" text-gray-500 text-sm
- Form fields:
  - Phone: <input type="tel" name="phone" placeholder="Phone number" required>
    - Classes: w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400
  - Password: <input type="password" name="password" placeholder="Password" required>
    - Same styling as phone
- Submit button: "Sign In"
  - Classes: w-full py-3 bg-amber-400 hover:bg-amber-500 text-gray-900 font-semibold rounded-lg transition
- Error display: @if($errors->any()) block above form, red bg-red-50 text-red-600 p-3 rounded-lg text-sm
- CSRF: @csrf on form
```

**`resources/views/layouts/admin.blade.php`** (main admin layout):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Admin') — Alif Taxi</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-50 min-h-screen flex">

    <!-- Sidebar -->
    <aside class="w-64 bg-gray-800 min-h-screen flex-shrink-0 flex flex-col">
        <!-- Brand -->
        <div class="px-6 py-5 border-b border-gray-700">
            <h1 class="text-amber-400 text-xl font-bold">Alif Taxi</h1>
            <p class="text-gray-400 text-xs mt-1">Admin Panel</p>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 py-6 space-y-1">
            <a href="{{ route('admin.dashboard') }}"
               class="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                      {{ request()->routeIs('admin.dashboard') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }}">
                <!-- SVG: squares-2x2 (Heroicons) -->
                <svg class="w-5 h-5 mr-3" ...></svg>
                Dashboard
            </a>
            <a href="{{ route('admin.drivers.index') }}"
               class="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                      {{ request()->routeIs('admin.drivers.*') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }}">
                <!-- SVG: user-group (Heroicons) -->
                <svg class="w-5 h-5 mr-3" ...></svg>
                Drivers
            </a>
            <a href="{{ route('admin.orders.index') }}"
               class="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
                      {{ request()->routeIs('admin.orders.*') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }}">
                <!-- SVG: clipboard-document-list (Heroicons) -->
                <svg class="w-5 h-5 mr-3" ...></svg>
                Orders
            </a>
        </nav>
    </aside>

    <!-- Main content -->
    <div class="flex-1 flex flex-col">
        <!-- Top bar -->
        <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-800">@yield('heading', 'Dashboard')</h2>
            <div class="flex items-center gap-4">
                <span class="text-sm text-gray-600">{{ Auth::user()->name }}</span>
                <form action="{{ route('admin.logout') }}" method="POST">
                    @csrf
                    <button type="submit"
                            class="text-sm text-red-500 hover:text-red-700 font-medium">
                        Logout
                    </button>
                </form>
            </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 p-6">
            @yield('content')
        </main>
    </div>

</body>
</html>
```

Use Heroicon outline SVGs (24x24) inline for sidebar icons. Specific icons:
- Dashboard: `squares-2x2`
- Drivers: `user-group`
- Orders: `clipboard-document-list`

### Design Brief (7.1)

- **Login page**: Centered white card on #F9FAFB. Amber-400 submit button. Clean, minimal. No images.
- **Layout sidebar**: Dark gray (#1F2937 / gray-800) full-height sidebar, 16rem wide. Active nav item has gray-900 bg with amber-400 text. Inactive items are gray-300 text with hover:bg-gray-700.
- **Top bar**: White background, bottom border gray-200. Admin name on right + red logout link.
- **Mobile responsive**: On screens < 768px, sidebar collapses. Add a hamburger button in the top bar that toggles sidebar visibility. Use a simple Alpine.js toggle or a Blade `<details>` element — keep it minimal. Sidebar overlays on mobile with z-50.

### PHPUnit Tests

**File**: `tests/Feature/Admin/AuthTest.php`
Create via: `php artisan make:test Admin/AuthTest --phpunit --no-interaction`

```
testAdminLoginPageIsAccessible(): void
    - GET /admin/login → 200
    - assertSee('Alif Taxi Admin')

testAdminCanLoginWithValidCredentials(): void
    - Create User factory with role=admin, phone='1234567890', password=Hash::make('password')
    - POST /admin/login {phone: '1234567890', password: 'password'}
    - assertRedirect(route('admin.dashboard'))
    - assertAuthenticatedAs($admin)

testNonAdminCannotLogin(): void
    - Create User factory with role=client, phone='1111111111', password=Hash::make('password')
    - POST /admin/login {phone: '1111111111', password: 'password'}
    - assertRedirect (back to login)
    - assertGuest()
    - assertSessionHas('errors')

testInvalidCredentialsAreRejected(): void
    - POST /admin/login {phone: '0000000000', password: 'wrong'}
    - assertRedirect (back to login)
    - assertGuest()

testAuthenticatedAdminCanAccessDashboard(): void
    - Create admin user, actingAs($admin)
    - GET /admin/dashboard → 200

testUnauthenticatedUserIsRedirectedToLogin(): void
    - GET /admin/dashboard → redirect to /admin/login (or /login)
    - Ensure the auth middleware redirects properly

testNonAdminAuthenticatedUserCannotAccessAdmin(): void
    - Create client user, actingAs($client)
    - GET /admin/dashboard → 403 or redirect

testAdminCanLogout(): void
    - actingAs($admin)
    - POST /admin/logout
    - assertRedirect(route('admin.login'))
    - assertGuest()
```

### Browser Tests

**File**: `tests/Feature/Admin/AuthBrowserTest.php` (standard PHPUnit HTTP tests simulating browser flow)

```
testFullLoginFlow(): void
    - Create admin user
    - GET /admin/login → 200, see form
    - POST /admin/login with credentials → follow redirect → see 'Dashboard'

testLoginPageShowsErrorOnBadCredentials(): void
    - POST /admin/login with wrong credentials → follow redirect → see 'Invalid credentials'
```

### Files Created/Modified

| Action | Path |
|--------|------|
| Create | `app/Http/Controllers/Admin/AuthController.php` |
| Create | `resources/views/admin/auth/login.blade.php` |
| Create | `resources/views/layouts/admin.blade.php` |
| Modify | `routes/web.php` |
| Modify | `app/Http/Middleware/EnsureUserRole.php` (if redirect logic needed) |
| Create | `tests/Feature/Admin/AuthTest.php` |
| Create | `tests/Feature/Admin/AuthBrowserTest.php` |

---

## Sub-task 7.2 — Admin Dashboard

### Objective

Dashboard page showing key stats (active orders, online drivers, today revenue, total rides) and a recent orders table.

### Routes

| Method | URI | Name | Controller Method |
|--------|-----|------|-------------------|
| GET | `/admin/dashboard` | `admin.dashboard` | `Admin\DashboardController@index` |

Register inside the authenticated admin group in `routes/web.php`:
```php
Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
```

### Controller

**File**: `app/Http/Controllers/Admin/DashboardController.php`
Create via: `php artisan make:controller Admin/DashboardController --no-interaction`

```
index(): View
    - $activeOrders = Order::whereIn('status', [
          OrderStatus::Searching,
          OrderStatus::Accepted,
          OrderStatus::Arrived,
      ])->count();

    - $onlineDrivers = User::where('role', UserRole::Driver)
          ->whereHas('driverProfile', fn ($q) => $q->where('is_online', true))
          ->count();
      // If DriverProfile doesn't have is_online, count all drivers instead
      // and add a comment noting the field should be added

    - $todayRevenue = Order::where('status', OrderStatus::Completed)
          ->whereDate('updated_at', today())
          ->sum('price');

    - $totalRides = Order::where('status', OrderStatus::Completed)->count();

    - $recentOrders = Order::with(['client', 'driver'])
          ->latest()
          ->take(10)
          ->get();

    - return view('admin.dashboard', compact(
          'activeOrders', 'onlineDrivers', 'todayRevenue', 'totalRides', 'recentOrders'
      ));
```

### View

**File**: `resources/views/admin/dashboard.blade.php`

```blade
@extends('layouts.admin')
@section('title', 'Dashboard')
@section('heading', 'Dashboard')

@section('content')

<!-- Stats Grid: 4 columns on lg, 2 on sm, 1 on xs -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

    <!-- Card: Active Orders -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500 font-medium">Active Orders</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">{{ $activeOrders }}</p>
            </div>
            <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <!-- Heroicon: clock (outline, amber-500) -->
            </div>
        </div>
    </div>

    <!-- Card: Online Drivers -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500 font-medium">Online Drivers</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">{{ $onlineDrivers }}</p>
            </div>
            <div class="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <!-- Heroicon: user-group (outline, emerald-500) -->
            </div>
        </div>
    </div>

    <!-- Card: Today Revenue -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500 font-medium">Today Revenue</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">{{ number_format($todayRevenue) }} KGS</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <!-- Heroicon: banknotes (outline, blue-500) -->
            </div>
        </div>
    </div>

    <!-- Card: Total Rides -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-sm text-gray-500 font-medium">Total Rides</p>
                <p class="text-3xl font-bold text-gray-900 mt-1">{{ number_format($totalRides) }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <!-- Heroicon: map-pin (outline, purple-500) -->
            </div>
        </div>
    </div>

</div>

<!-- Recent Orders Table -->
<div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-base font-semibold text-gray-900">Recent Orders</h3>
    </div>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                    <th class="px-6 py-3 text-left font-medium">ID</th>
                    <th class="px-6 py-3 text-left font-medium">Client</th>
                    <th class="px-6 py-3 text-left font-medium">Driver</th>
                    <th class="px-6 py-3 text-left font-medium">Status</th>
                    <th class="px-6 py-3 text-right font-medium">Price</th>
                    <th class="px-6 py-3 text-right font-medium">Date</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                @forelse($recentOrders as $order)
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-3 text-gray-900 font-medium">#{{ $order->id }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $order->client?->name ?? '—' }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $order->driver?->name ?? '—' }}</td>
                    <td class="px-6 py-3">
                        @include('admin.partials.order-status-badge', ['status' => $order->status])
                    </td>
                    <td class="px-6 py-3 text-right text-gray-900">{{ number_format($order->price) }} KGS</td>
                    <td class="px-6 py-3 text-right text-gray-500">{{ $order->created_at->format('M d, H:i') }}</td>
                </tr>
                @empty
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-400">No orders yet.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

@endsection
```

**File**: `resources/views/admin/partials/order-status-badge.blade.php`

Status badge partial (reused in 7.2 and 7.4):

```blade
@php
    $colors = match($status) {
        App\Enums\OrderStatus::Searching => 'bg-yellow-100 text-yellow-700',
        App\Enums\OrderStatus::Accepted  => 'bg-blue-100 text-blue-700',
        App\Enums\OrderStatus::Arrived   => 'bg-indigo-100 text-indigo-700',
        App\Enums\OrderStatus::Completed => 'bg-emerald-100 text-emerald-700',
        App\Enums\OrderStatus::Cancelled => 'bg-red-100 text-red-700',
        default                          => 'bg-gray-100 text-gray-700',
    };
@endphp
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {{ $colors }}">
    {{ $status->value }}
</span>
```

### Design Brief (7.2)

- **Stats cards**: White cards with rounded-xl, subtle shadow-sm, gray-200 border. Each has a colored icon container (amber, emerald, blue, purple) on the right. Numbers are text-3xl bold. Responsive 4-col grid.
- **Recent orders table**: White card, header row is bg-gray-50 uppercase, body rows have hover:bg-gray-50. Status column uses colored pill badges. Price right-aligned. Zebra via divide-y.
- **Empty state**: Centered gray text "No orders yet." spanning full width.
- **Currency**: KGS (Kyrgyz Som).

### PHPUnit Tests

**File**: `tests/Feature/Admin/DashboardTest.php`
Create via: `php artisan make:test Admin/DashboardTest --phpunit --no-interaction`

```
testDashboardDisplaysStatsCards(): void
    - Create admin, actingAs
    - Create 3 orders with status=Completed (2 today, 1 yesterday), price=500 each
    - Create 1 order with status=Searching
    - GET /admin/dashboard → 200
    - assertSee('1') // active orders (searching)
    - assertSee('1,000') // today revenue (2 * 500)
    - assertSee('3') // total rides

testDashboardDisplaysRecentOrders(): void
    - Create admin + client + driver users
    - Create 3 orders with client_id, driver_id
    - GET /admin/dashboard → 200
    - assertSee client name
    - assertSee driver name

testDashboardRequiresAdminAuth(): void
    - GET /admin/dashboard as guest → redirect
    - GET /admin/dashboard as client → 403 or redirect

testDashboardShowsEmptyStateWhenNoOrders(): void
    - Create admin, actingAs
    - GET /admin/dashboard → 200
    - assertSee('No orders yet.')
```

### Browser Tests

```
testDashboardPageLoadsWithLayout(): void
    - actingAs admin
    - GET /admin/dashboard → 200
    - assertSee('Dashboard')  // heading
    - assertSee('Alif Taxi')  // sidebar brand
    - assertSee(admin->name)  // top bar
    - assertSee('Logout')
```

### Files Created/Modified

| Action | Path |
|--------|------|
| Create | `app/Http/Controllers/Admin/DashboardController.php` |
| Create | `resources/views/admin/dashboard.blade.php` |
| Create | `resources/views/admin/partials/order-status-badge.blade.php` |
| Modify | `routes/web.php` (add dashboard route) |
| Create | `tests/Feature/Admin/DashboardTest.php` |

---

## Sub-task 7.3 — Admin Driver Management

### Objective

Full CRUD for drivers. Creating a driver creates both a User (role=driver) and a DriverProfile. Editing updates both. Deleting soft-deletes the User (if SoftDeletes is on the model) or prevents deletion if the driver has active orders.

### Routes

| Method | URI | Name | Controller Method |
|--------|-----|------|-------------------|
| GET | `/admin/drivers` | `admin.drivers.index` | `Admin\DriverController@index` |
| GET | `/admin/drivers/create` | `admin.drivers.create` | `Admin\DriverController@create` |
| POST | `/admin/drivers` | `admin.drivers.store` | `Admin\DriverController@store` |
| GET | `/admin/drivers/{driver}/edit` | `admin.drivers.edit` | `Admin\DriverController@edit` |
| PUT | `/admin/drivers/{driver}` | `admin.drivers.update` | `Admin\DriverController@update` |
| DELETE | `/admin/drivers/{driver}` | `admin.drivers.destroy` | `Admin\DriverController@destroy` |

Register inside the authenticated admin group in `routes/web.php`:
```php
Route::resource('drivers', DriverController::class)->except(['show']);
```

### Controller

**File**: `app/Http/Controllers/Admin/DriverController.php`
Create via: `php artisan make:controller Admin/DriverController --resource --no-interaction`

```
index(): View
    - $drivers = User::where('role', UserRole::Driver)
          ->with('driverProfile')
          ->latest()
          ->paginate(15);
    - return view('admin.drivers.index', compact('drivers'));

create(): View
    - return view('admin.drivers.create');

store(Request $request): RedirectResponse
    - Validate (see Validation Rules below)
    - DB::transaction(function () {
          $user = User::create([
              'name' => $request->name,
              'phone' => $request->phone,
              'password' => Hash::make($request->password),
              'role' => UserRole::Driver,
          ]);
          $user->driverProfile()->create([
              'car_model' => $request->car_model,
              'car_number' => $request->car_number,
          ]);
      });
    - redirect()->route('admin.drivers.index')->with('success', 'Driver created successfully.');

edit(User $driver): View
    - Abort 404 if $driver->role !== UserRole::Driver
    - $driver->load('driverProfile');
    - return view('admin.drivers.edit', compact('driver'));

update(Request $request, User $driver): RedirectResponse
    - Abort 404 if $driver->role !== UserRole::Driver
    - Validate (see below, phone unique ignores current $driver->id)
    - DB::transaction(function () {
          $driver->update([
              'name' => $request->name,
              'phone' => $request->phone,
              ...($request->filled('password') ? ['password' => Hash::make($request->password)] : []),
          ]);
          $driver->driverProfile()->updateOrCreate([], [
              'car_model' => $request->car_model,
              'car_number' => $request->car_number,
          ]);
      });
    - redirect()->route('admin.drivers.index')->with('success', 'Driver updated successfully.');

destroy(User $driver): RedirectResponse
    - Abort 404 if $driver->role !== UserRole::Driver
    - Check for active orders: Order::where('driver_id', $driver->id)
          ->whereIn('status', [OrderStatus::Accepted, OrderStatus::Arrived])
          ->exists()
      - If active orders exist: redirect back with error "Cannot delete driver with active orders."
    - $driver->delete();
    - redirect()->route('admin.drivers.index')->with('success', 'Driver deleted successfully.');
```

### Validation Rules

**Store**:
| Field | Rules |
|-------|-------|
| `name` | `required\|string\|max:255` |
| `phone` | `required\|string\|max:20\|unique:users,phone` |
| `password` | `required\|string\|min:6` |
| `car_model` | `required\|string\|max:255` |
| `car_number` | `required\|string\|max:20` |

**Update**:
| Field | Rules |
|-------|-------|
| `name` | `required\|string\|max:255` |
| `phone` | `required\|string\|max:20\|unique:users,phone,{$driver->id}` |
| `password` | `nullable\|string\|min:6` |
| `car_model` | `required\|string\|max:255` |
| `car_number` | `required\|string\|max:20` |

### Views

**`resources/views/admin/drivers/index.blade.php`**:

```blade
@extends('layouts.admin')
@section('title', 'Drivers')
@section('heading', 'Drivers')

@section('content')

<!-- Header row -->
<div class="flex items-center justify-between mb-6">
    <p class="text-sm text-gray-500">{{ $drivers->total() }} drivers total</p>
    <a href="{{ route('admin.drivers.create') }}"
       class="inline-flex items-center px-4 py-2 bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm font-semibold rounded-lg transition">
        + Add Driver
    </a>
</div>

<!-- Success/Error flash -->
@if(session('success'))
    <div class="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">{{ session('success') }}</div>
@endif
@if(session('error'))
    <div class="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{{ session('error') }}</div>
@endif

<!-- Table -->
<div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                    <th class="px-6 py-3 text-left font-medium">Name</th>
                    <th class="px-6 py-3 text-left font-medium">Phone</th>
                    <th class="px-6 py-3 text-left font-medium">Car</th>
                    <th class="px-6 py-3 text-left font-medium">Plate</th>
                    <th class="px-6 py-3 text-left font-medium">Joined</th>
                    <th class="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                @forelse($drivers as $driver)
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-3 text-gray-900 font-medium">{{ $driver->name }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $driver->phone }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $driver->driverProfile?->car_model ?? '—' }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $driver->driverProfile?->car_number ?? '—' }}</td>
                    <td class="px-6 py-3 text-gray-500">{{ $driver->created_at->format('M d, Y') }}</td>
                    <td class="px-6 py-3 text-right space-x-2">
                        <a href="{{ route('admin.drivers.edit', $driver) }}"
                           class="text-amber-600 hover:text-amber-800 text-sm font-medium">Edit</a>
                        <form action="{{ route('admin.drivers.destroy', $driver) }}" method="POST" class="inline"
                              onsubmit="return confirm('Delete this driver?')">
                            @csrf @method('DELETE')
                            <button type="submit" class="text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
                        </form>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-gray-400">No drivers found.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

<!-- Pagination -->
<div class="mt-4">
    {{ $drivers->links() }}
</div>

@endsection
```

**`resources/views/admin/drivers/create.blade.php`**:

```blade
@extends('layouts.admin')
@section('title', 'Add Driver')
@section('heading', 'Add Driver')

@section('content')
<div class="max-w-2xl">
    <form action="{{ route('admin.drivers.store') }}" method="POST" class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
        @csrf

        <!-- Name -->
        <div>
            <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" name="name" id="name" value="{{ old('name') }}" required
                   class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm">
            @error('name') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <!-- Phone -->
        <div>
            <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" name="phone" id="phone" value="{{ old('phone') }}" required
                   class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm">
            @error('phone') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <!-- Password -->
        <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" name="password" id="password" required
                   class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm">
            @error('password') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <!-- Car Model -->
        <div>
            <label for="car_model" class="block text-sm font-medium text-gray-700 mb-1">Car Model</label>
            <input type="text" name="car_model" id="car_model" value="{{ old('car_model') }}" required
                   placeholder="e.g. Toyota Camry"
                   class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm">
            @error('car_model') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <!-- Car Number -->
        <div>
            <label for="car_number" class="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
            <input type="text" name="car_number" id="car_number" value="{{ old('car_number') }}" required
                   placeholder="e.g. 01KG123ABC"
                   class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm">
            @error('car_number') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2">
            <button type="submit"
                    class="px-6 py-2.5 bg-amber-400 hover:bg-amber-500 text-gray-900 text-sm font-semibold rounded-lg transition">
                Create Driver
            </button>
            <a href="{{ route('admin.drivers.index') }}"
               class="px-6 py-2.5 text-gray-600 hover:text-gray-800 text-sm font-medium">
                Cancel
            </a>
        </div>
    </form>
</div>
@endsection
```

**`resources/views/admin/drivers/edit.blade.php`**:

Same layout as create, with differences:
- Form `action="{{ route('admin.drivers.update', $driver) }}"` method POST + `@method('PUT')`
- Fields pre-filled with `$driver->name`, `$driver->phone`, `$driver->driverProfile?->car_model`, `$driver->driverProfile?->car_number`
- Password field: `placeholder="Leave blank to keep current"`, NOT required
- Button label: "Update Driver"

### Design Brief (7.3)

- **Index page**: Header row with total count on left, amber "Add Driver" button on right. White table card. Actions column has amber Edit link and red Delete link.
- **Create/Edit forms**: Max-width 2xl, white card with border. Labels above inputs. Amber submit button. Cancel link beside it. Validation errors in red below each field.
- **Flash messages**: Green bar for success, red bar for errors, above the table.
- **Delete confirmation**: Browser-native `confirm()` dialog.
- **Pagination**: Laravel default pagination links below the table.

### PHPUnit Tests

**File**: `tests/Feature/Admin/DriverManagementTest.php`
Create via: `php artisan make:test Admin/DriverManagementTest --phpunit --no-interaction`

```
testDriverIndexPageListsDrivers(): void
    - Create admin, create 3 driver users with driverProfiles
    - actingAs(admin), GET /admin/drivers → 200
    - assertSee each driver's name

testDriverCreatePageIsAccessible(): void
    - actingAs(admin), GET /admin/drivers/create → 200
    - assertSee('Add Driver')

testAdminCanCreateDriver(): void
    - actingAs(admin)
    - POST /admin/drivers {name: 'Test Driver', phone: '5551234567', password: 'secret123', car_model: 'Toyota Camry', car_number: '01KG123'}
    - assertRedirect(route('admin.drivers.index'))
    - assertDatabaseHas('users', ['phone' => '5551234567', 'role' => 'driver'])
    - assertDatabaseHas('driver_profiles', ['car_model' => 'Toyota Camry'])

testCreateDriverValidatesRequiredFields(): void
    - actingAs(admin), POST /admin/drivers {} (empty)
    - assertSessionHasErrors(['name', 'phone', 'password', 'car_model', 'car_number'])

testCreateDriverValidatesUniquePhone(): void
    - Create existing user with phone '1111111111'
    - actingAs(admin), POST /admin/drivers {phone: '1111111111', ...}
    - assertSessionHasErrors(['phone'])

testDriverEditPageIsAccessible(): void
    - Create driver user with driverProfile
    - actingAs(admin), GET /admin/drivers/{driver}/edit → 200
    - assertSee driver's name

testAdminCanUpdateDriver(): void
    - Create driver user with driverProfile
    - actingAs(admin), PUT /admin/drivers/{driver} {name: 'Updated Name', phone: driver->phone, car_model: 'Honda', car_number: '02KG456'}
    - assertRedirect(route('admin.drivers.index'))
    - assertDatabaseHas('users', ['id' => driver->id, 'name' => 'Updated Name'])
    - assertDatabaseHas('driver_profiles', ['car_model' => 'Honda'])

testAdminCanUpdateDriverWithoutChangingPassword(): void
    - Create driver, save original password hash
    - PUT /admin/drivers/{driver} {name: 'X', phone: '...', password: '', car_model: '...', car_number: '...'}
    - Assert password hash unchanged in DB

testAdminCanDeleteDriverWithoutActiveOrders(): void
    - Create driver, no orders
    - actingAs(admin), DELETE /admin/drivers/{driver}
    - assertRedirect(route('admin.drivers.index'))
    - assertDatabaseMissing (or assertSoftDeleted) users table

testAdminCannotDeleteDriverWithActiveOrders(): void
    - Create driver with an order in status=Accepted
    - actingAs(admin), DELETE /admin/drivers/{driver}
    - assertRedirect (back)
    - assertSessionHas('error')
    - assertDatabaseHas('users', ['id' => driver->id])

testNonAdminCannotAccessDriverRoutes(): void
    - actingAs(client), GET /admin/drivers → 403 or redirect
```

### Browser Tests

```
testCreateDriverFullFlow(): void
    - actingAs admin
    - GET /admin/drivers/create → 200
    - POST with valid data → follow redirect → see 'Driver created successfully'

testEditDriverFullFlow(): void
    - actingAs admin, create driver
    - GET /admin/drivers/{id}/edit → 200, see driver name
    - PUT with updated name → follow redirect → see 'Driver updated successfully'
```

### Files Created/Modified

| Action | Path |
|--------|------|
| Create | `app/Http/Controllers/Admin/DriverController.php` |
| Create | `resources/views/admin/drivers/index.blade.php` |
| Create | `resources/views/admin/drivers/create.blade.php` |
| Create | `resources/views/admin/drivers/edit.blade.php` |
| Modify | `routes/web.php` (add resource route) |
| Create | `tests/Feature/Admin/DriverManagementTest.php` |

---

## Sub-task 7.4 — Admin Order List

### Objective

Read-only order management: paginated index with status filter, and a detail view for individual orders.

### Routes

| Method | URI | Name | Controller Method |
|--------|-----|------|-------------------|
| GET | `/admin/orders` | `admin.orders.index` | `Admin\OrderController@index` |
| GET | `/admin/orders/{order}` | `admin.orders.show` | `Admin\OrderController@show` |

Register inside the authenticated admin group in `routes/web.php`:
```php
Route::resource('orders', OrderController::class)->only(['index', 'show']);
```

### Controller

**File**: `app/Http/Controllers/Admin/OrderController.php`
Create via: `php artisan make:controller Admin/OrderController --no-interaction`

```
index(Request $request): View
    - $query = Order::with(['client', 'driver'])->latest();
    - if ($request->filled('status')) {
          $status = OrderStatus::tryFrom($request->status);
          if ($status) {
              $query->where('status', $status);
          }
      }
    - $orders = $query->paginate(20)->withQueryString();
    - $statuses = OrderStatus::cases();
    - return view('admin.orders.index', compact('orders', 'statuses'));

show(Order $order): View
    - $order->load(['client', 'driver.driverProfile']);
    - return view('admin.orders.show', compact('order'));
```

### Views

**`resources/views/admin/orders/index.blade.php`**:

```blade
@extends('layouts.admin')
@section('title', 'Orders')
@section('heading', 'Orders')

@section('content')

<!-- Filter bar -->
<div class="flex items-center justify-between mb-6">
    <p class="text-sm text-gray-500">{{ $orders->total() }} orders total</p>
    <form method="GET" action="{{ route('admin.orders.index') }}" class="flex items-center gap-2">
        <select name="status"
                class="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-400 focus:border-amber-400">
            <option value="">All Statuses</option>
            @foreach($statuses as $status)
                <option value="{{ $status->value }}" {{ request('status') === $status->value ? 'selected' : '' }}>
                    {{ $status->value }}
                </option>
            @endforeach
        </select>
        <button type="submit"
                class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition">
            Filter
        </button>
        @if(request('status'))
            <a href="{{ route('admin.orders.index') }}" class="text-sm text-gray-500 hover:text-gray-700">Clear</a>
        @endif
    </form>
</div>

<!-- Table -->
<div class="bg-white rounded-xl shadow-sm border border-gray-200">
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                    <th class="px-6 py-3 text-left font-medium">ID</th>
                    <th class="px-6 py-3 text-left font-medium">Date</th>
                    <th class="px-6 py-3 text-left font-medium">Client</th>
                    <th class="px-6 py-3 text-left font-medium">Driver</th>
                    <th class="px-6 py-3 text-left font-medium">Status</th>
                    <th class="px-6 py-3 text-right font-medium">Price</th>
                    <th class="px-6 py-3 text-right font-medium"></th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                @forelse($orders as $order)
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-3 text-gray-900 font-medium">#{{ $order->id }}</td>
                    <td class="px-6 py-3 text-gray-500">{{ $order->created_at->format('M d, Y H:i') }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $order->client?->name ?? '—' }}</td>
                    <td class="px-6 py-3 text-gray-700">{{ $order->driver?->name ?? '—' }}</td>
                    <td class="px-6 py-3">
                        @include('admin.partials.order-status-badge', ['status' => $order->status])
                    </td>
                    <td class="px-6 py-3 text-right text-gray-900">{{ number_format($order->price) }} KGS</td>
                    <td class="px-6 py-3 text-right">
                        <a href="{{ route('admin.orders.show', $order) }}"
                           class="text-amber-600 hover:text-amber-800 text-sm font-medium">View</a>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center text-gray-400">No orders found.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>
</div>

<!-- Pagination -->
<div class="mt-4">
    {{ $orders->links() }}
</div>

@endsection
```

**`resources/views/admin/orders/show.blade.php`**:

```blade
@extends('layouts.admin')
@section('title', 'Order #' . $order->id)
@section('heading', 'Order #' . $order->id)

@section('content')

<div class="max-w-4xl space-y-6">

    <!-- Back link -->
    <a href="{{ route('admin.orders.index') }}" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Orders</a>

    <!-- Status + Price header -->
    <div class="flex items-center gap-4">
        @include('admin.partials.order-status-badge', ['status' => $order->status])
        <span class="text-2xl font-bold text-gray-900">{{ number_format($order->price) }} KGS</span>
    </div>

    <!-- Two-column grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <!-- Client Info Card -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-semibold text-gray-500 uppercase mb-4">Client</h3>
            <dl class="space-y-3 text-sm">
                <div class="flex justify-between">
                    <dt class="text-gray-500">Name</dt>
                    <dd class="text-gray-900 font-medium">{{ $order->client?->name ?? '—' }}</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-gray-500">Phone</dt>
                    <dd class="text-gray-900">{{ $order->client?->phone ?? '—' }}</dd>
                </div>
            </dl>
        </div>

        <!-- Driver Info Card -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-semibold text-gray-500 uppercase mb-4">Driver</h3>
            <dl class="space-y-3 text-sm">
                <div class="flex justify-between">
                    <dt class="text-gray-500">Name</dt>
                    <dd class="text-gray-900 font-medium">{{ $order->driver?->name ?? '—' }}</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-gray-500">Phone</dt>
                    <dd class="text-gray-900">{{ $order->driver?->phone ?? '—' }}</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-gray-500">Car</dt>
                    <dd class="text-gray-900">{{ $order->driver?->driverProfile?->car_model ?? '—' }}</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-gray-500">Plate</dt>
                    <dd class="text-gray-900">{{ $order->driver?->driverProfile?->car_number ?? '—' }}</dd>
                </div>
            </dl>
        </div>

    </div>

    <!-- Order Details Card -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-500 uppercase mb-4">Order Details</h3>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div class="flex justify-between sm:block">
                <dt class="text-gray-500">Pickup Address</dt>
                <dd class="text-gray-900 font-medium">{{ $order->pickup_address ?? '—' }}</dd>
            </div>
            <div class="flex justify-between sm:block">
                <dt class="text-gray-500">Dropoff Address</dt>
                <dd class="text-gray-900 font-medium">{{ $order->dropoff_address ?? '—' }}</dd>
            </div>
            <div class="flex justify-between sm:block">
                <dt class="text-gray-500">Pickup Coordinates</dt>
                <dd class="text-gray-900">{{ $order->pickup_lat }}, {{ $order->pickup_lng }}</dd>
            </div>
            <div class="flex justify-between sm:block">
                <dt class="text-gray-500">Dropoff Coordinates</dt>
                <dd class="text-gray-900">{{ $order->dropoff_lat }}, {{ $order->dropoff_lng }}</dd>
            </div>
        </dl>
    </div>

    <!-- Timestamps Card -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 class="text-sm font-semibold text-gray-500 uppercase mb-4">Timeline</h3>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
                <dt class="text-gray-500">Created</dt>
                <dd class="text-gray-900">{{ $order->created_at->format('M d, Y H:i:s') }}</dd>
            </div>
            <div>
                <dt class="text-gray-500">Accepted</dt>
                <dd class="text-gray-900">{{ $order->accepted_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-gray-500">Driver Arrived</dt>
                <dd class="text-gray-900">{{ $order->arrived_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-gray-500">Completed</dt>
                <dd class="text-gray-900">{{ $order->completed_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-gray-500">Cancelled</dt>
                <dd class="text-gray-900">{{ $order->cancelled_at?->format('M d, Y H:i:s') ?? '—' }}</dd>
            </div>
            <div>
                <dt class="text-gray-500">Last Updated</dt>
                <dd class="text-gray-900">{{ $order->updated_at->format('M d, Y H:i:s') }}</dd>
            </div>
        </dl>
    </div>

</div>

@endsection
```

### Design Brief (7.4)

- **Index**: Filter bar on right with dropdown + dark "Filter" button. "Clear" link when filter is active. Same table style as dashboard/drivers. Each row has an amber "View" link.
- **Show page**: Back link at top. Status badge + large price on same line. Two-column card grid for client/driver info. Full-width cards for order details and timeline. Definition list layout with gray labels on left, values on right.
- **Empty/null handling**: Show em-dash for missing driver (unassigned orders), missing addresses, or null timestamps.

### PHPUnit Tests

**File**: `tests/Feature/Admin/OrderListTest.php`
Create via: `php artisan make:test Admin/OrderListTest --phpunit --no-interaction`

```
testOrderIndexPageListsOrders(): void
    - Create admin + 5 orders
    - actingAs(admin), GET /admin/orders → 200
    - assertSee order IDs (e.g. '#1')

testOrderIndexFiltersByStatus(): void
    - Create admin + 2 completed orders + 1 searching order
    - GET /admin/orders?status=completed → 200
    - assertSee completed order IDs
    - assertDontSee searching order client name (or check count)

testOrderIndexShowsAllWhenNoFilter(): void
    - Create admin + orders with various statuses
    - GET /admin/orders → 200
    - Assert all order IDs visible

testOrderShowPageDisplaysDetails(): void
    - Create admin + order with client, driver, driverProfile
    - actingAs(admin), GET /admin/orders/{order} → 200
    - assertSee client name
    - assertSee driver name
    - assertSee order price
    - assertSee 'Pickup Address' (or actual address value)

testOrderShowPageHandlesNoDriver(): void
    - Create order with driver_id = null
    - actingAs(admin), GET /admin/orders/{order} → 200
    - assertSee '—' (em-dash for missing driver)

testOrderIndexPaginates(): void
    - Create 25 orders
    - actingAs(admin), GET /admin/orders → 200
    - Assert only 20 visible (first page)

testNonAdminCannotAccessOrders(): void
    - actingAs(client), GET /admin/orders → 403 or redirect
```

### Browser Tests

```
testOrderIndexWithFilterFlow(): void
    - actingAs admin, create orders with different statuses
    - GET /admin/orders → 200, see all orders
    - GET /admin/orders?status=completed → see only completed
    - assertSee 'Clear'

testOrderShowPageLayout(): void
    - actingAs admin, create full order with client + driver
    - GET /admin/orders/{id} → 200
    - assertSee 'Client'
    - assertSee 'Driver'
    - assertSee 'Timeline'
    - assertSee 'Back to Orders'
```

### Files Created/Modified

| Action | Path |
|--------|------|
| Create | `app/Http/Controllers/Admin/OrderController.php` |
| Create | `resources/views/admin/orders/index.blade.php` |
| Create | `resources/views/admin/orders/show.blade.php` |
| Modify | `routes/web.php` (add order routes) |
| Create | `tests/Feature/Admin/OrderListTest.php` |

---

## Full File Inventory (Phase 7)

| Action | Path |
|--------|------|
| Create | `app/Http/Controllers/Admin/AuthController.php` |
| Create | `app/Http/Controllers/Admin/DashboardController.php` |
| Create | `app/Http/Controllers/Admin/DriverController.php` |
| Create | `app/Http/Controllers/Admin/OrderController.php` |
| Create | `resources/views/layouts/admin.blade.php` |
| Create | `resources/views/admin/auth/login.blade.php` |
| Create | `resources/views/admin/dashboard.blade.php` |
| Create | `resources/views/admin/partials/order-status-badge.blade.php` |
| Create | `resources/views/admin/drivers/index.blade.php` |
| Create | `resources/views/admin/drivers/create.blade.php` |
| Create | `resources/views/admin/drivers/edit.blade.php` |
| Create | `resources/views/admin/orders/index.blade.php` |
| Create | `resources/views/admin/orders/show.blade.php` |
| Modify | `routes/web.php` |
| Modify | `app/Http/Middleware/EnsureUserRole.php` (if needed) |
| Create | `tests/Feature/Admin/AuthTest.php` |
| Create | `tests/Feature/Admin/AuthBrowserTest.php` |
| Create | `tests/Feature/Admin/DashboardTest.php` |
| Create | `tests/Feature/Admin/DriverManagementTest.php` |
| Create | `tests/Feature/Admin/OrderListTest.php` |

## Execution Order

Execute sub-tasks sequentially: 7.1 → 7.2 → 7.3 → 7.4. Each builds on the layout and auth from 7.1.

## Post-Phase Checklist

- [ ] All admin routes require authentication + admin role
- [ ] Login/logout flow works end-to-end
- [ ] Dashboard stats are accurate
- [ ] Driver CRUD creates User + DriverProfile in a transaction
- [ ] Cannot delete driver with active orders
- [ ] Order list filters by status correctly
- [ ] Order show displays all fields with null safety
- [ ] Status badges use consistent colors across all views
- [ ] All PHPUnit tests pass: `php artisan test --compact tests/Feature/Admin/`
- [ ] Pint formatting applied: `vendor/bin/pint --dirty --format agent`
- [ ] Pages render correctly (run `npm run build` if Vite errors)
