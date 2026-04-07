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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState((prev) => ({ ...prev, loading: false, error: 'Нет доступа к геолокации' }));
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setState({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        heading: current.coords.heading,
        loading: false,
        error: null,
      });

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
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  return state;
}
