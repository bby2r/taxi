# UI Decisions

## Platform Overview
Three distinct UIs: web admin (English), mobile client (Russian, light theme), mobile driver (Russian, dark theme). Single mobile app binary — navigation splits by user role.

## Admin Panel (Blade + TailwindCSS)
- **Login:** Phone + password. Brand: "Village Taxi Admin", amber accent.
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
- **Order offer:** Slides up with 10-second countdown circle, pickup address, price. Accept (green, 2x width) + Skip (outline).
- **Active order:** Map (60%) + card (40%). States: en route (navigation link + "I'm here"), arrived (green checkmark + "Complete trip"), completed (earnings display).
- **Stats:** 2x2 grid — Today/Week/Month/Total earnings and order counts.

**Why dark theme for drivers:** Reduces eye strain at night; visual distinction from client experience.
**Why accept button 2x wider:** Encourages acceptance.
**Why 10-second timer:** Creates urgency, prevents orders sitting with unresponsive drivers.

## Design System
- Client: light (#F9FAFB), amber primary (#FBBF24)
- Driver: dark (#1F2937), amber primary, white text
- Russian locale for dates (dayjs 'ru')
- Shared Typography system (h1-h3, body, caption, button)
