import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  heading: number | null;
  loading: boolean;
  error: string | null;
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    latitude: 42.87,
    longitude: 74.59,
    heading: null,
    loading: true,
    error: null,
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
