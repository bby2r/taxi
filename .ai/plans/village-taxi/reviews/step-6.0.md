# Review: Step 6.0 — Driver App Setup

## Verdict: PASS

## Spec Compliance

| Requirement | Status |
|---|---|
| app.json: iOS UIBackgroundModes ["location"] | Done (line 20) |
| app.json: Android ACCESS_BACKGROUND_LOCATION permission | Done (line 29) |
| app.json: expo-location plugin config (background + foreground service) | Done (lines 32-38) |
| src/api/driver.ts: goOnline(lat, lng) | Done |
| src/api/driver.ts: goOffline() | Done |
| src/api/driver.ts: updateLocation(lat, lng, heading?) | Done |
| src/api/driver.ts: acceptOrder(orderId) | Done |
| src/api/driver.ts: declineOrder(orderId) | Done |
| src/api/driver.ts: arriveAtPickup(orderId) | Done |
| src/api/driver.ts: completeOrder(orderId) | Done |
| src/api/driver.ts: getCurrentDriverOrder() | Done (with 404 -> null handling) |
| src/api/driver.ts: getDriverStats() | Done |
| src/hooks/useDriverLocation.ts: background GPS tracking | Done |
| src/hooks/useDriverLocation.ts: sends location every 10s | Done (setInterval 10000ms) |

All 9 API functions present. All spec items covered.

## TypeScript

`npx tsc --noEmit` — **0 errors**

## Tests

`npx jest --no-coverage` — **111 passed, 0 failed** (18 suites)

### driver.test.ts coverage
- All 9 functions tested
- updateLocation: heading provided, null, and undefined cases
- getCurrentDriverOrder: success, 404 -> null, non-404 rethrow
- All endpoint URLs verified

### useDriverLocation.test.ts coverage
- enabled=false does not start tracking
- Requests foreground permission when enabled
- Starts watchPositionAsync with correct options
- Sends location to server at 10s intervals
- Cleans up subscription and interval on disable
- Denied foreground permission prevents background request

## Notes

- The hook returns `coordsRef.current` directly, which being a ref value won't trigger re-renders. This is acceptable since the hook's primary purpose is the side effect of sending location to the server, not driving UI updates.
- DriverStats type is properly defined in types.ts with today/week/month/total periods.
- The updateLocation function correctly omits heading from the payload when null or undefined.
