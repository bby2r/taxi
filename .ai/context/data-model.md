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
- Composite index on `(is_online, latitude, longitude)` — core dispatch query
- Coordinates: 7 decimal places (~1cm precision), Bishkek region (lat 42-43, lon 74-75)
- Scopes: `online()`, `withCoordinates()`

## Order
Core business entity. Tracks the full ride lifecycle.
- **Status workflow:** Searching -> Accepted -> Arrived -> InProgress -> Completed (or Cancelled)
- **Pricing:** `price` as unsignedInteger (KGS som, no fractional currency). Locked at creation time.
- **Pickup:** required (lat/lng + optional address)
- **Dropoff:** entirely optional — village model where destination is discussed verbally
- **Driver dispatch:** Sequential offer pattern via `offered_driver_id`, `offered_at`, `declined_drivers` (JSON array)
- **Cancellation:** `cancelled_by` (string: client/driver/system), `cancellation_fee` (integer)
- Scopes: `active()`, `forClient()`, `forDriver()`
- Methods: `isActive()`, `isCancellable()`, `getDeclinedDriverIds()`

**Why no distance-based pricing:** Village context — all destinations are approximately the same distance.
**Why dropoff optional:** Pickup-only model. Destination negotiated verbally with driver.

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
