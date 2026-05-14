# Review: Step 1.4 - Order Model & Migration

**Verdict: PASS (with minor gaps)**

**Date:** 2026-04-06
**Tests:** 11/11 passing (0.30s)

## Migration (`2026_04_06_185457_create_orders_table.php`)

All spec requirements met:
- client_id FK with cascadeOnDelete
- driver_id nullable FK with nullOnDelete
- status string default 'searching'
- pickup_latitude/longitude decimal(10,7)
- pickup_address string(500) nullable
- dropoff_latitude/longitude decimal(10,7) nullable
- dropoff_address string(500) nullable
- price unsignedInteger
- offered_driver_id nullable FK with nullOnDelete
- offered_at timestamp nullable
- declined_drivers json nullable
- cancellation_fee unsignedInteger nullable
- cancelled_by string nullable
- All status timestamps (accepted_at, arrived_at, in_progress_at, completed_at, cancelled_at)
- Indexes on status, client_id, driver_id, offered_driver_id

## Model (`app/Models/Order.php`)

All spec requirements met:
- `#[Fillable]` attribute with all columns
- Casts: status => OrderStatus, decimals, datetimes, declined_drivers => array, price/cancellation_fee => integer
- Relations: client, driver, offeredDriver (all BelongsTo User)
- Scopes: active, forClient, forDriver
- Helpers: isActive, isCancellable, getDeclinedDriverIds

## Factory (`database/factories/OrderFactory.php`)

All spec requirements met:
- Default: Searching status, price 80, KG-region coordinates
- States: accepted, arrived, completed, cancelled, nightPrice
- States properly chain timestamps (arrived sets accepted_at, completed sets all prior timestamps)

## Test Coverage (`tests/Feature/Models/OrderModelTest.php`)

Covered:
- client, driver, offeredDriver relations
- active scope
- forClient scope
- isActive helper (all statuses)
- isCancellable helper (all statuses)
- declined_drivers JSON cast
- status enum cast
- accepted factory state
- completed factory state

### Gaps (not blocking):
- **Missing test for `forDriver` scope** -- mirrors `forClient`, low risk
- **Missing test for `getDeclinedDriverIds` helper** -- trivial null-coalescing, low risk
- **Missing test for `nightPrice` factory state** -- simple price override
- **Missing test for `cancelled` factory state** -- used in active scope test but not directly asserted
- **Missing test for `arrived` factory state** -- used in active scope test but not directly asserted

These gaps are minor since the untested items are either trivially simple or indirectly exercised by other tests.

## Summary

Implementation fully matches the spec. Code quality is good -- proper PHPDoc, type hints, enum casts, and factory state chaining. The only recommendation is adding the 5 missing targeted tests for completeness.
