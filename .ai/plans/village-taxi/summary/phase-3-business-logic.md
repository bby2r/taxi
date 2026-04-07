---
phase: 3
title: "Core Business Logic — Tariff, Geo, Order Service, Broadcasting"
completed: 2026-04-07
---

# Summary: Phase 3 — Core Business Logic

## What Was Done
- TariffService: day/night pricing (80/120 som), timezone-aware (Asia/Bishkek), cancellation fee (50 som)
- GeoService: Haversine distance calculation, nearest online driver search with exclusion and limit
- OrderService: full order lifecycle (create → offer → accept → arrive → start → complete/cancel)
  - Driver cascade: nearest driver gets 10s offer, timeout → next driver, no drivers → auto-cancel
  - Pessimistic locking (DB::transaction + lockForUpdate) on all state transitions
  - Cancellation fee only when client cancels after driver acceptance
- OfferTimeoutJob: delayed job (10s) that auto-declines stale offers
- 6 order events: OrderOfferedToDriver, OrderAccepted, OrderDriverArrived, OrderInProgress, OrderCompleted, OrderCancelled
- Pusher broadcasting: all events implement ShouldBroadcast with private channels
- Channel authorization: client.{userId} and driver.{userId} with role check

## Files Created
- `app/Services/TariffService.php`, `app/Services/GeoService.php`, `app/Services/OrderService.php`
- `app/Jobs/OfferTimeoutJob.php`
- `app/Events/` — 6 event classes
- `routes/channels.php` — broadcast channel auth
- `config/broadcasting.php` — Pusher config
- `tests/` — 4 test files (46 new tests)

## Tests
- 148 tests total, all passing
- 46 new tests in Phase 3
