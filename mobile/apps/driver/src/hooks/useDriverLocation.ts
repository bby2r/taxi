import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { updateLocation } from '../api/driver';

interface UseDriverLocationOptions {
  enabled: boolean;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  heading: number | null;
}

export function useDriverLocation({ enabled }: UseDriverLocationOptions): LocationCoords | null {
  const coordsRef = useRef<LocationCoords | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Also request background
      await Location.requestBackgroundPermissionsAsync();

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (loc) => {
          coordsRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
          };
        }
      );

      // Send to server every 10s
      intervalRef.current = setInterval(async () => {
        if (coordsRef.current) {
          try {
            await updateLocation(
              coordsRef.current.latitude,
              coordsRef.current.longitude,
              coordsRef.current.heading
            );
          } catch {
            // Silent — next interval retries
          }
        }
      }, 10000);
    })();

    return () => {
      subscription?.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return coordsRef.current;
}
