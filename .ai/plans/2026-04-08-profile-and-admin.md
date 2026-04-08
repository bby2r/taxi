---
title: "Profile Management, Driver Tickets & Admin Improvements"
date: 2026-04-08
status: draft
tags: [profile, admin, otp, driver-tickets, landing-page]
summary: "User profile editing (with OTP phone change), driver change request approval workflow, admin driver tickets page, landing page, admin redirect logic, token refresh"
phases: 3
reviewer: PASS (after fixes)
---

# Profile Management, Driver Tickets & Admin Improvements

## Overview

Extends the taxi app with profile management for clients and drivers, a driver change request approval workflow, admin panel improvements (driver tickets page, landing page, redirect logic), and token refresh for session persistence.

## Phases

### Phase 1: Foundation — DriverChangeRequest Model
**Goal**: Create `DriverChangeRequestStatus` enum, `DriverChangeRequest` model with migration, factory, and scopes.
**Sub-tasks**: 1.1 Enum, 1.2 Model + Migration + Factory
**Depends on**: nothing
**File**: `profile-and-admin/phases/phase-1-foundation.md`

### Phase 2: Profile API Endpoints
**Goal**: Client profile update, phone change with OTP (both roles), driver change request submission, token refresh.
**Sub-tasks**: 2.1 Client Profile Update, 2.2 Phone Change with OTP, 2.3 Driver Profile Change Requests, 2.4 Token Refresh
**Depends on**: Phase 1
**File**: `profile-and-admin/phases/phase-2-profile-api.md`

### Phase 3: Admin Panel — Driver Tickets, Landing Page & Redirects
**Goal**: Admin driver ticket management (list/approve/reject), landing page on `/`, admin redirect logic.
**Sub-tasks**: 3.1 Controller & Routes, 3.2 Blade Views, 3.3 Landing Page, 3.4 Admin Redirect Logic
**Depends on**: Phase 1, Phase 2
**File**: `profile-and-admin/phases/phase-3-admin-panel.md`

## Execution Order

```
Phase 1 → Phase 2 → Phase 3
```

All phases are sequential — Phase 2 needs the model from Phase 1, Phase 3 needs the API from Phase 2.

## New API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/v1/client/profile` | client | Update client name |
| POST | `/v1/auth/change-phone/send-otp` | any | Send OTP to new phone |
| POST | `/v1/auth/change-phone/verify` | any | Verify OTP and update phone |
| POST | `/v1/driver/profile/request-changes` | driver | Submit change request |
| GET | `/v1/driver/profile/change-requests` | driver | List own change requests |
| POST | `/v1/auth/refresh-token` | any | Refresh Sanctum token |

## New Admin Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/tickets` | List driver change requests |
| GET | `/admin/tickets/{ticket}` | View single request |
| POST | `/admin/tickets/{ticket}/approve` | Approve request |
| POST | `/admin/tickets/{ticket}/reject` | Reject request |

## New Models

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| DriverChangeRequest | user_id, field, old_value, new_value, status, admin_comment, reviewed_at, reviewed_by | Track driver profile change requests |

## Key Design Decisions

- **Phone change**: OTP sent to NEW phone, old phone kept until verified. Race condition guard on verify.
- **Driver changes**: Each field change = separate DriverChangeRequest record. Cannot submit duplicate pending for same field.
- **Approval**: Admin approve updates actual User/DriverProfile field in a DB transaction. 409 on double-approve.
- **Token refresh**: Delete current token, create new 30-day token. Old token immediately invalidated.
- **Landing page**: Standalone Blade (not admin layout), minimal design, subtle admin link in footer.
- **Admin redirect**: Authenticated admin on `/` or `/admin/login` → `/admin/dashboard`. Non-admins see landing page.
