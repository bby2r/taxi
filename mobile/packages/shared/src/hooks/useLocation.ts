import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  heading: number | null;
  // Epoch ms + horizontal accuracy (m) of the latest fix. Feed both to the
  // navigation Kalman filter so it weights fixes by real timing/quality
  // instead of guessing dt from render cadence.
  timestamp: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  // True once we've seen a real GPS/Wi-Fi fix from the device. Callers
  // that POST orders / locations to the server MUST gate on this — the
  // initial (42.87, 74.59) coordinates are a Bishkek-center fallback
  // only meant to keep the map from blank-screening before the first
  // fix lands. Without this guard, denying location permission still
  // flipped loading=false → "Order taxi" button enabled → ghost orders
  // 30+ km from the village were getting created.
  hasRealFix: boolean;
}

interface UseLocationOptions {
  // navigation: true — переключает GPS в BestForNavigation +
  // distanceInterval=2м + timeInterval=1с. Heading получается надёжно
  // только в этом режиме (Balanced/network-locations heading не отдают
  // вообще), и обновления приходят ~1Hz для плавной follow-камеры.
  // Цена: батарея ест ~3-4% в час против ~1% у Balanced. Включать
  // только когда водитель реально едет по маршруту (OrderActiveScreen
  // с навигацией) — не на всём приложении.
  navigation?: boolean;
}

export function useLocation(options?: UseLocationOptions): LocationState {
  const navigation = options?.navigation === true;
  const [state, setState] = useState<LocationState>({
    latitude: 42.87,
    longitude: 74.59,
    heading: null,
    timestamp: null,
    accuracy: null,
    loading: true,
    error: null,
    hasRealFix: false,
  });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setState((prev) => ({ ...prev, loading: false, error: 'Нет доступа к геолокации' }));
          return;
        }

        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setState({
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            heading: last.coords.heading,
            timestamp: last.timestamp,
            accuracy: last.coords.accuracy,
            loading: false,
            error: null,
            hasRealFix: true,
          });
        }

        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const currentPromise = Location.getCurrentPositionAsync({
          accuracy: navigation
            ? Location.Accuracy.BestForNavigation
            : Location.Accuracy.Balanced,
        });
        const timeoutPromise = new Promise<null>((resolve) => {
          timeoutHandle = setTimeout(() => resolve(null), 10000);
        });
        const current = await Promise.race([currentPromise, timeoutPromise]);
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (current) {
          setState({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
            heading: current.coords.heading,
            timestamp: current.timestamp,
            accuracy: current.coords.accuracy,
            loading: false,
            error: null,
            hasRealFix: true,
          });
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }

        subscription = await Location.watchPositionAsync(
          navigation
            ? {
                accuracy: Location.Accuracy.BestForNavigation,
                // distanceInterval намеренно НЕ задаём (default 0). На Android
                // LocationManager требует одновременно timeInterval И
                // distanceInterval — fix'ы переставали приходить на светофоре /
                // в пробке (< 2 м смещения за секунду), а потом разом догоняли
                // одним «прыжком». Чистые 1Hz time-based апдейты + Kalman сам
                // схлопывает velocity к 0 при остановке — карта не дрожит, но и
                // не «отстаёт» при возобновлении движения.
                timeInterval: 1000,
              }
            : { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 },
          (loc) => {
            setState({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
              timestamp: loc.timestamp,
              accuracy: loc.coords.accuracy,
              loading: false,
              error: null,
              hasRealFix: true,
            });
          },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Ошибка геолокации';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    })();

    return () => {
      subscription?.remove();
    };
  }, [navigation]);

  return state;
}
