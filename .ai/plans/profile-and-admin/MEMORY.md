# Plan Memory — Profile & Admin

## Conventions Established
- Enums: string-backed, TitleCase keys, lowercase values (matches UserRole, OrderStatus)
- Models: `#[Fillable]` attribute, `casts()` method, PHPDoc generics on all relations/scopes
- Factories: default state + named states (approved, rejected, forField)
- Tests: PHPUnit v12, feature tests use RefreshDatabase, unit tests for enums

## Key Artifacts
- `DriverChangeRequestStatus` enum: Pending, Approved, Rejected
- `DriverChangeRequest` model: user_id, status, field, old_value, new_value, admin_comment, reviewed_at, reviewed_by
- Scopes: `pending()`, `forUser(int)`, `forField(string)`
- Relations: `user()` BelongsTo, `reviewer()` BelongsTo (reviewed_by)
- `User::changeRequests()` HasMany relation added
- Factory states: `approved()`, `rejected()`, `forField(string)`
- Index: `[user_id, field, status]`

## Patterns for Phase 2+
- Phone format: `+996XXXXXXXXX` (regex: `/^\+996[0-9]{9}$/`)
- Sanctum tokens: `createToken('mobile', expiresAt: now()->addDays(30))`
- API routes: prefix `v1`, named `api.v1.*`, role middleware `role:client` or `role:driver`
- FormRequests: `authorize()` returns true (role enforcement via middleware)
- Resources: V1-versioned in `app/Http/Resources/V1/`
