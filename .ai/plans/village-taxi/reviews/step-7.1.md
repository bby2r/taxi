# Step 7.1 Review: Admin Auth & Layout

## Verdict: PASS

## Checklist

| # | Check | Result |
|---|-------|--------|
| 1 | AuthController: showLogin returns login view | PASS |
| 2 | AuthController: login validates phone+password, Auth::attempt, admin-only with "Access denied." | PASS |
| 3 | AuthController: login calls session()->regenerate() after successful auth | PASS |
| 4 | AuthController: logout invalidates session + regenerates CSRF token | PASS |
| 5 | Login view: centered card, phone/password fields, amber-400 button, @csrf, error display | PASS |
| 6 | Admin layout: gray-800 sidebar with Heroicons, active state via routeIs(), top bar with heading/user/logout | PASS |
| 7 | Routes: GET/POST /admin/login (guest middleware), POST /admin/logout, GET /admin/ redirect to dashboard | PASS |
| 8 | EnsureUserRole middleware: web redirect for non-JSON, 403 JSON response | PASS |
| 9 | Middleware registered as 'role' alias in bootstrap/app.php | PASS |
| 10 | Admin tests pass (10/10, 31 assertions) | PASS |
| 11 | Middleware tests pass (6/6) with JSON 403 coverage | PASS |
| 12 | Full test suite passes (202/202, 493 assertions) | PASS |
| 13 | Pint formatting clean | PASS |

## Notes

- Non-admin login correctly calls `Auth::logout()` before returning the "Access denied." error, preventing session fixation.
- Session regeneration happens after admin role check, which is the correct order.
- The `EnsureUserRole` middleware supports variadic roles (`string ...$roles`) for flexibility.
- Stub routes registered in test setUp() for `admin.dashboard` and `login` since those are defined in later steps -- good practice.
- Layout references `admin.drivers.index` and `admin.orders.index` routes that will be added in later steps.
