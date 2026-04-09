# Phase 1 Summary: Profile Tab

## What was done

Added a "Профиль" tab to both client and driver mobile navigation.

### Step 1.1 — API Layer + Types
- Created `mobile/src/api/profile.ts` with 6 functions (client profile update, driver profile/changes, phone change OTP)
- Added `DriverProfile` and `DriverChangeRequest` types to `types.ts`

### Step 1.2 — Client Profile Screen + Tab
- Created `ProfileScreen.tsx` — name editing, phone change OTP flow, logout
- Added `refreshUser()` to AuthContext for re-fetching user after profile changes
- Added Profile as 3rd tab in ClientTabs

### Step 1.3 — Driver Profile Screen + Tab Navigation
- Created driver `ProfileScreen.tsx` — read-only fields with inline edit (submits change requests), change request list with status badges, logout
- Created `DriverTabs.tsx` — 2-tab bottom navigator (Главная + Профиль)
- Restructured `DriverStack.tsx` — DriverTabs as main, OrderActive/Stats as stack overlays
- Updated HomeScreen with `CompositeNavigationProp` for cross-navigator navigation

## Key decisions
- `refreshUser()` added to AuthContext (reusable across screens)
- Driver uses composite navigation to access parent stack screens from within tabs
- Driver HomeScreen still has its own logout button (redundant, minor cleanup candidate)
