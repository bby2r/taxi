# Expected Behavior

Key business rules extracted from 40 test files. These are executable specifications — the project considers this behavior correct.

## Authentication
- Clients: phone OTP (+996 format only), 4-digit code, 5-min expiry, single-session (all tokens revoked on login)
- Drivers: phone + password, single-session
- Admin: session-based web auth, phone + password, non-admin users rejected
- Rate limits: 5 OTP sends/min, 10 verifies/min, 10 driver logins/min
- New OTP invalidates all previous valid codes for that phone
- First OTP verify auto-creates client user

## Role-Based Access
- `role:client` blocks drivers (403), `role:driver` blocks clients (403)
- Multi-role syntax supported: `role:client,driver`
- Unauthenticated -> 401

## Order Lifecycle
- Active: Searching, Accepted, Arrived, InProgress
- Cancellable: Searching, Accepted, Arrived (NOT InProgress)
- Only one active order per client
- Only the offered driver can accept (RuntimeException otherwise)
- Status transitions are strictly sequential (can't skip states)
- All transitions use DB locks for concurrency

## Pricing (tested with boundary values)
- Day: 80 KGS (07:00-20:59 Asia/Bishkek)
- Night: 120 KGS (21:00-06:59)
- Cancellation from Searching: no fee
- Cancellation from Accepted/Arrived: 50 KGS (only if client cancels)
- Timezone is Asia/Bishkek (UTC+6)

## Driver Matching
- Nearest-first with Haversine distance
- Declined drivers excluded from subsequent offers
- Drivers with an Accepted/Arrived/InProgress order excluded from the dispatch pool
- Drivers with `blocked_until` in the future excluded
- Empty online pool -> auto-cancel by system
- 10-second offer timeout -> auto-decline (reason `timeout`, does not count toward shift block)

## Driver Decline Penalty
- Driver must pick one of: `too_far`, `wrong_district`, `client_no_answer`, `personal`
- Each non-timeout decline increments `shift_declines_count`
- 5 non-timeout declines -> `blocked_until = now + 2h`, driver forced offline
- `go-online` rejects (HTTP 423) while `blocked_until` is in the future
- `go-online` resets `shift_declines_count` to 0 (fresh shift)
- Timeouts and controller validation errors (missing/invalid reason) do not touch the counter

## Push Notifications
- Always includes `sound: 'default'`
- No HTTP call if user lacks push token (graceful degradation)
- Sent on: offer (driver), accepted (client), arrived (client), completed (both), cancelled (both)

## Admin Panel
- Dashboard shows today's revenue from completed orders
- Driver delete blocked if active orders exist
- Order list supports status filtering, paginated at 20

## Test Coverage Gaps
- No concurrent order acceptance tests (race conditions)
- No tests for DriverStats API endpoint
- No tests for dropoff coordinates in order creation
- No controller/service tests for DriverChangeRequest approve/reject
- No tests for driver-side order history pagination
