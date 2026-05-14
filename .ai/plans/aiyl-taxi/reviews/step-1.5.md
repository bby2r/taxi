# Review: Step 1.5 — OtpCode Model & Migration + Timezone Config

**Verdict: PASS**

## Checklist

| Requirement | Status | Notes |
|---|---|---|
| Timezone set to `Asia/Bishkek` | PASS | `config/app.php` line 68 |
| Migration: `phone` string(20) | PASS | |
| Migration: `code` string(4) | PASS | |
| Migration: `expires_at` timestamp | PASS | |
| Migration: `verified_at` timestamp nullable | PASS | |
| Migration: `timestamps()` | PASS | |
| Migration: index on `phone` | PASS | |
| Migration: composite index on `[phone, code]` | PASS | |
| Model: `#[Fillable]` attribute | PASS | `phone, code, expires_at, verified_at` |
| Model: casts for datetime fields | PASS | Both `expires_at` and `verified_at` cast to `datetime` |
| Model: `isExpired()` helper | PASS | Uses `$this->expires_at->isPast()` |
| Model: `isVerified()` helper | PASS | Checks `verified_at !== null` |
| Model: `isValid()` helper | PASS | `!isExpired() && !isVerified()` |
| Model: `scopeForPhone` | PASS | Filters by phone |
| Model: `scopeValid` | PASS | `whereNull('verified_at')->where('expires_at', '>', now())` |
| Factory: default +996 phone | PASS | `'+996'.fake()->numerify('#########')` |
| Factory: 4-digit string code | PASS | `(string) fake()->numberBetween(1000, 9999)` |
| Factory: 5min expiry | PASS | `now()->addMinutes(5)` |
| Factory: `expired()` state | PASS | Sets `expires_at` to `now()->subMinute()` |
| Factory: `verified()` state | PASS | Sets `verified_at` to `now()` |

## Tests

- `tests/Feature/Models/OtpCodeTest.php` — 8 tests covering all helpers and scopes
- `tests/Unit/TimezoneTest.php` — 1 test confirming timezone config
- Full suite: **48 tests, 99 assertions, all passing**

## Code Quality

- Clean PHPDoc blocks with proper generic type annotations (`Builder<OtpCode>`, `Factory<OtpCode>`)
- Uses `#[Fillable]` attribute (Laravel 13 style) instead of `$fillable` property
- Uses `casts()` method instead of `$casts` property (modern convention)
- Factory uses `fake()` helper consistently
- No issues found
