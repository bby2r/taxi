# Plan Memory: Alif Taxi Service

Last updated: 2026-04-07 (after Phase 8 — FINAL)

## Established Patterns

### Backend (Laravel)
- Models: `#[Fillable]`, `#[Hidden]` PHP 8.4 attributes, casts via method, PHPDoc generics
- Factories: `fake()` convention; Pint auto-formats to snake_case in tests
- Controllers: constructor injection `private readonly`, API under `Api\V1\`, Admin under `Admin\`
- Routes: API `Route::prefix('v1')` named `api.v1.*`; Admin in web.php with auth + role:admin middleware
- Order transitions: `DB::transaction()` + `lockForUpdate()`
- Events: `ShouldBroadcast`, private channels; tests use `Event::fake()` + `Queue::fake()`
- Push notifications: ExpoPushService (never throws, logs errors), calls OUTSIDE transactions
- Errors: RuntimeException → 422, ownership → 403, missing → 404
- Admin CRUD: DB::transaction for multi-model ops, flash messages, paginate(15-20)
- EnsureUserRole: JSON→403, web→redirect to admin.login

### Mobile (React Native / Expo)
- SDK 54, managed workflow, TypeScript, `React.ReactNode` return types
- Theme: ClientColors (light) / DriverColors (dark) in theme/colors.ts
- State machines: discriminated unions for phase-based UI
- Real-time: usePusher (primary) + setInterval polling (fallback)
- Navigation: type-safe ParamLists, auth+role routing in RootNavigator
- Testing: jest-expo, @testing-library/react-native, jest.mock at module level
- Distribution: EAS with 3 profiles (development/preview/production), EXPO_PUBLIC_ env vars

### Admin Panel (Blade + TailwindCSS)
- Layout: `layouts.admin` with sidebar (gray-800, Heroicons) + top bar
- Views: @extends, @section('title','heading','content')
- Forms: amber-400 buttons, gray-300 borders, focus:ring-amber-400
- Tables: white cards, bg-gray-50 headers, divide-y rows, hover:bg-gray-50
- Status badges: `admin.partials.order-status-badge` partial (colored pills)
- Flash: green success, red error, above content

## Key Decisions
- Timezone: Asia/Bishkek (UTC+6)
- OrderStatus: Searching, Accepted, Arrived, InProgress, Completed, Cancelled
- Pricing: 80 day / 120 night, 50 cancellation, locked at creation
- Driver cascade: 10s timeout, nearest first, auto-cancel when none
- Pusher: cluster ap1, private channels per user
- Admin auth: session-based (NOT Sanctum tokens), phone + password
- Push: Expo Push API, never throws, sound='default', outside transactions
- Bundle ID: kg.aliftaxi.app (both platforms)

## Final Architecture State
- Backend: 4 models, 2 enums, 5 services, 7 controllers (3 API + 4 Admin), 6 form requests, 1 middleware, 3 API resources, 1 job, 6 events, 1 command, 22 API + 13 web routes, 238 PHP tests
- Mobile: 6 hooks, 7 components, 8 screens, 5 nav files, 173 Jest tests
- Admin: dashboard + driver CRUD + order list/show, 8 Blade views
- Distribution: eas.json with 3 build profiles + submit config

## Gotchas & Warnings
- /orders/active route MUST precede /orders/{order}
- DriverProfile.user_id has unique constraint
- Order.declined_drivers JSON cast, default null not []
- usePusher omits `events` from deps (safe with memoized callbacks)
- jest-expo setup file filtered in jest.config.js (React 19 issues)
- Admin layout references dashboard/drivers/orders routes — all must exist
- Push calls never throw — failures are logged, not propagated
