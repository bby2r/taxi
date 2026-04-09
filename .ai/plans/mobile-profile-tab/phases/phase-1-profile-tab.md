# Phase 1: Profile Tab

## Goal
Add Profile tab to both client and driver mobile navigation with full profile management.

---

### Step 1.1 — API Layer + Types

**Files to create/modify:**
- Create `mobile/src/api/profile.ts` — API functions for profile endpoints
- Modify `mobile/src/api/types.ts` — Add DriverProfile, DriverChangeRequest types

**API functions:**
- `updateClientProfile(name: string)` → PUT `/api/v1/client/profile`
- `getDriverProfile()` → GET `/api/v1/driver/profile`  
- `requestDriverChanges(changes: {name?: string, car_model?: string, car_number?: string})` → POST `/api/v1/driver/profile/request-changes`
- `getDriverChangeRequests()` → GET `/api/v1/driver/profile/change-requests`
- `sendChangePhoneOtp(phone: string)` → POST `/api/v1/auth/change-phone/send-otp`
- `verifyChangePhone(phone: string, code: string)` → POST `/api/v1/auth/change-phone/verify`

**Types to add:**
```typescript
interface DriverProfile {
  id: number;
  name: string;
  phone: string;
  car_model: string;
  car_number: string;
}

interface DriverChangeRequest {
  id: number;
  field: string;
  old_value: string;
  new_value: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
}
```

---

### Step 1.2 — Client Profile Screen + Tab

**Files to create/modify:**
- Create `mobile/src/screens/client/ProfileScreen.tsx`
- Modify `mobile/src/navigation/ClientTabs.tsx` — Add Profile tab
- Modify `mobile/src/navigation/types.ts` — Add Profile to ClientTabParamList

**Screen design (Light theme, ClientColors):**
- Header: "Профиль"
- Avatar placeholder circle with user initial
- Name field — editable TextInput, "Сохранить" button calls `updateClientProfile()`
- Phone display with "Изменить номер" button
- Phone change flow: enter new phone → sendChangePhoneOtp → enter OTP → verifyChangePhone → update context user
- "Выйти" button at bottom (red, calls logout from AuthContext)
- Success/error alerts for all operations
- ScrollView for content, SafeAreaView wrapper

**Tab config:**
- Tab name: "Profile", label: "Профиль", icon: 👤
- Position: 3rd tab (after History)

---

### Step 1.3 — Driver Profile Screen + Tab Navigation

**Files to create/modify:**
- Create `mobile/src/screens/driver/ProfileScreen.tsx`
- Create `mobile/src/navigation/DriverTabs.tsx`
- Modify `mobile/src/navigation/DriverStack.tsx` — Use DriverTabs as main, stack for overlays
- Modify `mobile/src/navigation/types.ts` — Add DriverTabParamList, update DriverStackParamList

**Driver Profile Screen (Dark theme, DriverColors):**
- Header: "Профиль"
- Read-only fields: Имя, Телефон, Модель авто, Гос. номер
- Each field (except phone) has "Изменить" button → opens inline edit with TextInput + submit
- Submit calls `requestDriverChanges()` for that field
- Section: "Заявки на изменение" — list of change requests with status badges (pending=yellow, approved=green, rejected=red)
- "Выйти" button at bottom (red)

**Navigation restructure:**
- Create `DriverTabs.tsx`: bottom tab navigator with 2 tabs:
  - "Главная" (🚕) → DriverHomeScreen
  - "Профиль" (👤) → DriverProfileScreen
  - Dark theme tab bar (DriverColors.background, border DriverColors.border)
- Update `DriverStack.tsx`:
  - Main screen: DriverTabs (instead of DriverHome directly)
  - Stack overlays: OrderActive, Stats (unchanged)
- Update types:
  - Add `DriverTabParamList = { DriverHome: undefined; DriverProfile: undefined }`
  - DriverStackParamList: replace `DriverHome` with `DriverTabs`
