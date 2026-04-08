# Plan Memory — Profile & Admin

## Conventions
- Enums: string-backed, TitleCase keys, lowercase values
- Models: `#[Fillable]` attribute, `casts()` method, PHPDoc generics on relations/scopes
- Controllers: thin, delegate to services/FormRequests. Return Resources or JsonResponse.
- FormRequests: `authorize()` returns true (role enforcement via route middleware)
- Resources: V1-versioned in `app/Http/Resources/V1/`
- Tests: PHPUnit v12, feature tests use RefreshDatabase, `Sanctum::actingAs()` for auth
- API routes: prefix `v1`, named `api.v1.*`, role middleware `role:client` or `role:driver`

## Key Artifacts (Phase 1+2)
- `DriverChangeRequest` model: user_id, status (enum cast), field, old_value, new_value, admin_comment, reviewed_at, reviewed_by
- `DriverChangeRequestResource`: id, field, old_value, new_value, status, admin_comment, created_at
- `User::changeRequests()` HasMany
- Scopes: `pending()`, `forUser(int)`, `forField(string)`
- `DriverController::profile()` returns UserResource with `->additional(['pending_changes' => ...])`

## API Endpoints Added
- `PUT /v1/client/profile` — name update
- `POST /v1/auth/change-phone/send-otp` + `/verify` — phone change with OTP
- `POST /v1/driver/profile/request-changes` — creates DriverChangeRequest per field
- `GET /v1/driver/profile/change-requests` — paginated list
- `POST /v1/auth/refresh-token` — revoke + reissue 30-day token

## Phase 3 Notes
- Admin panel uses Blade + TailwindCSS 4, extends `layouts.admin`
- Existing admin views pattern: `admin/orders/index.blade.php`, `admin/orders/show.blade.php`
- Status badges: `admin/partials/order-status-badge.blade.php` — follow same pattern
- Admin routes: prefix `admin`, middleware `auth` + `EnsureUserRole:admin`, named `admin.*`
- Route model binding: `{ticket}` needs explicit binding to DriverChangeRequest in AppServiceProvider
- Admin approve logic: `name` updates User, `car_model`/`car_number` update DriverProfile — wrap in DB::transaction
