---
phase: 6
title: "Driver React Native App"
status: pending
depends_on: [1, 2, 3, 4, 5]
---

# Phase 6 — Driver React Native App

Build the driver-facing mobile application within the shared Expo project: driver-specific config, phone+password auth, online/offline toggle with order offer cards, active order management with navigation, and earnings stats.

---

## 6.0 — Driver App Setup

### Goal
Configure driver-specific requirements in the shared Expo project: background location permissions, driver API module, and driver-specific theme application.

### Implementation

#### 6.0.1 Update `app.json` — add background location

Add to the existing `app.json` plugins array:

```json
{
  "plugins": [
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "Нужен доступ к геолокации для передачи вашего местоположения пассажирам и диспетчеру",
        "isAndroidBackgroundLocationEnabled": true,
        "isAndroidForegroundServiceEnabled": true
      }
    ],
    "expo-notifications",
    "expo-secure-store"
  ]
}
```

Add to `ios.infoPlist`:
```json
"UIBackgroundModes": ["location"]
```

Add to `android.permissions`:
```json
"ACCESS_BACKGROUND_LOCATION"
```

#### 6.0.2 Create `src/api/driver.ts`

```typescript
import apiClient from './client';
import { Order, DriverStats } from './types';

export async function goOnline(latitude: number, longitude: number): Promise<void> {
  await apiClient.post('/api/v1/driver/go-online', { latitude, longitude });
}

export async function goOffline(): Promise<void> {
  await apiClient.post('/api/v1/driver/go-offline');
}

export async function updateLocation(
  latitude: number,
  longitude: number,
  heading?: number | null
): Promise<void> {
  await apiClient.post('/api/v1/driver/location', {
    latitude,
    longitude,
    ...(heading !== null && heading !== undefined ? { heading } : {}),
  });
}

export async function acceptOrder(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/accept`);
  return data.data;
}

export async function declineOrder(orderId: number): Promise<void> {
  await apiClient.post(`/api/v1/driver/orders/${orderId}/decline`);
}

export async function arriveAtPickup(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/arrived`);
  return data.data;
}

export async function completeOrder(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/complete`);
  return data.data;
}

export async function getCurrentDriverOrder(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/driver/orders/active');
    return data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getDriverStats(): Promise<DriverStats> {
  const { data } = await apiClient.get<{ data: DriverStats }>('/api/v1/driver/stats');
  return data.data;
}
```

#### 6.0.3 Create `src/hooks/useDriverLocation.ts`

Background location tracking for drivers. Sends location to server every 10 seconds while online.

```typescript
import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { updateLocation } from '../api/driver';

interface UseDriverLocationOptions {
  enabled: boolean; // true when driver is online
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  heading: number | null;
}

export function useDriverLocation({ enabled }: UseDriverLocationOptions): LocationCoords | null {
  const coordsRef = useRef<LocationCoords | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Also request background for when app is backgrounded
      const bgStatus = await Location.requestBackgroundPermissionsAsync();
      // Continue even if background denied — foreground still works

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (loc) => {
          coordsRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
          };
        }
      );

      // Send location to server every 10 seconds
      intervalRef.current = setInterval(async () => {
        if (coordsRef.current) {
          try {
            await updateLocation(
              coordsRef.current.latitude,
              coordsRef.current.longitude,
              coordsRef.current.heading
            );
          } catch {
            // Silently fail — next interval will retry
          }
        }
      }, 10000);
    })();

    return () => {
      subscription?.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return coordsRef.current;
}
```

### Tests

#### `__tests__/api/driver.test.ts`
- `goOnline` calls POST `/api/v1/driver/go-online` with coordinates
- `goOffline` calls POST `/api/v1/driver/go-offline`
- `updateLocation` includes heading when provided, omits when null
- `acceptOrder` returns parsed order
- `declineOrder` calls correct endpoint
- `arriveAtPickup` returns updated order
- `completeOrder` returns updated order
- `getCurrentDriverOrder` returns null on 404
- `getDriverStats` returns parsed stats

#### `__tests__/hooks/useDriverLocation.test.ts`
- Does not start tracking when `enabled=false`
- Requests foreground permission when enabled
- Starts watching position
- Sends location to server at intervals
- Cleans up subscription and interval on disable

### Done When

- `app.json` has background location permissions for both platforms
- `src/api/driver.ts` covers all driver API endpoints
- `useDriverLocation` tracks and sends GPS while driver is online
- All tests pass

---

## 6.1 — Driver Auth Screen

### Goal
Build a phone + password login screen for drivers with dark theme styling.

### Design Brief

- **Purpose**: Drivers log in with credentials (assigned by admin) — phone number and password. No self-registration, no OTP.
- **Tone**: Professional, dark theme. Yellow accents on dark gray background. Signals "work mode".
- **Key Screens/States**:
  - **Default**: Phone input, password input, "Войти" button.
  - **Loading**: Button shows spinner, inputs disabled.
  - **Error**: Red error message below inputs ("Неверный номер или пароль").
- **Components**: Reuse `ActionButton` (adapt colors for dark theme via prop or wrapper)
- **Interactions**: Phone input has `keyboardType="phone-pad"`, password has `secureTextEntry`. Return key on password submits form.
- **Responsive**: Vertically centered with `KeyboardAvoidingView`. Inputs stretch full width with padding 24.
- **Accessibility**: Inputs labeled, error announced, button state communicated.

### Implementation

#### 6.1.1 Create `src/screens/driver/LoginScreen.tsx`

Layout (dark background `DriverColors.background`, padding 24):
1. Spacer (flex: 0.25)
2. Title: "AIYL Taxi" — `Typography.h1`, color `DriverColors.primary` (yellow on dark)
3. Subtitle: "Вход для водителей" — `Typography.body`, color `DriverColors.textSecondary`
4. Phone input (marginTop 40):
   - Label: "Номер телефона" — `Typography.caption`, `DriverColors.textSecondary`
   - `TextInput` — dark card bg (`DriverColors.cardBackground`), white text, border `DriverColors.border`, borderRadius 12, height 52, paddingHorizontal 16
   - `placeholder="+996 555 123 456"`, `placeholderTextColor={DriverColors.textMuted}`
   - `keyboardType="phone-pad"`, `autoComplete="tel"`
5. Password input (marginTop 16):
   - Label: "Пароль" — same style
   - `TextInput` — same dark style, `secureTextEntry={true}`
   - `placeholder="Введите пароль"`
   - `returnKeyType="go"`, `onSubmitEditing={handleLogin}`
6. Error message (marginTop 12, shown conditionally):
   - `DriverColors.danger` text
7. Login button (marginTop 24):
   - `ActionButton` title "Войти"
   - For dark theme: override button style with yellow bg, dark text (same as primary variant — works on dark bg)
   - Disabled when phone or password empty
8. Spacer (flex: 0.5)
9. Wrap all in `KeyboardAvoidingView`

State:
- `phone: string`
- `password: string`
- `loading: boolean`
- `error: string | null`

```typescript
const handleLogin = async () => {
  setLoading(true);
  setError(null);
  try {
    const response = await driverLogin(phone, password);
    await authContext.login(response.token, response.user);
    // RootNavigator will auto-switch to DriverStack
  } catch (e: any) {
    if (e.response?.status === 401 || e.response?.status === 422) {
      setError('Неверный номер или пароль');
    } else {
      setError('Ошибка подключения. Попробуйте ещё раз.');
    }
  } finally {
    setLoading(false);
  }
};
```

#### 6.1.2 Update `src/navigation/AuthStack.tsx`

The AuthStack currently only has client screens. For driver login, we have two approaches. Since drivers are a separate login flow, add a "Я водитель" link at the bottom of `PhoneLoginScreen` that navigates to `DriverLogin`:

Add to AuthStack:
```typescript
import DriverLoginScreen from '../screens/driver/LoginScreen';

// Add screen:
<Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
```

Update `AuthStackParamList`:
```typescript
export type AuthStackParamList = {
  PhoneLogin: undefined;
  OtpVerify: { phone: string };
  DriverLogin: undefined;
};
```

Add to bottom of `PhoneLoginScreen` (below the Spacer):
```typescript
<TouchableOpacity
  onPress={() => navigation.navigate('DriverLogin')}
  style={{ alignSelf: 'center', paddingVertical: 12 }}
>
  <Text style={[Typography.caption, { color: ClientColors.textSecondary }]}>
    Я водитель
  </Text>
</TouchableOpacity>
```

### Tests

#### `__tests__/screens/driver/LoginScreen.test.tsx`
- Renders phone and password inputs
- Renders "Войти" button
- Button disabled when phone or password empty
- Calls `driverLogin` with phone and password on submit
- Shows loading indicator during API call
- Shows error message on 401 response
- Shows network error message on other failures
- Navigates to driver app on success (via AuthContext)
- Password input has `secureTextEntry`
- Dark theme background color applied

### Done When

- Driver login screen renders with dark theme
- Phone and password fields validate (non-empty)
- Successful login stores token and transitions to driver app
- Error messages display for invalid credentials and network errors
- "Я водитель" link on client login screen navigates to driver login
- All tests pass

---

## 6.2 — Driver Home — Online/Offline + Order Offers

### Goal
Build the driver's main screen: toggle online/offline status, receive order offers via Pusher with a 10-second countdown, and accept or decline orders.

### Design Brief

- **Purpose**: The driver's control center — go online to receive orders, see incoming requests, accept or pass.
- **Tone**: Dark, focused, professional. Yellow accent for active/online state. Red for offline. Large toggle for quick thumb access.
- **Key Screens/States**:
  1. **Offline**: Large toggle switch (OFF), "Вы не на линии" text. Gray/muted state.
  2. **Online, waiting**: Toggle ON (yellow glow), "На линии" text, "Ожидаем заказ..." subtitle. Map showing driver's location.
  3. **Order offer**: `OrderOfferCard` slides up from bottom with pickup address, price, distance, and a circular countdown timer (10s). Two buttons: "Принять" (green) and "Пропустить" (gray).
  4. **Offer expired**: Card auto-dismisses when countdown reaches 0 (same as decline).
- **Components**: `OnlineToggle`, `OrderOfferCard`
- **Interactions**: Toggle is a large pressable area (not a tiny switch). Order card has prominent accept button. Countdown is visual (circular progress).
- **Responsive**: Toggle centered on screen. Offer card overlays bottom half.
- **Accessibility**: Toggle state announced. Countdown timer has live region. Accept/decline buttons clearly labeled.

### Implementation

#### 6.2.1 Create `src/components/OnlineToggle.tsx`

Props:
- `isOnline: boolean`
- `onToggle: () => void`
- `loading?: boolean`

Layout:
- Circular button, 120x120, centered
- Offline: `DriverColors.cardBackground` bg, border `DriverColors.border`, text "OFF" in `DriverColors.textMuted`
- Online: `DriverColors.primary` bg (yellow), text "ON" in `DriverColors.background` (dark)
- Animated transition: `Animated.timing` on background color (use interpolation), scale bounce on press (1.0 → 0.95 → 1.0)
- Loading state: `ActivityIndicator` instead of text
- Below circle: status text
  - Online: "На линии" — `DriverColors.primary`, `Typography.h3`
  - Offline: "Не на линии" — `DriverColors.textMuted`, `Typography.h3`

```typescript
import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export default function OnlineToggle({
  isOnline,
  onToggle,
  loading = false,
}: OnlineToggleProps): JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOnline }}
          accessibilityLabel={isOnline ? 'Выключить линию' : 'Включить линию'}
          style={[
            styles.circle,
            isOnline ? styles.circleOnline : styles.circleOffline,
          ]}
        >
          {loading ? (
            <ActivityIndicator
              size="large"
              color={isOnline ? DriverColors.background : DriverColors.textMuted}
            />
          ) : (
            <Text
              style={[
                styles.circleText,
                { color: isOnline ? DriverColors.background : DriverColors.textMuted },
              ]}
            >
              {isOnline ? 'ON' : 'OFF'}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
      <Text
        style={[
          Typography.h3,
          {
            color: isOnline ? DriverColors.primary : DriverColors.textMuted,
            marginTop: 16,
          },
        ]}
      >
        {isOnline ? 'На линии' : 'Не на линии'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  circleOnline: {
    backgroundColor: DriverColors.primary,
    borderColor: DriverColors.primaryDark,
  },
  circleOffline: {
    backgroundColor: DriverColors.cardBackground,
    borderColor: DriverColors.border,
  },
  circleText: {
    fontSize: 28,
    fontWeight: '800',
  },
});
```

#### 6.2.2 Create `src/components/OrderOfferCard.tsx`

Props:
- `order: Order` — the offered order
- `onAccept: () => void`
- `onDecline: () => void`
- `countdownSeconds?: number` — default 10

State:
- `remaining: number` — countdown from `countdownSeconds`
- `progress: Animated.Value` — 1 → 0 for circular progress

Behavior:
- On mount: start `setInterval` decrementing `remaining` every second
- Animate `progress` from 1 to 0 over `countdownSeconds * 1000` ms
- When `remaining === 0`: call `onDecline()` automatically
- Clean up interval and animation on unmount

Layout (dark card, `DriverColors.cardBackground`, borderRadius 20, padding 20):
```
┌──────────────────────────────────────┐
│           ⏱ 8                        │  ← countdown circle (top-right)
│                                      │
│  📍 ул. Ленина 5                     │  ← pickup address
│  Стоимость: 80 сом                   │  ← price, yellow text
│                                      │
│  ┌──────────┐    ┌──────────┐        │
│  │ Принять  │    │ Пропустить│       │
│  │  (green) │    │  (gray)   │       │
│  └──────────┘    └──────────┘        │
└──────────────────────────────────────┘
```

Countdown circle (top-right corner):
- `View` 48x48, circular
- SVG-less approach: Use two half-circle `View`s with rotation for progress, OR use a simple text countdown with colored background
- Simpler: circular `View` with `borderWidth: 3`, `borderColor: DriverColors.primary`, with remaining number centered. Opacity fades as time runs out.

Accept button: `backgroundColor: DriverColors.success`, text "Принять", white text, height 52, borderRadius 12
Decline button: `backgroundColor: DriverColors.border`, text "Пропустить", `DriverColors.textSecondary` text

Both buttons side by side, `flexDirection: 'row'`, gap 12, accept has `flex: 2`, decline has `flex: 1`.

```typescript
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Order } from '../api/types';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface OrderOfferCardProps {
  order: Order;
  onAccept: () => void;
  onDecline: () => void;
  countdownSeconds?: number;
}

export default function OrderOfferCard({
  order,
  onAccept,
  onDecline,
  countdownSeconds = 10,
}: OrderOfferCardProps): JSX.Element {
  const [remaining, setRemaining] = useState(countdownSeconds);
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    Animated.timing(opacityAnim, {
      toValue: 0.3,
      duration: countdownSeconds * 1000,
      useNativeDriver: true,
    }).start();

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.card}>
      {/* Countdown */}
      <Animated.View style={[styles.countdown, { opacity: opacityAnim }]}>
        <Text style={styles.countdownText}>{remaining}</Text>
      </Animated.View>

      {/* Order details */}
      <Text style={styles.addressLabel}>Адрес подачи</Text>
      <Text style={styles.address}>
        {order.pickup_address || 'Геолокация клиента'}
      </Text>
      <Text style={styles.price}>{order.price} сом</Text>

      {/* Action buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={onAccept}
          style={[styles.button, styles.acceptButton]}
          accessibilityLabel="Принять заказ"
        >
          <Text style={styles.acceptText}>Принять</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDecline}
          style={[styles.button, styles.declineButton]}
          accessibilityLabel="Пропустить заказ"
        >
          <Text style={styles.declineText}>Пропустить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 20,
    padding: 20,
    position: 'relative',
  },
  countdown: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: DriverColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    color: DriverColors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  addressLabel: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    marginBottom: 4,
  },
  address: {
    ...Typography.h3,
    color: DriverColors.textPrimary,
    marginBottom: 8,
  },
  price: {
    ...Typography.h2,
    color: DriverColors.primary,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: DriverColors.success,
  },
  declineButton: {
    flex: 1,
    backgroundColor: DriverColors.border,
  },
  acceptText: {
    ...Typography.button,
    color: DriverColors.white,
  },
  declineText: {
    ...Typography.button,
    color: DriverColors.textSecondary,
  },
});
```

#### 6.2.3 Create `src/hooks/useDriverOrder.ts`

Central hook for driver order lifecycle.

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { Order } from '../api/types';
import * as driverApi from '../api/driver';
import { usePusher } from './usePusher';
import { useAuth } from '../context/AuthContext';

type DriverPhase =
  | { phase: 'offline' }
  | { phase: 'online_idle' }
  | { phase: 'offer'; order: Order }
  | { phase: 'active'; order: Order }
  | { phase: 'arrived'; order: Order }
  | { phase: 'completed'; order: Order };

interface UseDriverOrderReturn {
  state: DriverPhase;
  isOnline: boolean;
  toggleOnline: (latitude: number, longitude: number) => Promise<void>;
  acceptOffer: () => Promise<void>;
  declineOffer: () => void;
  markArrived: () => Promise<void>;
  markCompleted: () => Promise<void>;
  dismissCompleted: () => void;
  loading: boolean;
  error: string | null;
}

export function useDriverOrder(): UseDriverOrderReturn {
  const { user } = useAuth();
  const [state, setState] = useState<DriverPhase>({ phase: 'offline' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentOrderRef = useRef<Order | null>(null);
  const isOnline = state.phase !== 'offline';

  // Check for existing active order on mount
  useEffect(() => {
    (async () => {
      try {
        const current = await driverApi.getCurrentDriverOrder();
        if (current) {
          currentOrderRef.current = current;
          if (current.status === 'accepted') {
            setState({ phase: 'active', order: current });
          } else if (current.status === 'arrived') {
            setState({ phase: 'arrived', order: current });
          }
        }
      } catch {
        // No active order
      }
    })();
  }, []);

  // Pusher — listen for new order offers and cancellations
  const handleDriverOffered = useCallback((data: { order: Order }) => {
    currentOrderRef.current = data.order;
    setState({ phase: 'offer', order: data.order });
  }, []);

  const handleOrderCancelled = useCallback(() => {
    currentOrderRef.current = null;
    setState((prev) => {
      if (prev.phase === 'offline') return prev;
      return { phase: 'online_idle' };
    });
  }, []);

  usePusher({
    channelName: user ? `private-driver.${user.id}` : null,
    events: {
      DriverOffered: handleDriverOffered,
      OrderCancelled: handleOrderCancelled,
    },
    enabled: isOnline,
  });

  const toggleOnline = useCallback(async (latitude: number, longitude: number) => {
    setLoading(true);
    setError(null);
    try {
      if (isOnline) {
        await driverApi.goOffline();
        setState({ phase: 'offline' });
      } else {
        await driverApi.goOnline(latitude, longitude);
        setState({ phase: 'online_idle' });
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Ошибка соединения');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  const acceptOffer = useCallback(async () => {
    const order = currentOrderRef.current;
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      const accepted = await driverApi.acceptOrder(order.id);
      currentOrderRef.current = accepted;
      setState({ phase: 'active', order: accepted });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось принять заказ');
      setState({ phase: 'online_idle' });
    } finally {
      setLoading(false);
    }
  }, []);

  const declineOffer = useCallback(async () => {
    const order = currentOrderRef.current;
    if (!order) return;
    try {
      await driverApi.declineOrder(order.id);
    } catch {
      // Ignore — server will auto-reassign
    }
    currentOrderRef.current = null;
    setState({ phase: 'online_idle' });
  }, []);

  const markArrived = useCallback(async () => {
    const order = currentOrderRef.current;
    if (!order) return;
    setLoading(true);
    try {
      const arrived = await driverApi.arriveAtPickup(order.id);
      currentOrderRef.current = arrived;
      setState({ phase: 'arrived', order: arrived });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  const markCompleted = useCallback(async () => {
    const order = currentOrderRef.current;
    if (!order) return;
    setLoading(true);
    try {
      const completed = await driverApi.completeOrder(order.id);
      currentOrderRef.current = completed;
      setState({ phase: 'completed', order: completed });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissCompleted = useCallback(() => {
    currentOrderRef.current = null;
    setState({ phase: 'online_idle' });
  }, []);

  return {
    state,
    isOnline,
    toggleOnline,
    acceptOffer,
    declineOffer,
    markArrived,
    markCompleted,
    dismissCompleted,
    loading,
    error,
  };
}
```

#### 6.2.4 Create `src/screens/driver/HomeScreen.tsx`

Full-screen dark background. Structure:
```
<View style={{ flex: 1, backgroundColor: DriverColors.background }}>
  <SafeAreaView style={{ flex: 1 }}>
    {/* Header: driver name + logout */}
    <Header />

    {/* Main content */}
    {state.phase === 'offline' || state.phase === 'online_idle' ? (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <OnlineToggle isOnline={isOnline} onToggle={handleToggle} loading={loading} />
        {isOnline && (
          <Text style={waitingTextStyle}>Ожидаем заказ...</Text>
        )}
      </View>
    ) : null}

    {/* Order offer overlay */}
    {state.phase === 'offer' && (
      <View style={overlayStyle}>
        <OrderOfferCard
          order={state.order}
          onAccept={acceptOffer}
          onDecline={declineOffer}
        />
      </View>
    )}
  </SafeAreaView>
</View>
```

Header (row, paddingHorizontal 20, paddingVertical 12):
- Left: "Привет, {user.name}" — `Typography.body`, `DriverColors.textPrimary`
- Right: "Выйти" text button — `DriverColors.textMuted`, calls `auth.logout()`

`handleToggle`:
```typescript
const handleToggle = async () => {
  // Need current location to go online
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await toggleOnline(location.coords.latitude, location.coords.longitude);
};
```

When `state.phase === 'active'` or `state.phase === 'arrived'`: navigate to `OrderActive` screen (handled in 6.5 navigation, but this screen should detect it):
```typescript
useEffect(() => {
  if (state.phase === 'active' || state.phase === 'arrived') {
    navigation.navigate('OrderActive', { orderId: state.order.id });
  }
}, [state.phase]);
```

### Tests

#### `__tests__/components/OnlineToggle.test.tsx`
- Renders "OFF" and "Не на линии" when offline
- Renders "ON" and "На линии" when online
- Calls `onToggle` on press
- Shows ActivityIndicator when loading
- Has correct accessibility role "switch"

#### `__tests__/components/OrderOfferCard.test.tsx`
- Renders pickup address and price
- Countdown decrements every second
- Calls `onDecline` when countdown reaches 0
- Calls `onAccept` when accept button pressed
- Calls `onDecline` when decline button pressed

#### `__tests__/hooks/useDriverOrder.test.ts`
- Initial state is offline
- `toggleOnline` transitions to online_idle
- `toggleOnline` again transitions to offline
- Handles DriverOffered event → offer phase
- `acceptOffer` transitions to active phase
- `declineOffer` returns to online_idle
- Handles OrderCancelled event during active → online_idle
- `markArrived` transitions to arrived phase
- `markCompleted` transitions to completed phase
- `dismissCompleted` returns to online_idle
- Restores active order on mount

#### `__tests__/screens/driver/HomeScreen.test.tsx`
- Shows offline toggle by default
- Shows online toggle after going online
- Shows "Ожидаем заказ..." when online
- Shows OrderOfferCard when order offered
- Shows driver name in header
- Logout button calls auth.logout

### Done When

- Driver can toggle online/offline
- Going online sends GPS coordinates to server
- Pusher delivers order offers in real-time
- Order offer card shows with 10s countdown
- Accept navigates to active order flow
- Decline/timeout returns to waiting state
- Cancelled order returns to waiting state
- All tests pass

---

## 6.3 — Driver Active Order

### Goal
Build the active order screen: map showing route to client pickup, arrive/complete action buttons, and external navigation link to Apple Maps or Google Maps.

### Design Brief

- **Purpose**: Guide the driver to the pickup point, then allow marking arrival and trip completion.
- **Tone**: Dark, functional, map-dominant. Large bottom action buttons. Clear status progression.
- **Key Screens/States**:
  1. **En route to pickup** (status=accepted): Map with driver marker + pickup pin. Bottom: client info, "Навигация" button (opens external maps), "Я на месте" yellow button.
  2. **Arrived, waiting** (status=arrived): Map same. Bottom: "Клиент уведомлён" green checkmark text, client phone button, "Завершить поездку" yellow button.
  3. **Completed**: Brief "Заказ завершён! +80 сом" confirmation card with "Готово" button → back to home.
- **Components**: Reuse `ActionButton`, new inline layout
- **Interactions**: "Навигация" opens native maps app with directions to pickup. Phone button calls client. Action buttons are full-width, 56px tall.
- **Responsive**: Map fills top 60%. Bottom card fills remaining 40%. Safe area padding at bottom.
- **Accessibility**: Status announced. Navigation and phone buttons labeled.

### Implementation

#### 6.3.1 Create `src/screens/driver/OrderActiveScreen.tsx`

Props/params: receives `orderId` from navigation, but actual order data comes from `useDriverOrder` state.

Layout:
```
<View style={{ flex: 1, backgroundColor: DriverColors.background }}>
  {/* Map: top 60% */}
  <MapView style={{ flex: 0.6 }}>
    {/* Driver location marker — blue dot (showsUserLocation) */}
    {/* Pickup marker — yellow pin at order.pickup_latitude/longitude */}
    <Marker
      coordinate={{
        latitude: order.pickup_latitude,
        longitude: order.pickup_longitude,
      }}
      title={order.pickup_address || 'Клиент'}
    />
  </MapView>

  {/* Bottom card: 40% */}
  <View style={bottomCardStyle}>
    {state.phase === 'active' && <EnRouteCard />}
    {state.phase === 'arrived' && <ArrivedCard />}
    {state.phase === 'completed' && <CompletedCard />}
  </View>
</View>
```

**EnRouteCard** (phase === 'active'):
```
┌──────────────────────────────────────┐
│  📍 ул. Ленина 5                     │  ← pickup address
│  Клиент: +996555123456    📞         │  ← phone with call button
│                                      │
│  ┌─────────────────────────┐         │
│  │   🗺 Навигация           │         │  ← opens external maps
│  └─────────────────────────┘         │
│  ┌─────────────────────────┐         │
│  │   Я на месте            │         │  ← ActionButton primary
│  └─────────────────────────┘         │
└──────────────────────────────────────┘
```

"Навигация" button opens external maps:
```typescript
import { Linking, Platform } from 'react-native';

const openNavigation = (lat: number, lng: number) => {
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lng}&dirflg=d`,
    android: `google.navigation:q=${lat},${lng}&mode=d`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  });
  if (url) {
    Linking.openURL(url);
  }
};
```

"Я на месте" calls `markArrived()`.

**ArrivedCard** (phase === 'arrived'):
```
┌──────────────────────────────────────┐
│  ✅ Вы на месте                      │  ← green text
│  Клиент уведомлён                    │
│                                      │
│  📍 ул. Ленина 5                     │
│  Клиент: +996555123456    📞         │
│                                      │
│  ┌─────────────────────────┐         │
│  │   Завершить поездку     │         │  ← ActionButton primary
│  └─────────────────────────┘         │
└──────────────────────────────────────┘
```

"Завершить поездку" calls `markCompleted()`.

Phone call button: `Linking.openURL('tel:' + order.driver?.phone)` — wait, the order from driver perspective has the *client* info. Based on the OrderResource shape, `order.driver` contains *driver* info. The client phone is not in the resource. The driver already sees the pickup location on the map. If the API adds client phone later, use it. For now, show pickup address only.

Actually, re-reading the OrderResource — the API returns `driver` nested object. From the driver's perspective, the client's phone might be at a top-level field or in a `client` nested object. Since the spec only shows `driver` in the resource, we'll assume the backend will add `client.phone` or the driver navigates by address. For the phone button: if `order` has a client phone field, show it. Otherwise, omit the phone button.

```typescript
// Conditional phone button:
{order.client_phone && (
  <TouchableOpacity
    onPress={() => Linking.openURL(`tel:${order.client_phone}`)}
    accessibilityLabel="Позвонить клиенту"
    style={styles.phoneButton}
  >
    <Text style={styles.phoneIcon}>📞</Text>
  </TouchableOpacity>
)}
```

**CompletedCard** (phase === 'completed'):
```
┌──────────────────────────────────────┐
│        ✅                            │
│  Заказ завершён!                     │
│  + 80 сом                            │  ← price in yellow, large
│                                      │
│  ┌─────────────────────────┐         │
│  │   Готово                │         │  ← returns to home
│  └─────────────────────────┘         │
└──────────────────────────────────────┘
```

"Готово" calls `dismissCompleted()` and `navigation.goBack()` (or navigation resets based on state change detected in HomeScreen).

#### 6.3.2 Map configuration

MapView props:
- `style={{ flex: 0.6 }}`
- `initialRegion` centered between driver and pickup
- `showsUserLocation={true}` — driver's blue dot
- `showsMyLocationButton={true}`
- Dark map style for consistency (use `customMapStyle` with dark JSON or `userInterfaceStyle="dark"`)

Fit map to show both driver and pickup:
```typescript
const mapRef = useRef<MapView>(null);

useEffect(() => {
  if (mapRef.current && order) {
    mapRef.current.fitToCoordinates(
      [
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: order.pickup_latitude, longitude: order.pickup_longitude },
      ],
      {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      }
    );
  }
}, [order]);
```

#### 6.3.3 Bottom card styling

```typescript
const bottomCardStyle: ViewStyle = {
  flex: 0.4,
  backgroundColor: DriverColors.background,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 34, // safe area
  marginTop: -24, // overlap map slightly
};
```

### Tests

#### `__tests__/screens/driver/OrderActiveScreen.test.tsx`
- Renders map with pickup marker
- Shows pickup address
- Shows "Я на месте" button in active phase
- "Я на месте" calls `markArrived`
- Shows "Вы на месте" and "Завершить поездку" in arrived phase
- "Завершить поездку" calls `markCompleted`
- Shows completed card with price
- "Готово" dismisses and returns to home
- "Навигация" button calls Linking.openURL with correct platform URL
- Phone button calls Linking.openURL with tel: scheme (when client phone available)

### Done When

- Map shows driver location and pickup pin
- External navigation opens Apple Maps/Google Maps with directions
- "Я на месте" transitions to arrived state and notifies client
- "Завершить поездку" completes the order
- Completed card shows earnings and returns driver to home
- Phone call to client works (when phone available)
- All tests pass

---

## 6.4 — Driver Stats

### Goal
Build the earnings/stats screen showing order counts and earnings for today, this week, this month, and all time.

### Design Brief

- **Purpose**: Quick glance at earnings. Motivational dashboard for drivers.
- **Tone**: Dark, data-focused. Yellow numbers on dark cards. Grid layout.
- **Key Screens/States**:
  - **Loaded**: 2x2 grid of stat cards (today, week, month, total).
  - **Loading**: Skeleton placeholder or ActivityIndicator.
  - **Error**: "Не удалось загрузить статистику" + retry button.
- **Components**: `StatCard`
- **Interactions**: Pull-to-refresh only. No filtering or date picking (MVP).
- **Responsive**: Grid adapts — 2 columns on all phone sizes. Cards have equal width with 12px gap.
- **Accessibility**: Each card has `accessibilityLabel` with full text (e.g., "Сегодня: 5 заказов, 400 сом").

### Implementation

#### 6.4.1 Create `src/components/StatCard.tsx`

Props:
- `title: string` — e.g., "Сегодня"
- `orders: number`
- `earnings: number`

Layout (dark card bg, borderRadius 16, padding 16):
```
┌────────────────────┐
│  Сегодня           │  ← title, caption, muted
│                    │
│  400 сом           │  ← earnings, h2, yellow (primary)
│  5 заказов         │  ← orders count, body, secondary text
└────────────────────┘
```

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DriverColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface StatCardProps {
  title: string;
  orders: number;
  earnings: number;
}

export default function StatCard({ title, orders, earnings }: StatCardProps): JSX.Element {
  const ordersLabel = orders === 1 ? 'заказ' : orders < 5 ? 'заказа' : 'заказов';

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${title}: ${orders} ${ordersLabel}, ${earnings} сом`}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.earnings}>{earnings} сом</Text>
      <Text style={styles.orders}>
        {orders} {ordersLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DriverColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    flex: 1,
  },
  title: {
    ...Typography.caption,
    color: DriverColors.textMuted,
    marginBottom: 8,
  },
  earnings: {
    ...Typography.h2,
    color: DriverColors.primary,
    marginBottom: 4,
  },
  orders: {
    ...Typography.body,
    color: DriverColors.textSecondary,
  },
});
```

#### 6.4.2 Create `src/screens/driver/StatsScreen.tsx`

State:
- `stats: DriverStats | null`
- `loading: boolean`
- `refreshing: boolean`
- `error: string | null`

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDriverStats } from '../../api/driver';
import { DriverStats } from '../../api/types';
import StatCard from '../../components/StatCard';
import ActionButton from '../../components/ActionButton';
import { DriverColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

export default function StatsScreen(): JSX.Element {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const data = await getDriverStats();
      setStats(data);
    } catch {
      setError('Не удалось загрузить статистику');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={DriverColors.primary} />
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <ActionButton title="Повторить" onPress={() => fetchStats()} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Статистика</Text>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchStats(true)}
            tintColor={DriverColors.primary}
          />
        }
      >
        <View style={styles.grid}>
          <View style={styles.row}>
            <StatCard title="Сегодня" orders={stats!.today.orders} earnings={stats!.today.earnings} />
            <View style={{ width: 12 }} />
            <StatCard title="Неделя" orders={stats!.week.orders} earnings={stats!.week.earnings} />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <StatCard title="Месяц" orders={stats!.month.orders} earnings={stats!.month.earnings} />
            <View style={{ width: 12 }} />
            <StatCard title="Всего" orders={stats!.total.orders} earnings={stats!.total.earnings} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DriverColors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DriverColors.background,
    paddingHorizontal: 24,
  },
  header: {
    ...Typography.h1,
    color: DriverColors.textPrimary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  scrollContent: {
    padding: 20,
  },
  grid: {},
  row: {
    flexDirection: 'row',
  },
  errorText: {
    ...Typography.body,
    color: DriverColors.danger,
    textAlign: 'center',
  },
});
```

### Tests

#### `__tests__/components/StatCard.test.tsx`
- Renders title, earnings with "сом", and order count
- Correct Russian pluralization: 1 заказ, 3 заказа, 5 заказов
- Has correct accessibility label

#### `__tests__/screens/driver/StatsScreen.test.tsx`
- Shows loading indicator initially
- Renders 4 stat cards after fetch
- Pull-to-refresh triggers re-fetch
- Shows error message and retry button on failure
- Retry button re-fetches stats

### Done When

- Stats screen loads and displays 2x2 grid of earnings cards
- All 4 periods shown: today, week, month, total
- Pull-to-refresh reloads stats
- Error state with retry works
- Russian pluralization correct for order counts
- Dark theme applied throughout
- All tests pass

---

## 6.5 — Driver Navigation

### Goal
Wire up the driver navigation stack and integrate with RootNavigator so that authenticated drivers are routed to the driver app instead of the client app.

### Implementation

#### 6.5.1 Create `src/navigation/DriverStack.tsx`

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverHomeScreen from '../screens/driver/HomeScreen';
import OrderActiveScreen from '../screens/driver/OrderActiveScreen';
import StatsScreen from '../screens/driver/StatsScreen';
import { DriverStackParamList } from './types';
import { DriverColors } from '../theme/colors';

const Stack = createNativeStackNavigator<DriverStackParamList>();

export default function DriverStack(): JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: DriverColors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
      <Stack.Screen
        name="OrderActive"
        component={OrderActiveScreen}
        options={{
          gestureEnabled: false, // prevent swipe-back during active order
        }}
      />
      <Stack.Screen name="Stats" component={StatsScreen} />
    </Stack.Navigator>
  );
}
```

#### 6.5.2 Update `src/navigation/RootNavigator.tsx`

Replace `DriverPlaceholder` with actual `DriverStack`:

```typescript
import DriverStack from './DriverStack';

// In the navigator, replace:
// <Stack.Screen name="DriverApp" component={DriverPlaceholder} />
// with:
<Stack.Screen name="DriverApp" component={DriverStack} />
```

Remove the `DriverPlaceholder` function.

#### 6.5.3 Add Stats navigation to DriverHomeScreen

Add a stats button in the DriverHomeScreen header (top-right or as a small icon):

```typescript
// In DriverHomeScreen header, add:
<TouchableOpacity
  onPress={() => navigation.navigate('Stats')}
  style={{ paddingHorizontal: 8 }}
  accessibilityLabel="Статистика"
>
  <Text style={{ color: DriverColors.textSecondary, fontSize: 16 }}>📊</Text>
</TouchableOpacity>
```

Header layout becomes:
```
┌──────────────────────────────────────────┐
│  Привет, Азамат      📊     Выйти       │
└──────────────────────────────────────────┘
```

#### 6.5.4 Navigation flow summary

```
App.tsx
  └─ AuthProvider
       └─ RootNavigator
            ├─ (isLoading) → Loading spinner
            ├─ (!isAuthenticated) → AuthStack
            │     ├─ PhoneLogin
            │     ├─ OtpVerify
            │     └─ DriverLogin
            ├─ (role === 'client') → ClientTabs
            │     ├─ Home (tab)
            │     └─ History (tab)
            └─ (role === 'driver') → DriverStack
                  ├─ DriverHome
                  ├─ OrderActive
                  └─ Stats
```

#### 6.5.5 StatusBar configuration

In `App.tsx`, dynamically set StatusBar style based on user role:

```typescript
import { StatusBar } from 'expo-status-bar';

// Inside App component:
const { user } = useAuth();
const statusBarStyle = user?.role === 'driver' ? 'light' : 'dark';

return (
  <AuthProvider>
    <StatusBar style={statusBarStyle} />
    <RootNavigator />
  </AuthProvider>
);
```

Note: Since `useAuth` must be inside `AuthProvider`, extract StatusBar to a child component:

```typescript
function AppContent(): JSX.Element {
  const { user } = useAuth();
  return (
    <>
      <StatusBar style={user?.role === 'driver' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

### Tests

#### `__tests__/navigation/DriverStack.test.tsx`
- DriverHome is the initial route
- Navigation to OrderActive works
- Navigation to Stats works
- OrderActive has gesture disabled

#### `__tests__/navigation/RootNavigator.test.tsx` (update from Phase 5)
- Renders DriverStack when authenticated as driver (replace placeholder test)
- Renders ClientTabs when authenticated as client (existing test)
- StatusBar is "light" for driver, "dark" for client

### Done When

- Authenticated drivers see DriverHome → can navigate to OrderActive and Stats
- DriverHome shows stats button in header
- OrderActive prevents swipe-back gesture (no accidental dismissal during ride)
- Stats screen accessible from driver home
- RootNavigator correctly routes by role
- StatusBar adapts to theme (light for driver dark bg, dark for client light bg)
- Full navigation flow works: Login → Home → Accept Order → Active → Complete → Home
- All navigation tests pass
