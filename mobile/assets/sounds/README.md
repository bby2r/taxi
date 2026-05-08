# Custom notification sound for new orders

Right now the app uses Android's default notification sound on the
`driver_offers` channel. To swap in a branded melody:

## 1. Get a sound file

You need a short `.wav` (or `.mp3` for newer Android). Sources:

- **Record on your phone** — open voice recorder, say "Новый заказ" or play a melody, save as `.wav`. Easiest path
- **Free libraries** — https://freesound.org / https://pixabay.com/sound-effects (filter Creative Commons / royalty-free)
- **Generate online** — https://onlinesequencer.net or any DAW

Constraints:
- Length: **≤ 30 seconds** (longer files won't play correctly)
- Format: **`.wav` PCM 16-bit, 44.1 kHz, mono** is the safest cross-platform choice
- Size: **≤ 1 MB** (it ships in the APK)
- Volume: keep it punchy — Android lowers volume of notification sounds on some devices

## 2. Drop the file

Save it as exactly:

```
mobile/assets/sounds/order_arrived.wav
```

Filename matters — backend already sends `sound: 'order_arrived'` in the offer push payload (see `app/Services/ExpoPushService.php::sendOfferToDriver`).

## 3. Tell the build to bundle it

Edit `mobile/app.json`, find the `expo-notifications` plugin block, and add the `sounds` array:

```json
[
  "expo-notifications",
  {
    "color": "#FBBF24",
    "sounds": ["./assets/sounds/order_arrived.wav"]
  }
],
```

## 4. Tell the channel to use it

Edit `mobile/src/hooks/useNotifications.ts` — find the line:

```ts
sound: 'default',
```

Replace with the file name (without extension):

```ts
sound: 'order_arrived',
```

## 5. Rebuild the APK

OTA is **not enough** for sound files — they live in the native bundle.

```sh
cd mobile && eas build -p android --profile preview
```

Install the new APK on each driver's phone. **Important:** Android caches notification channels permanently after the first registration. To pick up the new sound on devices that already had the old channel:

1. Settings → Apps → Village Taxi → Notifications → "Новые заказы" channel → delete OR
2. Uninstall and reinstall the app

Newly installed devices will get the new sound right away.

## iOS notes

- iOS prefers `.caf`. Plain `.wav` works but may not play correctly on every iOS version.
- Apple caps notification sounds at 30 seconds and 1 MB regardless.
- iOS doesn't have channels — the `sound` value in the push payload is matched directly to a file in the app bundle.

## What if you want different sounds per event type?

Same pattern — register a second channel (e.g. `client_arrived`) in `useNotifications.ts`, drop a second `.wav`, update the backend method that sends that push to set `channelId: 'client_arrived'`. The plugin's `sounds` array can hold many entries.
