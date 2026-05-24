---
phase: 8
title: "Push Notifications & App Distribution"
status: pending
depends_on: [4, 5, 6]
---

# Phase 8 — Push Notifications & App Distribution

Expo Push Notifications integrated into order lifecycle events, plus EAS Build configuration for Android APK and iOS TestFlight distribution.

---

## Sub-task 8.1 — Expo Push Notifications

### Objective

Create an `ExpoPushService` that sends push notifications via the Expo Push API. Integrate it into the order lifecycle so clients and drivers receive real-time alerts when order status changes. No third-party SDK — just Laravel's Http facade.

### Service

**File**: `app/Services/ExpoPushService.php`
Create via: `php artisan make:class Services/ExpoPushService --no-interaction`

```php
<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoPushService
{
    private const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

    /**
     * Send a push notification to a user.
     *
     * @param User $user
     * @param string $title
     * @param string $body
     * @param array<string, mixed> $data Additional data payload
     * @return bool Whether the notification was sent (false if no token)
     */
    public function sendToUser(User $user, string $title, string $body, array $data = []): bool
    {
        if (empty($user->expo_push_token)) {
            return false;
        }

        return $this->send($user->expo_push_token, $title, $body, $data);
    }

    /**
     * Send a push notification to multiple users.
     *
     * @param iterable<User> $users
     * @param string $title
     * @param string $body
     * @param array<string, mixed> $data
     * @return int Number of notifications sent
     */
    public function sendToUsers(iterable $users, string $title, string $body, array $data = []): int
    {
        $messages = [];

        foreach ($users as $user) {
            if (empty($user->expo_push_token)) {
                continue;
            }

            $messages[] = [
                'to' => $user->expo_push_token,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'sound' => 'default',
            ];
        }

        if (empty($messages)) {
            return 0;
        }

        // Expo supports batch sending (up to 100 per request)
        $response = Http::acceptJson()
            ->post(self::EXPO_PUSH_URL, $messages);

        if ($response->failed()) {
            Log::error('Expo push batch failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return 0;
        }

        return count($messages);
    }

    /**
     * Send a single push notification.
     *
     * @param string $token Expo push token (ExponentPushToken[...])
     * @param string $title
     * @param string $body
     * @param array<string, mixed> $data
     * @return bool
     */
    private function send(string $token, string $title, string $body, array $data = []): bool
    {
        $payload = [
            'to' => $token,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'sound' => 'default',
        ];

        $response = Http::acceptJson()
            ->post(self::EXPO_PUSH_URL, [$payload]);

        if ($response->failed()) {
            Log::error('Expo push failed', [
                'token' => $token,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return false;
        }

        $result = $response->json('data.0');
        if (isset($result['status']) && $result['status'] === 'error') {
            Log::warning('Expo push error', [
                'token' => $token,
                'message' => $result['message'] ?? 'Unknown error',
                'details' => $result['details'] ?? null,
            ]);
            return false;
        }

        return true;
    }
}
```

### Notification Messages

Define notification content for each order event:

| Event | Recipient | Title | Body | Data |
|-------|-----------|-------|------|------|
| New order (searching) | Driver | "New ride request" | "A client is looking for a ride from {pickup_address}" | `{order_id, type: 'new_order'}` |
| Order accepted | Client | "Driver found!" | "{driver_name} is on the way in a {car_model}" | `{order_id, type: 'order_accepted'}` |
| Driver arrived | Client | "Driver arrived" | "{driver_name} has arrived at your pickup point" | `{order_id, type: 'driver_arrived'}` |
| Order completed | Client | "Ride completed" | "Your ride is complete. Total: {price} KGS" | `{order_id, type: 'order_completed'}` |
| Order completed | Driver | "Ride completed" | "Ride completed. Earned: {price} KGS" | `{order_id, type: 'order_completed'}` |
| Order cancelled | Client | "Ride cancelled" | "Your ride has been cancelled" | `{order_id, type: 'order_cancelled'}` |
| Order cancelled | Driver | "Ride cancelled" | "The ride has been cancelled" | `{order_id, type: 'order_cancelled'}` |

### Integration Points

Integrate push notifications into `OrderService` (or wherever order status transitions are handled). The executor must locate the existing order lifecycle methods and add push calls.

**Pattern**: After each status change is persisted, dispatch the push notification. Do NOT block the response — wrap in a queued job if the project uses queues, otherwise call synchronously (Expo API is fast, <200ms typically).

**File to modify**: `app/Services/OrderService.php`

Add `ExpoPushService` as a constructor dependency:

```php
public function __construct(
    private ExpoPushService $pushService,
) {}
```

**Integration per event**:

```php
// After order created (status = Searching) — notify available drivers
// This depends on how drivers are notified. If there's a broadcast to nearby drivers,
// send push to each. If orders are offered to a specific driver, send to that driver.
// Adapt based on existing logic.

// After order accepted (status = Accepted):
$this->pushService->sendToUser(
    $order->client,
    'Driver found!',
    "{$order->driver->name} is on the way in a {$order->driver->driverProfile->car_model}",
    ['order_id' => $order->id, 'type' => 'order_accepted'],
);

// After driver arrived (status = Arrived):
$this->pushService->sendToUser(
    $order->client,
    'Driver arrived',
    "{$order->driver->name} has arrived at your pickup point",
    ['order_id' => $order->id, 'type' => 'driver_arrived'],
);

// After order completed (status = Completed):
$this->pushService->sendToUser(
    $order->client,
    'Ride completed',
    "Your ride is complete. Total: " . number_format($order->price) . " KGS",
    ['order_id' => $order->id, 'type' => 'order_completed'],
);
$this->pushService->sendToUser(
    $order->driver,
    'Ride completed',
    "Ride completed. Earned: " . number_format($order->price) . " KGS",
    ['order_id' => $order->id, 'type' => 'order_completed'],
);

// After order cancelled (status = Cancelled):
if ($order->client) {
    $this->pushService->sendToUser(
        $order->client,
        'Ride cancelled',
        'Your ride has been cancelled',
        ['order_id' => $order->id, 'type' => 'order_cancelled'],
    );
}
if ($order->driver) {
    $this->pushService->sendToUser(
        $order->driver,
        'Ride cancelled',
        'The ride has been cancelled',
        ['order_id' => $order->id, 'type' => 'order_cancelled'],
    );
}
```

### Null-Safety

The `sendToUser` method returns `false` when `expo_push_token` is null. No exceptions are thrown. The caller does not need to check for null tokens — the service handles it silently.

### Error Handling

- HTTP failures: logged via `Log::error`, returns `false`
- Expo-level errors (invalid token, etc.): logged via `Log::warning`, returns `false`
- Never throw exceptions from push service — notifications are non-critical
- Consider adding a TODO comment: future improvement to clear invalid tokens from the database when Expo returns `DeviceNotRegistered`

### PHPUnit Tests

**File**: `tests/Feature/ExpoPushServiceTest.php`
Create via: `php artisan make:test ExpoPushServiceTest --phpunit --no-interaction`

```
testSendToUserWithValidToken(): void
    - Create User with expo_push_token = 'ExponentPushToken[test-token-123]'
    - Http::fake(['https://exp.host/*' => Http::response(['data' => [['status' => 'ok']]])])
    - $service = new ExpoPushService()
    - $result = $service->sendToUser($user, 'Test Title', 'Test Body', ['key' => 'value'])
    - assertTrue($result)
    - Http::assertSent(function ($request) {
          $payload = $request->data()[0];
          return $payload['to'] === 'ExponentPushToken[test-token-123]'
              && $payload['title'] === 'Test Title'
              && $payload['body'] === 'Test Body'
              && $payload['data']['key'] === 'value'
              && $payload['sound'] === 'default';
      })

testSendToUserWithNullTokenReturnsFalse(): void
    - Create User with expo_push_token = null
    - Http::fake() // should never be called
    - $result = $service->sendToUser($user, 'Title', 'Body')
    - assertFalse($result)
    - Http::assertNothingSent()

testSendToUserWithEmptyTokenReturnsFalse(): void
    - Create User with expo_push_token = ''
    - $result = $service->sendToUser($user, 'Title', 'Body')
    - assertFalse($result)
    - Http::assertNothingSent()

testSendToUserHandlesHttpFailure(): void
    - Create User with valid token
    - Http::fake(['*' => Http::response('Server Error', 500)])
    - $result = $service->sendToUser($user, 'Title', 'Body')
    - assertFalse($result)

testSendToUserHandlesExpoError(): void
    - Create User with valid token
    - Http::fake(['*' => Http::response(['data' => [['status' => 'error', 'message' => 'DeviceNotRegistered']]])])
    - $result = $service->sendToUser($user, 'Title', 'Body')
    - assertFalse($result)

testSendToUsersSkipsUsersWithoutTokens(): void
    - Create 3 users: 2 with tokens, 1 without
    - Http::fake(['*' => Http::response(['data' => [['status' => 'ok'], ['status' => 'ok']]])])
    - $count = $service->sendToUsers(User::all(), 'Title', 'Body')
    - assertEquals(2, $count)
    - Http::assertSent(function ($request) {
          return count($request->data()) === 2;
      })

testSendToUsersReturnsZeroWhenNoTokens(): void
    - Create 2 users without tokens
    - $count = $service->sendToUsers(User::all(), 'Title', 'Body')
    - assertEquals(0, $count)
    - Http::assertNothingSent()

testSendIncludesSoundDefault(): void
    - Create User with token
    - Http::fake(['*' => Http::response(['data' => [['status' => 'ok']]])])
    - $service->sendToUser($user, 'T', 'B')
    - Http::assertSent(fn ($r) => $r->data()[0]['sound'] === 'default')
```

**File**: `tests/Feature/OrderPushNotificationTest.php`
Create via: `php artisan make:test OrderPushNotificationTest --phpunit --no-interaction`

These tests verify that push notifications are triggered during order lifecycle. They depend on the existing OrderService methods.

```
testPushSentWhenOrderAccepted(): void
    - Http::fake()
    - Create client with expo_push_token, create driver with driverProfile
    - Create order (status=Searching, client_id, driver_id=null)
    - Call OrderService method that accepts order (assign driver, set status=Accepted)
    - Http::assertSent(function ($request) {
          $payload = $request->data()[0];
          return str_contains($payload['body'], 'on the way')
              && $payload['data']['type'] === 'order_accepted';
      })

testPushSentWhenDriverArrived(): void
    - Http::fake()
    - Create order with client (has token) + driver, status=Accepted
    - Transition to Arrived
    - Http::assertSent — body contains 'arrived', type 'driver_arrived'

testPushSentToBothWhenOrderCompleted(): void
    - Http::fake()
    - Create order with client (has token) + driver (has token), status=Arrived
    - Transition to Completed
    - Http::assertSentCount(1) // single batch request with 2 messages
      // OR assertSent called twice if sent individually

testPushSentToBothWhenOrderCancelled(): void
    - Http::fake()
    - Create order with client + driver (both have tokens), status=Accepted
    - Transition to Cancelled
    - Assert push sent to both

testNoPushSentWhenUserHasNoToken(): void
    - Http::fake()
    - Create client WITHOUT expo_push_token, driver with token
    - Transition order to Completed
    - Assert only 1 push sent (to driver), not to client
```

### Files Created/Modified

| Action | Path |
|--------|------|
| Create | `app/Services/ExpoPushService.php` |
| Modify | `app/Services/OrderService.php` (add push integration) |
| Create | `tests/Feature/ExpoPushServiceTest.php` |
| Create | `tests/Feature/OrderPushNotificationTest.php` |

---

## Sub-task 8.2 — App Distribution via EAS

### Objective

Configure Expo Application Services (EAS) for building and distributing the React Native app. This is configuration-only — no Laravel changes, no PHPUnit tests.

### Prerequisites

- Expo project exists in a separate directory (e.g., `mobile/` or a separate repo)
- `expo-cli` and `eas-cli` are installed globally: `npm install -g eas-cli`
- Expo account created and logged in: `eas login`

### EAS Configuration

**File**: `mobile/eas.json` (in the React Native project root)

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "API_URL": "http://192.168.1.100:8000/api",
        "PUSHER_KEY": "your-dev-pusher-key",
        "PUSHER_CLUSTER": "ap2"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "enterpriseProvisioning": "adhoc"
      },
      "env": {
        "API_URL": "https://staging.aliftaxi.kg/api",
        "PUSHER_KEY": "your-staging-pusher-key",
        "PUSHER_CLUSTER": "ap2"
      },
      "channel": "preview"
    },
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "autoIncrement": true
      },
      "env": {
        "API_URL": "https://aliftaxi.kg/api",
        "PUSHER_KEY": "your-production-pusher-key",
        "PUSHER_CLUSTER": "ap2"
      },
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "developer@aliftaxi.kg",
        "ascAppId": "YOUR_ASC_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### Build Profiles Explained

| Profile | Use Case | Android Output | iOS Output | Distribution |
|---------|----------|---------------|------------|-------------|
| `development` | Local dev with dev client | APK (direct install) | Simulator build | Internal |
| `preview` | Internal testing / QA | APK (direct install) | Ad-hoc IPA | Internal (share link) |
| `production` | Store release | AAB (Play Store) | IPA (App Store) | Store |

### Build Commands

```bash
# Development build (for testing on physical device)
eas build --profile development --platform android
eas build --profile development --platform ios

# Preview build (share with team for QA)
eas build --profile preview --platform android
eas build --profile preview --platform ios

# Production build
eas build --profile production --platform android
eas build --profile production --platform ios

# Build both platforms at once
eas build --profile preview --platform all
```

### OTA Updates

Expo supports over-the-air JavaScript bundle updates without rebuilding:

```bash
# Push an OTA update to preview channel
eas update --channel preview --message "Fix: order status not refreshing"

# Push an OTA update to production channel
eas update --channel production --message "v1.0.1 - minor bug fixes"
```

OTA updates only work for JS changes. Native code changes (new native modules, SDK version bump) require a full rebuild.

### App Configuration

Ensure `mobile/app.json` (or `app.config.js`) has the required fields:

```json
{
  "expo": {
    "name": "Alif Taxi",
    "slug": "alif-taxi",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FBBF24"
    },
    "updates": {
      "url": "https://u.expo.dev/YOUR_PROJECT_ID"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "ios": {
      "bundleIdentifier": "kg.aliftaxi.app",
      "supportsTablet": false,
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "We need your location to find nearby drivers and show your position on the map.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Location is used to track your position during active rides."
      }
    },
    "android": {
      "package": "kg.aliftaxi.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FBBF24"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    },
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    },
    "plugins": [
      "expo-location",
      "expo-notifications"
    ]
  }
}
```

### Distribution Workflow

**Android (APK for direct install)**:

1. Run `eas build --profile preview --platform android`
2. Wait for build to complete (~5-10 minutes)
3. Download APK from the EAS dashboard or CLI output URL
4. Share APK file with testers (via Telegram, email, etc.)
5. Testers install APK directly (enable "Install from unknown sources" on Android)

**Android (Play Store)**:

1. Run `eas build --profile production --platform android` (produces AAB)
2. Run `eas submit --platform android` (requires Google service account key)
3. App goes to internal testing track on Google Play Console

**iOS (TestFlight)**:

1. Run `eas build --profile production --platform ios`
2. Run `eas submit --platform ios` (requires Apple Developer account)
3. App appears in TestFlight for internal testers
4. Add external testers via App Store Connect

**iOS (Ad-hoc for preview)**:

1. Register test device UDIDs: `eas device:create`
2. Run `eas build --profile preview --platform ios`
3. Share install link with registered devices

### Environment Variables in React Native

Access EAS env variables in the app code:

```typescript
// In app config or via expo-constants
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
```

Update `eas.json` env keys to use `EXPO_PUBLIC_` prefix for client-side access:

```json
"env": {
    "EXPO_PUBLIC_API_URL": "https://aliftaxi.kg/api",
    "EXPO_PUBLIC_PUSHER_KEY": "your-pusher-key",
    "EXPO_PUBLIC_PUSHER_CLUSTER": "ap2"
}
```

### Notification Setup in Expo

Ensure the React Native app registers for push notifications on startup and stores the token via the API:

```typescript
// This should already exist from Phase 5-6. Verify it:
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications(): Promise<string | null> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
        return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'YOUR_EAS_PROJECT_ID',
    });
    return token.data; // "ExponentPushToken[...]"
}
```

The token is then sent to the Laravel API via `PUT /api/user/push-token` (or similar endpoint from Phase 4) and stored in `users.expo_push_token`.

### No PHPUnit Tests

This sub-task is purely configuration and React Native code. No Laravel tests needed.

### Files Created/Modified

| Action | Path |
|--------|------|
| Create | `mobile/eas.json` |
| Modify | `mobile/app.json` or `mobile/app.config.js` (verify/update fields) |

---

## Full File Inventory (Phase 8)

| Action | Path |
|--------|------|
| Create | `app/Services/ExpoPushService.php` |
| Modify | `app/Services/OrderService.php` |
| Create | `tests/Feature/ExpoPushServiceTest.php` |
| Create | `tests/Feature/OrderPushNotificationTest.php` |
| Create | `mobile/eas.json` |
| Modify | `mobile/app.json` (verify config) |

## Execution Order

Execute sub-tasks sequentially: 8.1 → 8.2. The push service (8.1) is a Laravel backend task. Distribution (8.2) is React Native configuration that can be done independently but is listed second for logical flow.

## Post-Phase Checklist

- [ ] `ExpoPushService` sends correct payloads to Expo Push API
- [ ] Null tokens are handled gracefully (no exceptions, no HTTP calls)
- [ ] HTTP failures are logged but never throw
- [ ] Push notifications fire on all order status transitions
- [ ] Notification messages include relevant order details (driver name, price, etc.)
- [ ] All PHPUnit tests pass: `php artisan test --compact tests/Feature/ExpoPushServiceTest.php tests/Feature/OrderPushNotificationTest.php`
- [ ] Pint formatting applied: `vendor/bin/pint --dirty --format agent`
- [ ] `eas.json` has development, preview, and production profiles
- [ ] `app.json` has correct bundle identifiers, permissions, and plugin list
- [ ] Test build works: `eas build --profile preview --platform android`
