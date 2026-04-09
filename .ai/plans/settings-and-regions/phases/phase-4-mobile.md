---
phase: 4
title: "Mobile — Region Order Selector"
status: pending
depends_on: [3]
sub_tasks: 3
---

# Phase 4: Mobile — Region Order Selector

## Sub-task 4.1: Regions API Integration

### Goal

Create the API layer for fetching available regions and creating regional orders. Add the `Region` type to the shared types file and wire up two new API functions that talk to the Phase 3 backend endpoints.

### Implementation

#### 1. Add `Region` type

File: `mobile/src/api/types.ts`

Append the following interface (after the existing `DriverStats` interface):

```typescript
export interface Region {
  id: number;
  name: string;
  price: number;
}
```

Note: The backend `GET /v1/client/regions` returns `price` as the current time-aware price (day or night), already resolved server-side.

#### 2. Create regions API module

File: `mobile/src/api/regions.ts`

Follow the same pattern as `orders.ts` — import `apiClient` from `./client`, use typed generics on axios calls, and return unwrapped `data.data`.

```typescript
import apiClient from './client';
import { Region } from './types';

/**
 * Fetch all active regions with their current prices.
 */
export async function getRegions(): Promise<Region[]> {
  const { data } = await apiClient.get<{ data: Region[] }>('/api/v1/client/regions');
  return data.data;
}

/**
 * Fetch the current in-village price from settings API.
 */
export async function getCurrentPrice(): Promise<number> {
  const { data } = await apiClient.get<{ data: { price: number } }>('/api/v1/client/price');
  return data.data.price;
}
```

#### 3. Add `createRegionalOrder` to orders API

File: `mobile/src/api/orders.ts`

Add a new export function after the existing `createOrder`:

```typescript
export async function createRegionalOrder(
  latitude: number,
  longitude: number,
  regionId: number,
  address?: string
): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>('/api/v1/client/orders/regional', {
    pickup_latitude: latitude,
    pickup_longitude: longitude,
    region_id: regionId,
    pickup_address: address,
  });
  return data.data;
}
```

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| Types | `mobile/src/api/types.ts` | Modify (add `Region` interface) |
| Regions API | `mobile/src/api/regions.ts` | Create |
| Orders API | `mobile/src/api/orders.ts` | Modify (add `createRegionalOrder`) |

### Test Spec

Create test: `mobile/src/__tests__/api/regions.test.ts`

Use `jest.mock('../../../src/api/client')` to mock axios, matching any existing test patterns in the project.

| Test Method | Description |
|-------------|-------------|
| `getRegions calls GET /api/v1/client/regions and returns region array` | Mock apiClient.get to return `{ data: { data: [...] } }`, call `getRegions()`, assert result matches mock data |
| `getCurrentPrice calls GET /api/v1/client/price and returns number` | Mock apiClient.get to return `{ data: { data: { price: 80 } } }`, call `getCurrentPrice()`, assert returns `80` |
| `createRegionalOrder calls POST /api/v1/client/orders/regional with correct payload` | Mock apiClient.post, call `createRegionalOrder(42.87, 74.59, 3, 'Test')`, assert post called with correct URL and body containing `region_id: 3` |

---

## Sub-task 4.2: Region Selector Popup Component

### Goal

Create a reusable `RegionSelector` modal component that displays a list of available regions with their current prices. The component uses a bottom-sheet style modal consistent with the existing completed-ride modal in `HomeScreen.tsx`.

### Implementation

#### 1. RegionSelector component

File: `mobile/src/components/RegionSelector.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ClientColors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Region } from '../api/types';
import { getRegions } from '../api/regions';

interface RegionSelectorProps {
  visible: boolean;
  onSelect: (regionId: number) => void;
  onClose: () => void;
}

export default function RegionSelector({
  visible,
  onSelect,
  onClose,
}: RegionSelectorProps): React.ReactNode {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setError(null);
      getRegions()
        .then(setRegions)
        .catch(() => setError('Не удалось загрузить направления'))
        .finally(() => setLoading(false));
    }
  }, [visible]);

  const renderItem = ({ item }: { item: Region }) => (
    <TouchableOpacity
      style={styles.regionItem}
      onPress={() => onSelect(item.id)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.price} сом`}
    >
      <Text style={[Typography.bodyBold, { color: ClientColors.dark }]}>{item.name}</Text>
      <Text style={[Typography.h3, { color: ClientColors.primaryDark }]}>{item.price} сом</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <Text style={[Typography.h2, { color: ClientColors.dark, marginBottom: 16 }]}>
            Межгород
          </Text>

          {loading && (
            <ActivityIndicator
              color={ClientColors.primary}
              size="large"
              style={{ marginVertical: 32 }}
            />
          )}

          {error && (
            <Text style={[Typography.body, { color: ClientColors.danger, textAlign: 'center', marginVertical: 16 }]}>
              {error}
            </Text>
          )}

          {!loading && !error && regions.length === 0 && (
            <Text style={[Typography.body, { color: ClientColors.textSecondary, textAlign: 'center', marginVertical: 16 }]}>
              Нет доступных направлений
            </Text>
          )}

          {!loading && !error && regions.length > 0 && (
            <FlatList
              data={regions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              style={{ maxHeight: 400 }}
            />
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          >
            <Text style={[Typography.button, { color: ClientColors.textSecondary }]}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: ClientColors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: ClientColors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  regionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  separator: {
    height: 1,
    backgroundColor: ClientColors.border,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
});
```

Key design decisions:
- Uses `Modal` with `animationType="slide"` for a bottom-sheet feel (consistent with RN patterns used in the app)
- Tapping the overlay backdrop dismisses the modal
- `onStartShouldSetResponder={() => true}` prevents taps on the sheet content from closing the modal
- `FlatList` with `maxHeight: 400` keeps the sheet from taking over the full screen
- Handle bar at top signals the bottom-sheet UX pattern
- Loading, error, and empty states are all handled
- Each region item shows name (left) and price (right) — tappable full-width row
- `accessibilityRole` and `accessibilityLabel` on interactive elements

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| RegionSelector | `mobile/src/components/RegionSelector.tsx` | Create |

### Test Spec

Create test: `mobile/src/__tests__/components/RegionSelector.test.tsx`

Mock `getRegions` from `../api/regions`.

| Test Method | Description |
|-------------|-------------|
| `renders title "Межгород" when visible` | Render with `visible={true}`, assert "Межгород" text is present |
| `shows loading spinner while fetching regions` | Mock `getRegions` to return a pending promise, assert `ActivityIndicator` renders |
| `renders list of regions with names and prices` | Mock `getRegions` to resolve with `[{id:1,name:'Бишкек',price:300},{id:2,name:'Токмок',price:200}]`, assert both names and prices appear |
| `calls onSelect with region id when region is tapped` | Mock regions, simulate press on first item, assert `onSelect` called with `1` |
| `calls onClose when close button is pressed` | Simulate press on "Закрыть", assert `onClose` called |
| `shows error message when API fails` | Mock `getRegions` to reject, assert error text "Не удалось загрузить направления" appears |
| `shows empty message when no regions returned` | Mock `getRegions` to resolve with `[]`, assert "Нет доступных направлений" appears |
| `does not render when visible is false` | Render with `visible={false}`, assert modal content is not visible |

---

## Sub-task 4.3: Update HomeScreen + useOrder Hook

### Goal

Add a "Межгород" button to the HomeScreen idle state, wire the `RegionSelector` popup to create regional orders, fetch the current in-village price from the API to replace the hardcoded `FIXED_PRICE` constant, and extend `useOrder` to support regional order creation.

### Implementation

#### 1. Extend `useOrder` hook

File: `mobile/src/hooks/useOrder.ts`

Add `callRegionalTaxi` to the hook return and implementation:

**Update `UseOrderReturn` interface:**

```typescript
export interface UseOrderReturn {
  state: ClientOrderState;
  callTaxi: (latitude: number, longitude: number, address?: string) => Promise<void>;
  callRegionalTaxi: (latitude: number, longitude: number, regionId: number, address?: string) => Promise<void>;
  cancelOrder: () => Promise<void>;
  dismissCompleted: () => void;
  loading: boolean;
  error: string | null;
}
```

**Add `callRegionalTaxi` callback** (after the existing `callTaxi` callback, same pattern):

```typescript
const callRegionalTaxi = useCallback(
  async (latitude: number, longitude: number, regionId: number, address?: string) => {
    setLoading(true);
    setError(null);
    try {
      const order = await ordersApi.createRegionalOrder(latitude, longitude, regionId, address);
      orderRef.current = order;
      setState({ phase: 'searching', order });
    } catch (e: unknown) {
      const axiosError = e as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  },
  []
);
```

**Update the return statement:**

```typescript
return { state, callTaxi, callRegionalTaxi, cancelOrder, dismissCompleted, loading, error };
```

#### 2. Update HomeScreen

File: `mobile/src/screens/client/HomeScreen.tsx`

**Update imports:**

- Add `useState` to the React import
- Add `RegionSelector` component import
- Add `getCurrentPrice` from `../../api/regions`
- Remove `FIXED_PRICE` import from `../../utils/constants`

```typescript
import React, { useRef, useEffect, useState } from 'react';
// ... existing imports ...
import RegionSelector from '../../components/RegionSelector';
import { getCurrentPrice } from '../../api/regions';
// Remove: import { FIXED_PRICE } from '../../utils/constants';
```

**Add state and effects in `HomeScreen` function body** (after the existing `mapRef`):

```typescript
const [regionSelectorVisible, setRegionSelectorVisible] = useState(false);
const [currentPrice, setCurrentPrice] = useState<number | null>(null);

useEffect(() => {
  getCurrentPrice()
    .then(setCurrentPrice)
    .catch(() => setCurrentPrice(80)); // Fallback to default if API unavailable
}, []);
```

**Destructure `callRegionalTaxi` from `useOrder`:**

```typescript
const { state, callTaxi, callRegionalTaxi, cancelOrder, dismissCompleted, loading, error } = useOrder();
```

**Add regional order handler:**

```typescript
const handleRegionSelect = (regionId: number): void => {
  setRegionSelectorVisible(false);
  callRegionalTaxi(location.latitude, location.longitude, regionId);
};
```

**Update idle state JSX** — replace the current idle block with:

```tsx
{state.phase === 'idle' && (
  <>
    <Text style={[Typography.body, { color: ClientColors.textSecondary, marginBottom: 4 }]}>
      Текущее местоположение
    </Text>
    <Text style={[Typography.h2, { color: ClientColors.dark, marginBottom: 16 }]}>
      {currentPrice !== null ? `${currentPrice} сом` : '...'}
    </Text>
    <ActionButton
      title="Вызвать такси"
      onPress={handleCallTaxi}
      loading={loading}
      disabled={location.loading}
    />
    <ActionButton
      title="Межгород"
      onPress={() => setRegionSelectorVisible(true)}
      variant="outline"
      disabled={location.loading || loading}
      style={{ marginTop: 10 }}
    />
  </>
)}
```

Key changes to the idle block:
- Price display now uses `currentPrice` state (fetched from API) instead of `FIXED_PRICE`
- Shows `'...'` while price is loading
- New "Межгород" button added below the existing "Вызвать такси" button with `variant="outline"` to visually differentiate it
- Both buttons are disabled while location is loading or an order is being created

**Add `RegionSelector` modal** — place it right after the existing Completed Modal (before the Cancelled Toast):

```tsx
{/* Region Selector Modal */}
<RegionSelector
  visible={regionSelectorVisible}
  onSelect={handleRegionSelect}
  onClose={() => setRegionSelectorVisible(false)}
/>
```

#### 3. Clean up FIXED_PRICE constant (optional)

File: `mobile/src/utils/constants.ts`

The `FIXED_PRICE` constant can remain for backwards compatibility, but it is no longer imported in `HomeScreen.tsx`. If no other files import it, it can be removed. Check with:

```bash
grep -r "FIXED_PRICE" mobile/src/
```

If only `constants.ts` references it, remove the line. Otherwise leave it.

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| useOrder hook | `mobile/src/hooks/useOrder.ts` | Modify (add `callRegionalTaxi`) |
| HomeScreen | `mobile/src/screens/client/HomeScreen.tsx` | Modify (add Межгород button, RegionSelector, dynamic price) |
| Constants | `mobile/src/utils/constants.ts` | Modify (remove `FIXED_PRICE` if unused elsewhere) |

### Test Spec

Create test: `mobile/src/__tests__/screens/HomeScreen.test.tsx`

Mock `useLocation`, `useOrder`, `getRegions`, `getCurrentPrice`. Use `@testing-library/react-native` if available, otherwise standard RN testing utilities.

| Test Method | Description |
|-------------|-------------|
| `renders "Вызвать такси" button in idle state` | Assert "Вызвать такси" button is present when state is idle |
| `renders "Межгород" button in idle state` | Assert "Межгород" button is present when state is idle |
| `does not render "Межгород" button when not idle` | Set state to `searching`, assert "Межгород" button is absent |
| `opens RegionSelector when "Межгород" is pressed` | Simulate press on "Межгород", assert `RegionSelector` visible prop becomes true |
| `calls callRegionalTaxi when region is selected` | Simulate region selection with id 2, assert `callRegionalTaxi` called with current location coords and regionId 2 |
| `closes RegionSelector after region selection` | Simulate region selection, assert RegionSelector visible is false |
| `displays fetched price instead of hardcoded value` | Mock `getCurrentPrice` to return 100, assert "100 сом" is displayed |
| `falls back to 80 if price API fails` | Mock `getCurrentPrice` to reject, assert "80 сом" is displayed |
| `shows loading indicator for price` | Before `getCurrentPrice` resolves, assert "..." is displayed |

Create test: `mobile/src/__tests__/hooks/useOrder.test.ts`

| Test Method | Description |
|-------------|-------------|
| `callRegionalTaxi creates regional order and transitions to searching` | Mock `createRegionalOrder`, call `callRegionalTaxi(42, 74, 3)`, assert state becomes `{ phase: 'searching', order }` |
| `callRegionalTaxi sets error on failure` | Mock `createRegionalOrder` to reject with message, assert error is set |
| `callRegionalTaxi sets loading during request` | Assert loading is true during the call, false after |

---

## Execution Order

1. Implement sub-task 4.1 (types, regions API, orders API update)
2. Run tests for 4.1: Jest tests for API functions
3. Implement sub-task 4.2 (RegionSelector component)
4. Run tests for 4.2: Jest tests for component rendering and interactions
5. Implement sub-task 4.3 (useOrder hook update, HomeScreen update, FIXED_PRICE cleanup)
6. Run tests for 4.3: Jest tests for HomeScreen and useOrder hook
7. Manual verification: Run `npx expo start`, confirm both buttons appear, popup opens with regions, regional order can be created
8. Commit: `git commit -m "feat: add region selector popup and dynamic pricing to client app"`
