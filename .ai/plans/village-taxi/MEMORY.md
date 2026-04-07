# Plan Memory: Village Taxi Service

Last updated: 2026-04-07 (after Phase 4)

## Established Patterns
- Models use `#[Fillable]` and `#[Hidden]` PHP 8.4 attribute syntax
- Casts defined via `protected function casts(): array` method
- Relations use PHPDoc generics: `/** @return BelongsTo<User, $this> */`
- Factories use `fake()` convention, not `$this->faker`
- Scopes return `Builder` type
- Pint auto-formats method names to snake_case in test files
- Controllers use constructor injection with `private readonly`
- API controllers namespaced under `App\Http\Controllers\Api\V1\`
- Routes use `Route::prefix('v1')` grouping with named routes `api.v1.*`
- Artisan commands use Laravel 13 PHP attribute syntax (#[Signature], #[Description])
- Services use constructor injection with `private readonly` properties
- All order state transitions use `DB::transaction()` + `lockForUpdate()`
- Events implement `ShouldBroadcast` with private channels
- RuntimeException from services caught in controllers → 422 JSON response
- Ownership checks: client_id match → 403, driver profile missing → 404
- API Resources: OrderResource, UserResource, DriverProfileResource under V1/
- EnsureUserRole middleware: `role:client`, `role:driver`, `role:admin`

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6)
- OrderStatus: Searching, Accepted, Arrived, InProgress, Completed, Cancelled
- cancelled_by is string ('client'/'driver'/'system')
- OTP: 4-digit string, preserves leading zeros
- User email/password nullable (clients use phone OTP)
- Sanctum tokens: 30-day expiry, all revoked on new login
- Phone: Kyrgyz regex `/^\+996[0-9]{9}$/`
- Expo push token: `/^ExponentPushToken\[.+\]$/`
- Pricing: 80 som day (07:00-20:59), 120 som night, 50 som cancellation fee
- Price locked at order creation
- Driver cascade: 10s timeout, nearest first, auto-cancel when none
- Pusher broadcasting (cluster ap1)

## Current Architecture State
- 4 models: User, DriverProfile, Order, OtpCode
- 2 enums: UserRole, OrderStatus
- 5 services: NikitaSmsService, OtpService, TariffService, GeoService, OrderService
- 3 controllers: AuthController (6 methods), ClientOrderController (5), DriverController (11)
- 6 form requests: SendOtp, VerifyOtp, DriverLogin, UpdatePushToken, CreateOrder, UpdateLocation
- 1 middleware: EnsureUserRole (alias: 'role')
- 3 API resources: OrderResource, UserResource, DriverProfileResource
- 1 job: OfferTimeoutJob
- 6 events (all broadcastable)
- 1 artisan command: make:admin
- 22 API routes (6 auth + 5 client + 11 driver)
- 2 broadcast channels
- 190 tests passing

## Gotchas & Warnings
- /orders/active route MUST come before /orders/{order} to avoid model binding conflict
- DriverProfile.user_id has unique constraint
- Order.declined_drivers JSON cast, default null not []
- Use Event::fake() + Queue::fake() in order-related tests
- Haversine calc in PHP (village-scale OK)
