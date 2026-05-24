# Alif Taxi

A ride-hailing application for villages — a simple replacement for calling a dispatcher. Passengers tap one button, and the system automatically finds the nearest available driver.

## Roles

- **Passenger** — phone number login via SMS code, one-tap ride ordering, real-time order tracking, ride history
- **Driver** — go online/offline, receive ride offers with a 10-second countdown, GPS tracking, earnings stats
- **Admin** — web dashboard with active orders, online drivers, revenue, driver management, and order history

## Pricing

| Time | Price |
|------|-------|
| Day (07:00–21:00) | 80 сом |
| Night (21:00–07:00) | 120 сом |

Fixed pricing — the passenger sees the fare before ordering.

## Tech Stack

- **Backend**: Laravel 13 (PHP 8.4), PostgreSQL
- **Frontend**: Vite + TailwindCSS v4
- **Mobile**: iOS & Android (Apple Maps / Google Maps)
- **Real-time**: instant order status & driver location updates
- **Auth**: SMS OTP (passengers), password (drivers)

## Development

```bash
# Setup
composer run setup

# Run dev server (app + queue + Vite)
composer run dev

# Run tests
php artisan test --compact

# Fix code style
vendor/bin/pint --dirty --format agent
```
