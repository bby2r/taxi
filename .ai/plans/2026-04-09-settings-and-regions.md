---
title: "Settings, Regions & Admin Improvements"
date: 2026-04-09
status: draft
tags: [settings, regions, admin, pricing, mobile]
summary: "DB-backed settings, region management with pricing, admin improvements (drivers status, clients page), max search radius, regional orders with mobile popup"
phases: 4
reviewer: PASS (after fixes)
---

# Settings, Regions & Admin Improvements

## Overview

Move hardcoded pricing/config to database-backed settings. Add region management for inter-village rides with day/night pricing. Improve admin panel with driver online status, clients page, settings page, and regions CRUD. Add regional order support in the mobile app with a popup selector.

## Phases

### Phase 1: Foundation — Setting & Region Models
**Goal**: Create Setting (key-value config store) and Region (villages with pricing) models.
**Sub-tasks**: 1.1 Setting model + migration + seeder, 1.2 Region model + migration + factory
**Depends on**: nothing
**File**: `settings-and-regions/phases/phase-1-foundation.md`

### Phase 2: Admin Panel — Drivers Status, Clients, Settings & Regions
**Goal**: Add is_online to drivers list, clients page, settings page, regions CRUD.
**Sub-tasks**: 2.1 Drivers is_online column, 2.2 Clients page, 2.3 Settings page, 2.4 Regions management
**Depends on**: Phase 1
**File**: `settings-and-regions/phases/phase-2-admin-panel.md`

### Phase 3: Backend API — Settings Integration, Max Radius & Regional Orders
**Goal**: Refactor TariffService to use DB settings, add max radius filter, region API endpoints, regional order support.
**Sub-tasks**: 3.1 TariffService refactor, 3.2 Max radius in GeoService, 3.3 Region + price API endpoints, 3.4 Regional order support
**Depends on**: Phase 1, Phase 2
**File**: `settings-and-regions/phases/phase-3-backend-api.md`

### Phase 4: Mobile — Region Order Selector
**Goal**: Add "Межгород" button with region popup, fetch dynamic pricing.
**Sub-tasks**: 4.1 Regions API integration, 4.2 RegionSelector popup component, 4.3 HomeScreen + useOrder updates
**Depends on**: Phase 3
**File**: `settings-and-regions/phases/phase-4-mobile.md`

## Execution Order

```
Phase 1 → Phase 2 (admin) → Phase 3 (API) → Phase 4 (mobile)
```

All phases are sequential.

## New API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/client/regions` | client | List active regions with current prices |
| GET | `/v1/client/price` | client | Get current in-village tariff price |
| POST | `/v1/client/orders/regional` | client | Create order for a specific region |

## New Admin Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/clients` | List all clients |
| GET/PUT | `/admin/settings` | View/update app settings |
| CRUD | `/admin/regions` | Manage regions (villages + pricing) |

## New Models

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| Setting | key (unique), value, description | Key-value app configuration |
| Region | name (unique), day_price, night_price, is_active, sort_order | Inter-village destinations with pricing |

## Key Design Decisions

- **Settings**: key-value store with `Setting::getValue()` + fallback defaults for backward compatibility
- **TariffService**: reads from DB, caches per-instance, keeps time boundaries as constants
- **Max radius**: applied in GeoService after distance calculation, configurable via settings (default 10km)
- **Regional orders**: price from Region::getCurrentPrice(), 30s driver timeout (vs 10s for in-village)
- **Timeout logic**: derived from `$order->region_id ? 30 : 10` inside offerToNextDriver() — no parameter threading
- **Mobile**: "Межгород" button below "Вызвать такси", opens modal with region list + prices
