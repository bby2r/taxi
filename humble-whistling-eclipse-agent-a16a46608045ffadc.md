---
title: "Implementation Plan: Village Taxi Service"
date: 2026-04-06
status: draft
tags: [taxi, react-native, expo, laravel, api, realtime, village]
summary: "Village taxi dispatch — Laravel 13 API backend + React Native (Expo) mobile apps for Client & Driver"
phases: 8
---

# Implementation Plan: Village Taxi Service

## Overview

Build a simple taxi dispatch system for a small village. Three roles: Client, Driver, Admin. Fixed pricing (80 som day / 120 som night). Client requests a ride, system finds nearest online driver via Haversine distance, driver accepts/declines within 10 seconds, auto-cascades to next driver.

**Tech stack**:
- **Backend**: Laravel 13 (PHP 8.4), SQLite, Sanctum API auth, Broadcasting (Pusher)
- **Mobile**: React Native (Expo managed workflow), TypeScript, React Navigation, react-native-maps, expo-location, expo-notifications
- **Admin**: Laravel Blade (web-only, for admin dashboard)

## Design Direction

- **Tone**: Minimal, clean, functional — village simplicity
- **Palette**: Primary — Yellow `#FBBF24` (taxi), Dark — `#1F2937`, Success — `#10B981`, Danger — `#EF4444`, Background — `#F9FAFB`
- **Typography**: System default (San Francisco on iOS, Roboto on Android)
- **Theme**: Light for Client app, Dark for Driver app
- **Navigation**: React Navigation (native stack + bottom tabs)

## Project Structure

```
/taxi                          # Laravel backend (existing repo)
  app/
  routes/
  config/
  ...
/taxi/mobile                   # React Native Expo monorepo (NEW)
  app.json                     # Expo config
  tsconfig.json
  package.json
  src/
    api/                       # API client, Axios instance, types
      client.ts                # Axios config with baseURL + Sanctum token
      types.ts                 # TypeScript interfaces matching API resources
      auth.ts                  # Auth API calls (sendOtp, verifyOtp, driverLogin, logout)
      orders.ts                # Order API calls (create, cancel, history, current)
      driver.ts                # Driver API calls (online, offline, location, accept, etc.)
    navigation/
      RootNavigator.tsx        # Auth check → ClientStack or DriverStack
      ClientStack.tsx          # Client tab/stack navigation
      DriverStack.tsx          # Driver stack navigation
    screens/
      client/
        PhoneLoginScreen.tsx
        OtpVerifyScreen.tsx
        HomeScreen.tsx          # Map + Call Taxi
        OrderTrackingScreen.tsx # Real-time order status
        HistoryScreen.tsx
      driver/
        LoginScreen.tsx
        HomeScreen.tsx          # Online/offline + order management
        OrderActiveScreen.tsx   # Navigate to client, arrive, complete
        StatsScreen.tsx
    components/
      MapView.tsx              # Wrapper around react-native-maps
      DriverCard.tsx           # Driver info card for client
      OrderOfferCard.tsx       # Order offer with countdown for driver
      OnlineToggle.tsx         # Driver online/offline switch
      OtpInput.tsx             # 4-digit OTP input
      ActionButton.tsx         # Large full-width action button
      StatCard.tsx             # Stats display card
    hooks/
      useAuth.ts               # Auth context + token management
      useLocation.ts           # GPS via expo-location
      usePusher.ts             # Real-time channel subscription
      useOrder.ts              # Order state machine
    context/
      AuthContext.tsx           # Auth provider with SecureStore
    utils/
      storage.ts               # expo-secure-store wrapper
      constants.ts             # API URL, colors, etc.
    theme/
      colors.ts                # #FBBF24, #1F2937, #10B981, #EF4444
      typography.ts
```

---

## Phase 1: Foundation — Database Models & Enums

**Goal**: Create all database tables, Eloquent models, enums, factories, and seeders.

### 1.1 Order Status Enum
**Complexity**: simple | **Requires**: nothing

- **Enum**: `App\Enums\OrderStatus` (string-backed): `Searching`, `Accepted`, `Arrived`, `Completed`, `Cancelled`
- **Enum**: `App\Enums\UserRole` (string-backed): `Client`, `Driver`, `Admin`
- **Tests**: Unit — enum values are correct strings, all cases exist

### 1.2 Modify User Model for Roles
**Complexity**: medium | **Requires**: 1.1

- **Migration**: `add_role_and_phone_to_users_table` — `role` enum, `phone` string unique nullable, `phone_verified_at` timestamp nullable. Make `email` and `password` nullable.
- **Model**: Cast `role` to `UserRole`, scopes: `scopeClients()`, `scopeDrivers()`, `scopeAdmins()`, helpers: `isClient()`, `isDriver()`, `isAdmin()`
- **Factory**: States: `client()`, `driver()`, `admin()`
- **Tests**: Unit — scopes, helpers. Database — factory states.

### 1.3 Driver Profile Model
**Complexity**: medium | **Requires**: 1.2

- **Migration**: `create_driver_profiles_table` — `user_id` FK unique, `car_model`, `car_number`, `is_online` boolean, `latitude`/`longitude` decimal(10,7), `location_updated_at`
- **Model**: `DriverProfile` — `belongsTo User`, `scopeOnline()`, `scopeNearby(lat, lng)` (Haversine raw query)
- **Factory**: States: `online()`, `offline()`, `atLocation($lat, $lng)`
- **Seeder**: 5 sample drivers with locations
- **Tests**: Database — relationships. Unit — scopeOnline, scopeNearby sorts by distance.

### 1.4 Order Model
**Complexity**: medium | **Requires**: 1.1, 1.2, 1.3

- **Migration**: `create_orders_table` — `client_id`, `driver_id` nullable, `status`, `pickup_latitude`/`longitude`, `pickup_address`, `price` integer, timestamps for each status, `cancelled_by`
- **Model**: Relations, casts, scopes (`scopeActive`, `scopeForClient`, `scopeForDriver`), `calculatePrice()` static (80 or 120 based on hour)
- **Factory**: States: `searching()`, `accepted()`, `arrived()`, `completed()`, `cancelled()`
- **Tests**: Unit — price calculation boundaries. Database — relationships, scopes, factory states.

### 1.5 OTP Verification Model
**Complexity**: simple | **Requires**: 1.2

- **Migration**: `create_otp_codes_table` — `phone`, `code` (6 chars), `expires_at`, `verified_at`
- **Model**: `OtpCode` — `scopeValid($phone)`, `isExpired()`, `markVerified()`
- **Factory**: States: `expired()`, `verified()`
- **Tests**: Unit — isExpired, markVerified. Database — scopeValid.

---

## Phase 2: Authentication

**Goal**: Phone OTP auth for clients, credential auth for drivers, Sanctum API tokens for React Native.

### 2.1 Install & Configure Laravel Sanctum
**Complexity**: simple | **Requires**: Phase 1

- Install & publish Sanctum, add `HasApiTokens` to User
- Configure for **token-only auth** (no session/cookie — mobile apps use bearer tokens)
- Set token expiration to 30 days (mobile-appropriate)
- Create `routes/api.php`, register in `bootstrap/app.php`
- **Tests**: Feature — authenticated user can access protected route, unauthenticated gets 401

### 2.2 OTP Send & Verify Endpoints
**Complexity**: medium | **Requires**: 1.5, 2.1

- **Service**: `App\Services\OtpService` — `send(phone)` generates 4-digit code, `verify(phone, code)` returns User + token
- **Controller**: `App\Http\Controllers\Api\AuthController` — `sendOtp`, `verifyOtp`, `logout`, `me`
- **Routes**: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp` (public), `POST /api/auth/logout`, `GET /api/auth/me` (auth:sanctum)
- **Tests**: Feature — send-otp creates record, verify with valid/invalid/expired codes, logout revokes token, me returns user

### 2.3 Driver Login Endpoint
**Complexity**: simple | **Requires**: 2.1

- `POST /api/auth/driver/login` — validate phone+password, check role=driver, return token
- **Tests**: Feature — valid credentials return token, invalid return 401, non-driver returns 403

### 2.4 Push Token Registration Endpoint

**Complexity**: simple
**Requires**: 2.1 Sanctum

**Implementation**:
- **Migration**: `add_expo_push_token_to_users_table`
  - `expo_push_token` string nullable
- **Controller**: Add to `AuthController`
  - `registerPushToken(Request)` — POST `/api/auth/push-token` — store Expo push token
- **Form Request**: `RegisterPushTokenRequest` (token: required, string, starts with `ExponentPushToken[`)
- **Tests (PHPUnit)**:
  - Feature: Authenticated user can register push token
  - Feature: Unauthenticated returns 401

Done when: Users can register their Expo push token via API.

---

## Phase 3: Core Business Logic — Order Service & Driver Assignment

**Goal**: Implement order creation, Haversine-based driver matching, cascading assignment with 10s timeout, and real-time broadcasting.

### 3.1 Tariff Service
**Complexity**: simple | **Requires**: Phase 1

- **Service**: `App\Services\TariffService` — `getCurrentPrice()` returns 80 (07:00-21:00) or 120 (21:00-07:00)
- **Tests**: Unit — boundary cases at 07:00, 21:00, and mid-ranges

### 3.2 Haversine Distance Helper (GeoService)
**Complexity**: simple | **Requires**: nothing

- **Service**: `App\Services\GeoService` — `haversineDistance(lat1, lng1, lat2, lng2): float` (km), `getNearbyDrivers(lat, lng, radiusKm): Collection`
- **Tests**: Unit — known coordinates, same coordinates=0, sorted results, excludes offline

### 3.3 Order Creation & Driver Assignment Service
**Complexity**: complex | **Requires**: 3.1, 3.2, Phase 1

- **Service**: `App\Services\OrderService` — `createOrder()`, `acceptOrder()`, `declineOrder()`, `arriveAtPickup()`, `completeOrder()`, `cancelOrder()`
- **Job**: `FindDriverJob` — get nearby drivers, send offer to closest, schedule timeout
- **Job**: `DriverOfferTimeoutJob` (delay 10s) — if not accepted, decline and try next; if no more drivers, cancel order
- **Events**: `OrderCreated`, `DriverOffered`, `OrderAccepted`, `DriverArrived`, `OrderCompleted`, `OrderCancelled`
- **Migration**: `add_current_driver_offer_to_orders_table` — `offered_driver_id`, `offered_at`, `declined_drivers` json
- **Tests**: Feature — full order lifecycle, driver cascading, no drivers → cancelled. Use DB transactions/locking for race conditions.

### 3.4 Broadcasting Setup
**Complexity**: medium | **Requires**: 3.3

- **Broadcasting driver**: **Pusher** — `pusher-js` has first-class React Native support via `pusher-js/react-native`
- **Dependency**: `composer require pusher/pusher-php-server`
- **Channels** (`routes/channels.php`):
  - `private-client.{userId}` — only that client
  - `private-driver.{userId}` — only that driver
  - `private-drivers.available` — all online drivers
- **Auth endpoint**: `POST /api/broadcasting/auth` under `auth:sanctum` middleware — React Native uses bearer token auth, not session cookies
- **Config**: `config/broadcasting.php` — Pusher host/port accessible from mobile devices (not localhost), CORS headers
- **Events**: All events from 3.3 implement `ShouldBroadcast`, return appropriate channel + payload
- **Tests**: Feature — events broadcast to correct channels, channel authorization works with bearer tokens

---

## Phase 4: API Endpoints

**Goal**: RESTful JSON API consumed by React Native client and driver apps.

### 4.1 Client API Endpoints
**Complexity**: medium | **Requires**: Phase 2, Phase 3

- **Controller**: `App\Http\Controllers\Api\Client\OrderController`
  - `store` — POST `/api/client/orders` (lat, lng, address)
  - `show` — GET `/api/client/orders/{order}`
  - `cancel` — POST `/api/client/orders/{order}/cancel`
  - `history` — GET `/api/client/orders` (paginated)
  - `current` — GET `/api/client/orders/current`
- **Resource**: `OrderResource` — id, status, price, driver (name, car_model, car_number, phone, latitude, longitude), timestamps
- **Policy**: `OrderPolicy` — client can only view/cancel own orders
- **Middleware**: `App\Http\Middleware\EnsureUserRole` — check user role
- **Tests**: Feature — CRUD operations, authorization, validation, pagination

### 4.2 Driver API Endpoints
**Complexity**: medium | **Requires**: Phase 2, Phase 3

- **Controller**: `App\Http\Controllers\Api\Driver\StatusController`
  - `goOnline` — POST `/api/driver/online` (+ location)
  - `goOffline` — POST `/api/driver/offline`
  - `updateLocation` — POST `/api/driver/location` (lat, lng, heading)
- **Controller**: `App\Http\Controllers\Api\Driver\OrderController`
  - `accept`, `decline`, `arrive`, `complete`, `current`, `stats`
- **Resource**: `DriverOrderResource` — id, status, client (name, phone), pickup coordinates, price
- **Service**: `App\Services\DriverStatsService` — today/week/month/total earnings + ride counts
- Rate limit `updateLocation` to max 1 per 5 seconds (background GPS can be aggressive)
- **Tests**: Feature — online/offline, accept/decline/arrive/complete, stats, role enforcement

---

## Phase 5: Client React Native App

**Goal**: Native mobile app for clients — phone OTP login, GPS, call taxi, track driver in real-time.

### 5.0 Expo Project Setup
**Complexity**: medium
**Requires**: Phase 4 complete

**Implementation**:
- Initialize Expo project in `/mobile` directory:
  ```
  npx create-expo-app@latest mobile --template blank-typescript
  ```
- Install dependencies:
  ```
  npx expo install react-native-maps expo-location expo-notifications
  npx expo install expo-secure-store expo-device expo-constants
  npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
  npm install react-native-screens react-native-safe-area-context
  npm install axios pusher-js
  npm install react-native-gesture-handler react-native-reanimated
  ```
- Configure `app.json`:
  - `name`: "Village Taxi"
  - `slug`: "village-taxi"
  - `scheme`: "villagetaxi"
  - `ios.bundleIdentifier`: "com.villagetaxi.client"
  - `android.package`: "com.villagetaxi.client"
  - `android.permissions`: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
  - `ios.infoPlist.NSLocationWhenInUseUsageDescription`: location permission string
  - `plugins`: ["expo-location", "expo-notifications", "expo-secure-store"]
- Create `src/api/client.ts` — Axios instance with:
  - `baseURL` from constants (e.g., `https://your-api.com/api`)
  - Request interceptor to attach `Authorization: Bearer {token}` from SecureStore
  - Response interceptor for 401 → redirect to login
- Create `src/api/types.ts` — TypeScript interfaces:
  - `User`, `Order`, `DriverProfile`, `OrderResource`, `PaginatedResponse<T>`
- Create `src/theme/colors.ts` — design palette:
  - `primary: '#FBBF24'`, `dark: '#1F2937'`, `success: '#10B981'`, `danger: '#EF4444'`, `background: '#F9FAFB'`

**React Native package list** (all):
| Package | Purpose |
|---------|---------|
| `react-native-maps` | MapView with markers |
| `expo-location` | GPS (foreground) |
| `expo-notifications` | Push notifications |
| `expo-secure-store` | Secure token storage |
| `expo-device` | Device info for push tokens |
| `@react-navigation/native` | Navigation core |
| `@react-navigation/native-stack` | Stack navigator |
| `@react-navigation/bottom-tabs` | Tab navigator |
| `axios` | HTTP client |
| `pusher-js` | Real-time WebSocket (Pusher channels) |
| `react-native-reanimated` | Animations |

Done when: Expo project initializes, builds, and runs on simulator with placeholder screens.

### 5.1 Client Auth Screens
**Complexity**: medium
**Requires**: 5.0 Setup, Phase 2 Auth API

**Design Brief**:
- Same design tone as original: clean, minimal, large touch targets, village simplicity
- Same color palette: yellow primary, dark text

**Screen Components**:

**`PhoneLoginScreen.tsx`**:
- Full-screen, centered content
- Country prefix display: `+996` (non-editable label)
- Phone number `TextInput` with `keyboardType="phone-pad"`, large font (24px)
- "Отправить код" (Send Code) button — large, yellow (#FBBF24), full-width
- Loading state: ActivityIndicator replaces button text
- Error state: red text below input
- API call: `POST /api/auth/send-otp` with phone
- On success: navigate to `OtpVerifyScreen` passing phone

**`OtpVerifyScreen.tsx`**:
- 4 separate `TextInput` boxes (each `maxLength={1}`, `keyboardType="number-pad"`)
- Auto-advance focus to next box on input
- Auto-submit when all 4 digits entered
- Countdown timer (60s) for "Отправить повторно" (Resend)
- API call: `POST /api/auth/verify-otp` with phone + code
- On success: store token in `expo-secure-store`, register push token, navigate to `HomeScreen`

**Navigation**: `AuthStack` — PhoneLogin → OtpVerify (stack navigator, no back on PhoneLogin)

**`AuthContext.tsx`**:
- `AuthProvider` wrapping entire app
- State: `{ token: string | null, user: User | null, isLoading: boolean }`
- On app start: check SecureStore for token → call `GET /api/auth/me` → set user or clear token
- Methods: `signIn(token, user)`, `signOut()`, `isAuthenticated`

**Tests**:
- Jest + React Native Testing Library:
  - PhoneLoginScreen renders input and button
  - OtpVerifyScreen auto-advances digits
  - AuthContext persists/clears token correctly

Done when: Client can enter phone, receive OTP, verify, get authenticated with token stored securely.

### 5.2 Client Home — Call Taxi
**Complexity**: complex
**Requires**: 5.1 Auth, 4.1 Client API, 3.4 Broadcasting

**Design Brief**: Same as original — map with user location, single "Call Taxi" button, real-time driver tracking.

**Screen Component: `HomeScreen.tsx`**

**States** (managed by `useOrder` hook):
1. **Idle**: Map centered on user location, yellow "Вызвать такси — {price} сом" button at bottom
2. **Searching**: Pulsing animation overlay, "Ищем водителя..." text, Cancel button
3. **Accepted**: Driver card slides up (name, car model+number, phone with call link), "Водитель едет к вам", driver marker on map
4. **Arrived**: Driver card, "Водитель прибыл!" with vibration
5. **Completed**: "Поездка завершена — {price} сом" card, "OK" button returns to Idle
6. **No Drivers**: "Нет свободных водителей" message, "OK" button returns to Idle

**Sub-components**:
- `MapView` (react-native-maps): User marker (blue dot), driver marker (car icon) when assigned
- `CallTaxiButton`: Positioned absolute bottom, large yellow button with price
- `SearchingOverlay`: Semi-transparent overlay with pulsing animation + cancel
- `DriverCard`: Bottom sheet style — driver name, car info, phone (Linking.openURL for call)
- `TripCompleteCard`: Summary with price

**Hooks**:
- `useLocation()`: Requests permission, gets current position via `expo-location`, watches position
- `useOrder()`: State machine for order lifecycle
  - `createOrder()` → POST `/api/client/orders` with lat/lng
  - `cancelOrder()` → POST `/api/client/orders/{id}/cancel`
  - `fetchCurrent()` → GET `/api/client/orders/current` (on app resume)
- `usePusher()`: Connect to Pusher, subscribe to `private-client.{userId}`
  - Listen for: `OrderAccepted`, `DriverArrived`, `OrderCompleted`, `OrderCancelled`
  - Update order state on each event

**Real-time flow**:
1. Client creates order → API returns order with `status: searching`
2. Pusher channel receives `OrderAccepted` → show driver card, add driver marker to map
3. Pusher channel receives `DriverArrived` → update UI, vibrate
4. Pusher channel receives `OrderCompleted` → show completion card
5. Pusher channel receives `OrderCancelled` → show "cancelled" message

**Pusher integration** (`usePusher.ts`):
```typescript
// Uses pusher-js which works in React Native
import Pusher from 'pusher-js/react-native';

const pusher = new Pusher(PUSHER_KEY, {
  cluster: PUSHER_CLUSTER,
  authorizer: (channel) => ({
    authorize: (socketId, callback) => {
      api.post('/broadcasting/auth', {
        socket_id: socketId,
        channel_name: channel.name,
      }).then(response => callback(null, response.data))
        .catch(error => callback(error, null));
    },
  }),
});
```

Done when: Client can call taxi, see real-time updates, view driver info on map.

### 5.3 Client Order History
**Complexity**: simple
**Requires**: 5.1 Auth, 4.1 Client API

**Screen Component: `HistoryScreen.tsx`**:
- `FlatList` with pull-to-refresh and pagination (load more on scroll end)
- Each item: date, price, status badge (green=completed, red=cancelled)
- Empty state: "У вас пока нет поездок" with icon
- API: `GET /api/client/orders` (paginated)

**Navigation**: Part of `ClientTabs` — Home | History (bottom tab navigator)

Done when: Client can browse past rides with infinite scroll.

### 5.4 Client Navigation Structure
**Complexity**: simple
**Requires**: 5.1, 5.2, 5.3

```
RootNavigator
  ├── AuthStack (when not authenticated)
  │   ├── PhoneLoginScreen
  │   └── OtpVerifyScreen
  └── ClientTabs (when authenticated as client)
      ├── Home tab → HomeScreen (+ OrderTrackingScreen as modal)
      └── History tab → HistoryScreen
```

- `RootNavigator` checks `AuthContext.isAuthenticated` and `user.role`
- If role is `driver`, redirect to DriverStack (or show error — drivers should use driver app)

Done when: Navigation flow works end-to-end: login → home → history, with tab navigation.

---

## Phase 6: Driver React Native App

**Goal**: Native mobile app for drivers — login, go online, accept orders, GPS tracking, navigate to client.

### 6.0 Driver App Setup
**Complexity**: simple
**Requires**: 5.0 (shared Expo project)

**Decision**: Client and Driver apps share the same Expo project but with different entry points controlled by the `RootNavigator` based on user role. This avoids duplicating shared code (API client, Pusher, components).

Alternative: Separate Expo projects if the apps are distributed separately. For a village with few drivers, a single app with role-based routing is simpler.

**Implementation**:
- The same `/mobile` Expo project handles both roles
- `RootNavigator` checks `user.role` after auth:
  - `client` → ClientTabs
  - `driver` → DriverStack
- Driver-specific packages (already installed in 5.0):
  - `expo-location` with background location permission (driver needs background GPS)
  - Add to `app.json`:
    - `ios.infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription`
    - `ios.infoPlist.UIBackgroundModes`: ["location"]
    - `android.permissions`: add `ACCESS_BACKGROUND_LOCATION`
    - `plugins`: `["expo-location", { "isAndroidBackgroundLocationEnabled": true }]`

Done when: Driver role routes to DriverStack after login.

### 6.1 Driver Auth Screen
**Complexity**: simple
**Requires**: 6.0 Setup, 2.3 Driver Login API

**Screen Component: `driver/LoginScreen.tsx`**:
- Dark themed (background: #1F2937, text: white)
- Phone input (`+996` prefix, `keyboardType="phone-pad"`)
- Password input (`secureTextEntry`)
- "Войти" (Login) button — yellow (#FBBF24)
- Error: "Неверный телефон или пароль" inline
- API call: `POST /api/auth/driver/login` with phone + password
- On success: store token, register push token, navigate to DriverHomeScreen

**Navigation**: Same `AuthStack` but with a "Driver Login" link on the PhoneLoginScreen that navigates to `DriverLoginScreen`, or alternatively a role selector before auth.

**Recommended approach**: A single login screen with a toggle/link:
- Default: "Я пассажир" (phone + OTP flow)
- Link at bottom: "Вход для водителей" → navigates to DriverLoginScreen (phone + password)

Done when: Driver can login with phone + password.

### 6.2 Driver Home — Order Management
**Complexity**: complex
**Requires**: 6.1 Auth, 4.2 Driver API, 3.4 Broadcasting

**Design Brief**: Dark theme, clear status indicators, large touch targets. Same UX intent as original.

**Screen Component: `driver/HomeScreen.tsx`**

**States**:
1. **Offline**: Large "Выйти на линию" toggle (greyed), stats summary below
2. **Online/Waiting**: Green "На линии" badge, "Ожидание заказов...", map showing driver position
3. **Order Offered**: Order card slides up — distance to client, price, pickup address, Accept/Decline buttons with 10s countdown progress bar
4. **Accepted**: Navigate to `OrderActiveScreen`

**Sub-components**:
- `OnlineToggle.tsx`: Large custom switch component
  - When toggled ON: calls `POST /api/driver/online` with current GPS, starts background location tracking
  - When toggled OFF: calls `POST /api/driver/offline`, stops background tracking
- `OrderOfferCard.tsx`: 
  - Shows distance (km), price (som), address
  - 10-second animated countdown bar
  - "Принять" (Accept) green button, "Отказаться" (Decline) red button
  - Auto-decline on timeout (locally, server handles via DriverOfferTimeoutJob)

**Hooks**:
- `useDriverLocation()`: 
  - Foreground: `expo-location` watchPositionAsync with `accuracy: High`, `distanceInterval: 50` (meters)
  - Sends location to `POST /api/driver/location` every update
  - Background: `expo-location` startLocationUpdatesAsync with TaskManager for when app is backgrounded
- `usePusher()`: Subscribe to `private-driver.{userId}`
  - Listen for: `DriverOffered` → show OrderOfferCard
  - Listen for: `OrderCancelled` → return to waiting

**Background location** (critical for drivers):
```typescript
// Register background location task
TaskManager.defineTask('DRIVER_LOCATION_TASK', ({ data, error }) => {
  if (data) {
    const { locations } = data;
    // Send to API: POST /api/driver/location
    sendLocationToServer(locations[0].coords);
  }
});

// Start background updates when driver goes online
Location.startLocationUpdatesAsync('DRIVER_LOCATION_TASK', {
  accuracy: Location.Accuracy.High,
  distanceInterval: 100, // meters
  deferredUpdatesInterval: 10000, // ms
  foregroundService: {
    notificationTitle: 'Village Taxi',
    notificationBody: 'Вы на линии — ожидание заказов',
  },
});
```

Done when: Driver can go online/offline, receive order offers with countdown, accept/decline.

### 6.3 Driver Active Order Screen
**Complexity**: medium
**Requires**: 6.2

**Screen Component: `driver/OrderActiveScreen.tsx`**

**States**:
1. **En Route**: Map with route to client pickup, client info card, "Прибыл" (Arrived) button
2. **At Pickup**: "Завершить поездку" (Complete) button, client info
3. **Completed**: Trip summary (price), auto-return to HomeScreen after 3 seconds

**Sub-components**:
- `MapView` with driver marker + client pickup marker
- `ClientInfoCard`: Client name, phone (tap to call via `Linking.openURL('tel:...')`)
- `ActionButton`: Full-width bottom button — changes text/color per state

**API calls**:
- "Прибыл" → `POST /api/driver/orders/{id}/arrive`
- "Завершить" → `POST /api/driver/orders/{id}/complete`

**External navigation**: "Навигация" button opens pickup coordinates in device maps app:
```typescript
const url = Platform.select({
  ios: `maps:?daddr=${lat},${lng}`,
  android: `google.navigation:q=${lat},${lng}`,
});
Linking.openURL(url);
```

Done when: Driver can navigate to client, mark arrived, complete trip.

### 6.4 Driver Stats Screen
**Complexity**: simple
**Requires**: 6.1 Auth, 4.2 Stats API

**Screen Component: `driver/StatsScreen.tsx`**:
- Dark theme
- Grid of `StatCard` components: Today earnings, Today rides, Week earnings, Month earnings
- API: `GET /api/driver/stats`
- Pull-to-refresh

**Navigation**: Part of `DriverTabs` or accessible from HomeScreen header.

Done when: Driver can view income stats.

### 6.5 Driver Navigation Structure
**Complexity**: simple
**Requires**: 6.1-6.4

```
RootNavigator
  ├── AuthStack (shared)
  │   ├── PhoneLoginScreen (client OTP)
  │   ├── OtpVerifyScreen
  │   └── DriverLoginScreen (phone + password)
  └── DriverStack (when authenticated as driver)
      ├── DriverHomeScreen
      ├── OrderActiveScreen (push on accept)
      └── DriverStatsScreen (accessible from header)
```

Done when: Full driver navigation flow works.

---

## Phase 7: Admin Web Panel (Laravel Blade)

**Goal**: Simple admin panel for managing drivers, viewing orders, and basic analytics. Web-only — accessed from desktop or mobile browser.

### 7.1 Admin Auth & Layout
**Complexity**: simple | **Requires**: Phase 2

- Login route `GET/POST /admin/login`, `EnsureUserRole:admin` middleware
- Layout: `resources/views/layouts/admin.blade.php` — sidebar (Dashboard, Drivers, Orders) + top bar
- **Tests**: Feature — admin login, non-admin rejected, routes require admin role

### 7.2 Admin Dashboard
**Complexity**: medium | **Requires**: 7.1

- Stats cards: Active Orders, Online Drivers, Today Revenue, Total Rides
- Recent orders table (last 10 with status badges)
- **Tests**: Feature — dashboard shows correct stats

### 7.3 Admin Driver Management
**Complexity**: medium | **Requires**: 7.1

- CRUD for drivers: list, create (name, phone, password, car model, car number), edit, delete
- **Tests**: Feature — list, create, edit, delete drivers; validation enforced

### 7.4 Admin Order List
**Complexity**: simple | **Requires**: 7.1

- Orders table with status filter, order detail view
- **Tests**: Feature — list orders, filter by status, view order detail

---

## Phase 8: Push Notifications & App Distribution

**Goal**: Expo Push Notifications for key events + native app builds for iOS/Android.

### 8.1 Expo Push Notifications Setup
**Complexity**: medium
**Requires**: Phase 5, Phase 6, 2.4 Push Token Endpoint

**Implementation (React Native side)**:
- Use `expo-notifications` + `expo-device`
- On app startup (after auth), register for push notifications:
  ```typescript
  import * as Notifications from 'expo-notifications';
  import * as Device from 'expo-device';
  
  async function registerForPushNotifications() {
    if (!Device.isDevice) return; // Push doesn't work on simulator
    
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig.extra.eas.projectId,
    })).data;
    
    // Send to backend: POST /api/auth/push-token
    await api.post('/auth/push-token', { token });
  }
  ```
- Configure notification handler (foreground behavior):
  ```typescript
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  ```

**Implementation (Laravel side)**:
- **Service**: `App\Services\ExpoPushService`
  - `sendToUser(User $user, string $title, string $body, array $data = []): void`
  - Uses Expo Push API: `POST https://exp.host/--/api/v2/push/send`
  - Payload: `{ to: user.expo_push_token, title, body, data }`
- **HTTP client**: Use Laravel's Http facade to call Expo Push API (no SDK needed, simple REST call)
- **Integration points** — send push notifications on:
  - `OrderAccepted` → Client: "Водитель принял заказ" + driver name
  - `DriverArrived` → Client: "Водитель прибыл!" 
  - `OrderCompleted` → Client: "Поездка завершена — {price} сом"
  - `DriverOffered` → Driver: "Новый заказ рядом — {price} сом"
  - `OrderCancelled` → Both: "Заказ отменён"
- **Listener/Observer approach**: Create notification listeners on existing broadcast events, or dispatch notifications from the OrderService methods directly
- **Fallback**: If Expo push token is missing, skip silently (user will still get WebSocket updates)

**No new Laravel packages needed** — Expo Push API is a simple HTTP POST.

**Tests (PHPUnit)**:
- Feature: ExpoPushService sends correct payload (mock Http)
- Feature: Push token registration stores token
- Unit: Push notification triggered on order events

Done when: Both client and driver receive push notifications for all key order events.

### 8.2 App Distribution via Expo EAS
**Complexity**: medium  
**Requires**: 8.1, all previous phases

**Implementation**:
- Set up EAS (Expo Application Services):
  ```
  npm install -g eas-cli
  eas login
  eas build:configure
  ```
- Configure `eas.json`:
  ```json
  {
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {}
    }
  }
  ```
- For village deployment (simplest approach):
  - **Android**: Build APK via `eas build --platform android --profile preview`, distribute APK directly (sideload) or via Google Play Internal Testing
  - **iOS**: Use TestFlight or Ad Hoc distribution (requires Apple Developer account)
  - **OTA updates**: `eas update` for JS-only updates without app store review

Done when: App can be built and distributed to village users on both platforms.

---

## Dependency Summary

### Laravel Backend — New Dependencies
| Package | Purpose | Phase |
|---------|---------|-------|
| `laravel/sanctum` | API token auth | 2.1 |
| `pusher/pusher-php-server` | Broadcasting via Pusher | 3.4 |

Pusher is chosen over Reverb because `pusher-js/react-native` provides first-class React Native WebSocket support.

### React Native (Expo) — Dependencies
| Package | Purpose | Phase |
|---------|---------|-------|
| `expo` | Expo SDK | 5.0 |
| `expo-location` | GPS (foreground + background) | 5.0 |
| `expo-notifications` | Push notifications | 5.0 |
| `expo-secure-store` | Token storage | 5.0 |
| `expo-device` | Device checks | 5.0 |
| `expo-constants` | App config access | 5.0 |
| `react-native-maps` | Native map views | 5.0 |
| `@react-navigation/native` | Navigation core | 5.0 |
| `@react-navigation/native-stack` | Stack navigator | 5.0 |
| `@react-navigation/bottom-tabs` | Tab navigator | 5.0 |
| `react-native-screens` | Native screen containers | 5.0 |
| `react-native-safe-area-context` | Safe area handling | 5.0 |
| `react-native-gesture-handler` | Gesture support | 5.0 |
| `react-native-reanimated` | Animations | 5.0 |
| `axios` | HTTP client | 5.0 |
| `pusher-js` | Real-time WebSocket | 5.0 |

### Admin Panel (Web)
Laravel Blade + TailwindCSS 4. No additional dependencies beyond what Laravel provides.

---

## Real-Time Communication Architecture

```
┌─────────────────┐    HTTP/JSON     ┌──────────────────┐
│  React Native    │ ───────────────→ │  Laravel 13 API  │
│  (Expo)          │ ←─────────────── │  (Sanctum Auth)  │
│                  │                  │                  │
│  pusher-js       │    WebSocket     │  Broadcasting    │
│  (RN client)     │ ←─────────────── │  (Pusher)        │
└─────────────────┘                  └──────────────────┘
                                            │
                                     Expo Push API
                                     (HTTP POST)
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ Expo Push     │
                                     │ Service       │
                                     │ → APNs (iOS)  │
                                     │ → FCM (Droid) │
                                     └──────────────┘
```

**WebSocket (real-time updates while app is open)**:
- `pusher-js/react-native` connects to Pusher channels
- Auth via `POST /api/broadcasting/auth` with Sanctum bearer token
- Used for: order status changes, driver location updates, offer notifications

**Push Notifications (when app is backgrounded/closed)**:
- Expo Push Notifications via `exp.host` API
- Laravel sends push via simple HTTP POST (no FCM SDK needed)
- Used for: driver offered order, driver arrived, order completed/cancelled

**Both channels complement each other**: WebSocket for instant in-app updates, push for background alerts.

---

## Execution Order

```
Phase 1 (Models) → Phase 2 (Auth + Push Token) → Phase 3 (Business Logic) → Phase 4 (API)
                                                                                  ↓
Phase 7 (Admin Blade) ←←←←←←←←←←←←←←←←←←←← Phase 5 (Client React Native App)
                                                                                  ↓
                                                Phase 6 (Driver React Native App)
                                                                                  ↓
                                                Phase 8 (Push Notifications + EAS)
```

Phases 5, 6, 7 can be worked on in parallel after Phase 4 is complete.
Phase 5.0 (Expo setup) should happen first within the mobile phases.
Phases 5 and 6 share the same Expo project, so 5.0 serves both.

---

## Verification Checklist

- [ ] All PHPUnit tests passing (`php artisan test --compact`)
- [ ] Code style clean (`vendor/bin/pint --dirty --format agent`)
- [ ] All migrations run cleanly
- [ ] Expo app builds for iOS and Android (`eas build`)
- [ ] Client can: login by phone OTP → call taxi → see driver on map → complete ride
- [ ] Driver can: login → go online → accept order → navigate → arrive → complete
- [ ] Admin can: login → see dashboard → manage drivers → view orders (Blade web)
- [ ] Push notifications received for key events (both platforms)
- [ ] Real-time updates work via Pusher/WebSocket
- [ ] Background GPS tracking works for drivers (app backgrounded)
- [ ] Price is 80 som (07-21) and 120 som (21-07)
- [ ] Driver assignment cascades on 10s timeout
- [ ] App installable via APK (Android) / TestFlight (iOS)

## Rollback Plan

- Phases 1-4 (backend): Same as original — revert migration + remove code
- Phases 5-6 (mobile): `/mobile` directory is independent — can delete entirely without affecting backend
- Phase 7 (admin): Same as original — Blade views
- Phase 8 (push): Remove `expo_push_token` column + `ExpoPushService`

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Background GPS drains battery | Use `distanceInterval: 100m` to reduce updates; stop tracking when offline |
| Pusher free tier limits (200 concurrent) | Sufficient for village scale; upgrade or switch to Reverb if needed |
| iOS App Store review takes time | Use TestFlight for beta; OTA updates via EAS for JS changes |
| React Native maps performance | Use `PROVIDER_GOOGLE` on Android for better perf; limit marker updates |
| WebSocket auth with Sanctum tokens | Test broadcasting auth endpoint early; ensure it accepts Bearer tokens |
