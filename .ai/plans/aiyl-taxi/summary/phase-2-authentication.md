---
phase: 2
title: "Authentication — OTP, Sanctum, Driver Login, Push Token, Admin Command"
completed: 2026-04-07
---

# Summary: Phase 2 — Authentication

## What Was Done
- NikitaSmsService: singleton service for Kyrgyz SMS provider (XML API), logs when disabled
- OtpService: generates 4-digit OTP codes, sends via SMS, verifies with expiry
- Laravel Sanctum installed with personal access tokens
- AuthController with 5 endpoints: sendOtp, verifyOtp, driverLogin, logout, me, updatePushToken
- Form requests: SendOtpRequest, VerifyOtpRequest, DriverLoginRequest, UpdatePushTokenRequest
- API routes under /api/v1/auth/ with throttle and auth:sanctum middleware
- MakeAdminCommand (php artisan make:admin) for interactive admin user creation

## Key Decisions
- Sanctum tokens expire after 30 days
- All existing tokens revoked on new login (both OTP and driver login)
- Phone validation: Kyrgyz format +996XXXXXXXXX regex
- Expo push token validation: regex `/^ExponentPushToken\[.+\]$/`
- Driver login is phone+password (no self-registration, admin-created accounts only)
- Client login is phone+OTP (no password needed)
- make:admin uses interactive prompts (ask, not secret for password — noted for improvement)

## Files Created/Modified
- `config/nikita.php` — SMS config
- `app/Services/NikitaSmsService.php`, `app/Services/OtpService.php`
- `app/Providers/AppServiceProvider.php` — NikitaSmsService singleton
- `app/Http/Controllers/Api/V1/AuthController.php` — 5 methods
- `app/Http/Requests/Auth/` — 4 form requests
- `app/Console/Commands/MakeAdminCommand.php`
- `routes/api.php` — 6 routes
- `config/sanctum.php` + personal_access_tokens migration
- `tests/` — 8 test files

## Tests
- 92 tests total, all passing
- 44 new tests in Phase 2 (across 8 test files)

## Deviations from Plan
- MakeAdminCommand uses Laravel 13 PHP attribute syntax (#[Signature], #[Description]) instead of $signature/$description properties
- verifyOtp returns `$user->role` (enum auto-serialized) while driverLogin returns `$user->role->value` — minor inconsistency, both work correctly
