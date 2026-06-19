# Demo Account для ревьюеров

Передаётся в форму **App Store Connect → App Information → Sign-In Information**
и **Google Play Console → App content → App access → Demo credentials**.

## Что вписать

**Username (или Phone)**:
```
+996 999 99 99 99
```

**Password (или OTP code)**:
```
0000
```

## Инструкции для ревьюера (App Review notes)

Скопируй этот текст в поле "Notes" в App Store Connect и
"Instructions" в Google Play Console:

```
Alif Taxi is a regional taxi-hailing app for the Talas Region of
Kyrgyzstan (villages of Talas, Kirovka, Pokrovka).

To test the full order flow without a real driver in the area:

1. Open the app, you'll see the phone-login screen.
2. Enter +996 999 99 99 99 (this is a reserved demo number — no
   SMS is sent, but the OTP screen will accept the fixed code).
3. On the OTP screen, enter the code: 0000
4. On the home screen, tap "Заказать такси" (Order Taxi).
5. A bot-driver "Демо Водитель" (Toyota Camry, 01 KG 777 AAA) will
   automatically accept your order in ~5 seconds and progress through
   all phases:
   - "Водитель в пути" (driver en route) — 10s
   - "Водитель прибыл" (driver arrived) — 10s
   - "В пути" (in progress) — 10s
   - "Поездка завершена" (completed) — 5-star rating screen appears
6. Submit a rating and tap "Готово" (Done).

The demo flow ignores GPS zone validation, so it works from any
location worldwide. Total cycle time: ~35 seconds.

Background location permission is requested only for DRIVER role
(separate app). The CLIENT app uses location only while the user
is selecting a pickup point.
```

## Альтернативный текст (если в форме мало места)

```
Demo: phone +996 999 99 99 99, OTP code 0000.
Bot-driver auto-accepts and completes a full ride in ~35 seconds.
Works from any location worldwide.
```
