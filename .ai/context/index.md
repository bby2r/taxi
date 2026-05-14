# Project Context Index

AIYL Taxi — a taxi dispatch app for a small village in Kyrgyzstan (Bishkek region). Flat-rate pricing, cash or bank transfer payments, admin-managed drivers, phone OTP auth for clients. Binary feedback system (👍/👎). Drivers can cancel with reasons. Client blacklist for repeat offenders.

## Domains
- **[data-model](data-model.md)** — Entities (User, Order, DriverProfile, OtpCode, DriverChangeRequest), relationships, status workflows, constraints
- **[business-logic](business-logic.md)** — Order lifecycle, pricing (80/120 KGS day/night), driver matching algorithm, OTP flow, push/SMS notifications
- **[api-surface](api-surface.md)** — REST API v1 (client + driver + admin), Sanctum auth, broadcasting channels, middleware
- **[ui-decisions](ui-decisions.md)** — Admin panel (Blade), mobile client (React Native, light theme, Russian), mobile driver (React Native, dark theme, Russian)
- **[architecture](architecture.md)** — Laravel 13 + PostgreSQL, Expo mobile, Pusher real-time, Render deployment, service-layer pattern
- **[expected-behavior](expected-behavior.md)** — Key invariants from 40 test files, coverage gaps, business rules as tests
- **[planned-work](planned-work.md)** — Inter-district pricing, in-app card payments, blacklist system, driver cancellation reasons, 👍/👎 feedback, search radius
