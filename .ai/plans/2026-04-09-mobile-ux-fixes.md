---
title: "Mobile UX Fixes"
date: 2026-04-09
status: draft
tags: [mobile, ux, phone-input, login]
summary: "No-drivers message, driver login back link, phone input formatting with country code prefix"
phases: 1
reviewer: N/A (single lightweight phase)
---

# Mobile UX Fixes

## Overview

Five small UX improvements to the mobile app, all in one phase:
1. Show "Нет свободных водителей" when no drivers available (instead of generic "Заказ отменён")
2. Add "Я пассажир" back link on driver login screen
3. Auto-format phone numbers with spaces (555 123 456)
4. Add +996 country code prefix to driver login phone field
5. Make driver phone input match client style (prefix box + 9 digits)

Items 3-5 are combined into a single sub-task since they're the same change.

## Phase

### Phase 1: Mobile UX Fixes
**Goal**: Fix all 5 issues in one pass.
**Sub-tasks**: 1.1 No-drivers message, 1.2 Back link, 1.3 Phone input unification, 1.4 Other phone inputs check
**Depends on**: nothing
**File**: `mobile-ux-fixes/phases/phase-1-mobile-ux.md`

## Key Decisions

- **No backend changes** — `cancelled_by` already returned in OrderResource, phone formatting is client-side only
- **Shared utility** — `mobile/src/utils/phone.ts` for `formatPhoneDigits()` and `extractDigits()` used by both login screens
- **Raw digits in state** — phone state stores "555123456", display shows "555 123 456", sent as "+996555123456"
- **Cancelled reason** — `useOrder` hook fetches fresh order on cancel event to read `cancelled_by` field
