---
step: "8.1"
verdict: PASS
date: 2026-04-07
---

## Checklist
- [x] sendToUser returns false for null/empty token without HTTP call
- [x] sendToUser wraps in try/catch, logs errors, never throws
- [x] sendToUsers batches messages in a single HTTP call
- [x] sendToUsers returns count of successful sends
- [x] Sound is set to 'default'
- [x] Uses Http::acceptJson()->post()
- [x] ExpoPushService injected via constructor (private readonly)
- [x] Push calls are OUTSIDE DB::transaction blocks
- [x] Push on accept: to client, with 'order_accepted' type
- [x] Push on arrived: to client, with 'driver_arrived' type
- [x] Push on complete: to BOTH client and driver
- [x] Push on cancel: to BOTH client and driver (if driver exists)
- [x] Push on offerToNextDriver: to driver (with null guard)
- [x] No push calls throw exceptions that would break order flow
- [x] All 13 tests pass (0.32s)

## Notes
- Implementation is clean and follows all spec requirements precisely.
- Push calls are correctly placed after transactions close, ensuring DB state is committed before notifications fire.
- The `send()` private method wraps single-user sends in a one-element array, matching Expo's batch API format -- good consistency.
- `offerToNextDriver` has a null guard on `User::find()` before calling push, which is correct since `driver_location.user_id` could reference a deleted user.
- Empty string token handled correctly because PHP's `!''` evaluates to `true`.

### Minor gaps (non-blocking)
- No dedicated test for push sent during `offerToNextDriver` (the `new_order` type push). This path is exercised indirectly through OrderServiceTest's createOrder tests but not explicitly asserted for push.
- No test for the `\Throwable` catch path in `send()` or `sendToUsers()` (e.g., connection timeout). HTTP failure status is tested but not transport-level exceptions.
- `sendToUsers` is defined but not currently used in OrderService (all calls are individual `sendToUser`). This is fine -- it's available for future batch use cases.
