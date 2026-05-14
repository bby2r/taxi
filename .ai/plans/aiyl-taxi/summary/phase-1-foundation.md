---
phase: 1
title: "Foundation — Enums, Models, Migrations, Factories"
completed: 2026-04-07
---

# Summary: Phase 1 — Foundation

## What Was Done
- 2 string-backed enums: UserRole (Client, Driver, Admin), OrderStatus (6 statuses including InProgress)
- Updated User model: role cast to enum, phone field, scopes (drivers/clients), helpers (isDriver/isClient/isAdmin), relations (driverProfile, clientOrders, driverOrders)
- DriverProfile model: car_model, car_number, is_online, lat/lng, scopeOnline, scopeWithCoordinates
- Order model: full order schema with pickup/dropoff coords, price, cascade fields (offered_driver_id, declined_drivers JSON), status timestamps, scopeActive, isActive/isCancellable helpers
- OtpCode model: phone, 4-digit code, expires_at, isExpired/isVerified/isValid helpers, scopeValid
- App timezone set to Asia/Bishkek

## Key Decisions
- Models use PHP 8.4 #[Fillable] attribute syntax (matching existing User pattern)
- Factory uses `fake()` convention (not `$this->faker`)
- OrderStatus includes InProgress (6 statuses total, not 5)
- Order has dropoff_latitude/longitude/address fields (nullable, for future use)
- OTP code stored as 4-char string (preserves leading zeros)
- cancelled_by is a string ('client'/'driver'/'system'), not a FK

## Files Created/Modified
- `app/Enums/` — 2 files
- `app/Models/` — 3 new + 1 modified (User)
- `database/migrations/` — 3 new
- `database/factories/` — 3 new + 1 modified (UserFactory)
- `config/app.php` — timezone change
- `tests/` — 5 test files

## Tests
- 48 tests, 99 assertions — all passing

## Deviations from Plan
- None significant. Backend phase writers added InProgress status and dropoff fields not in original plan, but these are harmless additions.
