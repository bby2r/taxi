# Custom notification sounds

Drop a short branded audio cue here as `order_arrived.wav` (PCM, ≤ 30 sec, ≤ 1 MB) to enable a custom sound for driver order offers. Without it, the system default plays.

## Activation steps

1. Place the file: `mobile/assets/sounds/order_arrived.wav`
2. Re-enable the `sounds` array in `mobile/app.json`:

   ```json
   ["expo-notifications", {
     "color": "#FBBF24",
     "sounds": ["./assets/sounds/order_arrived.wav"]
   }]
   ```

3. Switch the channel sound in `mobile/src/hooks/useNotifications.ts`:

   ```ts
   sound: 'order_arrived',  // was 'default'
   ```

4. Update the backend offer push to use the same file name (already configured: `app/Services/ExpoPushService.php::sendOfferToDriver` sends `sound: 'order_arrived'`).

5. Rebuild the APK (`eas build -p android --profile preview`). OTA update alone is **not** enough — sound files are bundled into the native binary.

## Format notes

- Android: `.wav` PCM 16-bit, 44.1 kHz, mono. AAC/MP3 also works on newer Android.
- iOS: should be `.caf` ideally, but `.wav` is accepted. Keep under 30 seconds.
- Channel sound on Android is **immutable** after first install — uninstall/reinstall the app (or clear app data) for a sound change to take effect on existing devices.
