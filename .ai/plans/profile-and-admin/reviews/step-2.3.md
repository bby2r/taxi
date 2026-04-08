---
step: "2.3"
verdict: PASS
date: 2026-04-08
---
## Review Notes

### Resource (`DriverChangeRequestResource`)
- Returns all required fields: id, field, old_value, new_value, status (as enum value), admin_comment, created_at (ISO string). Correct.

### FormRequest (`RequestDriverChangesRequest`)
- Validates name, car_model, car_number as optional strings with max lengths.
- `after()` hook enforces at least one field must be provided.
- Rejects unchanged values by comparing against current DB value (cast to string for safe comparison).
- Rejects duplicate pending requests using `DriverChangeRequest::forUser()->forField()->pending()->exists()`.
- FIELD_SOURCES mapping correctly routes name to User model and car_model/car_number to DriverProfile. All good.

### Controller (`DriverProfileController`)
- `requestChanges()`: loads driverProfile, iterates validated fields, creates one DriverChangeRequest per field with correct old_value sourced from the right model (user vs driverProfile). Returns 201 with resource collection.
- `changeRequests()`: paginated list of authenticated user's change requests, latest first. Correct.
- Minor note: FIELD_SOURCES constant is duplicated between the FormRequest and Controller. This is acceptable for now but could be extracted to a shared location if it grows.

### DriverController (`profile()` method)
- Loads driverProfile and fetches pending change requests via `changeRequests()->pending()->get()`.
- Uses `additional()` to attach `pending_changes` as a top-level key alongside the UserResource data. Correct.

### Routes (`api.php`)
- Both new routes are inside the `v1 > auth:sanctum > driver > role:driver` middleware group. Correct placement.
- `POST /driver/profile/request-changes` and `GET /driver/profile/change-requests` with proper named routes.

### Tests (11 tests, 29 assertions, all passing)
- Happy path: single field change, multiple field changes.
- Validation: empty request rejected, unchanged value rejected, duplicate pending rejected, max length enforced.
- Edge case: same field allowed after previous request resolved (approved).
- List endpoint: returns paginated results with correct structure.
- Profile endpoint: includes pending_changes, excludes resolved changes.
- Authorization: client role gets 403 on all three endpoints.
- Good coverage overall.

### No issues found.
