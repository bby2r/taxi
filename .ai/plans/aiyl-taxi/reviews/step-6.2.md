# Review: Step 6.2 - Driver Home: Online/Offline + Order Offers

**Verdict: PASS**

## Checklist

| # | Criterion | Result |
|---|-----------|--------|
| 1 | OnlineToggle: 120x120 circular, ON/OFF text, animated scale, accessibilityRole="switch" | PASS |
| 2 | OrderOfferCard: 10s default countdown, auto-decline at 0, accept/decline buttons with 2:1 flex | PASS |
| 3 | useDriverOrder: state machine with all 6 phases (offline/online_idle/offer/active/arrived/completed), Pusher events, API calls | PASS |
| 4 | HomeScreen: dark theme (DriverColors.background), toggle, offer overlay, auto-navigate on active/arrived, header with greeting + logout | PASS |
| 5 | TypeScript (`npx tsc --noEmit`) | PASS - zero errors |
| 6 | Tests (`npx jest --no-coverage`) | PASS - 151/151 tests, 23 suites |

## Component Analysis

### OnlineToggle
- 120x120 circle with borderRadius 60 matches spec.
- Animated scale on pressIn/pressOut (0.95 bounce).
- `accessibilityRole="switch"` with `accessibilityState={{ checked: isOnline }}`.
- Loading state shows ActivityIndicator, disables press.

### OrderOfferCard
- Default countdown 10s, decrements via setInterval.
- Auto-decline guarded by `declineCalledRef` to prevent double-fire.
- Accept button `flex: 2`, decline button `flex: 1` (2:1 ratio).
- Opacity animation tied to countdown progress.

### useDriverOrder
- Discriminated union state (`DriverOrderState`) with all 6 phases.
- Pusher subscription on `private-driver.{id}` channel when online.
- Handles `order.offered` and `order.cancelled` events.
- Restores active order on mount via `getCurrentDriverOrder`.
- All API actions guarded by phase checks.

### HomeScreen
- Dark background from `DriverColors.background`.
- Header shows greeting with user name and logout button.
- Online toggle centered with waiting text when idle.
- Offer overlay positioned absolutely at bottom.
- Auto-navigates to `OrderActive` on active/arrived phase via useEffect.

## Test Coverage
- OnlineToggle: 5 tests (offline/online rendering, press, loading, accessibility).
- OrderOfferCard: 5 tests (render, countdown, auto-decline, accept, decline buttons).
- useDriverOrder: 10 tests (full state machine lifecycle, Pusher events, order restoration).
- HomeScreen: 6 tests (offline/online states, waiting text, offer card, header, logout).

## Notes
- The useEffect dependency array in HomeScreen line 44 uses a ternary expression which is unconventional but functionally correct for avoiding stale order ID references.
- `onDecline` in OrderOfferCard countdown useEffect dependency array is correct -- ensures latest callback is used.
