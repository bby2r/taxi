import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { angularGapDeg, smoothBearing } from '../utils/geo';

// Magnetometer на Android тикает 15-50 Hz и заметно шумит. Раньше hook
// отсекал изменения < 8° и отдавал СЫРОЕ значение — стрелка прыгала рывками
// по 8°. Теперь каждое чтение low-pass-сглаживаем (SMOOTHING_ALPHA), а наружу
// отдаём новый курс только когда сглаженное значение реально уехало на
// >= MIN_EMIT_DEGREES. Это убирает дрожь стрелки и держит число ререндеров
// (а значит bridge-переходов в WebView) низким — на месте эмитов почти нет,
// в повороте идёт плавная лесенка мелких шагов.
const SMOOTHING_ALPHA = 0.15;
const MIN_EMIT_DEGREES = 3;

/**
 * Подписка на магнитометр телефона. Возвращает СГЛАЖЕННЫЙ compass heading
 * (0-360°, true-north если доступен, иначе magnetic). `null` пока не пришёл
 * первый reading или устройство без сенсора.
 *
 * Используется только для поворота иконки-стрелки водителя («куда смотрит
 * телефон») — камеру карты компас НЕ вращает (карта идёт course-up по GPS),
 * иначе поворот телефона в руке разворачивал всю карту.
 *
 * Подписка живёт только пока экран в фокусе (useFocusEffect) — иначе
 * HomeScreen за стеком OrderActiveScreen всё равно тратил бы батарею на
 * sensor reads. Cleanup на blur, recreate на focus.
 */
export function useCompassBearing(): number | null {
  const [bearing, setBearing] = useState<number | null>(null);
  // Сглаженный курс живёт в ref'е, чтобы переживать re-subscribe на focus
  // без сброса к сырому первому чтению.
  const smoothedRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      // `active` закрывает гонку между async watchHeadingAsync и
      // useFocusEffect cleanup — без неё подписка утекала бы при
      // быстрой смене focus → blur → focus.
      let active = true;
      let sub: { remove: () => void } | null = null;
      (async () => {
        try {
          const created = await Location.watchHeadingAsync((h) => {
            if (!active) return;
            const raw =
              h?.trueHeading != null && h.trueHeading >= 0
                ? h.trueHeading
                : h?.magHeading != null && h.magHeading >= 0
                  ? h.magHeading
                  : null;
            if (raw === null) return;
            const next =
              smoothedRef.current === null
                ? raw
                : smoothBearing(smoothedRef.current, raw, SMOOTHING_ALPHA);
            smoothedRef.current = next;
            setBearing((prev) =>
              prev === null || angularGapDeg(next, prev) >= MIN_EMIT_DEGREES
                ? next
                : prev,
            );
          });
          if (!active) {
            created.remove();
            return;
          }
          sub = created;
        } catch {
          // device без магнитометра / отказ permission — null остаётся.
        }
      })();
      return () => {
        active = false;
        sub?.remove();
      };
    }, []),
  );

  return bearing;
}
