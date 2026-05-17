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
          // Tightened from 5/5000ms — at city speed (~50 km/h ≈ 14 m/s)
          // the old setting only updated every ~70 m, which made the
          // client's animated marker visibly skip. 3 m / 2 s keeps the
          // tween smooth without hammering GPS.
          distanceInterval: 3,
          timeInterval: 2000,
        },
        (loc) => {
          coordsRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
          };
        }
      );

      // Upload every 3 s. Old value was 10 s; with the client side now
      // tweening between fixes over 1.2 s, the marker would freeze for
      // ~8 s out of every 10. 3 s leaves enough headroom for the tween
      // animation to finish before the next position lands.
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
      }, 3000);
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
