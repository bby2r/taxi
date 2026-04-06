# Plan Memory: Village Taxi Service

Last updated: 2026-04-07 (after Phase 1)

## Established Patterns
- Models use `#[Fillable]` and `#[Hidden]` PHP 8.4 attribute syntax (not `$fillable` property)
- Casts defined via `protected function casts(): array` method
- Relations use PHPDoc generics: `/** @return BelongsTo<User, $this> */`
- Factories use `fake()` convention, not `$this->faker`
- Scopes return `Builder` type: `public function scopeX(Builder $query): Builder`
- Pint auto-formats method names to snake_case in test files

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6) — set in config/app.php
- OrderStatus has 6 cases: Searching, Accepted, Arrived, InProgress, Completed, Cancelled
- Order has dropoff fields (nullable) for future flexibility
- cancelled_by is string ('client'/'driver'/'system'), not FK
- OTP code is 4-digit string (preserves leading zeros like "0042")
- User email and password are nullable (clients use phone OTP)

## Naming Conventions
- Enums: TitleCase keys, string-backed (e.g., `InProgress = 'in_progress'`)
- Models: singular (Order, DriverProfile, OtpCode)
- Factories: `online()`, `atLocation()`, `accepted()`, `expired()` — descriptive state names
- Tests: `test_descriptive_name` snake_case (Pint enforced)

## Current Architecture State
- 4 models: User (modified), DriverProfile, Order, OtpCode
- 2 enums: UserRole, OrderStatus
- 3 migrations + 1 user update migration
- 48 tests passing, 99 assertions
- No controllers, routes, services, or middleware yet

## Gotchas & Warnings
- SQLite ignores `after()` column positioning — non-issue functionally
- DriverProfile.user_id has unique constraint — one profile per driver
- Order.declined_drivers is JSON column, cast to array — default null not []
