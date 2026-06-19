# Обоснования разрешений

## Google Play — обязательные для каждой Privacy-sensitive permission

В Play Console → **App content → Sensitive permissions and APIs** для каждого
разрешения нужно указать "Purpose" + опционально "Demo video URL".

### ACCESS_FINE_LOCATION (драйверское приложение)

**Purpose:**
```
This permission is used in the driver app to broadcast the driver's
current location to the dispatch server and to the client who ordered
the ride. The client sees the driver approaching on a real-time map.
Without this permission, ride dispatching is impossible.
```

### ACCESS_BACKGROUND_LOCATION (драйверское приложение)

**Purpose:**
```
The driver app uses background location only while the driver is in
the "online" state (a dedicated foreground service with a persistent
notification is shown). This allows the dispatcher to assign incoming
ride requests to the nearest available driver, even when the driver
has the app minimised while waiting for an offer.

When the driver toggles "Offline" or kills the app, all background
location tracking stops immediately.
```

**Demo video required**: да, Google Play 2023+ требует 30-сек видео
демонстрирующее точно как пользователь активирует/деактивирует
background location.

Содержание видео:
1. Driver открывает app, видит главный экран с переключателем "Выйти на линию"
2. Тапает переключатель → запрашивается background location permission
3. Driver в Settings/Permissions выбирает "Allow all the time"
4. Возвращается в app, переключатель в положении "Online"
5. Driver сворачивает app (Home button)
6. Показывает шторку уведомлений — постоянное notification «Alif Taxi водитель на линии»
7. Driver возвращается, тапает "Завершить смену" → notification исчезает

Записывай 30 сек, MP4, 720p, без звука или с минимальным.

### FOREGROUND_SERVICE_LOCATION (Android 14+)

**Purpose:**
```
Used together with ACCESS_BACKGROUND_LOCATION. While the driver is
online, a foreground service runs to keep the GPS pings active for
ride dispatching. The service shows a persistent notification.
```

### SYSTEM_ALERT_WINDOW (драйверское приложение)

**Purpose:**
```
Used to display a small floating card with the current order details
(client name, ETA, address) on top of external navigation apps like
Yandex Navigator, 2GIS, or Google Maps while the driver is en route.
The overlay is read-only (no taps pass through except inside the
card), respects system padding, and is only shown when there is an
active order. It disappears automatically when the order ends.

This is a common pattern for ride-hailing driver apps (Yandex Pro,
Bolt Driver, InDrive Driver use similar overlays).
```

### USE_FULL_SCREEN_INTENT (драйверское приложение, Android 14+)

**Purpose:**
```
Used to show incoming-ride offers as a lock-screen alert (similar to
an incoming call). The driver has a 30-second window to accept or
decline. Without full-screen intents, offers shown only as banners
get missed when the phone is in a pocket.
```

### POST_NOTIFICATIONS

**Purpose:**
```
Driver app: incoming ride offers, dispatcher messages.
Client app: ride status updates ("Driver arrived", "Trip completed").
```

---

## Apple App Store — Privacy Manifest

В Xcode Info.plist (или `app.json → ios.infoPlist`) — у нас уже стоит:

```json
"NSLocationWhenInUseUsageDescription": "Нужен доступ к геолокации для определения точки подачи такси",
"NSLocationAlwaysAndWhenInUseUsageDescription": "Нужен доступ к геолокации в фоне для отправки координат пассажирам и диспетчеру",
"NSLocationAlwaysUsageDescription": "..."
```

Эти строки **показываются пользователю** при первом запросе, поэтому
они должны быть user-friendly. Что у нас есть — норм.

## Apple Privacy Nutrition Label (App Store Connect → App Privacy)

Что отметить в форме:

### Data Used to Track You
**Нет** — мы не используем cross-app tracking.

### Data Linked to You
- **Contact Info → Phone Number** (для аутентификации)
- **Contact Info → Name** (для отображения водителю)
- **Location → Precise Location** (для подачи такси и подбора водителя)
- **User Content → Photos** (только driver-фото профиля, не клиентские)
- **Identifiers → User ID** (внутренний user_id)
- **Usage Data → Product Interaction** (история заказов)

### Data Not Linked to You
- **Diagnostics → Crash Data** (если используется expo-updates / Sentry — у нас нет)
- **Diagnostics → Performance Data** (опционально, если включишь)

### Reasons (для каждого типа данных):
- Phone number: **App Functionality** (для входа)
- Name: **App Functionality** (для водителя)
- Location: **App Functionality** (для подачи такси)
- Photos: **App Functionality** (фото водителя для пассажира)

### Data Sharing
Никаких third-party data sharing у нас нет. Pusher (real-time events)
и FCM (push notifications) — это infrastructure provider, не data
broker. Можно не указывать их как sharing, но если консервативно —
указать как "Service Provider" (не product analytics).
