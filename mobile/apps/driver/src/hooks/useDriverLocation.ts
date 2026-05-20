import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { updateLocation } from '../api/driver';
import { startBackgroundLocation, stopBackgroundLocation } from '../lib/location-task';

interface UseDriverLocationOptions {
  enabled: boolean;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  heading: number | null;
}

/**
 * Drives the location pipeline for an on-shift driver.
 *
 * - Background pinging (the heartbeat that keeps the driver in dispatch)
 *   runs in a native expo-task-manager task — survives the app being
 *   minimized, the screen going off, the driver scrolling Instagram for
 *   an hour. The task fires from a foreground service so Android doesn't
 *   throttle it.
 * - Foreground UI updates (the blue dot on the home-screen map) still
 *   come from watchPositionAsync because the JS layer needs the
 *   coordinate object to re-render — but they are NOT what keeps the
 *   server seeing this driver as alive.
 *
 * Before this split, the heartbeat was a JS setInterval that froze the
 * moment the app went background — drivers flipped to Stale within 30 s
 * of swiping to WhatsApp.
 */
export function useDriverLocation({ enabled }: UseDriverLocationOptions): LocationCoords | null {
  const coordsRef = useRef<LocationCoords | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    if (!enabled) {
      void stopBackgroundLocation().catch(() => undefined);
      return;
    }

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Background permission is required for the foreground-service
      // task to deliver fixes when the app is not on screen. If the
      // user declines, the foreground UI still updates but the
      // background heartbeat won't survive a minimize.
      await Location.requestBackgroundPermissionsAsync();

      if (cancelled) return;

      // Immediate fire-and-forget seed: get a fast Balanced fix and
      // POST it so location_updated_at moves the moment the driver
      // taps "На линию" — without this we wait up to the task's
      // timeInterval (3 s) for the first ping, plus the task's own
      // startup time (1-2 s on cold launch).
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coordsRef.current = {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
          heading: initial.coords.heading,
        };
        try {
          await updateLocation(
            initial.coords.latitude,
            initial.coords.longitude,
            initial.coords.heading,
          );
        } catch {
          // Network may be flaky right at toggle-online — the background
          // task will retry on its next interval tick
        }
      } catch {
        // getCurrentPositionAsync can throw when location services are
        // off; the watch/background paths below will pick up later
      }

      if (cancelled) return;

      // Foreground UI watch — drives the blue dot on the home-screen
      // map. Separate from the background heartbeat above.
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 3,
          timeInterval: 2000,
        },
        (loc) => {
          coordsRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
          };
        },
      );

      // Kick off the native background task. Idempotent — if it was
      // already running (e.g. user toggled offline then online quickly,
      // before the stop completed), this is a no-op.
      try {
        await startBackgroundLocation();
      } catch {
        // Foreground service start can throw on devices that
        // mis-declared the FOREGROUND_SERVICE_LOCATION permission. We
        // log nothing visible — the server-side heartbeat will surface
        // the consequence (driver flipping to Stale) and the OEM
        // wizard banner already nudges them to fix their permissions.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      // Stop the background task on shift-end. Errors swallowed: if the
      // task wasn't running we don't care, and if Android refused the
      // stop we'll retry on the next toggle.
      void stopBackgroundLocation().catch(() => undefined);
    };
  }, [enabled]);

  return coordsRef.current;
}
