# Review: Step 7.4 — Admin Order List

**Verdict: PASS**

## Checklist

| # | Item | Status |
|---|------|--------|
| 1 | OrderController index: filter by status, paginate 20, withQueryString | PASS |
| 2 | OrderController show: loads client, driver.driverProfile | PASS |
| 3 | Index view: filter bar with select + submit + clear link | PASS |
| 4 | Index view: table with ID/Date/Client/Driver/Status/Price/View columns | PASS |
| 5 | Index view: pagination links rendered | PASS |
| 6 | Show view: back link, status+price header | PASS |
| 7 | Show view: client and driver cards with null-safe access | PASS |
| 8 | Show view: order details (addresses, coordinates) | PASS |
| 9 | Show view: timeline with null-safe timestamp formatting | PASS |
| 10 | Routes: resource orders only index+show | PASS |
| 11 | Tests: 7 tests, 28 assertions, all passing | PASS |
| 12 | Pint: no formatting issues | PASS |

## Analysis

### Controller
- `index()` correctly uses `OrderStatus::tryFrom()` to safely parse the filter value, ignoring invalid statuses. Eager-loads client and driver. Paginates at 20 with `withQueryString()` to preserve filters across pages.
- `show()` eager-loads `client` and `driver.driverProfile` as specified.

### Views
- Index view uses null-safe operator (`?->`) for client and driver names, falling back to em-dash.
- Show view handles null driver throughout: name, phone, driverProfile car_model, car_number all use `?->` chaining with em-dash fallback.
- Timeline handles null timestamps correctly with `?->format()` and em-dash fallback for all 7 timestamp fields.
- Status badge partial uses a `match` expression for color coding all OrderStatus cases.

### Routes
- `Route::resource('orders', OrderController::class)->only(['index', 'show'])` correctly limits to the two required actions.

### Tests
- Covers: listing, status filtering, no-filter showing all, show page with full details, null driver handling, pagination at 20, non-admin access denial. Good coverage of happy paths and edge cases.
