import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

// Magnetometer на Android тикает 15-50 Hz. Без порога каждый reading
// триггерит ререндер + setCenter в WebView (~40 bridge-crossings/сек),
// а пользователь не видит разницу 0.3°. 3° = ниже порога восприятия
// поворота карты на телефоне, но выше типичного сенсорного шума.
const MIN_DELTA_DEGREES = 3;

function shortestAngleDelta(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Подписка на магнитометр телефона. Возвращает текущий compass
 * heading (0-360°, true-north если доступен, иначе magnetic).
 * `null` пока не пришёл первый reading или устройство без сенсора.
 *
 * Подписка живёт только пока экран в фокусе (useFocusEffect) —
 * иначе HomeScreen за стеком OrderActiveScreen всё равно тратил бы
 * батарею на sensor reads. Cleanup на blur, recreate на focus.
 */
export function useCompassBearing(): number | null {
  const [bearing, setBearing] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let sub: { remove: () => void } | null = null;
      (async () => {
        try {
          sub = await Location.watchHeadingAsync((h) => {
            const raw =
              h?.trueHeading != null && h.trueHeading >= 0
                ? h.trueHeading
                : h?.magHeading != null && h.magHeading >= 0
                  ? h.magHeading
                  : null;
            if (raw === null) return;
            setBearing((prev) =>
              prev === null || shortestAngleDelta(raw, prev) >= MIN_DELTA_DEGREES
                ? raw
                : prev,
            );
          });
        } catch {
          // device без магнитометра / отказ permission — null остаётся.
        }
      })();
      return () => {
        sub?.remove();
      };
    }, []),
  );

  return bearing;
}
