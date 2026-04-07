# Plan Memory: Village Taxi Service

Last updated: 2026-04-07 (after Phase 5)

## Established Patterns

### Backend (Laravel)
- Models use `#[Fillable]` and `#[Hidden]` PHP 8.4 attribute syntax
- Casts via `protected function casts(): array`, relations use PHPDoc generics
- Factories use `fake()` convention
- Pint auto-formats method names to snake_case in test files
- Controllers use constructor injection with `private readonly`
- API controllers: `App\Http\Controllers\Api\V1\`, routes: `api.v1.*`
- Artisan commands use Laravel 13 attribute syntax (#[Signature], #[Description])
- All order state transitions: `DB::transaction()` + `lockForUpdate()`
- Events implement `ShouldBroadcast` with private channels
- RuntimeException → 422 JSON, ownership mismatch → 403, missing → 404
- Use `Event::fake()` + `Queue::fake()` in order-related tests

### Mobile (React Native / Expo)
- Expo SDK 54, managed workflow, TypeScript
- Components return `React.ReactNode` (not JSX.Element) for React 19 compat
- Theme: `ClientColors`/`DriverColors` in `theme/colors.ts`, `Typography` in `theme/typography.ts`
- Hooks in `src/hooks/`, screens in `src/screens/{role}/`, navigation in `src/navigation/`
- API: Axios client with auth interceptor (src/api/client.ts), modules per domain
- Auth: SecureStore for tokens, AuthContext with session restore + 401 auto-logout
- State machines: discriminated unions (e.g., ClientOrderState with phase + order)
- Real-time: usePusher hook (primary) + setInterval polling (10s fallback)
- Navigation: type-safe ParamLists, auth-based routing in RootNavigator
- Testing: jest-expo, @testing-library/react-native, jest.mock() at module level
- jest.config.js: filtered jest-expo setup files, custom transformIgnorePatterns for axios/pusher-js
- UNSAFE_getByType for ActivityIndicator (no progressbar role in jest-expo)

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6)
- OrderStatus: searching, accepted, arrived, in_progress, completed, cancelled
- cancelled_by: string ('client'/'driver'/'system')
- OTP: 4-digit string, preserves leading zeros
- Sanctum tokens: 30-day expiry, all revoked on new login
- Phone: Kyrgyz regex `/^\+996[0-9]{9}$/`
- Pricing: 80 som day / 120 som night, 50 som cancellation fee, locked at creation
- Driver cascade: 10s timeout, nearest first, auto-cancel when none
- Pusher: cluster ap1, channels `private-client.{userId}`, `private-driver.{userId}`
- Default coords: 42.87, 74.59 (Bishkek)
- Date formatting: dayjs with Russian locale

## Current Architecture State
- Backend: 4 models, 2 enums, 5 services, 3 controllers, 6 form requests, 1 middleware, 3 API resources, 1 job, 6 events, 1 command, 22 routes, 190 PHP tests
- Mobile: AuthContext, 4 hooks, 4 components, 4 screens, 4 navigation files, 6 API/util modules, 92 Jest tests
- Client app complete: auth flow, home (map + order lifecycle), history, tab navigation
- Driver app: placeholder in RootNavigator, to be built in Phase 6

## Gotchas & Warnings
- /orders/active route MUST precede /orders/{order} (model binding conflict)
- DriverProfile.user_id has unique constraint
- Order.declined_drivers JSON cast, default null not []
- usePusher omits `events` from deps array (safe with memoized callbacks only)
- jest-expo setup file filtered out in jest.config.js (causes React 19 issues)
- Use --legacy-peer-deps for some dev deps (React 19 peer conflicts)
