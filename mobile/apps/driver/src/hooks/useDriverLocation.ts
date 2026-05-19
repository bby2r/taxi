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

      // Seed coordsRef immediately with a Balanced-accuracy fix (cell +
      // wifi + GPS, comes back in 1-2 s even indoors). watchPositionAsync
      // below uses High accuracy which can take 10-30 s for a first fix
      // on cold GPS — without this seed the 3-second upload interval
      // skipped every tick (the `if (coordsRef.current)` guard), and the
      // driver became Stale on the admin dashboard within 30 s of going
      // online despite the app working correctly.
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coordsRef.current = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
          heading: initial.coords.heading,
        };
        // First push happens immediately so the driver never sits with a
        // stale location_updated_at waiting for the 3-second interval.
        try {
          await updateLocation(
            initial.coords.latitude,
            initial.coords.longitude,
            initial.coords.heading,
          );
        } catch {
          // Network may be flaky right at toggle-online — interval will retry
        }
      } catch {
        // getCurrentPositionAsync can throw if location services are off;
        // fall through to watchPositionAsync, which will populate eventually
      }

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
