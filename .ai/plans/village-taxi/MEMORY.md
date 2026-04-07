# Plan Memory: Village Taxi Service

Last updated: 2026-04-07 (after Phase 2)

## Established Patterns
- Models use `#[Fillable]` and `#[Hidden]` PHP 8.4 attribute syntax (not `$fillable` property)
- Casts defined via `protected function casts(): array` method
- Relations use PHPDoc generics: `/** @return BelongsTo<User, $this> */`
- Factories use `fake()` convention, not `$this->faker`
- Scopes return `Builder` type: `public function scopeX(Builder $query): Builder`
- Pint auto-formats method names to snake_case in test files
- Controllers use constructor injection: `public function __construct(private readonly SomeService $service) {}`
- Form requests live in `app/Http/Requests/Auth/` for auth-related validation
- API controllers namespaced under `App\Http\Controllers\Api\V1\`
- Routes use `Route::prefix('v1')` grouping with named routes `api.v1.*`
- Artisan commands use Laravel 13 PHP attribute syntax (#[Signature], #[Description])

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6) — set in config/app.php
- OrderStatus has 6 cases: Searching, Accepted, Arrived, InProgress, Completed, Cancelled
- Order has dropoff fields (nullable) for future flexibility
- cancelled_by is string ('client'/'driver'/'system'), not FK
- OTP code is 4-digit string (preserves leading zeros like "0042")
- User email and password are nullable (clients use phone OTP)
- Sanctum tokens expire after 30 days, all existing tokens revoked on new login
- Phone validation: Kyrgyz format regex `/^\+996[0-9]{9}$/`
- Expo push token regex: `/^ExponentPushToken\[.+\]$/`
- Driver login: phone+password (admin-created accounts, no self-registration)
- Client login: phone+OTP (no password)
- NikitaSmsService registered as singleton, logs when disabled (dev mode)

## Naming Conventions
- Enums: TitleCase keys, string-backed (e.g., `InProgress = 'in_progress'`)
- Models: singular (Order, DriverProfile, OtpCode)
- Factories: `online()`, `atLocation()`, `accepted()`, `expired()` — descriptive state names
- Tests: `test_descriptive_name` snake_case (Pint enforced)
- Routes: `api.v1.auth.send-otp` pattern (kebab-case paths, dot-separated names)

## Current Architecture State
- 4 models: User (modified), DriverProfile, Order, OtpCode
- 2 enums: UserRole, OrderStatus
- 2 services: NikitaSmsService (SMS), OtpService (OTP generation/verification)
- 1 controller: AuthController (5 methods: sendOtp, verifyOtp, driverLogin, logout, me, updatePushToken)
- 4 form requests: SendOtpRequest, VerifyOtpRequest, DriverLoginRequest, UpdatePushTokenRequest
- 1 artisan command: MakeAdminCommand (make:admin)
- 6 API routes under /api/v1/auth/
- 92 tests passing

## Gotchas & Warnings
- SQLite ignores `after()` column positioning — non-issue functionally
- DriverProfile.user_id has unique constraint — one profile per driver
- Order.declined_drivers is JSON column, cast to array — default null not []
- verifyOtp returns `$user->role` (enum auto-serialized) while driverLogin returns `$user->role->value` — minor inconsistency
- OtpCodeFactory generates codes 1000-9999 only (no leading zeros), but OtpService uses str_pad for full 0000-9999 range
