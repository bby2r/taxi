---
phase: 4
title: "API Endpoints — Client API, Driver API, EnsureUserRole Middleware"
completed: 2026-04-07
---

# Summary: Phase 4 — API Endpoints

## What Was Done
- EnsureUserRole middleware: variadic role check, registered as 'role' alias
- 3 API Resources: OrderResource, UserResource, DriverProfileResource
- ClientOrderController: 5 endpoints (create, list, show, cancel, active order)
- DriverController: 11 endpoints (go-online/offline, location, accept/decline/arrive/start/complete, orders list, active, profile)
- CreateOrderRequest + UpdateLocationRequest form requests
- 22 total API routes under /api/v1/ with auth:sanctum + role middleware

## Key Decisions
- /orders/active route placed before /orders/{order} to avoid model binding conflict
- Client ownership enforced via client_id check (403 on mismatch)
- Driver profile existence checked on all driver endpoints (404 if missing)
- RuntimeException from OrderService caught and returned as 422

## Files Created/Modified
- `app/Http/Middleware/EnsureUserRole.php`
- `app/Http/Resources/V1/` — 3 resource classes
- `app/Http/Controllers/Api/V1/ClientOrderController.php`, `DriverController.php`
- `app/Http/Requests/Api/V1/` — 2 form requests
- `routes/api.php` — 16 new routes
- `tests/` — 4 test files

## Tests
- 190 tests total, all passing
- 42 new tests in Phase 4
