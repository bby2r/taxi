# Plan Memory — Settings, Regions & Admin Improvements

## Status: COMPLETE (all 4 phases)

## Setting model
- Key-value store: `Setting::getValue('key', $default)` returns `?string`
- 4 seeded keys: day_price (80), night_price (120), cancellation_fee (50), max_search_radius_km (10)
- TariffService reads from settings with fallback defaults, caches per instance
- Admin: GET/PUT /admin/settings for editing

## Region model
- Inter-village destinations with day/night pricing
- `getCurrentPrice(?Carbon)`: hour 7-20 = day, else night (Asia/Bishkek)
- Admin: full CRUD at /admin/regions
- API: GET /api/v1/client/regions (active regions with prices)
- Regional orders: POST /api/v1/client/orders/regional (30s driver timeout)

## Mobile
- `RegionSelector` bottom-sheet component fetches regions from API
- HomeScreen: "Межгород" outline button opens RegionSelector
- Dynamic price from GET /api/v1/client/price (fallback 80)
- `useOrder.callRegionalTaxi()` creates regional orders
- FIXED_PRICE constant removed

## Admin sidebar order
Dashboard, Drivers, Clients, Regions, Orders, Tickets, Settings
