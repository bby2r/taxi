---
step: "3.3 + 3.4"
verdict: PASS
date: 2026-04-08
---
## Review Notes

### 3.3 Landing Page
- Standalone HTML layout with `@vite` directive -- no admin layout dependency.
- Proper structure: header (brand), hero section (heading + subtitle), footer.
- Admin link in footer is subtle: `text-xs text-gray-400` styling, blends with copyright text.
- Uses `route('admin.login')` for URL generation (named route, per conventions).
- Dynamic year via `{{ date('Y') }}`.

### 3.4 Admin Redirect
- Root route (`/`): checks `auth()->check()` and `role === UserRole::Admin` before redirecting to dashboard; all other users (guest, client, driver) see the landing view.
- `bootstrap/app.php`: `redirectUsersTo` correctly returns `admin.dashboard` for admin users and `home` for non-admin, handling the `guest` middleware redirect (e.g., authenticated admin hitting `/admin/login`).
- Middleware alias `role` registered for `EnsureUserRole`.

### Tests
- **LandingPageTest** (4 tests): guest loads page, hero heading present, admin link present, no admin layout leakage.
- **AdminRedirectTest** (6 tests): admin redirected from root, guest sees landing, driver sees landing, client sees landing, admin redirected from `/admin/login`, guest can access login.
- All 10 tests pass (16 assertions, 0.45s).

### Minor observations (non-blocking)
- The root route closure uses `auth()` facade directly rather than injecting `Request`. Acceptable for a simple closure route.
- No CSRF or rate-limit concerns on the landing page (read-only GET).
