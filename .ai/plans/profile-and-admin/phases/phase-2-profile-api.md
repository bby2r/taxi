---
phase: 2
title: "Profile API Endpoints"
status: pending
depends_on: [1]
sub_tasks: 4
---

# Phase 2: Profile API Endpoints

## Goal

Implement profile management API endpoints for both clients and drivers, including client name updates, driver change requests (pending admin approval), phone number changes via OTP verification for both roles, and token refresh. These endpoints are consumed by the React Native mobile app and follow the existing V1 API conventions with Sanctum authentication.

---

## Sub-task 2.1: Client Profile Update

### Goal

Allow authenticated clients to update their `name` via a simple PUT endpoint. No approval workflow needed — the change applies immediately.

### Implementation

1. **Create FormRequest** `app/Http/Requests/Api/V1/UpdateClientProfileRequest.php`:
   - `authorize()`: return `true` (role enforcement is handled by `role:client` middleware)
   - Rules:
     ```php
     'name' => ['required', 'string', 'max:255'],
     ```

2. **Create Controller** `app/Http/Controllers/Api/V1/ClientProfileController.php`:
   - Inject nothing (simple update)
   - Method `update(UpdateClientProfileRequest $request): UserResource`
     - `$request->user()->update($request->validated())`
     - Return `new UserResource($request->user())`

3. **Register Route** in `routes/api.php`:
   - Inside the existing `v1/client` group with `role:client` middleware:
     ```php
     Route::put('/profile', [ClientProfileController::class, 'update'])
         ->name('api.v1.client.profile.update');
     ```
   - Add the `use` import for `ClientProfileController`

### Artifacts

| Action | File |
|--------|------|
| Create | `app/Http/Requests/Api/V1/UpdateClientProfileRequest.php` |
| Create | `app/Http/Controllers/Api/V1/ClientProfileController.php` |
| Modify | `routes/api.php` |
| Create | `tests/Feature/Http/Api/V1/ClientProfileControllerTest.php` |

### Test Spec

**File**: `tests/Feature/Http/Api/V1/ClientProfileControllerTest.php`

Uses `RefreshDatabase`, `Sanctum::actingAs()` with `User::factory()` (client by default).

| Method | Description | Key Assertions |
|--------|-------------|----------------|
| `test_client_can_update_name` | PUT `/api/v1/client/profile` with `{name: "New Name"}` | 200, `data.name` = "New Name", DB updated |
| `test_update_profile_requires_name` | PUT with empty body | 422, validation error on `name` |
| `test_update_profile_rejects_name_exceeding_max_length` | PUT with 256-char name | 422, validation error on `name` |
| `test_driver_cannot_access_client_profile_update` | Sanctum acting as driver, PUT | 403 |
| `test_unauthenticated_user_cannot_update_profile` | No auth, PUT | 401 |

---

## Sub-task 2.2: Phone Change with OTP

### Goal

Allow any authenticated user (client or driver) to change their phone number using a two-step OTP flow: send OTP to the new number, then verify it to apply the change. The old phone remains active until the new phone is verified.

### Implementation

1. **Create FormRequest** `app/Http/Requests/Auth/ChangePhoneSendOtpRequest.php`:
   - `authorize()`: return `true`
   - Rules:
     ```php
     'phone' => [
         'required',
         'string',
         'regex:/^\+996[0-9]{9}$/',
         Rule::unique('users', 'phone')->ignore($this->user()->id),
     ],
     ```
   - Custom validation in `withValidator()` or `after()`:
     - Reject if `phone` equals the user's current phone (message: "New phone must differ from current phone.")
   - Custom messages:
     - `phone.unique` => "This phone number is already registered."

2. **Create FormRequest** `app/Http/Requests/Auth/ChangePhoneVerifyRequest.php`:
   - Rules:
     ```php
     'phone' => ['required', 'string', 'regex:/^\+996[0-9]{9}$/'],
     'code'  => ['required', 'string', 'size:4'],
     ```

3. **Add methods to `AuthController`**:

   **`changePhoneSendOtp(ChangePhoneSendOtpRequest $request): JsonResponse`**
   - Call `$this->otpService->sendOtp($request->validated('phone'))`
   - Return `{'message': 'OTP code sent to new phone number.'}`

   **`changePhoneVerify(ChangePhoneVerifyRequest $request): JsonResponse`**
   - `$validated = $request->validated()`
   - `$otpCode = $this->otpService->verifyOtp($validated['phone'], $validated['code'])`
   - If null, return 422 with "Invalid or expired OTP code."
   - Check uniqueness again (race condition guard): `User::where('phone', $validated['phone'])->where('id', '!=', $request->user()->id)->exists()` — if true, return 409 "This phone number was just taken."
   - Update user: `$request->user()->update(['phone' => $validated['phone'], 'phone_verified_at' => now()])`
   - Return `{'message': 'Phone number updated successfully.'}`

4. **Register Routes** in `routes/api.php`:
   - Inside the existing `v1/auth` group, under `auth:sanctum` middleware:
     ```php
     Route::post('/change-phone/send-otp', [AuthController::class, 'changePhoneSendOtp'])
         ->middleware(['auth:sanctum', 'throttle:5,1'])
         ->name('api.v1.auth.change-phone.send-otp');

     Route::post('/change-phone/verify', [AuthController::class, 'changePhoneVerify'])
         ->middleware(['auth:sanctum', 'throttle:10,1'])
         ->name('api.v1.auth.change-phone.verify');
     ```

### Artifacts

| Action | File |
|--------|------|
| Create | `app/Http/Requests/Auth/ChangePhoneSendOtpRequest.php` |
| Create | `app/Http/Requests/Auth/ChangePhoneVerifyRequest.php` |
| Modify | `app/Http/Controllers/Api/V1/AuthController.php` |
| Modify | `routes/api.php` |
| Create | `tests/Feature/Http/Auth/ChangePhoneTest.php` |

### Test Spec

**File**: `tests/Feature/Http/Auth/ChangePhoneTest.php`

Uses `RefreshDatabase`, `Sanctum::actingAs()`. Mock `NikitaSmsService` to prevent real SMS.

| Method | Description | Key Assertions |
|--------|-------------|----------------|
| `test_send_otp_to_new_phone` | POST send-otp with valid new phone | 200, OtpCode record created for new phone |
| `test_send_otp_rejects_current_phone` | POST send-otp with user's own phone | 422, validation error |
| `test_send_otp_rejects_already_taken_phone` | POST send-otp with another user's phone | 422, "already registered" |
| `test_send_otp_rejects_invalid_phone_format` | POST send-otp with "123456" | 422, validation error on `phone` |
| `test_verify_otp_updates_phone` | Full flow: send OTP, then verify | 200, user phone updated in DB, `phone_verified_at` refreshed |
| `test_verify_otp_fails_with_wrong_code` | POST verify with bad code | 422, phone unchanged |
| `test_verify_otp_fails_with_expired_code` | Create expired OTP, then verify | 422, phone unchanged |
| `test_verify_otp_rejects_phone_taken_race_condition` | Verify after another user takes the phone between steps | 409 |
| `test_unauthenticated_user_cannot_change_phone` | No auth | 401 on both endpoints |
| `test_client_can_change_phone` | Acting as client, full flow | 200, phone updated |
| `test_driver_can_change_phone` | Acting as driver, full flow | 200, phone updated |

---

## Sub-task 2.3: Driver Profile Change Request

### Goal

Drivers cannot directly edit their profile fields (`name`, `car_model`, `car_number`). Instead, they submit change requests that go through admin approval (Phase 3). This sub-task creates the request submission and listing endpoints, and enhances the existing driver profile response to include pending changes.

### Implementation

> **Prerequisite**: Phase 1 delivers the `DriverChangeRequest` model, `DriverDriverChangeRequestStatus` enum, migration, factory, and the `changeRequests()` HasMany on User. This sub-task uses those artifacts directly — do not recreate them.

1. **Create Resource** `app/Http/Resources/V1/DriverChangeRequestResource.php`:
   ```php
   public function toArray(Request $request): array
   {
       return [
           'id' => $this->id,
           'field' => $this->field,
           'old_value' => $this->old_value,
           'new_value' => $this->new_value,
           'status' => $this->status->value,
           'admin_comment' => $this->admin_comment,
           'created_at' => $this->created_at->toISOString(),
       ];
   }
   ```

4. **Create FormRequest** `app/Http/Requests/Api/V1/RequestDriverChangesRequest.php`:
   - `authorize()`: return `true`
   - Rules:
     ```php
     'name'       => ['sometimes', 'string', 'max:255'],
     'car_model'  => ['sometimes', 'string', 'max:255'],
     'car_number' => ['sometimes', 'string', 'max:20'],
     ```
   - `withValidator()` or `after()`:
     - Ensure at least one field is present
     - For each submitted field, check it differs from the current value (user's `name`, or `driverProfile->car_model` / `car_number`)
     - For each submitted field, check no pending `DriverChangeRequest` exists for this user + field combo. Error: "You already have a pending change request for {field}."

5. **Create Controller** `app/Http/Controllers/Api/V1/DriverProfileController.php`:

   **`requestChanges(RequestDriverChangesRequest $request): JsonResponse`**
   - Allowed fields: `['name', 'car_model', 'car_number']`
   - For each validated field present in the request:
     - Determine `old_value`: for `name`, use `$request->user()->name`; for `car_model`/`car_number`, use `$request->user()->driverProfile->{$field}`
     - Create `DriverChangeRequest` with `user_id`, `field`, `old_value`, `new_value`, `status: pending`
   - Return created requests as `DriverChangeRequestResource::collection($createdRequests)` with 201 status

   **`changeRequests(Request $request): AnonymousResourceCollection`**
   - `$request->user()->changeRequests()->latest()->paginate(15)`
   - Return `DriverChangeRequestResource::collection(...)`

6. **Modify existing `DriverController::profile()`** method:
   - After loading `driverProfile`, also load pending change requests:
     ```php
     $user = $request->user();
     $user->load('driverProfile');
     $pendingChanges = $user->changeRequests()
         ->where('status', DriverChangeRequestStatus::Pending)
         ->get();
     ```
   - Return a custom JSON response (or use `additional()` on UserResource):
     ```php
     return (new UserResource($user))->additional([
         'pending_changes' => DriverChangeRequestResource::collection($pendingChanges),
     ]);
     ```

7. **Register Routes** in `routes/api.php`:
   - Inside the existing `v1/driver` group:
     ```php
     Route::post('/profile/request-changes', [DriverProfileController::class, 'requestChanges'])
         ->name('api.v1.driver.profile.request-changes');
     Route::get('/profile/change-requests', [DriverProfileController::class, 'changeRequests'])
         ->name('api.v1.driver.profile.change-requests');
     ```
   - Add the `use` import for `DriverProfileController`

### Artifacts

| Action | File |
|--------|------|
| Create | `app/Http/Resources/V1/DriverChangeRequestResource.php` |
| Create | `app/Http/Requests/Api/V1/RequestDriverChangesRequest.php` |
| Create | `app/Http/Controllers/Api/V1/DriverProfileController.php` |
| Modify | `app/Http/Controllers/Api/V1/DriverController.php` (enhance `profile()`) |
| Modify | `routes/api.php` |
| Create | `tests/Feature/Http/Api/V1/DriverProfileChangeRequestTest.php` |

### Test Spec

**File**: `tests/Feature/Http/Api/V1/DriverProfileChangeRequestTest.php`

Uses `RefreshDatabase`, `Sanctum::actingAs()` with `User::factory()->driver()`, `DriverProfile::factory()->for($driver)`.

| Method | Description | Key Assertions |
|--------|-------------|----------------|
| `test_driver_can_request_name_change` | POST request-changes `{name: "New Name"}` | 201, DB has DriverChangeRequest with field=name, old_value=old name, status=pending |
| `test_driver_can_request_multiple_field_changes` | POST `{name: "X", car_model: "Y"}` | 201, two DriverChangeRequest records created |
| `test_request_requires_at_least_one_field` | POST with empty body | 422 |
| `test_request_rejects_unchanged_value` | POST with current name value | 422, "must differ" |
| `test_request_rejects_duplicate_pending_field` | Create pending request for `name`, POST another name change | 422, "already have a pending change request" |
| `test_driver_can_request_same_field_after_previous_resolved` | Create approved request for `name`, POST new name change | 201 |
| `test_driver_can_list_change_requests` | Create 3 requests, GET change-requests | 200, paginated, latest first |
| `test_driver_profile_includes_pending_changes` | Create pending request, GET /v1/driver/profile | 200, response has `pending_changes` array with the request |
| `test_driver_profile_excludes_resolved_changes` | Create approved request, GET /v1/driver/profile | 200, `pending_changes` is empty |
| `test_client_cannot_access_driver_change_request_endpoints` | Acting as client | 403 on all driver endpoints |
| `test_car_number_validation_max_length` | POST with car_number > 20 chars | 422 |

---

## Sub-task 2.4: Token Refresh

### Goal

Allow authenticated users to refresh their Sanctum token, extending their session by 30 days. The old token is revoked and a new one is issued.

### Implementation

1. **Add method to `AuthController`**:

   **`refreshToken(Request $request): JsonResponse`**
   ```php
   public function refreshToken(Request $request): JsonResponse
   {
       $request->user()->currentAccessToken()->delete();

       $token = $request->user()->createToken('mobile', expiresAt: now()->addDays(30));

       return response()->json([
           'message' => 'Token refreshed successfully.',
           'token' => $token->plainTextToken,
       ]);
   }
   ```

2. **Register Route** in `routes/api.php`:
   - Inside the existing `v1/auth` group:
     ```php
     Route::post('/refresh-token', [AuthController::class, 'refreshToken'])
         ->middleware('auth:sanctum')
         ->name('api.v1.auth.refresh-token');
     ```

### Artifacts

| Action | File |
|--------|------|
| Modify | `app/Http/Controllers/Api/V1/AuthController.php` |
| Modify | `routes/api.php` |
| Create | `tests/Feature/Http/Auth/RefreshTokenTest.php` |

### Test Spec

**File**: `tests/Feature/Http/Auth/RefreshTokenTest.php`

Uses `RefreshDatabase`, `Sanctum::actingAs()`.

| Method | Description | Key Assertions |
|--------|-------------|----------------|
| `test_authenticated_user_can_refresh_token` | POST /v1/auth/refresh-token | 200, response has `token`, new token string differs from old |
| `test_old_token_is_invalidated_after_refresh` | Refresh, then use old token on /auth/me | 401 |
| `test_new_token_works_after_refresh` | Refresh, extract new token, call /auth/me with it | 200 |
| `test_unauthenticated_user_cannot_refresh_token` | No auth, POST | 401 |
| `test_refresh_token_works_for_client` | Acting as client | 200 |
| `test_refresh_token_works_for_driver` | Acting as driver | 200 |

---

## Execution Order

1. **Sub-task 2.1** (simple, independent client endpoint)
2. **Sub-task 2.2** (phone change OTP flow, touches AuthController)
3. **Sub-task 2.3** (driver change requests — uses Phase 1 model artifacts)
4. **Sub-task 2.4** (token refresh, also touches AuthController — do last to minimize merge conflicts)

## Post-Phase Checklist

- [ ] Run `vendor/bin/pint --dirty --format agent` after all PHP changes
- [ ] Run `php artisan test --compact` for all new test files
- [ ] Verify `php artisan route:list --path=api/v1` shows all new routes
- [ ] Confirm no N+1 queries in profile endpoint (eager load relationships)
