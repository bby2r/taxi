---
title: "Mobile Profile Tab"
date: 2026-04-09
status: in-progress
tags: [mobile, react-native, profile, navigation]
summary: "Add Profile tab to both client and driver mobile navigation with profile editing and logout"
phases: 1
---

# Mobile Profile Tab

## Overview

Add a "Профиль" tab to both client and driver mobile navigation. Backend API endpoints already exist — this is purely mobile screen + navigation work.

## Phase 1: Profile Tab
**Goal**: API layer, client profile screen, driver profile screen, navigation updates
**Sub-tasks**: 1.1 API + Types, 1.2 Client Profile + Tab, 1.3 Driver Profile + Tabs
**File**: `mobile-profile-tab/phases/phase-1-profile-tab.md`

## Key Decisions

- Client: add 3rd tab to existing ClientTabs
- Driver: convert to DriverTabs (Home + Profile) wrapped in stack for OrderActive/Stats overlays
- Client name is instantly editable; driver fields require admin approval via change requests
- No phone change for drivers — they use change request flow
- No PHPUnit tests needed — this is mobile-only with no backend changes
