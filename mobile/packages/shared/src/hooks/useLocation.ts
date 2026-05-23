import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  heading: number | null;
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

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    latitude: 42.87,
    longitude: 74.59,
    heading: null,
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
            loading: false,
            error: null,
            hasRealFix: true,
          });
        }

        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const currentPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
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
            loading: false,
            error: null,
            hasRealFix: true,
          });
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }

        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 },
          (loc) => {
            setState({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
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
  }, []);

  return state;
}
