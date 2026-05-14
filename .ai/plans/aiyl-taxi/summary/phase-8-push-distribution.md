# Phase 8 Summary: Push Notifications & Distribution

Completed: 2026-04-07

## What Was Built

### Step 8.1: Expo Push Notifications
- **ExpoPushService**: sendToUser (single) and sendToUsers (batch) via Expo Push API (`https://exp.host/--/api/v2/push/send`)
  - Returns false for null/empty tokens without HTTP call
  - Never throws — all errors caught and logged
  - Sound set to 'default' on all messages
  - Batch mode sends all messages in a single HTTP request
- **OrderService integration**: Push notifications after every order lifecycle transition
  - `offerToNextDriver` → driver gets "New ride request"
  - `acceptOrder` → client gets "Driver found!" with car info
  - `driverArrived` → client gets "Driver arrived"
  - `completeOrder` → both client and driver get "Ride completed" with price
  - `cancelOrder` → both client and driver get "Ride cancelled" (null-safe)
  - All push calls placed OUTSIDE DB::transaction blocks

### Step 8.2: EAS Distribution
- **eas.json**: 3 build profiles (development/preview/production)
  - Development: APK + simulator, internal distribution
  - Preview: APK + ad-hoc, internal with OTA channel
  - Production: AAB + store, auto-increment iOS, OTA channel
  - Submit config for Google Play (service account) and App Store (Apple ID)
  - EXPO_PUBLIC_ prefixed env vars for client-side access
- **app.json updates**: OTA updates URL, runtimeVersion policy, EAS projectId, bundle identifiers updated to `kg.aiyltaxi.app`

## Test Coverage

13 new PHP tests added (238 total), all passing:
- `ExpoPushServiceTest` (8 tests): valid token, null/empty token, HTTP failure, Expo error, batch skip/zero, sound default
- `OrderPushNotificationTest` (5 tests): push on accept, arrived, complete (both), cancel (both), no-token skip

## Architecture After Phase 8

- 5 services: TariffService, GeoService, OrderService, OtpService, ExpoPushService
- 238 PHP tests total, all passing
- 173 mobile Jest tests, all passing
- EAS configured for 3-tier build pipeline (dev/preview/prod)
