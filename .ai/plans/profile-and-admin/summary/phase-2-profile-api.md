# Phase 2 Summary: Profile API Endpoints

**Completed**: 2026-04-08

## What was built
- **2.1** `PUT /v1/client/profile` — client name update with FormRequest validation
- **2.2** Phone change with OTP — two-step flow (send-otp → verify) for both roles, race condition guard (409)
- **2.3** Driver change requests — `POST /v1/driver/profile/request-changes` creates per-field DriverChangeRequest records. `GET /change-requests` lists them. `GET /profile` enhanced with `pending_changes`.
- **2.4** Token refresh — `POST /v1/auth/refresh-token` revokes old, issues new 30-day token

## New Files
- `ClientProfileController`, `DriverProfileController`
- `UpdateClientProfileRequest`, `ChangePhoneSendOtpRequest`, `ChangePhoneVerifyRequest`, `RequestDriverChangesRequest`
- `DriverChangeRequestResource`
- 4 test files (33 tests total, all passing)

## Modified Files
- `AuthController` — added changePhoneSendOtp, changePhoneVerify, refreshToken
- `DriverController` — profile() now includes pending_changes
- `routes/api.php` — 6 new routes

## Tests
- 5 (client profile) + 11 (phone change) + 11 (driver changes) + 6 (token refresh) = 33 tests
- All pass. 1 pre-existing failure in MakeAdminCommandTest (unrelated).

## Key Decisions
- Phone change: OTP sent to NEW phone, old phone kept until verified
- Race condition: double-check uniqueness on verify (409 response)
- Driver changes: each field = separate DriverChangeRequest record
- Duplicate pending check: cannot submit if pending request exists for same user+field
