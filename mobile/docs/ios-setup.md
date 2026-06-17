# iOS Setup

Конфиги iOS заложены в `app.json` обоих приложений, но фактическая
сборка требует **Mac + Apple Developer account** или EAS Cloud Build.

## Что уже сделано в репозитории

### app.json (client + driver)

- `ios.bundleIdentifier` — `kg.aliftaxi.client` / `kg.aliftaxi.app`
- `ios.buildNumber: "1"` — стартовое значение, EAS production-профайл его авто-инкрементит
- `ios.config.usesNonExemptEncryption: false` — отключает диалог про экспорт криптографии при каждом TestFlight upload (приложение использует только HTTPS, не подпадает под ITAR)
- `infoPlist.ITSAppUsesNonExemptEncryption: false` — дубль для App Store Connect
- `infoPlist.CFBundleAllowMixedLocalizations: true` — русский UI на устройстве с английской системой
- `infoPlist.LSApplicationQueriesSchemes: ["tel", "whatsapp"]` — без него `Linking.openURL('tel:...')` возвращает false на iOS

### Клиент

- `NSLocationWhenInUseUsageDescription` — request при первом заказе
- `UIBackgroundModes: ["remote-notification"]` — приём silent push для обновления статуса заказа

### Водитель

- Три location-permissions (When-In-Use, Always, legacy Always) — iOS 14+ требует все три текста, иначе крашится при request
- `UIBackgroundModes: ["location", "audio", "remote-notification", "fetch"]` — фоновая геолокация когда «на линии», audio для loop-уведомления нового заказа, remote-notification для push, fetch для периодического обновления

### expo-build-properties

- `ios.useFrameworks: "static"` — обязательно для `@notifee/react-native` и Firebase
- `ios.deploymentTarget: "15.1"` — нижняя планка iOS

### Scripts (package.json)

- `npm run prebuild:ios` — генерирует `ios/` папку из app.json
- `npm run build:ios` — full release Xcode build (нужен Mac)

### GitHub Actions

`.github/workflows/mobile-ios-eas.yml` — ручной trigger через workflow_dispatch
(EAS Cloud Build, не GitHub macos-runner).

---

## Что нужно сделать перед первым iOS билдом

### 1. Apple Developer Program

- Купить аккаунт ($99/год) — https://developer.apple.com/programs/
- Получить **Team ID** (Membership → Account)

### 2. Expo / EAS project

```bash
cd mobile/apps/client
npx eas init   # создаст extra.eas.projectId и закоммитит в app.json
cd ../driver
npx eas init
```

Заменить `YOUR_CLIENT_EAS_PROJECT_ID` в `mobile/apps/client/app.json` на
реальный UUID, который вернёт `eas init`. У driver уже есть
(`6a367005-44a7-40d0-a95a-ec0d133c661c`).

### 3. iOS credentials (один раз, локально)

```bash
cd mobile/apps/client
npx eas credentials
# выбрать iOS → production → Set up a new Distribution Certificate
# выбрать Generate a new Distribution Certificate (EAS делает всё сам)
# то же самое для Provisioning Profile
```

После этого EAS хранит cert + profile у себя; локально ничего не остаётся.
Повторить для `mobile/apps/driver`.

### 4. APNs (Push notifications на iOS)

Apple Push Notification service ключ создаётся в App Store Connect:

- Users and Access → Keys → APNs Authentication Key → Generate
- Скачать `.p8` ключ (одноразово)
- Загрузить в Firebase Console → Project Settings → Cloud Messaging → APNs
- Альтернатива: `npx eas credentials` → iOS → Push Notifications →
  Set up a Push Key (EAS добавит ключ в Apple + Firebase автоматически)

### 5. GitHub secrets

Добавить в Settings → Secrets and variables → Actions:

- `EXPO_TOKEN` — из Expo Dashboard → Account Settings → Access Tokens
- (остальные `EXPO_PUBLIC_*` уже есть из Android workflow)

---

## Запуск iOS сборки

### Через GitHub Actions (рекомендуется)

Actions → Build Mobile iOS (EAS) → Run workflow → выбрать app + profile.
~20-40 мин на сборку, ссылка на `.ipa` в логах последнего шага.

### Локально на Mac

```bash
cd mobile/apps/client
npm run prebuild:ios
cd ios && pod install
open AlifTaxi.xcworkspace   # подключить iPhone, нажать Run
```

### Локальный EAS build

```bash
cd mobile/apps/client
npx eas build --platform ios --profile preview
```

---

## Распространение

- **TestFlight** (внутренние тестеры) — `preview` или `production` профайл,
  затем `npx eas submit --platform ios --latest`
- **App Store** — `production` профайл, `eas submit`, далее ручной review
  через App Store Connect (~24-48 ч)
- **Internal distribution** (без App Store, до 100 устройств) —
  зарегистрировать UDID через `npx eas device:create`, использовать
  `preview` профайл с `internalDistribution`

---

## Известные iOS-специфичные edge cases

1. **MapLibre через WebView** — работает на iOS, но `Background Modes`
   не разрешают WebView обновляться когда приложение свернуто. Для
   водителя это OK (геолокация продолжает посылать координаты на сервер),
   для клиента — карта замораживается, но Pusher-события (включая
   «Водитель прибыл») приходят благодаря `remote-notification`.

2. **TTS** — `expo-speech` использует AVSpeechSynthesizer. Русский
   голос предустановлен на iOS 13+. Работает на silent-режиме только
   если предварительно вызвать `setAudioModeAsync({playsInSilentMode: true})`
   — уже сделано в `useOrder.ts`.

3. **Haptics через Vibration** — на iOS короткие импульсы 35-70ms
   игнорируются, срабатывает дефолтная alert-вибрация. Если нужны
   разные паттерны (success vs error feedback), переключиться на
   `expo-haptics.notificationAsync(NotificationFeedbackType.Success)` —
   добавить deps + ветку iOS в `packages/shared/src/utils/haptics.ts`.

4. **Notifee LED + bypassDnd** — игнорируются iOS, используются только
   на Android. iOS показывает heads-up по системному правилу (важность
   назначается через `interruptionLevel: 'timeSensitive'`, если нужно).
