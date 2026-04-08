---
phase: 3
title: "Admin Panel — Driver Tickets, Landing Page & Redirects"
status: pending
depends_on: [1, 2]
sub_tasks: 4
---

# Phase 3: Admin Panel — Driver Tickets, Landing Page & Redirects

## Goal

Extend the admin panel with a complete driver change request management interface ("tickets"), add a public landing page for unauthenticated visitors at `/`, and implement redirect logic so authenticated admins are sent straight to the dashboard. This phase wires up the `DriverChangeRequest` model (from Phase 1) to the admin UI, following the existing patterns established by `OrderController` and the orders Blade views.

---

## Sub-task 3.1: Driver Tickets Controller & Routes

### Goal

Create the `Admin\DriverTicketController` to list, view, approve, and reject driver change requests. Add routes under the existing `admin` prefix with `auth` + `EnsureUserRole:admin` middleware. Create a `RejectDriverTicketRequest` form request for the reject action.

### Implementation

#### 1. Routes

Add to `routes/web.php` inside the existing `Route::middleware(['auth', EnsureUserRole::class.':admin'])` group:

```php
use App\Http\Controllers\Admin\DriverTicketController;

Route::resource('tickets', DriverTicketController::class)->only(['index', 'show']);
Route::post('tickets/{ticket}/approve', [DriverTicketController::class, 'approve'])->name('tickets.approve');
Route::post('tickets/{ticket}/reject', [DriverTicketController::class, 'reject'])->name('tickets.reject');
```

This produces named routes: `admin.tickets.index`, `admin.tickets.show`, `admin.tickets.approve`, `admin.tickets.reject`.

Route model binding: the `{ticket}` parameter must be explicitly bound to `DriverChangeRequest`. Add this in `AppServiceProvider::boot()`:
```php
use App\Models\DriverChangeRequest;
Route::model('ticket', DriverChangeRequest::class);
```

#### 2. Controller

Create via: `php artisan make:controller Admin/DriverTicketController --no-interaction`

**File**: `app/Http/Controllers/Admin/DriverTicketController.php`

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Enums\DriverChangeRequestStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RejectDriverTicketRequest;
use App\Models\DriverChangeRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class DriverTicketController extends Controller
{
    /**
     * Display a listing of driver change requests with optional status filter.
     */
    public function index(Request $request): View
    {
        $query = DriverChangeRequest::with('user')->latest();

        if ($request->filled('status')) {
            $status = DriverChangeRequestStatus::tryFrom($request->status);

            if ($status) {
                $query->where('status', $status);
            }
        }

        $tickets = $query->paginate(20)->withQueryString();
        $statuses = DriverChangeRequestStatus::cases();

        return view('admin.tickets.index', compact('tickets', 'statuses'));
    }

    /**
     * Display the specified driver change request.
     */
    public function show(DriverChangeRequest $ticket): View
    {
        $ticket->load(['user.driverProfile', 'reviewer']);

        return view('admin.tickets.show', compact('ticket'));
    }

    /**
     * Approve a pending driver change request.
     */
    public function approve(DriverChangeRequest $ticket): RedirectResponse
    {
        abort_unless($ticket->status === DriverChangeRequestStatus::Pending, 409, 'Ticket already reviewed.');

        DB::transaction(function () use ($ticket) {
            // Apply the change to the actual user/profile field
            $field = $ticket->field;
            $driver = $ticket->user;

            if (in_array($field, ['car_model', 'car_number'])) {
                $driver->driverProfile()->update([$field => $ticket->new_value]);
            } elseif ($field === 'name') {
                $driver->update([$field => $ticket->new_value]);
            }

            // Mark ticket as approved
            $ticket->update([
                'status' => DriverChangeRequestStatus::Approved,
                'reviewed_at' => now(),
                'reviewed_by' => auth()->id(),
            ]);
        });

        return redirect()->route('admin.tickets.show', $ticket)
            ->with('success', 'Change request approved and applied.');
    }

    /**
     * Reject a pending driver change request.
     */
    public function reject(RejectDriverTicketRequest $request, DriverChangeRequest $ticket): RedirectResponse
    {
        abort_unless($ticket->status === DriverChangeRequestStatus::Pending, 409, 'Ticket already reviewed.');

        $ticket->update([
            'status' => DriverChangeRequestStatus::Rejected,
            'admin_comment' => $request->validated('admin_comment'),
            'reviewed_at' => now(),
            'reviewed_by' => auth()->id(),
        ]);

        return redirect()->route('admin.tickets.show', $ticket)
            ->with('success', 'Change request rejected.');
    }
}
```

Key design decisions:
- Follows `OrderController` pattern: filter via query string, eager-load relations, paginate with `withQueryString()`
- `approve()` wraps field update + ticket status change in a DB transaction for atomicity
- Field application logic handles three known fields: `name` (on `User`), `car_model` and `car_number` (on `DriverProfile`)
- Uses `abort_unless` with 409 Conflict for already-reviewed tickets (prevents double-approve)
- Redirects back to show page after action (admin can see the updated status)

#### 3. Form Request

Create via: `php artisan make:request Admin/RejectDriverTicketRequest --no-interaction`

**File**: `app/Http/Requests/Admin/RejectDriverTicketRequest.php`

```php
<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class RejectDriverTicketRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by route middleware (EnsureUserRole:admin)
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'admin_comment' => ['nullable', 'string', 'max:500'],
        ];
    }
}
```

### Artifacts

- `routes/web.php` (modify -- add ticket routes inside admin auth group)
- `app/Http/Controllers/Admin/DriverTicketController.php` (create)
- `app/Http/Requests/Admin/RejectDriverTicketRequest.php` (create)

### Test Spec

**File**: `tests/Feature/Admin/DriverTicketControllerTest.php`

Create via: `php artisan make:test --phpunit Admin/DriverTicketControllerTest`

All tests should use `RefreshDatabase` and set up an admin user via `User::factory()->admin()->create()`, then `actingAs($admin)`.

| Test Method | What It Verifies |
|---|---|
| `test_index_displays_tickets` | Create 3 tickets, GET `admin.tickets.index`, assert 200, assert all 3 ticket fields visible in response |
| `test_index_filters_by_pending_status` | Create 2 pending + 1 approved, GET with `?status=pending`, assert only pending tickets visible |
| `test_index_filters_by_approved_status` | Create 1 pending + 1 approved, GET with `?status=approved`, assert only approved visible |
| `test_index_filters_by_rejected_status` | Create 1 pending + 1 rejected, GET with `?status=rejected`, assert only rejected visible |
| `test_index_shows_all_when_no_filter` | Create mixed tickets, GET without filter, assert all visible |
| `test_show_displays_ticket_details` | Create ticket, GET `admin.tickets.show`, assert 200, assert driver name, field, old/new values visible |
| `test_approve_updates_user_name` | Create pending ticket for `name` field with `new_value='New Name'`, POST approve, assert user's name changed to 'New Name', ticket status is Approved, `reviewed_at` is not null, `reviewed_by` is admin id |
| `test_approve_updates_driver_profile_car_model` | Create pending ticket for `car_model` field, POST approve, assert driver profile's car_model updated |
| `test_approve_updates_driver_profile_car_number` | Create pending ticket for `car_number` field, POST approve, assert driver profile's car_number updated |
| `test_approve_redirects_to_show_with_success` | POST approve, assert redirect to show route, assert session has 'success' |
| `test_cannot_approve_already_approved_ticket` | Create approved ticket, POST approve, assert 409 status |
| `test_cannot_approve_already_rejected_ticket` | Create rejected ticket, POST approve, assert 409 status |
| `test_reject_sets_status_and_comment` | Create pending ticket, POST reject with admin_comment='Invalid', assert ticket status is Rejected, admin_comment matches, reviewed_at set, reviewed_by is admin |
| `test_reject_without_comment` | POST reject without admin_comment, assert ticket rejected, admin_comment is null |
| `test_reject_comment_max_500_chars` | POST reject with 501-char comment, assert validation error on admin_comment |
| `test_cannot_reject_already_reviewed_ticket` | Create approved ticket, POST reject, assert 409 |
| `test_unauthenticated_user_redirected_from_tickets` | Logout, GET tickets index, assert redirect to login |
| `test_non_admin_user_cannot_access_tickets` | Login as driver, GET tickets index, assert redirect to admin login |

---

## Sub-task 3.2: Driver Tickets Blade Views

### Goal

Create the index and show Blade views for driver tickets, add a ticket status badge partial, and add a "Tickets" link to the admin sidebar navigation.

### Implementation

#### 1. Ticket Status Badge Partial

**File**: `resources/views/admin/partials/ticket-status-badge.blade.php`

Follow the exact pattern of `order-status-badge.blade.php`:

```blade
@php
$colors = match($status) {
    App\Enums\DriverChangeRequestStatus::Pending  => 'bg-yellow-100 text-yellow-700',
    App\Enums\DriverChangeRequestStatus::Approved  => 'bg-emerald-100 text-emerald-700',
    App\Enums\DriverChangeRequestStatus::Rejected  => 'bg-red-100 text-red-700',
    default                                        => 'bg-gray-100 text-gray-700',
};
@endphp
<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {{ $colors }}">
    {{ $status->value }}
</span>
```

- Pending = yellow (matches OrderStatus::Searching color)
- Approved = emerald/green (matches OrderStatus::Completed color)
- Rejected = red (matches OrderStatus::Cancelled color)

#### 2. Index View

**File**: `resources/views/admin/tickets/index.blade.php`

Extends `layouts.admin`. Follow the exact structure of `admin/orders/index.blade.php`:

```blade
@extends('layouts.admin')

@section('title', 'Driver Tickets')
@section('heading', 'Driver Tickets')

@section('content')
    {{-- Filter Bar --}}
    <div class="mb-6 flex items-center justify-between">
        <p class="text-sm text-gray-600">Total: {{ $tickets->total() }} tickets</p>

        <form method="GET" action="{{ route('admin.tickets.index') }}" class="flex items-center gap-2">
            <select name="status" class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="">All Statuses</option>
                @foreach ($statuses as $status)
                    <option value="{{ $status->value }}" @selected(request('status') === $status->value)>
                        {{ ucfirst($status->value) }}
                    </option>
                @endforeach
            </select>

            <button type="submit" class="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600">Filter</button>

            @if (request('status'))
                <a href="{{ route('admin.tickets.index') }}" class="text-sm font-medium text-gray-500 hover:text-gray-700">Clear</a>
            @endif
        </form>
    </div>

    {{-- Table --}}
    <!-- Table with columns: ID, Driver, Field, Old Value, New Value, Status, Date, Action (View link) -->
    <!-- Each row shows ticket data with ticket-status-badge partial -->
    <!-- Empty state: "No tickets found." -->

    {{-- Pagination --}}
    <div class="mt-4">{{ $tickets->links() }}</div>
@endsection
```

Table columns: ID, Driver (user->name), Field, Old Value, New Value, Status (badge), Date (created_at formatted), Action ("View" link to show route).

Follow the exact table markup pattern from `admin/orders/index.blade.php` (same CSS classes, same structure).

#### 3. Show View

**File**: `resources/views/admin/tickets/show.blade.php`

Extends `layouts.admin`. Follow the card-based layout pattern from `admin/orders/show.blade.php`:

```blade
@extends('layouts.admin')

@section('title', 'Ticket #' . $ticket->id)
@section('heading', 'Ticket #' . $ticket->id)

@section('content')
    {{-- Back Link --}}
    <div class="mb-6">
        <a href="{{ route('admin.tickets.index') }}" class="text-sm font-medium text-gray-500 hover:text-gray-700">
            &larr; Back to Tickets
        </a>
    </div>

    {{-- Status Badge --}}
    <div class="mb-6">
        @include('admin.partials.ticket-status-badge', ['status' => $ticket->status])
    </div>

    {{-- Driver Info Card --}}
    <!-- Card showing driver name, phone, car info (from user.driverProfile) -->

    {{-- Change Details Card --}}
    <!-- Card showing: Field, Old Value, New Value, Submitted date -->
    <!-- Old value displayed in red/strikethrough, new value in green for visual comparison -->

    {{-- Reviewer Info Card (only if reviewed) --}}
    <!-- If ticket is reviewed: show reviewer name, reviewed_at, admin_comment (if any) -->

    {{-- Action Buttons (only if Pending) --}}
    @if ($ticket->status === App\Enums\DriverChangeRequestStatus::Pending)
        <div class="mt-6 flex items-center gap-4">
            {{-- Approve Button --}}
            <form method="POST" action="{{ route('admin.tickets.approve', $ticket) }}">
                @csrf
                <button type="submit" class="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-600">
                    Approve
                </button>
            </form>

            {{-- Reject Form --}}
            <form method="POST" action="{{ route('admin.tickets.reject', $ticket) }}" class="flex items-center gap-2">
                @csrf
                <textarea
                    name="admin_comment"
                    rows="1"
                    placeholder="Rejection reason (optional)"
                    class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    maxlength="500"
                ></textarea>
                <button type="submit" class="inline-flex items-center rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600">
                    Reject
                </button>
            </form>
        </div>
    @endif
@endsection
```

Design decisions:
- Action buttons only visible when ticket is Pending (no approve/reject for already-reviewed tickets)
- Reject form includes inline textarea for optional comment
- Old/new value comparison uses color coding for visual clarity
- Card structure matches orders/show.blade.php (same CSS classes, same spacing)

#### 4. Admin Sidebar — Add Tickets Link

**File**: `resources/views/layouts/admin.blade.php`

Add a new `<a>` element in the `<nav>` section, after the Orders link and before the closing `</nav>`. Follow the exact pattern of existing sidebar links:

```blade
<a
    href="{{ route('admin.tickets.index') }}"
    class="{{ request()->routeIs('admin.tickets.*') ? 'bg-gray-900 text-amber-400' : 'text-gray-300 hover:bg-gray-700' }} flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
>
    {{-- Heroicon: ticket (outline) --}}
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
    Tickets
</a>
```

Uses the Heroicon "ticket" outline icon. Active state highlights with `bg-gray-900 text-amber-400` (same as other links).

### Artifacts

- `resources/views/admin/partials/ticket-status-badge.blade.php` (create)
- `resources/views/admin/tickets/index.blade.php` (create)
- `resources/views/admin/tickets/show.blade.php` (create)
- `resources/views/layouts/admin.blade.php` (modify -- add Tickets nav link)

### Test Spec

**File**: tests are shared with Sub-task 3.1 in `tests/Feature/Admin/DriverTicketControllerTest.php`.

Additional view-specific assertions to include in existing test methods:

| Test Method | Additional Assertions |
|---|---|
| `test_index_displays_tickets` | Assert response `assertSee('Driver Tickets')`, assert response contains driver name text, assert response contains status badge text |
| `test_show_displays_ticket_details` | Assert response `assertSee('Back to Tickets')`, assert old_value and new_value are visible, assert approve/reject buttons visible for pending ticket |
| `test_show_hides_actions_for_reviewed_ticket` | Create approved ticket, GET show, assert response `assertDontSee('Approve')` button text, `assertDontSee('Reject')` button text |
| `test_sidebar_shows_tickets_link` | GET any admin page (e.g. dashboard), assert response contains `route('admin.tickets.index')` URL |

---

## Sub-task 3.3: Landing Page

### Goal

Replace the current default welcome page at `/` with a simple, clean landing page for the taxi app. The page uses its own standalone layout (not the admin layout), is styled with TailwindCSS 4, and includes a subtle footer link to the admin login.

### Implementation

#### 1. Landing Blade View

**File**: `resources/views/landing.blade.php`

This is a self-contained page with its own `<!DOCTYPE html>` (not using `layouts.admin`). It uses `@vite` to load the same CSS/JS bundle.

```blade
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Village Taxi</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="flex min-h-screen flex-col bg-gray-50">
    {{-- Header --}}
    <header class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-6">
            <span class="text-2xl font-bold text-amber-500">Village Taxi</span>
        </div>
    </header>

    {{-- Hero Section --}}
    <main class="flex flex-1 items-center justify-center px-6">
        <div class="mx-auto max-w-2xl text-center">
            <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Your Village Taxi Service
            </h1>
            <p class="mt-6 text-lg leading-8 text-gray-600">
                Fast, reliable rides across the village. Open the mobile app to book your next trip.
            </p>
        </div>
    </main>

    {{-- Footer --}}
    <footer class="border-t border-gray-200 bg-white">
        <div class="mx-auto max-w-4xl px-6 py-4 text-center">
            <p class="text-xs text-gray-400">
                &copy; {{ date('Y') }} Village Taxi &middot;
                <a href="{{ route('admin.login') }}" class="text-gray-400 hover:text-gray-500">Admin</a>
            </p>
        </div>
    </footer>
</body>
</html>
```

Design decisions:
- Standalone HTML document -- does NOT extend admin layout
- Uses `@vite` to load TailwindCSS 4 from the same bundle
- Title matches the admin panel name "Village Taxi"
- Hero section is centered vertically (flex-1 with items-center)
- Footer link to admin login is intentionally subtle: `text-xs text-gray-400` (tiny, gray, blends with copyright)
- Mobile responsive: uses `sm:text-5xl` breakpoint for hero heading
- Clean and minimal -- no images, no complex components

#### 2. Route Update

**File**: `routes/web.php`

Replace the existing root route:

```php
// Before:
Route::get('/', function () {
    return view('welcome');
});

// After:
Route::get('/', function () {
    return view('landing');
})->name('home');
```

The redirect logic for authenticated admins is handled in Sub-task 3.4.

### Artifacts

- `resources/views/landing.blade.php` (create)
- `routes/web.php` (modify -- update `/` route)

### Test Spec

**File**: `tests/Feature/LandingPageTest.php`

Create via: `php artisan make:test --phpunit LandingPageTest`

| Test Method | What It Verifies |
|---|---|
| `test_landing_page_loads_for_guest` | GET `/`, assert 200, assert `assertSee('Village Taxi')` |
| `test_landing_page_contains_hero_heading` | GET `/`, assert `assertSee('Your Village Taxi Service')` |
| `test_landing_page_contains_admin_link` | GET `/`, assert response contains `route('admin.login')` URL (the `/admin/login` path) |
| `test_landing_page_admin_link_is_in_footer` | GET `/`, assert `assertSee('Admin')` within context of footer content |
| `test_landing_page_does_not_use_admin_layout` | GET `/`, assert `assertDontSee('Admin Panel')` (the admin sidebar subtitle), confirming standalone layout |

---

## Sub-task 3.4: Admin Redirect Logic

### Goal

Authenticated admins visiting `/` or `/admin/login` should be automatically redirected to `/admin/dashboard`. Non-admin authenticated users and guests should see the landing page at `/`.

### Implementation

#### 1. Root Route — Admin Redirect

**File**: `routes/web.php`

Update the `/` route to check for authenticated admin and redirect:

```php
use App\Enums\UserRole;

Route::get('/', function () {
    if (auth()->check() && auth()->user()->role === UserRole::Admin) {
        return redirect()->route('admin.dashboard');
    }

    return view('landing');
})->name('home');
```

This is a simple inline check -- no middleware needed for this single route. If the user is logged in as admin, redirect. Otherwise (guest, client, or driver), show the landing page.

#### 2. Admin Login Route — Redirect If Already Authenticated Admin

The `/admin/login` route currently uses the `guest` middleware, which redirects authenticated users. We need to verify that this redirect goes to `/admin/dashboard` specifically.

**Check the `guest` middleware configuration:**

In Laravel 13, the `guest` middleware is `RedirectIfAuthenticated`. Its default redirect is controlled by the `HOME` constant or the `RouteServiceProvider`. Since this project does not have a custom `RouteServiceProvider` (Laravel 13 removed it) or a `HOME` constant override, the default redirect for `guest` middleware goes to `/`.

This means: authenticated admin hits `/admin/login` -> `guest` middleware redirects to `/` -> the `/` route detects admin and redirects to `/admin/dashboard`. This creates a double redirect but works correctly.

**Optimization (recommended):** Override the `guest` middleware redirect to go directly to `/admin/dashboard` for admin users. In `bootstrap/app.php`, configure the redirect:

```php
use Illuminate\Http\Request;

->withMiddleware(function (Middleware $middleware) {
    $middleware->redirectGuestsTo(fn (Request $request) => route('admin.login'));
    $middleware->redirectUsersTo(fn (Request $request) => route(
        $request->user()?->role === UserRole::Admin ? 'admin.dashboard' : 'home'
    ));
})
```

The `redirectUsersTo` callback controls where the `guest` middleware (RedirectIfAuthenticated) sends authenticated users. By checking the user's role:
- Admin users -> `/admin/dashboard` (direct, no double redirect)
- Non-admin users -> `/` (landing page)

If `bootstrap/app.php` already has a `withMiddleware` call, add the `redirectUsersTo` line inside the existing callback. Do not duplicate the `withMiddleware` call.

### Artifacts

- `routes/web.php` (modify -- update `/` route with admin redirect logic)
- `bootstrap/app.php` (modify -- add `redirectUsersTo` configuration)

### Test Spec

**File**: `tests/Feature/AdminRedirectTest.php`

Create via: `php artisan make:test --phpunit AdminRedirectTest`

| Test Method | What It Verifies |
|---|---|
| `test_authenticated_admin_redirected_from_root_to_dashboard` | Login as admin, GET `/`, assert redirect to `admin.dashboard` route |
| `test_guest_sees_landing_page_at_root` | GET `/` without auth, assert 200, assert `assertSee('Village Taxi')` |
| `test_authenticated_driver_sees_landing_page` | Login as driver, GET `/`, assert 200 (not redirected), assert `assertSee('Village Taxi')` |
| `test_authenticated_client_sees_landing_page` | Login as client, GET `/`, assert 200 (not redirected), assert `assertSee('Village Taxi')` |
| `test_authenticated_admin_redirected_from_admin_login` | Login as admin, GET `/admin/login`, assert redirect (302) away from login page |
| `test_authenticated_admin_login_redirect_goes_to_dashboard` | Login as admin, GET `/admin/login`, follow redirects, assert final URL is `/admin/dashboard` |
| `test_guest_can_access_admin_login` | GET `/admin/login` without auth, assert 200, assert login form is visible |
| `test_non_admin_authenticated_user_can_access_admin_login` | Login as driver, GET `/admin/login` -- this depends on `guest` middleware behavior. If `guest` middleware redirects all authenticated users, assert redirect. If not, assert 200. Verify actual behavior and adjust test accordingly. |

---

## Checklist

- [ ] `DriverTicketController` created with `index`, `show`, `approve`, `reject` methods
- [ ] `RejectDriverTicketRequest` form request validates `admin_comment`
- [ ] Routes added: resource (index, show) + POST approve + POST reject
- [ ] Approve logic: updates actual user/profile field, sets Approved status, reviewed_at, reviewed_by
- [ ] Reject logic: sets Rejected status, admin_comment, reviewed_at, reviewed_by
- [ ] Cannot approve/reject already-reviewed tickets (409 response)
- [ ] `tickets/index.blade.php` -- table with filter, pagination, status badges
- [ ] `tickets/show.blade.php` -- detail view with approve/reject forms (only for pending)
- [ ] `ticket-status-badge.blade.php` -- Pending (yellow), Approved (green), Rejected (red)
- [ ] Admin sidebar has "Tickets" link with active state highlighting
- [ ] `landing.blade.php` -- standalone page, not admin layout, mobile responsive
- [ ] Landing page has header with app name, hero section, footer with tiny admin link
- [ ] Root route `/` redirects admin users to `/admin/dashboard`
- [ ] `/admin/login` redirects authenticated admin to `/admin/dashboard`
- [ ] Non-admin authenticated users see landing page (not redirected)
- [ ] All tests pass: `DriverTicketControllerTest`, `LandingPageTest`, `AdminRedirectTest`
- [ ] `vendor/bin/pint --dirty --format agent` runs clean
- [ ] `npm run build` succeeds (Vite manifest valid for landing page)
