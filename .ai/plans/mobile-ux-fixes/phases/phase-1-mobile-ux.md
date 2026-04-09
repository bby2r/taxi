---
phase: 1
title: "Mobile UX Fixes"
status: pending
depends_on: []
sub_tasks: 4
---

# Phase 1: Mobile UX Fixes

## 1.1: "No Drivers" Message When Order Auto-Cancelled

### Goal

When a client calls a taxi and no drivers are available, show "Нет свободных водителей" instead of the generic "Заказ отменён".

### Implementation

The backend already sets `cancelled_by: 'system'` when no drivers found (vs `'client'` for user-initiated cancel). The `OrderResource` already returns `cancelled_by` in the response. We just need to use it on mobile.

#### 1. Add `cancelled_by` to Order type

File: `mobile/src/api/types.ts`

Add to the `Order` interface:
```typescript
cancelled_by: string | null;
```

#### 2. Update `useOrder` hook to pass cancellation reason

File: `mobile/src/hooks/useOrder.ts`

Update the `ClientOrderState` type — change the `cancelled` phase to carry a reason:
```typescript
| { phase: 'cancelled'; reason: 'no_drivers' | 'other' };
```

Update `handleOrderCancelled` to check the last known order's `cancelled_by`:
```typescript
const handleOrderCancelled = useCallback(() => {
  const cancelledBy = orderRef.current?.cancelled_by;
  orderRef.current = null;
  const reason = cancelledBy === 'system' ? 'no_drivers' : 'other';
  setState({ phase: 'cancelled', reason });
  setTimeout(() => {
    setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
  }, 3000);
}, []);
```

Also update the polling fallback (around line 140) — when a cancelled order is fetched, read `cancelled_by` from the fresh order data:
```typescript
if (phase === 'cancelled') {
  const reason = fresh.cancelled_by === 'system' ? 'no_drivers' : 'other';
  orderRef.current = null;
  setState({ phase: 'cancelled', reason });
  // ... same timeout logic
}
```

But there's a problem: `handleOrderCancelled` is triggered by Pusher events which don't carry data. The `orderRef.current` might have stale data. To solve this reliably:

- When Pusher fires `order.cancelled`, call `refreshAndSetPhase` to fetch fresh order data first, THEN check `cancelled_by`.

Alternative simpler approach: After receiving the `order.cancelled` event, fetch the order to get `cancelled_by`:

```typescript
const handleOrderCancelled = useCallback(async () => {
  let reason: 'no_drivers' | 'other' = 'other';
  const orderId = orderRef.current?.id;
  if (orderId) {
    try {
      const fresh = await ordersApi.getOrder(orderId);
      reason = fresh.cancelled_by === 'system' ? 'no_drivers' : 'other';
    } catch {
      // ignore fetch error, default to 'other'
    }
  }
  orderRef.current = null;
  setState({ phase: 'cancelled', reason });
  setTimeout(() => {
    setState((prev) => (prev.phase === 'cancelled' ? { phase: 'idle' } : prev));
  }, 3000);
}, []);
```

Also update `cancelOrder` (user-initiated) — this always uses reason `'other'`:
```typescript
setState({ phase: 'cancelled', reason: 'other' });
```

#### 3. Update HomeScreen toast message

File: `mobile/src/screens/client/HomeScreen.tsx`

Change the cancelled toast to show different text based on reason:
```tsx
{state.phase === 'cancelled' && (
  <View style={styles.cancelledToast}>
    <Text style={[Typography.bodyBold, { color: ClientColors.white }]}>
      {state.reason === 'no_drivers'
        ? 'Нет свободных водителей'
        : 'Заказ отменён'}
    </Text>
  </View>
)}
```

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| Types | `mobile/src/api/types.ts` | Modify (add `cancelled_by` to Order) |
| useOrder | `mobile/src/hooks/useOrder.ts` | Modify (add reason to cancelled state) |
| HomeScreen | `mobile/src/screens/client/HomeScreen.tsx` | Modify (conditional toast text) |

### Test Spec

No Jest tests configured in this project. Manual verification:
- Create order with no online drivers → should show "Нет свободных водителей"
- Cancel order manually → should show "Заказ отменён"

---

## 1.2: Back Link on Driver Login Screen

### Goal

Add a "Я пассажир" link on the driver login screen so users can navigate back to the client login form. Currently the client login has "Я водитель" but there's no way back.

### Implementation

File: `mobile/src/screens/driver/LoginScreen.tsx`

Add `TouchableOpacity` import (already imported? check — no, it's not imported currently).

Add after the `ActionButton` at the bottom of the content view:
```tsx
<TouchableOpacity
  onPress={() => navigation.navigate('PhoneLogin')}
  style={styles.clientLink}
>
  <Text style={[Typography.caption, { color: DriverColors.textSecondary }]}>
    Я пассажир
  </Text>
</TouchableOpacity>
```

Add style:
```typescript
clientLink: {
  alignSelf: 'center',
  paddingVertical: 12,
  marginTop: 8,
},
```

This mirrors the exact same pattern used in `PhoneLoginScreen.tsx` for the "Я водитель" link.

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| DriverLoginScreen | `mobile/src/screens/driver/LoginScreen.tsx` | Modify |

### Test Spec

Manual verification: On driver login screen, "Я пассажир" link visible and navigates to client login.

---

## 1.3: Driver Phone Input — Match Client Style (Prefix + Formatting)

### Goal

Make the driver login phone input identical to the client's: show "+996" in a separate prefix box, accept only 9 digits, and auto-format with spaces after every 3 digits. Then prepend "+996" before sending to backend.

This combines three user requirements:
- Country code prefix for driver login
- Auto-spaces in phone input
- Same phone field style as client

### Implementation

#### 1. Create shared phone formatting utility

File: `mobile/src/utils/phone.ts` (new)

```typescript
/**
 * Format a raw digit string with spaces every 3 digits.
 * Example: "555123456" → "555 123 456"
 */
export function formatPhoneDigits(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

/**
 * Strip non-digits from a string and limit to maxLength.
 */
export function extractDigits(text: string, maxLength: number = 9): string {
  return text.replace(/[^0-9]/g, '').slice(0, maxLength);
}
```

#### 2. Update Client PhoneLoginScreen

File: `mobile/src/screens/client/PhoneLoginScreen.tsx`

Import and use the shared utility:
```typescript
import { formatPhoneDigits, extractDigits } from '../../utils/phone';
```

Update `handlePhoneChange`:
```typescript
const handlePhoneChange = (text: string) => {
  const digits = extractDigits(text, 9);
  setPhone(digits);
  if (error) {
    setError('');
  }
};
```

Update the TextInput value to display formatted:
```tsx
<TextInput
  ...
  value={formatPhoneDigits(phone)}
  onChangeText={handlePhoneChange}
  placeholder="--- --- ---"
  maxLength={11}  // 9 digits + 2 spaces
  ...
/>
```

Note: `maxLength` changes from 9 to 11 because the displayed value now includes spaces.

The `phone` state stays as raw digits (e.g., `"555123456"`). Only the display is formatted.

#### 3. Update Driver LoginScreen

File: `mobile/src/screens/driver/LoginScreen.tsx`

Major refactor of the phone input to match client style:

```typescript
import { formatPhoneDigits, extractDigits } from '../../utils/phone';
```

Replace the phone TextInput block with client-style prefix + input:

```tsx
<View style={styles.inputGroup}>
  <Text style={[Typography.caption, styles.label]}>Номер телефона</Text>
  <View style={styles.phoneRow}>
    <View style={styles.prefixBox}>
      <Text style={[Typography.body, styles.prefixText]}>+996</Text>
    </View>
    <TextInput
      style={styles.phoneInput}
      value={formatPhoneDigits(phone)}
      onChangeText={(text) => setPhone(extractDigits(text, 9))}
      placeholder="--- --- ---"
      placeholderTextColor={DriverColors.textMuted}
      keyboardType="phone-pad"
      maxLength={11}
      autoFocus
      accessibilityLabel="Номер телефона"
    />
  </View>
</View>
```

Add styles (matching client but using DriverColors):
```typescript
phoneRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
prefixBox: {
  height: 52,
  paddingHorizontal: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: DriverColors.border,
  backgroundColor: DriverColors.cardBackground,
  justifyContent: 'center',
},
prefixText: {
  color: DriverColors.textPrimary,
  fontWeight: '600',
},
phoneInput: {
  flex: 1,
  height: 52,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: DriverColors.border,
  backgroundColor: DriverColors.cardBackground,
  paddingHorizontal: 16,
  fontSize: 16,
  color: DriverColors.textPrimary,
},
```

Remove the old `input` style entry for the phone field (keep it for password input — or rename to `passwordInput`). Actually the simplest approach: keep the existing `input` style for the password field, add the new `phoneRow`/`prefixBox`/`prefixText`/`phoneInput` styles for the phone field.

Update `handleLogin` to prepend country code:
```typescript
const handleLogin = async () => {
  setLoading(true);
  setError(null);
  try {
    const fullPhone = '+996' + phone;
    const response = await driverLogin(fullPhone, password);
    await auth.login(response.token, response.user);
  } catch (e: any) {
    // ... same error handling
  } finally {
    setLoading(false);
  }
};
```

Update the disabled check (phone is now raw digits):
```tsx
disabled={phone.length < 9 || !password}
```

### Artifacts

| Artifact | Path | Action |
|----------|------|--------|
| Phone utils | `mobile/src/utils/phone.ts` | Create |
| PhoneLoginScreen | `mobile/src/screens/client/PhoneLoginScreen.tsx` | Modify (use shared utils, display formatted) |
| DriverLoginScreen | `mobile/src/screens/driver/LoginScreen.tsx` | Modify (prefix box, formatted input, prepend +996) |

### Test Spec

Manual verification:
- Client login: typing "555123456" displays as "555 123 456" with +996 prefix
- Driver login: same display — +996 prefix box, "555 123 456" formatting
- Both send "+996555123456" to backend
- Driver login requires 9 digits + password to enable button

---

## 1.4: Phone Formatting in Change Phone Screens (if applicable)

### Goal

Check if there are other phone input fields (e.g., change phone in profile) that also need the same formatting treatment. Apply the shared utility there too.

### Implementation

Search for phone inputs in the mobile codebase:
```bash
grep -r "phone-pad\|phone.*input\|onChangeText.*Phone\|setPhone" mobile/src/ --include="*.tsx" --include="*.ts"
```

If found in profile/change-phone screens, apply the same `formatPhoneDigits` / `extractDigits` pattern with the +996 prefix box.

If no other phone inputs exist, this sub-task is a no-op — just verify and mark done.

### Artifacts

Depends on search results. Likely:
| Artifact | Path | Action |
|----------|------|--------|
| Any screen with phone input | Various | Modify if needed |

### Test Spec

Manual verification: all phone inputs in the app use consistent formatting.

---

## Execution Order

1. **1.3 first** — create shared phone utility, update both login screens (biggest change)
2. **1.1 next** — add cancelled_by handling + toast message
3. **1.2 next** — add "Я пассажир" link (trivial)
4. **1.4 last** — check for other phone inputs, apply formatting if found
