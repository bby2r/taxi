---
step: "2.2"
verdict: PASS
date: 2026-04-08
---
## Review Notes

### ChangePhoneSendOtpRequest
- Phone validates `+996` prefix with exactly 9 trailing digits -- correct.
- Uniqueness rule ignores the authenticated user's own ID -- correct.
- `withValidator` after-hook rejects same-phone submission -- correct.
- Custom message for `phone.unique` -- good UX.

### ChangePhoneVerifyRequest
- Validates phone format (same regex) and 4-digit code with `size:4` -- correct.

### Controller (changePhoneSendOtp / changePhoneVerify)
- `changePhoneSendOtp` delegates to `OtpService::sendOtp` and returns 200 -- correct.
- `changePhoneVerify` verifies OTP, returns 422 on invalid/expired code, checks race condition with `User::where(...)->exists()` returning 409, then updates phone + `phone_verified_at` -- all correct.
- Race condition guard correctly excludes self (`where('id', '!=', ...)`) so it only catches other users claiming the number.

### Routes
- Both routes sit under `auth:sanctum` with appropriate throttle limits (5/min for send, 10/min for verify) -- correct.
- Named routes follow existing convention (`api.v1.auth.change-phone.*`).

### Tests (11 tests, 36 assertions, all passing)
- Happy path: send OTP to new phone, verify and update phone.
- Rejection: same phone, already-taken phone, invalid format, wrong code, expired code.
- Race condition: another user takes phone between send and verify -- asserts 409.
- Auth guard: unauthenticated user gets 401 on both endpoints.
- Role coverage: both client and driver can change phone.
- All tests use factories and Sanctum::actingAs -- follows project conventions.

No issues found.
