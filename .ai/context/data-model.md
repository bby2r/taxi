# Data Model

## Entity Relationship Graph
```
User (role: client|driver|admin)
  |-- 1:1 --> DriverProfile (only if role=driver)
  |-- 1:N --> Order (as client_id) [cascade delete]
  |-- 1:N --> Order (as driver_id) [null on delete]
  |-- 1:N --> Order (as offered_driver_id) [null on delete]
  |-- 1:N --> DriverChangeRequest (as requester) [cascade delete]
  |-- 1:N --> DriverChangeRequest (as reviewer) [null on delete]

OtpCode (standalone, linked by phone string, not FK)
```

## User
Single table for all roles (client, driver, admin). Phone-first auth — email/password are nullable.
- `phone` is the primary identifier (unique, +996 Kyrgyz format)
- `expo_push_token` for mobile push notifications
- Scopes: `drivers()`, `clients()`
- Methods: `isDriver()`, `isClient()`, `isAdmin()`
- Cast: `role` -> `UserRole` enum

**Why single table:** Simple RBAC — role field distinguishes behavior, middleware enforces access.
**Driver creation:** Admin-only — confirmed permanent. No self-registration planned.

## DriverProfile
1:1 with User (unique `user_id`, cascade delete). Contains car info and real-time location.
- `car_model`, `car_number` — car_number has no unique constraint (intentional — shared vehicles possible in village context)
- `is_online`, `latitude`, `longitude`, `location_updated_at` — real-time driver state
- `shift_declines_count` — non-timeout declines in current shift; reset on go-online
- `blocked_until` — nullable timestamp; driver cannot receive offers or go-online while in future
- Composite index on `(is_online, latitude, longitude)` — core dispatch query
- Coordinates: 7 decimal places (~1cm precision), Bishkek region (lat 42-43, lon 74-75)
- Scopes: `online()`, `withCoordinates()`, `notBlocked()`, `withoutActiveOrder()`
- `computedStatus()` derives: offline | blocked | free | en_route | arrived | in_ride

## Order
Core business entity. Tracks the full ride lifecycle.
- **Status workflow:** Searching -> Accepted -> Arrived -> InProgress -> Completed (or Cancelled)
- **Pricing:** `price` as unsignedInteger (KGS som, no fractional currency). Locked at creation time.
- **Pickup:** required (lat/lng + optional address)
- **Dropoff:** optional for in-village orders (destination discussed verbally); used for inter-district orders where the driver needs to see the destination district/address up front
- **Driver dispatch:** Sequential offer pattern via `offered_driver_id`, `offered_at`, `declined_drivers` (JSON array of IDs for quick exclusion)
- **Cancellation:** `cancelled_by` (string: client/driver/system), `cancellation_fee` (integer)
- Scopes: `active()`, `forClient()`, `forDriver()`
- Methods: `isActive()`, `isCancellable()`, `getDeclinedDriverIds()`

**Why no distance-based pricing:** Village context — all destinations are approximately the same distance.
**Why dropoff optional:** Pickup-only model. Destination negotiated verbally with driver.

## OrderDecline
Append-only log of driver decline events. One row per decline.
- `order_id`, `driver_id` — both cascade-delete
- `reason` — string matching `App\Enums\DeclineReason` (`too_far`, `wrong_district`, `client_no_answer`, `personal`, `timeout`)
- `created_at` only (no updated_at — immutable)
- Indexes on `driver_id` and `order_id` for admin analytics

**Why separate table:** `orders.declined_drivers` stays a simple ID array for fast dispatch exclusion; decline reasons live here to avoid bloating the hot path and to allow per-driver reporting.

## OtpCode
Phone verification codes. Not linked to User by FK (supports registration where user doesn't exist yet).
- 4-digit code, 5-minute TTL
- Composite index on `(phone, code)` for verification lookup
- Old codes accumulate — no cleanup mechanism yet (needs scheduled purge task)

## DriverChangeRequest
Admin-approval workflow for driver profile changes. Feature is complete and done.
- Tracks: `field` (string), `old_value`, `new_value`, `status` (Pending/Approved/Rejected)
- `reviewed_by` (admin FK), `reviewed_at`, `admin_comment`
- Composite index on `(user_id, field, status)`

## Infrastructure Tables
- `personal_access_tokens` — Sanctum (30-day expiry)
- `cache`, `sessions` — database-backed
- `jobs`, `job_batches`, `failed_jobs` — database queue
- `password_reset_tokens` — unused (OTP-based auth)
