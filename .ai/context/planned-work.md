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

## Pre-Assign UX Polish
First version uses haversine distance from driver to current dropoff (`pre_assign_distance_km`, default 1.5 km) as a proxy for "near completion". Still open: live ETA tracking from the route service for a more accurate window, and a dedicated "next order" UI on the driver side so the new offer doesn't compete with the active ride card.
> Source: conversation 2026-04-22, partial implementation 2026-05-06

## Done

- **Driver Cancellation / Decline Reasons** — required reason on decline, 5-strike → 2h block, timeout declines excluded from the counter. Implemented 2026-04-22.
- **Driver Search Radius** — `max_search_radius_km` setting (default 10 km) enforced in `GeoService`. Implemented during regional pricing work.
- **Busy-Driver Exclusion** — drivers with an Accepted/Arrived/InProgress order are excluded from the dispatch pool. Implemented 2026-04-22.
- **Inter-District UI** — offer card badge + dropoff info, active-screen dropoff marker, route switches to dropoff once ride is in progress. Implemented 2026-04-22.
- **Driver-Initiated Cancel** — `POST /driver/orders/{order}/cancel` with `DriverCancellationReason` enum, valid only in Accepted/Arrived; mobile sheet on Arrived card. Implemented 2026-05-06.
- **Start Ride Step on Mobile** — driver UI now has explicit "Начать поездку" → InProgress state separate from "Завершить поездку" → Completed (backend already had `/start`). Implemented 2026-05-06.
- **Client Phone Visible on Active Screen** — name + phone shown on EnRouteCard / ArrivedCard with one-tap call (tel:). Implemented 2026-05-06.
- **Pre-Assign Next Order (v1)** — `pre_assign_distance_km` setting (default 1.5 km, 0 disables); driver in InProgress whose haversine distance to dropoff is below the threshold becomes eligible for the next dispatch. Implemented 2026-05-06.
