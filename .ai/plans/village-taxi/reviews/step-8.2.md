---
step: "8.2"
verdict: PASS
date: 2026-04-07
---

## Checklist
- [x] eas.json created with development, preview, production profiles
- [x] Development: APK + simulator, internal distribution
- [x] Preview: APK + ad-hoc, internal distribution with channel
- [x] Production: AAB + store, auto-increment iOS, channel set
- [x] Submit config for Android (service account) and iOS (Apple ID)
- [x] EXPO_PUBLIC_ prefix on all env vars for client-side access
- [x] Pusher cluster set to ap1 (matching existing project config)
- [x] app.json updated: updates URL, runtimeVersion policy, EAS projectId
- [x] Bundle identifiers updated to kg.villagetaxi.app (both platforms)
- [x] Existing plugins and permissions preserved

## Notes
- Config-only step, no PHPUnit tests required per spec
- Placeholder values (YOUR_EAS_PROJECT_ID, etc.) need to be replaced before first build
- Bundle identifiers changed from com.villagetaxi.app to kg.villagetaxi.app per plan spec
