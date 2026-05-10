# Architecture

## Stack
- **Backend:** Laravel 13 (PHP 8.4) + PostgreSQL
- **Mobile:** React Native via Expo (SDK 54/55), single binary for client+driver
- **Real-time:** Pusher (cluster ap1, Asia-Pacific)
- **Auth:** Sanctum tokens (mobile), sessions (admin web)
- **SMS:** Nikita (`smspro.nikita.kg`) — Kyrgyz provider for OTP delivery
- **Push:** Expo Push Notifications
- **Frontend (admin):** Blade + Vite + TailwindCSS v4

**Why this stack:** Village taxi app prioritizing simplicity and speed-to-market. Laravel monolith + Expo for cross-platform, Pusher as managed WebSocket service.

## Code Structure
Standard Laravel 13, service-layer architecture. Controllers are thin — delegate to services.

```
app/
  Enums/         — UserRole, OrderStatus, DriverChangeRequestStatus
  Events/        — 6 broadcast events (order lifecycle)
  Http/
    Controllers/ — Admin/ (web) + Api/V1/ (mobile API)
    Middleware/   — EnsureUserRole, LogApiTraffic
    Requests/    — Auth/ + Api/V1/
    Resources/V1/ — OrderResource, UserResource, DriverProfileResource
  Jobs/          — OfferTimeoutJob (10s auto-decline)
  Models/        — User, Order, DriverProfile, OtpCode, DriverChangeRequest
  Services/      — OrderService, TariffService, GeoService, OtpService, ExpoPushService, NikitaSmsService
```

**OrderService** is the central orchestrator — full order state machine with pessimistic locking.

## External Services

| Service | Role |
|---------|------|
| Pusher | WebSocket broadcasting (order events) |
| Nikita SMS | OTP delivery (Kyrgyz provider) |
| Expo Push | Mobile push notifications |
| EAS Build | Mobile app builds (Android package: `kg.villagetaxi.app`) |

## Queue
Database queue driver. Single key job: `OfferTimeoutJob` (10s delay for driver offer timeout). Supervisor runs 1 worker in production.

## Cache & Sessions
Redis will be used for cache/queue. Pusher confirmed for real-time broadcasting.

## Deployment
**Target: Render (PaaS).** Docker multi-stage build (3 stages: Node for Vite, Composer for deps, PHP-FPM for runtime). Single container runs Nginx + PHP-FPM + queue worker + scheduler via Supervisor.

Entrypoint: clears caches, runs migrations, seeds, creates default admin from env vars.

## Environment Differences

| Aspect | Dev | Prod |
|--------|-----|------|
| SMS | Disabled, logs to file | Enabled, real SMS |
| Queue | `queue:listen` | `queue:work` via Supervisor |
| Frontend | Vite HMR | Pre-built in Docker |
| DB | Local PostgreSQL | Docker PostgreSQL 17 |
