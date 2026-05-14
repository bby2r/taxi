# UI Decisions

## Platform Overview
Three distinct UIs: web admin (English), mobile client (Russian, light theme), mobile driver (Russian, dark theme). Single mobile app binary — navigation splits by user role.

## Admin Panel (Blade + TailwindCSS)
- **Login:** Phone + password. Brand: "AIYL Taxi Admin", amber accent.
- **Layout:** Fixed sidebar (Dashboard, Drivers, Orders) + header with user name + logout.
- **Dashboard:** 4 KPI cards (Active Orders, Online Drivers, Today Revenue KGS, Total Rides) + Recent Orders table.
- **Drivers:** Paginated table (name, phone, car, plate, joined). Full CRUD. Delete blocked if active orders.
- **Orders:** Paginated table with status filter. Detail view with client/driver cards, addresses, full timeline.
- **Status badges:** Color-coded pills (Searching=yellow, Accepted=blue, Arrived=indigo, InProgress=purple, Completed=emerald, Cancelled=red).

**Why admin creates drivers:** Village context — admin knows all drivers personally. No self-registration.

## Mobile Client Flow
- **Auth:** Phone input with hardcoded +996 prefix -> 4-digit OTP with 60s resend timer. "I'm a driver" link to driver login.
- **Home:** Full-screen map + bottom card. Shows fixed price (80 som) + "Call taxi" button. No destination input — pickup-only model.
- **Active order states:** Searching (pulsing animation + cancel), Accepted/Arrived (DriverCard with call button), Completed (modal with price), Cancelled (red toast).
- **Post-ride feedback:** Two buttons: 👍 "All good" / 👎 "There's a problem". If 👎 → text field "Describe what happened". No star ratings — binary feedback only.
- **History:** Paginated trip list with status, address, price.

**Why no destination:** Village — all destinations are similar distance. Discussed verbally with driver.
**Why fixed price shown:** No variability — price is always 80 som (day) or 120 (night).

## Mobile Driver Flow
- **Login:** Phone + password on dark background.
- **Home:** Large ON/OFF toggle (120px circle). When online + idle: "Waiting for order..."
- **Order offer:** Slides up with 10-second countdown circle.
  - Badge shows order type: "В селе" (amber) or "Межрайон · {region}" (green)
  - Pickup address always shown; for inter-district orders a second "Куда" block shows dropoff_address or region name
  - Price, then Accept (green, 2x width) + "Отказаться" (outline)
  - Tapping "Отказаться" opens a bottom sheet with four reasons (Слишком далеко / Не мой район / Клиент не отвечает / Личная причина). A reason is required — no raw skip.
- **Active order:** Map (60%) + card (40%). Card phases follow server status 1:1:
  - `active` (Accepted): ETA + pickup address + client name/phone (tap to call) + "Открыть в Картах" + "Я на месте" button.
  - `arrived` (Arrived): "Вы на месте" confirmation + client contact + "Начать поездку" primary + "Клиент не пришёл — отменить" link (opens reason sheet: client_no_show / client_no_answer / long_wait).
  - `in_progress` (InProgress): ETA to dropoff + "Куда" address (inter-district) + "Завершить поездку" button.
  - `completed`: earnings + "Готово".
  - Inter-district orders show a second green "пункт Б" marker; the built-in route auto-switches from driver->pickup to driver->dropoff once the ride starts. Driver dot is rendered in `active` and `in_progress` phases.
- **Stats:** 2x2 grid — Today/Week/Month/Total earnings and order counts.

**Why dark theme for drivers:** Reduces eye strain at night; visual distinction from client experience.
**Why accept button 2x wider:** Encourages acceptance.
**Why 10-second timer:** Creates urgency, prevents orders sitting with unresponsive drivers.
**Why mandatory decline reason:** 5 non-timeout declines per shift triggers a 2-hour block, so the reason is both accountability and analytics input. Timeouts don't count — the driver may have simply missed the alert.
**Why inter-district shows the destination up front:** Drivers need to know if the trip crosses into another district before accepting, because time commitment and vehicle readiness differ from a village-internal run.
**Why a separate "Начать поездку" step:** The server already had Arrived → InProgress as distinct states, but mobile collapsed them. Splitting them lets the driver mark the actual ride start (so dropoff routing kicks in) and exposes a cancel option only while the client is still expected to show up — once `in_progress`, the cancel link disappears because the ride is happening.

## Design System
- Client: light (#F9FAFB), amber primary (#FBBF24)
- Driver: dark (#1F2937), amber primary, white text
- Russian locale for dates (dayjs 'ru')
- Shared Typography system (h1-h3, body, caption, button)
