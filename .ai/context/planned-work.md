# Planned Work

Features and improvements confirmed by the project owner.

## Inter-District Pricing
Within-village pricing is fixed (80/120 KGS). Per-region pricing is implemented (`regions.day_price` / `night_price`). Still open: how to surface/assign regions for new inter-district directions added in the future.
> Source: bplan interview 2026-04-09, work 2026-04-22

## In-App Card Payments (Visa/Mastercard)
Currently cash or bank card transfer. May add in-app card payment processing later.
> Source: bplan interview 2026-04-09

## Client Blacklist System
Clients who frequently cancel or don't show up: warning first, then block. Replaces monetary penalty escalation.
> Source: bplan interview 2026-04-09

## Post-Ride Feedback (👍/👎)
Binary feedback after ride completion. If negative → free-text description. No star ratings.
> Source: bplan interview 2026-04-09

## Soft Deletes
Need to add soft deletes for data retention (orders, users, driver profiles). Confirmed needed.
> Source: bplan interview 2026-04-09

## Pre-Assign Next Order Before Current Ride Ends
When a driver is 5-10 minutes from completing their current ride, and is geographically closest to a new pickup, they should be eligible to receive that order before finishing. Blocked on: live ETA tracking from dropoff route, tie-breaking rules, UX for "next order" state on the driver side.
> Source: conversation 2026-04-22

## Done

- **Driver Cancellation / Decline Reasons** — required reason on decline, 5-strike → 2h block, timeout declines excluded from the counter. Implemented 2026-04-22.
- **Driver Search Radius** — `max_search_radius_km` setting (default 10 km) enforced in `GeoService`. Implemented during regional pricing work.
- **Busy-Driver Exclusion** — drivers with an Accepted/Arrived/InProgress order are excluded from the dispatch pool. Implemented 2026-04-22.
- **Inter-District UI** — offer card badge + dropoff info, active-screen dropoff marker, route switches to dropoff once ride is in progress. Implemented 2026-04-22.
