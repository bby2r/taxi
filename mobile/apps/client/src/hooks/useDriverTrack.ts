import { useEffect, useRef, useState } from 'react';
import { GeoKalmanFilter } from '@taxi/shared';

export interface RawDriverFix {
  latitude: number;
  longitude: number;
  heading?: number | null;
}

export interface SmoothedDriverTrack {
  latitude: number;
  longitude: number;
  /** Heading в градусах [0, 360). Берём из GPS (приоритет) или из Kalman-velocity. */
  heading: number | null;
  /** Сглаженная Kalman-скорость в долготных градусах/мс. */
  velLngPerMs: number;
  /** Сглаженная Kalman-скорость в широтных градусах/мс. */
  velLatPerMs: number;
}

/**
 * Прогоняет «прыгающие» координаты водителя из Pusher-broadcast'а через
 * constant-velocity Kalman filter и возвращает сглаженное положение +
 * Kalman-velocity. WebView-карта использует velocity для dead-reckoning
 * между фиксами: маркер плавно ползёт по предполагаемому курсу, пока
 * новый GPS-фикс ещё не дошёл, — как в Yandex / 2GIS.
 *
 * Filter — singleton на жизнь хука. Если фиксы перестают приходить >5с
 * (resetGapMs внутри Kalman'а), он сам seed'нет с новой точки и
 * стартанёт заново — это покрывает случаи длинной задержки или
 * пересоздания заказа.
 *
 * Heading: GPS-heading с устройства водителя точнее Kalman-velocity,
 * поэтому если он пришёл — отдаём его; иначе берём bearing из Kalman
 * (он null когда машина почти стоит, и мы возвращаем previous heading,
 * чтобы стрелка не крутилась на красном свете).
 */
export function useDriverTrack(raw: RawDriverFix | null): SmoothedDriverTrack | null {
  const kfRef = useRef<GeoKalmanFilter | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const [track, setTrack] = useState<SmoothedDriverTrack | null>(null);

  useEffect(() => {
    if (!raw) {
      kfRef.current = null;
      lastHeadingRef.current = null;
      setTrack(null);
      return;
    }

    if (!kfRef.current) {
      // minBearingSpeed=1.5 — машина считается «движущейся» уже на ~5 км/ч,
      // ниже — bearing из Kalman'а null и используем GPS / последний known.
      kfRef.current = new GeoKalmanFilter({ minBearingSpeed: 1.5 });
    }

    const filtered = kfRef.current.update({
      latitude: raw.latitude,
      longitude: raw.longitude,
      timestamp: Date.now(),
    });

    let heading: number | null;
    if (typeof raw.heading === 'number' && raw.heading >= 0) {
      heading = raw.heading;
    } else if (filtered.bearing !== null) {
      heading = filtered.bearing;
    } else {
      heading = lastHeadingRef.current;
    }
    if (heading !== null) {
      lastHeadingRef.current = heading;
    }

    setTrack({
      latitude: filtered.latitude,
      longitude: filtered.longitude,
      heading,
      velLngPerMs: filtered.velLngPerMs,
      velLatPerMs: filtered.velLatPerMs,
    });
  }, [raw?.latitude, raw?.longitude, raw?.heading]); // eslint-disable-line react-hooks/exhaustive-deps

  return track;
}
