---
phase: 5
title: "Client React Native App"
status: pending
depends_on: [1, 2, 3, 4]
---

# Phase 5 — Client React Native App

Build the passenger-facing mobile application: Expo project setup, OTP auth, GPS-based taxi calling, real-time order tracking via Pusher, and order history.

---

## 5.0 — Expo Project Setup

### Goal
Initialize the shared Expo managed-workflow project, install all dependencies, configure `app.json`, and create foundational files: API client, theme constants, TypeScript types, and utility modules.

### Implementation

#### 5.0.1 Initialize Expo Project

```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
```

#### 5.0.2 Install Dependencies

```bash
npx expo install expo-location expo-notifications expo-secure-store expo-linking expo-constants expo-status-bar
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context
npm install react-native-maps axios pusher-js dayjs
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo @types/react-native-maps
```

#### 5.0.3 Configure `app.json`

```json
{
  "expo": {
    "name": "Village Taxi",
    "slug": "village-taxi",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FBBF24"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.villagetaxi.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Нужен доступ к геолокации для определения точки подачи такси",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Нужен доступ к геолокации для отслеживания маршрута"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FBBF24"
      },
      "package": "com.villagetaxi.app",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    },
    "plugins": [
      "expo-location",
      "expo-notifications",
      "expo-secure-store"
    ]
  }
}
```

#### 5.0.4 Create `src/theme/colors.ts`

```typescript
export const ClientColors = {
  background: '#F9FAFB',
  primary: '#FBBF24',
  primaryDark: '#D97706',
  dark: '#1F2937',
  darkSecondary: '#374151',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  success: '#10B981',
  danger: '#EF4444',
  white: '#FFFFFF',
  border: '#E5E7EB',
  cardBackground: '#FFFFFF',
  mapOverlay: 'rgba(255,255,255,0.95)',
} as const;

export const DriverColors = {
  background: '#1F2937',
  backgroundSecondary: '#111827',
  primary: '#FBBF24',
  primaryDark: '#D97706',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#9CA3AF',
  success: '#10B981',
  danger: '#EF4444',
  cardBackground: '#374151',
  border: '#4B5563',
  white: '#FFFFFF',
} as const;
```

#### 5.0.5 Create `src/theme/typography.ts`

```typescript
import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  h1: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  } as TextStyle,
  h2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  } as TextStyle,
  h3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,
  body: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,
  bodyBold: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  } as TextStyle,
  caption: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  } as TextStyle,
  button: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  } as TextStyle,
  buttonLarge: {
    fontFamily,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  } as TextStyle,
} as const;
```

#### 5.0.6 Create `src/utils/constants.ts`

```typescript
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:8000' // TODO: replace with actual dev IP
  : 'https://api.villagetaxi.kg';

export const PUSHER_KEY = 'your-pusher-key';
export const PUSHER_CLUSTER = 'ap1';

export const ORDER_STATUSES = {
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const OTP_LENGTH = 4;
export const OTP_RESEND_DELAY_SECONDS = 60;

export const DEFAULT_MAP_REGION = {
  latitude: 42.87,
  longitude: 74.59,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export const FIXED_PRICE = 80; // сом
```

#### 5.0.7 Create `src/api/types.ts`

```typescript
export type OrderStatus =
  | 'searching'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Driver {
  name: string;
  phone: string;
  car_model: string;
  car_number: string;
  latitude: number;
  longitude: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  price: number;
  pickup_address: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  driver: Driver | null;
  created_at: string;
  accepted_at: string | null;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  role: 'client' | 'driver';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface DriverStats {
  today: { orders: number; earnings: number };
  week: { orders: number; earnings: number };
  month: { orders: number; earnings: number };
  total: { orders: number; earnings: number };
}
```

#### 5.0.8 Create `src/api/client.ts`

Axios instance with interceptors for auth token injection and 401 handling.

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { getToken, removeToken } from '../utils/storage';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// 401 interceptor — handled by AuthContext to trigger logout
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

#### 5.0.9 Create `src/utils/storage.ts`

```typescript
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<string | null> {
  return SecureStore.getItemAsync(USER_KEY);
}

export async function saveUser(user: object): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function removeUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([removeToken(), removeUser()]);
}
```

#### 5.0.10 Create `src/api/auth.ts`

```typescript
import apiClient from './client';
import { AuthResponse, User } from './types';

export async function sendOtp(phone: string): Promise<void> {
  await apiClient.post('/api/v1/auth/send-otp', { phone });
}

export async function verifyOtp(phone: string, code: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/v1/auth/verify-otp', { phone, code });
  return data;
}

export async function driverLogin(phone: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/v1/auth/driver-login', { phone, password });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/v1/auth/logout');
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/api/v1/auth/me');
  return data;
}

export async function registerPushToken(token: string): Promise<void> {
  await apiClient.put('/api/v1/auth/push-token', { expo_push_token: token });
}
```

#### 5.0.11 Create `src/api/orders.ts`

```typescript
import apiClient from './client';
import { Order, PaginatedResponse } from './types';

export async function createOrder(
  latitude: number,
  longitude: number,
  address?: string
): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>('/api/v1/client/orders', {
    pickup_latitude: latitude,
    pickup_longitude: longitude,
    pickup_address: address,
  });
  return data.data;
}

export async function getCurrentOrder(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/client/orders/active');
    return data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getOrder(id: number): Promise<Order> {
  const { data } = await apiClient.get<{ data: Order }>(`/api/v1/client/orders/${id}`);
  return data.data;
}

export async function cancelOrder(id: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/client/orders/${id}/cancel`);
  return data.data;
}

export async function getOrderHistory(page: number = 1): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<PaginatedResponse<Order>>('/api/v1/client/orders', {
    params: { page },
  });
  return data;
}
```

#### 5.0.12 Create `jest.config.js`

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterSetup: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-maps|pusher-js)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### Tests

- **`__tests__/api/client.test.ts`** — verify axios instance has correct baseURL, interceptors inject token, 401 triggers `onUnauthorized`
- **`__tests__/utils/storage.test.ts`** — mock `expo-secure-store`, test `saveToken`, `getToken`, `removeToken`, `clearAuth`
- **`__tests__/api/auth.test.ts`** — mock axios, verify `sendOtp` calls correct endpoint, `verifyOtp` returns parsed response

### Done When

- `npx expo start` launches without errors
- All dependencies installed and resolvable
- `src/api/client.ts` makes authenticated requests with token from SecureStore
- `src/api/types.ts` matches the OrderResource JSON shape from backend
- Theme files export correct color and typography constants
- Jest test suite runs with `npm test` and all tests pass

---

## 5.1 — Client Auth Screens

### Goal
Implement the OTP-based phone authentication flow for passengers: phone number input screen, OTP verification screen, and AuthContext that persists auth state via SecureStore.

### Design Brief

- **Purpose**: Allow village residents to log in with just their phone number — no passwords, no email. Minimal friction.
- **Tone**: Friendly, minimal. Yellow accent on white. Large inputs for older users.
- **Key Screens/States**:
  - **PhoneLoginScreen**: Phone input (prefilled +996), "Вызвать такси" / "Получить код" button. Loading state while OTP sends.
  - **OtpVerifyScreen**: 4-digit code input, auto-submit on last digit, resend countdown timer, error shake animation.
- **Components**: `OtpInput` (4 cells), `ActionButton` (full-width primary button)
- **Interactions**: Phone input auto-focuses, keyboard type `phone-pad`. OTP cells auto-advance. Back button returns to phone screen.
- **Responsive**: Content centered vertically with `KeyboardAvoidingView`. Works on small (iPhone SE) and large screens.
- **Accessibility**: All inputs have `accessibilityLabel`. Button disabled states clearly communicated. Error messages announced.

### Implementation

#### 5.1.1 Create `src/context/AuthContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../api/types';
import { getMe, logout as apiLogout, registerPushToken } from '../api/auth';
import { saveToken, saveUser, clearAuth, getToken, getUser } from '../utils/storage';
import { setOnUnauthorized } from '../api/client';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;       // true while checking stored token on mount
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logoutHandler = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore — token may already be invalid
    }
    await clearAuth();
    setUser(null);
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const storedToken = await getToken();
      if (storedToken) {
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          await clearAuth();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  // Register 401 handler
  useEffect(() => {
    setOnUnauthorized(() => {
      logoutHandler();
    });
  }, [logoutHandler]);

  const login = useCallback(async (token: string, userData: User) => {
    await saveToken(token);
    await saveUser(userData);
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout: logoutHandler,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
```

#### 5.1.2 Create `src/components/ActionButton.tsx`

Props:
- `title: string` — button label
- `onPress: () => void`
- `loading?: boolean` — shows ActivityIndicator, disables press
- `disabled?: boolean`
- `variant?: 'primary' | 'danger' | 'outline'` — default `'primary'`
- `style?: ViewStyle`

```typescript
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
  style?: ViewStyle;
}

export default function ActionButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ActionButtonProps): JSX.Element {
  const isDisabled = disabled || loading;

  const bgColor =
    variant === 'primary'
      ? ClientColors.primary
      : variant === 'danger'
        ? ClientColors.danger
        : 'transparent';

  const textColor =
    variant === 'primary'
      ? ClientColors.dark
      : variant === 'danger'
        ? ClientColors.white
        : ClientColors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        { backgroundColor: bgColor },
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[Typography.button, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  outline: {
    borderWidth: 2,
    borderColor: ClientColors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
```

#### 5.1.3 Create `src/components/OtpInput.tsx`

Props:
- `length: number` — default 4
- `onComplete: (code: string) => void`
- `error?: boolean` — triggers red border + shake animation

State: `values: string[]` array of length N, array of `TextInput` refs.

Behavior:
- Each cell is a `TextInput` with `maxLength={1}`, `keyboardType="number-pad"`.
- On text change: set value, auto-advance to next ref. On backspace of empty cell: go to previous ref.
- When all cells filled, call `onComplete(values.join(''))`.
- When `error` becomes `true`, run a horizontal shake `Animated.sequence` (translate X: 0 → -10 → 10 → -10 → 0, duration 50ms each) and clear all values.

```typescript
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;
}

export default function OtpInput({
  length = 4,
  onComplete,
  error = false,
}: OtpInputProps): JSX.Element {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      setValues(Array(length).fill(''));
      inputRefs.current[0]?.focus();
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newValues = [...values];
    newValues[index] = digit;
    setValues(newValues);

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newValues.every((v) => v !== '') && digit) {
      onComplete(newValues.join(''));
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}
    >
      {values.map((value, index) => (
        <TextInput
          key={index}
          ref={(ref) => { inputRefs.current[index] = ref; }}
          style={[
            styles.cell,
            value ? styles.cellFilled : null,
            error ? styles.cellError : null,
          ]}
          value={value}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          accessibilityLabel={`Цифра ${index + 1} из ${length}`}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  cell: {
    width: 56,
    height: 64,
    borderWidth: 2,
    borderColor: ClientColors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: ClientColors.dark,
    backgroundColor: ClientColors.white,
  },
  cellFilled: {
    borderColor: ClientColors.primary,
  },
  cellError: {
    borderColor: ClientColors.danger,
  },
});
```

#### 5.1.4 Create `src/screens/client/PhoneLoginScreen.tsx`

Layout (top to bottom, centered with padding 24):
1. Spacer (flex: 0.3)
2. Title: "Village Taxi" — `Typography.h1`, color `ClientColors.dark`
3. Subtitle: "Введите номер телефона" — `Typography.body`, color `ClientColors.textSecondary`, marginTop 8
4. Phone input container (marginTop 32):
   - Prefix label "+996" in a box, attached left
   - `TextInput` for remaining digits, `keyboardType="phone-pad"`, `maxLength={9}`, `placeholder="555 123 456"`
5. `ActionButton` title "Получить код" — marginTop 24, disabled when phone.length < 9
6. Spacer (flex: 0.5)
7. `KeyboardAvoidingView` wrapping entire content, `behavior="padding"` on iOS

State:
- `phone: string` — digits only, no prefix
- `loading: boolean`
- `error: string | null`

On submit:
1. Set loading true
2. Call `sendOtp('+996' + phone)`
3. On success: navigate to `OtpVerify` with params `{ phone: '+996' + phone }`
4. On error: set error message "Не удалось отправить код. Попробуйте ещё раз."
5. Set loading false

Navigation type: `NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>`

#### 5.1.5 Create `src/screens/client/OtpVerifyScreen.tsx`

Layout (centered, padding 24):
1. Back button (top-left, `TouchableOpacity` with "←" or chevron icon)
2. Title: "Введите код" — `Typography.h1`
3. Subtitle: "Код отправлен на {phone}" — `Typography.body`, `ClientColors.textSecondary`
4. `OtpInput` component — marginTop 32
5. Resend section — marginTop 24:
   - When timer > 0: "Отправить повторно через {seconds} сек" — gray text
   - When timer === 0: "Отправить код повторно" — `TouchableOpacity`, `ClientColors.primary`
6. Error text if present — `ClientColors.danger`, below OTP input

State:
- `loading: boolean`
- `error: boolean` — passed to `OtpInput.error` to trigger shake
- `resendTimer: number` — starts at `OTP_RESEND_DELAY_SECONDS` (60), counts down via `setInterval`

On OTP complete (`onComplete` callback):
1. Set loading true, error false
2. Call `verifyOtp(phone, code)`
3. On success: call `authContext.login(response.token, response.user)`
4. On error (422/401): set error true (triggers shake + clear), show "Неверный код"
5. Set loading false

On resend:
1. Call `sendOtp(phone)`
2. Reset timer to 60

Route params: `{ phone: string }` — received from PhoneLoginScreen.

### Tests

#### `__tests__/screens/client/PhoneLoginScreen.test.tsx`
- Renders phone input and button
- Button disabled when phone < 9 digits
- Button enabled when phone is 9 digits
- On press calls `sendOtp` with "+996" prefix
- Shows loading indicator during API call
- Navigates to OtpVerify on success
- Shows error message on API failure

#### `__tests__/screens/client/OtpVerifyScreen.test.tsx`
- Renders 4 OTP cells
- Auto-advances focus on digit entry
- Calls `verifyOtp` when all 4 digits entered
- Shows error shake on invalid code
- Resend timer counts down from 60
- Resend button appears when timer reaches 0
- Calls `sendOtp` on resend press

#### `__tests__/components/OtpInput.test.tsx`
- Renders correct number of cells
- Calls `onComplete` with full code string
- Clears and shakes on error prop change
- Backspace moves focus to previous cell

#### `__tests__/components/ActionButton.test.tsx`
- Renders title text
- Calls onPress when tapped
- Shows ActivityIndicator when loading
- Does not call onPress when disabled
- Applies correct variant styles

#### `__tests__/context/AuthContext.test.tsx`
- Provides user after login
- Clears user after logout
- Restores user from SecureStore on mount
- Handles expired token (401 from getMe) gracefully

### Done When

- Phone screen accepts 9-digit input, sends OTP, navigates to verify screen
- OTP screen auto-submits 4-digit code, authenticates, stores token
- AuthContext persists session across app restarts
- Error states display properly (network, invalid code)
- Resend timer works correctly
- All auth tests pass

---

## 5.2 — Client Home — Call Taxi

### Goal
Build the main client screen: a map showing the user's GPS location, a "Вызвать такси" button, and real-time order tracking through all states (searching, accepted, driver arrived, in progress, completed/cancelled) via Pusher.

### Design Brief

- **Purpose**: The core screen — call a taxi with one tap and watch the driver approach.
- **Tone**: Clean map-first UI. Minimal chrome. Yellow call button at bottom. Info cards slide up from bottom.
- **Key Screens/States**:
  1. **Idle**: Map centered on user's GPS pin. Bottom card: pickup address (reverse geocoded or "Текущее местоположение"), price "80 сом", yellow "Вызвать такси" button.
  2. **Searching** (status=searching): Pulsing animation on map pin. Bottom card: "Ищем водителя..." with spinning indicator. "Отменить" button (outline/danger).
  3. **Accepted**: Map shows user pin + driver pin. Bottom card: `DriverCard` with driver name, car, phone. "Водитель в пути" status. "Отменить" still available.
  4. **Driver Arrived** (status=arrived): Bottom card: `DriverCard`, status "Водитель прибыл!" with green accent. Phone call button.
  5. **In Progress** (status=in_progress): Bottom card: "Поездка..." status, driver info shown.
  6. **Completed**: Modal/card: "Поездка завершена! 80 сом". "Готово" button returns to idle.
  7. **Cancelled**: Toast/card: "Заказ отменён". Auto-dismiss after 3 seconds, return to idle.
- **Components**: `MapView` (react-native-maps), `DriverCard`, `ActionButton`
- **Interactions**: Map follows user location. Driver marker animates to new position. Pull-up card uses absolute positioning at bottom (no gesture library needed — fixed cards). Phone button opens `tel:` link.
- **Responsive**: Map fills screen. Bottom card is max 280px tall with rounded top corners. On small screens card content scrolls.
- **Accessibility**: Status changes announced via `accessibilityLiveRegion="polite"`. All buttons labeled. Map markers have labels.

### Implementation

#### 5.2.1 Create `src/hooks/useLocation.ts`

```typescript
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  heading: number | null;
  loading: boolean;
  error: string | null;
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    latitude: 42.87,
    longitude: 74.59,
    heading: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Нет доступа к геолокации',
        }));
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setState({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        heading: current.coords.heading,
        loading: false,
        error: null,
      });

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (loc) => {
          setState({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
            loading: false,
            error: null,
          });
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  return state;
}
```

#### 5.2.2 Create `src/hooks/usePusher.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';
import Pusher from 'pusher-js/react-native';
import { PUSHER_KEY, PUSHER_CLUSTER, API_BASE_URL } from '../utils/constants';
import { getToken } from '../utils/storage';

type EventCallback = (data: any) => void;

interface UsePusherOptions {
  channelName: string | null; // null = don't subscribe
  events: Record<string, EventCallback>;
  enabled?: boolean;
}

export function usePusher({ channelName, events, enabled = true }: UsePusherOptions): void {
  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    if (!channelName || !enabled) {
      return;
    }

    let cancelled = false;

    (async () => {
      const token = await getToken();

      if (cancelled) return;

      const pusher = new Pusher(PUSHER_KEY, {
        cluster: PUSHER_CLUSTER,
        authEndpoint: `${API_BASE_URL}/broadcasting/auth`,
        auth: {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      });

      pusherRef.current = pusher;

      const channel = pusher.subscribe(channelName);

      Object.entries(events).forEach(([eventName, callback]) => {
        // Laravel broadcasts as "App\\Events\\EventName" or ".EventName"
        channel.bind(eventName, callback);
      });
    })();

    return () => {
      cancelled = true;
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(channelName);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [channelName, enabled]);
  // Note: events intentionally excluded from deps to avoid reconnect on every render.
  // Callbacks should use refs or be stable.
}
```

#### 5.2.3 Create `src/hooks/useOrder.ts`

Central hook that manages the entire order lifecycle for the client.

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { Order, OrderStatus } from '../api/types';
import * as ordersApi from '../api/orders';
import { usePusher } from './usePusher';
import { useAuth } from '../context/AuthContext';

type ClientOrderState =
  | { phase: 'idle' }
  | { phase: 'searching'; order: Order }
  | { phase: 'accepted'; order: Order }
  | { phase: 'arrived'; order: Order }
  | { phase: 'in_progress'; order: Order }
  | { phase: 'completed'; order: Order }
  | { phase: 'cancelled' };

interface UseOrderReturn {
  state: ClientOrderState;
  callTaxi: (latitude: number, longitude: number, address?: string) => Promise<void>;
  cancelOrder: () => Promise<void>;
  dismissCompleted: () => void;
  loading: boolean;
  error: string | null;
}

function statusToPhase(status: OrderStatus): ClientOrderState['phase'] {
  switch (status) {
    case 'searching': return 'searching';
    case 'accepted': return 'accepted';
    case 'arrived': return 'arrived';
    case 'in_progress': return 'in_progress';
    case 'completed': return 'completed';
    case 'cancelled': return 'cancelled';
  }
}

export function useOrder(): UseOrderReturn {
  const { user } = useAuth();
  const [state, setState] = useState<ClientOrderState>({ phase: 'idle' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderRef = useRef<Order | null>(null);

  // Check for existing current order on mount
  useEffect(() => {
    (async () => {
      try {
        const current = await ordersApi.getCurrentOrder();
        if (current) {
          orderRef.current = current;
          setState({ phase: statusToPhase(current.status), order: current } as any);
        }
      } catch {
        // No current order — stay idle
      }
    })();
  }, []);

  // Pusher events
  const handleOrderAccepted = useCallback((data: { order: Order }) => {
    orderRef.current = data.order;
    setState({ phase: 'accepted', order: data.order });
  }, []);

  const handleDriverArrived = useCallback((data: { order: Order }) => {
    orderRef.current = data.order;
    setState({ phase: 'arrived', order: data.order });
  }, []);

  const handleOrderCompleted = useCallback((data: { order: Order }) => {
    orderRef.current = data.order;
    setState({ phase: 'completed', order: data.order });
  }, []);

  const handleOrderCancelled = useCallback(() => {
    orderRef.current = null;
    setState({ phase: 'cancelled' });
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
    }, 3000);
  }, []);

  usePusher({
    channelName: user ? `private-client.${user.id}` : null,
    events: {
      OrderAccepted: handleOrderAccepted,
      DriverArrived: handleDriverArrived,
      OrderCompleted: handleOrderCompleted,
      OrderCancelled: handleOrderCancelled,
    },
    enabled: state.phase !== 'idle',
  });

  const callTaxi = useCallback(async (latitude: number, longitude: number, address?: string) => {
    setLoading(true);
    setError(null);
    try {
      const order = await ordersApi.createOrder(latitude, longitude, address);
      orderRef.current = order;
      setState({ phase: 'searching', order });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelOrder = useCallback(async () => {
    const order = orderRef.current;
    if (!order) return;
    setLoading(true);
    try {
      await ordersApi.cancelOrder(order.id);
      orderRef.current = null;
      setState({ phase: 'cancelled' });
      setTimeout(() => {
        setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
      }, 3000);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Не удалось отменить заказ');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissCompleted = useCallback(() => {
    orderRef.current = null;
    setState({ phase: 'idle' });
  }, []);

  return { state, callTaxi, cancelOrder, dismissCompleted, loading, error };
}
```

#### 5.2.4 Create `src/components/DriverCard.tsx`

Props:
- `driver: Driver` — from order
- `status: 'accepted' | 'arrived' | 'in_progress'`

Layout (horizontal card, white bg, rounded 16, shadow, padding 16):
- Left: Circle avatar placeholder (first letter of name, yellow bg, dark text, 48x48)
- Middle (flex 1, marginLeft 12):
  - Driver name — `Typography.bodyBold`, `ClientColors.dark`
  - Car: "{car_model} · {car_number}" — `Typography.caption`, `ClientColors.textSecondary`
  - Status line:
    - accepted: "В пути к вам" — `ClientColors.primary`
    - arrived: "Водитель прибыл!" — `ClientColors.success`, bold
    - in_progress: "Поездка..." — `ClientColors.dark`
- Right: Phone call button — circular 48x48, yellow bg, phone icon (unicode "📞" or simple "✆" text)

Phone button `onPress`: `Linking.openURL('tel:' + driver.phone)`

#### 5.2.5 Create `src/screens/client/HomeScreen.tsx`

Full-screen structure:
```
<View style={{ flex: 1 }}>
  <MapView />           {/* fills entire screen */}
  <BottomCard />        {/* absolute positioned at bottom */}
  <CompletedModal />    {/* conditional overlay */}
  <CancelledToast />    {/* conditional toast at top */}
</View>
```

**MapView setup** (react-native-maps):
- `provider={PROVIDER_GOOGLE}` on Android, default on iOS
- `initialRegion` from `useLocation` coordinates with delta 0.015
- `showsUserLocation={true}`, `showsMyLocationButton={false}` (custom button)
- `ref` for `animateToRegion`
- When order has driver with coordinates: render `<Marker>` for driver at `(driver.latitude, driver.longitude)` with car emoji "🚗" or custom yellow marker
- `followsUserLocation={true}` when idle, `false` when tracking driver (so user can pan)
- Custom "my location" button (top-right, circular, crosshair icon) that re-centers map

**Bottom card states:**

1. **Idle state** — `phase === 'idle'`:
   ```
   ┌─────────────────────────────────┐
   │  📍 Текущее местоположение       │
   │  Стоимость: 80 сом              │
   │                                 │
   │  ┌─────────────────────────┐    │
   │  │   Вызвать такси         │    │  ← ActionButton primary
   │  └─────────────────────────┘    │
   └─────────────────────────────────┘
   ```
   - On press: `callTaxi(location.latitude, location.longitude)`
   - Disabled while `location.loading`

2. **Searching state** — `phase === 'searching'`:
   ```
   ┌─────────────────────────────────┐
   │  🔍 Ищем водителя...            │  ← pulsing dot animation
   │  Это может занять пару минут    │
   │                                 │
   │  ┌─────────────────────────┐    │
   │  │   Отменить              │    │  ← ActionButton variant="outline"
   │  └─────────────────────────┘    │
   └─────────────────────────────────┘
   ```
   - Pulsing dot: `Animated.loop(Animated.sequence([fadeIn, fadeOut]))` on a yellow circle

3. **Accepted / Driver Arrived / In Progress**:
   ```
   ┌─────────────────────────────────┐
   │  DriverCard                      │
   │  (shows driver, car, status,    │
   │   phone button)                  │
   │                                 │
   │  ┌─────────────────────────┐    │  ← only in accepted phase
   │  │   Отменить              │    │
   │  └─────────────────────────┘    │
   └─────────────────────────────────┘
   ```
   - Cancel button shown only when status is `accepted` (not after arrival)

4. **Completed overlay** — modal centered:
   ```
   ┌─────────────────────────────────┐
   │        ✅                        │
   │  Поездка завершена!             │
   │  Стоимость: 80 сом             │
   │                                 │
   │  ┌─────────────────────────┐    │
   │  │   Готово                │    │
   │  └─────────────────────────┘    │
   └─────────────────────────────────┘
   ```
   - On press: `dismissCompleted()`

5. **Cancelled toast** — top of screen, slides down:
   - "Заказ отменён" — red bg, white text
   - Auto-dismisses (handled by `useOrder`)

**Bottom card styling**:
- `position: 'absolute'`, `bottom: 0`, `left: 0`, `right: 0`
- `backgroundColor: ClientColors.white`
- `borderTopLeftRadius: 24`, `borderTopRightRadius: 24`
- `paddingHorizontal: 20`, `paddingTop: 20`, `paddingBottom: 34` (safe area)
- `shadowColor: '#000'`, `shadowOffset: { width: 0, height: -2 }`, `shadowOpacity: 0.1`, `shadowRadius: 8`
- Android `elevation: 8`

#### 5.2.6 Driver marker animation

When driver coordinates update (from Pusher `OrderAccepted` or periodic refresh), animate the marker:
- Use `Animated.timing` on latitude/longitude values (via `AnimatedRegion` from react-native-maps)
- Duration 1000ms, linear easing
- This creates smooth movement of the car marker on the map

#### 5.2.7 Periodic order refresh (fallback)

In `useOrder`, when `phase` is not `idle` and not `completed`/`cancelled`, set up a `setInterval` every 10 seconds to call `getOrder(orderId)` and update state. This covers cases where Pusher events are missed (network issues).

```typescript
useEffect(() => {
  if (state.phase === 'idle' || state.phase === 'completed' || state.phase === 'cancelled') {
    return;
  }
  const orderId = (state as any).order?.id;
  if (!orderId) return;

  const interval = setInterval(async () => {
    try {
      const fresh = await ordersApi.getOrder(orderId);
      orderRef.current = fresh;
      setState({ phase: statusToPhase(fresh.status), order: fresh } as any);
    } catch {
      // Ignore — Pusher is primary
    }
  }, 10000);

  return () => clearInterval(interval);
}, [state.phase]);
```

### Tests

#### `__tests__/hooks/useOrder.test.ts`
- Initial state is idle
- `callTaxi` transitions to searching phase
- Handles OrderAccepted event → accepted phase with driver data
- Handles DriverArrived event → arrived phase
- Handles OrderCompleted event → completed phase
- Handles OrderCancelled event → cancelled phase, auto-clears to idle after 3s
- `cancelOrder` calls API and transitions to cancelled
- Restores current order on mount
- Error state set on API failure

#### `__tests__/hooks/useLocation.test.ts`
- Returns loading true initially
- Returns coordinates after permission granted
- Sets error when permission denied

#### `__tests__/screens/client/HomeScreen.test.tsx`
- Renders map and bottom card in idle state
- Shows "Вызвать такси" button when idle
- Shows "Ищем водителя..." when searching
- Shows DriverCard when order accepted
- Shows "Водитель прибыл!" when driver arrived
- Shows completed modal with price
- Shows cancelled toast
- Cancel button calls cancelOrder
- "Готово" button returns to idle

#### `__tests__/components/DriverCard.test.tsx`
- Renders driver name, car model, car number
- Shows correct status text for each state
- Phone button triggers Linking.openURL with tel: scheme

### Done When

- Map displays with user's GPS location
- "Вызвать такси" creates order and shows searching state
- Pusher events transition through all order phases
- Driver marker appears and moves on map
- DriverCard shows driver info with phone call button
- Cancel works during searching and accepted phases
- Completed modal shows price and dismisses to idle
- Cancelled toast auto-dismisses after 3 seconds
- Periodic refresh works as Pusher fallback
- All tests pass

---

## 5.3 — Client Order History

### Goal
Paginated list of past orders with pull-to-refresh.

### Design Brief

- **Purpose**: Let clients see their ride history — simple list of past trips.
- **Tone**: Clean list, minimal information per row. No complex filtering.
- **Key Screens/States**:
  - **Loaded**: FlatList of orders. Each row: date, pickup address, price, status badge.
  - **Empty**: Centered illustration-free message "У вас пока нет поездок".
  - **Loading**: ActivityIndicator centered.
  - **Error**: "Не удалось загрузить историю" + "Повторить" button.
- **Components**: `OrderHistoryItem` (row component)
- **Interactions**: Pull-to-refresh (PTR), infinite scroll pagination, tap row does nothing (no detail screen needed for MVP).
- **Responsive**: Full screen list with safe area insets.
- **Accessibility**: Each row has `accessibilityLabel` combining date, address, and price.

### Implementation

#### 5.3.1 Create `src/screens/client/HistoryScreen.tsx`

State:
- `orders: Order[]`
- `page: number` — current page, starts at 1
- `lastPage: number` — from API meta
- `loading: boolean` — initial load
- `refreshing: boolean` — pull-to-refresh
- `loadingMore: boolean` — pagination

```typescript
// Fetch logic:
const fetchOrders = async (pageNum: number, isRefresh: boolean = false) => {
  if (isRefresh) setRefreshing(true); else if (pageNum === 1) setLoading(true); else setLoadingMore(true);
  try {
    const response = await getOrderHistory(pageNum);
    if (isRefresh || pageNum === 1) {
      setOrders(response.data);
    } else {
      setOrders((prev) => [...prev, ...response.data]);
    }
    setPage(response.meta.current_page);
    setLastPage(response.meta.last_page);
  } catch {
    setError('Не удалось загрузить историю');
  } finally {
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }
};

// Initial fetch
useEffect(() => { fetchOrders(1); }, []);

// Pull-to-refresh
const onRefresh = () => fetchOrders(1, true);

// Infinite scroll
const onEndReached = () => {
  if (!loadingMore && page < lastPage) {
    fetchOrders(page + 1);
  }
};
```

FlatList props:
- `data={orders}`
- `renderItem` → `OrderHistoryItem`
- `keyExtractor={(item) => item.id.toString()}`
- `onRefresh={onRefresh}`
- `refreshing={refreshing}`
- `onEndReached={onEndReached}`
- `onEndReachedThreshold={0.5}`
- `ListFooterComponent` → `ActivityIndicator` when `loadingMore`
- `ListEmptyComponent` → empty state (only when `!loading`)
- `contentContainerStyle={{ flexGrow: 1 }}` (for empty state centering)

#### 5.3.2 Create `src/components/OrderHistoryItem.tsx`

Props: `{ order: Order }`

Layout (horizontal row, padding 16, border-bottom):
```
┌──────────────────────────────────────┐
│  7 апр 2026, 10:00    [Завершён ✓]  │
│  ул. Ленина 5            80 сом     │
└──────────────────────────────────────┘
```

- Top row: formatted date (`dayjs(order.created_at).format('D MMM YYYY, HH:mm')`) + status badge
- Bottom row: `order.pickup_address || 'Без адреса'` + `order.price + ' сом'`
- Status badge styling:
  - `completed` → green bg (#D1FAE5), green text (#065F46), "Завершён"
  - `cancelled` → red bg (#FEE2E2), red text (#991B1B), "Отменён"
  - `searching`/`accepted`/etc → yellow bg (#FEF3C7), dark text, "В процессе"

Import `dayjs` with Russian locale:
```typescript
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
dayjs.locale('ru');
```

### Tests

#### `__tests__/screens/client/HistoryScreen.test.tsx`
- Renders list of orders
- Shows empty state when no orders
- Pull-to-refresh triggers re-fetch from page 1
- Loads next page on scroll to end
- Does not load more when on last page
- Shows loading indicator initially

#### `__tests__/components/OrderHistoryItem.test.tsx`
- Renders formatted date
- Renders pickup address
- Renders price with "сом" suffix
- Shows correct status badge color and text for completed/cancelled/searching

### Done When

- History screen shows paginated list of past orders
- Pull-to-refresh reloads from page 1
- Infinite scroll loads next pages
- Empty state shown when no orders
- Date formatted in Russian locale
- Status badges with correct colors
- All tests pass

---

## 5.4 — Client Navigation

### Goal
Wire up React Navigation: `RootNavigator` that switches between `AuthStack` (login/OTP) and `ClientTabs` (Home | History) based on auth state. Splash/loading screen while auth state is being restored.

### Implementation

#### 5.4.1 Define navigation types in `src/navigation/types.ts`

```typescript
export type AuthStackParamList = {
  PhoneLogin: undefined;
  OtpVerify: { phone: string };
};

export type ClientTabParamList = {
  Home: undefined;
  History: undefined;
};

export type DriverStackParamList = {
  DriverHome: undefined;
  OrderActive: { orderId: number };
  Stats: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  ClientApp: undefined;
  DriverApp: undefined;
};
```

#### 5.4.2 Create `src/navigation/AuthStack.tsx`

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneLoginScreen from '../screens/client/PhoneLoginScreen';
import OtpVerifyScreen from '../screens/client/OtpVerifyScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack(): JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    </Stack.Navigator>
  );
}
```

#### 5.4.3 Create `src/navigation/ClientTabs.tsx`

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/client/HomeScreen';
import HistoryScreen from '../screens/client/HistoryScreen';
import { ClientTabParamList } from './types';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';

const Tab = createBottomTabNavigator<ClientTabParamList>();

export default function ClientTabs(): JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ClientColors.primary,
        tabBarInactiveTintColor: ClientColors.textMuted,
        tabBarStyle: {
          backgroundColor: ClientColors.white,
          borderTopColor: ClientColors.border,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          ...Typography.caption,
          fontSize: 12,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Главная',
          tabBarIcon: ({ color }) => (
            // Simple text icon — replace with vector icon if expo-vector-icons added
            <TabIcon label="🚕" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'История',
          tabBarIcon: ({ color }) => (
            <TabIcon label="📋" color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ label }: { label: string; color: string }): JSX.Element {
  return <Text style={{ fontSize: 22 }}>{label}</Text>;
}
```

#### 5.4.4 Create `src/navigation/RootNavigator.tsx`

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import ClientTabs from './ClientTabs';
// DriverStack imported in Phase 6
import { RootStackParamList } from './types';
import { ClientColors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): JSX.Element {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={ClientColors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : user?.role === 'driver' ? (
          <Stack.Screen name="DriverApp" component={DriverPlaceholder} />
          // Replaced with DriverStack in Phase 6
        ) : (
          <Stack.Screen name="ClientApp" component={ClientTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Temporary placeholder until Phase 6
function DriverPlaceholder(): JSX.Element {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={ClientColors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ClientColors.background,
  },
});
```

#### 5.4.5 Update `App.tsx`

```typescript
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
```

#### 5.4.6 Push notification registration

In `App.tsx` or a `useNotifications` hook (called inside `AuthProvider` children):
- On mount, if authenticated, request push permission
- Get Expo push token via `Notifications.getExpoPushTokenAsync()`
- Send to backend via `registerPushToken(token.data)`
- Handle incoming notifications: if app in foreground, show nothing (Pusher handles it); if background tap, navigate to Home

```typescript
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../api/auth';
import { useAuth } from '../context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications(): void {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      await registerPushToken(tokenData.data);
    })();
  }, [isAuthenticated]);
}
```

### Tests

#### `__tests__/navigation/RootNavigator.test.tsx`
- Shows loading spinner when auth state is loading
- Shows AuthStack when not authenticated
- Shows ClientTabs when authenticated as client
- Shows driver placeholder when authenticated as driver

#### `__tests__/navigation/AuthStack.test.tsx`
- PhoneLogin screen is initial route
- Navigates to OtpVerify with phone param

### Done When

- App shows splash/loading while checking stored auth token
- Unauthenticated users see PhoneLogin → OtpVerify flow
- Authenticated clients see bottom tab navigator with Home and History
- Tab bar shows correct labels and icons in Russian
- Role-based routing works (driver role goes to driver placeholder)
- Push notification token registered on auth
- All navigation tests pass
