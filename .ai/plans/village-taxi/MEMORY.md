# Plan Memory: Village Taxi Service

Last updated: 2026-04-07 (after Phase 6)

## Established Patterns

### Backend (Laravel)
- Models: `#[Fillable]`, `#[Hidden]` PHP 8.4 attributes, casts via method, PHPDoc generics on relations
- Factories: `fake()` convention; Pint auto-formats to snake_case in tests
- Controllers: constructor injection `private readonly`, namespaced `Api\V1\`
- Routes: `Route::prefix('v1')`, named `api.v1.*`
- Order transitions: `DB::transaction()` + `lockForUpdate()`
- Events: `ShouldBroadcast`, private channels; tests use `Event::fake()` + `Queue::fake()`
- Errors: RuntimeException → 422, ownership → 403, missing → 404

### Mobile (React Native / Expo)
- SDK 54, managed workflow, TypeScript
- Components return `React.ReactNode` (React 19 compat)
- Theme: `ClientColors` (light/yellow) and `DriverColors` (dark/yellow) in `theme/colors.ts`
- Hooks in `src/hooks/`, screens in `src/screens/{role}/`, navigation in `src/navigation/`
- API: Axios client with auth interceptor, modules per domain (auth, orders, driver)
- Auth: SecureStore, AuthContext with session restore + 401 auto-logout
- State machines: discriminated unions for phase-based UI (ClientOrderState, DriverPhase)
- Real-time: usePusher (primary) + setInterval polling (fallback)
- Navigation: type-safe ParamLists, auth+role routing in RootNavigator
- Testing: jest-expo, @testing-library/react-native, jest.mock at module level
- jest.config.js: filtered jest-expo setup files, custom transformIgnorePatterns
- UNSAFE_getByType for ActivityIndicator (no progressbar role in jest-expo)
- Dark theme for driver screens, light for client

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6)
- OrderStatus: searching, accepted, arrived, in_progress, completed, cancelled
- OTP: 4-digit, preserves leading zeros; Sanctum 30-day tokens
- Phone: `/^\+996[0-9]{9}$/`; Expo push: `/^ExponentPushToken\[.+\]$/`
- Pricing: 80 day / 120 night, 50 cancellation, locked at creation
- Driver cascade: 10s timeout, nearest first, auto-cancel when none
- Pusher: cluster ap1, `private-client.{userId}`, `private-driver.{userId}`
- Default coords: 42.87, 74.59 (Bishkek)
- Date: dayjs with Russian locale
- Driver location: 10s upload interval, high accuracy, 5m distance interval

## Current Architecture State
- Backend: 4 models, 2 enums, 5 services, 3 controllers, 6 form requests, 1 middleware, 3 API resources, 1 job, 6 events, 1 command, 22 routes, 190 PHP tests
- Mobile: AuthContext, 6 hooks, 7 components, 8 screens (4 client + 4 driver), 5 navigation files, 7 API/util modules, 173 Jest tests
- Full navigation: Auth (PhoneLogin/OtpVerify/DriverLogin) → Client (Home/History tabs) or Driver (Home/OrderActive/Stats stack)
- Dynamic StatusBar: light for driver, dark for client

## Gotchas & Warnings
- /orders/active route MUST precede /orders/{order}
- DriverProfile.user_id has unique constraint
- Order.declined_drivers JSON cast, default null not []
- usePusher omits `events` from deps (safe with memoized callbacks)
- jest-expo setup file filtered in jest.config.js (React 19 issues)
- --legacy-peer-deps for some dev deps
- useDriverLocation returns ref.current (no re-renders) — if rendering needed, switch to useState
