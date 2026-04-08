---
step: "1.1 + 1.2"
verdict: PASS
date: 2026-04-08
---

## Review Notes

### Enum (`DriverChangeRequestStatus`)
- Matches `UserRole` and `OrderStatus` conventions exactly: backed string enum, TitleCase keys, lowercase values.

### Model (`DriverChangeRequest`)
- Follows `DriverProfile` conventions: `#[Fillable]` attribute, `/** @use HasFactory<T> */` docblock, typed `casts()` method, PHPDoc on all relations and scopes with proper generics (`Builder<DriverChangeRequest>`, `BelongsTo<User, $this>`).
- All required relations present: `user()` and `reviewer()` BelongsTo.
- All required scopes present: `scopePending`, `scopeForUser`, `scopeForField`.

### Migration
- All required columns present: id, user_id (FK with cascadeOnDelete), status (default pending), field, old_value (nullable), new_value, admin_comment (nullable text), reviewed_at (nullable timestamp), reviewed_by (nullable FK to users with nullOnDelete), timestamps.
- Composite index on `[user_id, field, status]` present.

### Factory
- Default state creates a pending request with a driver user, matching `DriverProfileFactory` pattern for `user_id`.
- `approved()` and `rejected()` states correctly set status, reviewed_at, reviewed_by (admin user). Rejected state also sets admin_comment.
- `forField()` state present.

### User Model
- `changeRequests()` HasMany relation added with proper PHPDoc generics, consistent with `clientOrders()`/`driverOrders()` style.

### Tests
- 5 unit tests for enum (case count, individual values, from-string construction).
- 13 feature tests covering: factory creation, user/reviewer relations, null reviewer for pending, enum/datetime casting, all three scopes, all three factory states, and the User->changeRequests inverse relation.
- All 18 tests pass (24 assertions, 0.81s).

## Issues
None.
