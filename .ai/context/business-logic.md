# Business Logic

## Tariff / Pricing
Flat-rate pricing — intentionally simple for a village where all destinations are roughly equal distance.
- **Day rate:** 80 KGS (07:00-20:59 Asia/Bishkek)
- **Night rate:** 120 KGS (21:00-06:59 Asia/Bishkek)
- **Cancellation fee:** 50 KGS (only when client cancels after driver assigned)
- Price locked at order creation time via `TariffService::getCurrentPrice()`
- All prices are hardcoded PHP constants — configurable settings planned

**Inter-district pricing:** Within village = flat rate. Between districts = TBD (not yet defined).
- No higher penalty when driver has arrived — since payment is cash/transfer, enforcement is via blacklist instead.
- **Blacklist system:** If a client frequently cancels or doesn't show up → warning first, then block the user.

> Source: `app/Services/TariffService.php`, bplan interview 2026-04-09

## Order Lifecycle (State Machine)

```
(new) -> Searching -> Accepted -> Arrived -> InProgress -> Completed
              \          \           \
               \-> Cancelled (from Searching, Accepted, Arrived — NOT InProgress)
```

### Transitions & Side Effects

| From | To | Trigger | Side Effects |
|---|---|---|---|
| (new) | Searching | `createOrder()` | Price locked; `offerToNextDriver()` called |
| Searching | Accepted | `acceptOrder()` | DB lock; sets driver; broadcasts `OrderAccepted`; push to client |
| Searching | Searching | `declineOrder()` / timeout | Driver added to declined list; re-offers to next |
| Searching | Cancelled | No drivers | Auto-cancel by system |
| Accepted | Arrived | `driverArrived()` | Broadcasts `OrderDriverArrived`; push to client |
| Arrived | InProgress | `startRide()` | Broadcasts `OrderInProgress` |
| InProgress | Completed | `completeOrder()` | Broadcasts `OrderCompleted`; push to both |
| Any cancellable | Cancelled | `cancelOrder()` | Fee if client cancels post-assignment; broadcasts + push |

### Key Rules
- Client can only have one active order at a time
- Only the offered driver can accept/decline
- All transitions use `DB::transaction()` + `lockForUpdate()` for concurrency safety
- **Drivers CAN cancel orders** in `Accepted` or `Arrived` status. They cannot cancel `InProgress` (the actual ride). Endpoint: `POST /api/v1/driver/orders/{order}/cancel` with required `reason` from `DriverCancellationReason` enum (`client_no_show`, `client_no_answer`, `long_wait`). No fee, no shift-decline penalty — reason saved to `orders.cancellation_reason` for admin visibility.

## Driver Matching Algorithm
Sequential nearest-driver offer (not broadcast):
1. `GeoService::findNearestDrivers()` — loads all online drivers with coordinates, excludes declined and blocked. Eligibility filter:
   - No active order → eligible
   - Active order in `InProgress` AND haversine distance from current driver location to dropoff is ≤ `pre_assign_distance_km` → eligible (pre-assign window). The order must have dropoff coords; in-village pickups without dropoff fall through.
   - Active order in `Accepted` or `Arrived` → not eligible (driver hasn't picked up yet)
2. Haversine distance in PHP (not SQL), sorts by distance, takes closest
3. Offers to that driver, dispatches `OfferTimeoutJob` (10-second delay)
4. If no response in 10s, auto-decline and re-offer to next
5. If no drivers left, auto-cancel order

**Max radius:** Configurable `max_search_radius_km` setting (default 10 km).
**Pre-assign distance:** Configurable `pre_assign_distance_km` setting (default 1.5 km, 0 disables). Lets a driver who is finishing their current ride pick up the next request before completing.
**In-memory calculation** — acceptable for small village driver pool.

> Source: `app/Services/GeoService.php`, `app/Services/OrderService.php`, `app/Jobs/OfferTimeoutJob.php`

## Driver Decline Rules
Drivers must select a reason when declining an offer; timeouts are tracked separately and do not count toward the block threshold.

- Reasons (enum `App\Enums\DeclineReason`): `too_far`, `wrong_district`, `client_no_answer`, `personal`. Server-side timeouts use `timeout` and are excluded from the penalty counter.
- Each decline is logged in `order_declines` (`order_id`, `driver_id`, `reason`, `created_at`).
- `driver_profiles.shift_declines_count` is incremented on every non-timeout decline and reset to 0 on `goOnline` (new shift).
- When the counter reaches `decline_block_threshold` (default 5), `blocked_until` is set to now + `decline_block_hours` (default 2) and the driver is forced offline.
- `goOnline` is rejected with HTTP 423 while `blocked_until` is still in the future.
- `DriverProfile::scopeNotBlocked` + `scopeWithoutActiveOrder` enforce exclusion during dispatch.

> Source: `app/Services/OrderService.php::declineOrder`, `app/Models/DriverProfile.php`, migrations in `database/migrations/`

## Driver Operational Status
`DriverProfile::computedStatus()` derives a single status string used by UI/admin:
`offline | blocked | free | en_route | arrived | in_ride`.
Computed from `is_online`, `blocked_until`, and the driver's active order status.

## OTP / Phone Verification
- 4-digit code, 5-minute TTL, sent via Nikita SMS
- New OTP invalidates all previous codes for that phone
- In non-production: code is logged (dev/testing convenience)
- Message in Russian: "Ваш код подтверждения: {code}"

> Source: `app/Services/OtpService.php`

## Notifications
Dual-channel: Expo push + Pusher broadcasting.
- **Push (Expo):** fire-and-forget, graceful degradation if no token
- **Broadcasting (Pusher):** private channels `client.{id}` and `driver.{id}`
- Events: `order.offered`, `order.accepted`, `order.driver_arrived`, `order.in_progress`, `order.completed`, `order.cancelled`

## Roles & Authorization
Three roles: Client, Driver, Admin. No formal Laravel Policies — authorization is implicit in service methods and `EnsureUserRole` middleware.

## Payments
Two payment methods: **cash** or **bank card transfer** (direct transfer to driver's card, not in-app processing). Card payments (Visa/Mastercard in-app) may be added later.
