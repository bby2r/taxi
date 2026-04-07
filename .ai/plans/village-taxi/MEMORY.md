# Plan Memory: Village Taxi Service

Last updated: 2026-04-07 (after Phase 3)

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
- Services use constructor injection with `private readonly` properties
- All order state transitions use `DB::transaction()` + `lockForUpdate()` for concurrency safety
- Events implement `ShouldBroadcast` with `broadcastOn()`, `broadcastWith()`, `broadcastAs()`
- Broadcast channels: `private-client.{userId}`, `private-driver.{userId}`

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6) — set in config/app.php
- OrderStatus: Searching, Accepted, Arrived, InProgress, Completed, Cancelled
- cancelled_by is string ('client'/'driver'/'system'), not FK
- OTP code is 4-digit string (preserves leading zeros)
- User email and password are nullable (clients use phone OTP)
- Sanctum tokens expire after 30 days, all existing tokens revoked on new login
- Phone validation: Kyrgyz format regex `/^\+996[0-9]{9}$/`
- Expo push token regex: `/^ExponentPushToken\[.+\]$/`
- Driver login: phone+password (admin-created, no self-registration)
- Client login: phone+OTP (no password)
- Pricing: 80 som day (07:00-20:59), 120 som night (21:00-06:59), 50 som cancellation fee
- Price locked at order creation time (stored in order, doesn't change)
- Driver cascade: nearest driver gets 10s offer → timeout → next driver → no drivers → auto-cancel
- Cancellation fee only when client cancels after driver acceptance
- Pusher broadcasting (BROADCAST_CONNECTION=pusher, cluster ap1)

## Naming Conventions
- Enums: TitleCase keys, string-backed (e.g., `InProgress = 'in_progress'`)
- Models: singular (Order, DriverProfile, OtpCode)
- Factories: `online()`, `atLocation()`, `accepted()`, `expired()` — descriptive state names
- Tests: `test_descriptive_name` snake_case (Pint enforced)
- Routes: `api.v1.auth.send-otp` pattern (kebab-case paths, dot-separated names)
- Events: `OrderAccepted`, `OrderCancelled` etc. — broadcastAs `order.accepted`, `order.cancelled`

## Current Architecture State
- 4 models: User, DriverProfile, Order, OtpCode
- 2 enums: UserRole, OrderStatus
- 5 services: NikitaSmsService, OtpService, TariffService, GeoService, OrderService
- 1 controller: AuthController (6 methods: sendOtp, verifyOtp, driverLogin, logout, me, updatePushToken)
- 4 form requests: SendOtpRequest, VerifyOtpRequest, DriverLoginRequest, UpdatePushTokenRequest
- 1 job: OfferTimeoutJob (10s delay for driver offer timeout)
- 6 events: OrderOfferedToDriver, OrderAccepted, OrderDriverArrived, OrderInProgress, OrderCompleted, OrderCancelled
- 1 artisan command: MakeAdminCommand (make:admin)
- 6 API routes under /api/v1/auth/
- 2 broadcast channels: client.{userId}, driver.{userId}
- 148 tests passing

## Gotchas & Warnings
- SQLite ignores `after()` column positioning — non-issue functionally
- DriverProfile.user_id has unique constraint — one profile per driver
- Order.declined_drivers is JSON column, cast to array — default null not []
- verifyOtp returns `$user->role` (enum auto-serialized) while driverLogin returns `$user->role->value` — minor inconsistency
- Use `Event::fake()` and `Queue::fake()` in OrderService tests to prevent broadcasting/job side effects
- Haversine distance calc is done in PHP (acceptable for village-scale, few drivers)
