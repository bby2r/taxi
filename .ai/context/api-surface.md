# API Surface

## Overview
Versioned REST API at `/api/v1` for mobile clients + session-based admin web panel. Sanctum token auth (30-day expiry, single-device model).

## Global API Middleware
- `HandleCors` — all origins allowed (mobile-only API)
- `LogApiTraffic` — logs full request/response to `api_request`/`api_response` channels (14-day retention)

## Auth Endpoints (`/api/v1/auth`)

| Endpoint | Method | Auth | Rate Limit | Notes |
|---|---|---|---|---|
| `send-otp` | POST | None | 5/min | Phone must be +996... |
| `verify-otp` | POST | None | 10/min | Creates user on first verify; revokes all tokens |
| `driver-login` | POST | None | 10/min | Phone+password; checks role=driver |
| `logout` | POST | Sanctum | — | Deletes current token |
| `me` | GET | Sanctum | — | Returns user info |
| `push-token` | PUT | Sanctum | — | Sets Expo push token |

## Client Endpoints (`/api/v1/client`, role:client)

| Endpoint | Method | Notes |
|---|---|---|
| `orders` | GET | Paginated (20), own orders via OrderResource |
| `orders` | POST | Create order (pickup required, dropoff optional) |
| `orders/active` | GET | Single active order or 404 |
| `orders/{order}` | GET | Manual ownership check (no Policy) |
| `orders/{order}/cancel` | POST | Delegates to OrderService |
| `profile` | PUT | Update name only |

## Driver Endpoints (`/api/v1/driver`, role:driver)

| Endpoint | Method | Notes |
|---|---|---|
| `go-online` | POST | Requires lat/lng. 423 if blocked_until is in the future. Resets shift_declines_count. |
| `go-offline` | POST | Sets is_online=false |
| `location` | POST | Update coordinates (no rate limit) |
| `profile` | GET | Returns UserResource with driver_profile (includes status, blocked_until, shift_declines_count) |
| `stats` | GET | Today/week/month/total orders+earnings |
| `orders` | GET | Paginated (20) |
| `orders/active` | GET | Active order or 404 |
| `orders/{order}/accept` | POST | OrderService validates offered_driver_id |
| `orders/{order}/decline` | POST | Requires `reason` (too_far / wrong_district / client_no_answer / personal). Logs decline, increments shift counter, triggers next offer. |
| `orders/{order}/arrived` | POST | — |
| `orders/{order}/start` | POST | — |
| `orders/{order}/complete` | POST | — |
| `orders/{order}/cancel` | POST | Driver-initiated cancel. Requires `reason` from `DriverCancellationReason` (`client_no_show` / `client_no_answer` / `long_wait`). Only valid in Accepted or Arrived. No fee, no shift penalty. |

## Admin Web Panel (`/admin`)

Session-based auth (phone+password, role:admin).
- Dashboard: 4 KPIs (active orders, online drivers, today revenue, total rides) + recent orders
- Drivers: full CRUD (index, create, store, edit, update, destroy)
- Orders: index (with status filter) + show (detail with timeline)

## Broadcasting Channels
- `private-client.{userId}` — authorized if user owns the ID
- `private-driver.{userId}` — authorized if user owns the ID AND is a driver

## API Resources
- **OrderResource:** full order with conditional driver info (id, name, phone, car_model, car_number). Includes `is_inter_district` (bool) and a `region` block `{id, name}` when `region_id` is set.
- **UserResource:** user with conditional driver_profile (car_model, car_number, is_online, computed `status`, `blocked_until`, `shift_declines_count`)
- **DriverProfileResource:** defined but not used in routes (potential dead code)
