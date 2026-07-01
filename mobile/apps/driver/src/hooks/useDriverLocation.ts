import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { API_BASE_URL, getToken } from '@taxi/shared';
import { updateLocation } from '../api/driver';
import {
  isOfferOverlayAvailable,
  setNativeAuth,
  startNativeLocationPings,
  stopNativeLocationPings,
} from '../../modules/offer-overlay/src';

interface UseDriverLocationOptions {
  enabled: boolean;
}

interface LocationCoords {
  latitude: number;
  longitude: number;
  heading: number | null;
}

/**
 * Drives the location pipeline for an on-shift driver. Three layers
 * run in parallel:
 *
 * 1. watchPositionAsync — feeds coordsRef so the home-screen blue dot
 *    keeps following the driver. Foreground only.
 *
 * 2. JS setInterval — uploads coordsRef every 3 s. Foreground only
 *    (RN freezes JS timers in background). Acts as a safety net if
 *    the native ping service didn't start (no background-location
 *    permission, OEM blocked the foreground service, older build
 *    without the native module).
 *
 * 3. Native LocationPingService — Kotlin foreground service. Survives
 *    the user swiping the app out of recents on Xiaomi/MIUI (where the
 *    previous expo-task-manager headless JS body got killed even
 *    though the service notification stayed visible — the actual bug
 *    that triggered this whole native rewrite). Reads token + API
 *    URL from a SharedPreferences seeded by setNativeAuth() below.
 */
export function useDriverLocation({ enabled }: UseDriverLocationOptions): LocationCoords | null {
  const coordsRef = useRef<LocationCoords | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      try {
        stopNativeLocationPings();
        // Wipe the cached token from native prefs on shift-end so a
        // stale token can't accidentally ping if the service is woken
        // back up by Android resurrection logic.
        setNativeAuth(null, null);
      } catch {
        // Native module may be absent in older builds
      }
      return;
    }

    let nativePingsRunning = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Background permission is what lets LocationPingService actually
      // deliver fixes from the foreground service when the app is
      // swiped out of recents. Without it the foreground JS still
      // pings, but the moment the driver minimizes for >60 s they
      // flip to Stale.
      await Location.requestBackgroundPermissionsAsync();

      if (cancelled) return;

      // Hand auth credentials to the native service BEFORE starting
      // it — the service reads them on every tick, no JS runtime
      // required after this point. Token comes from the same
      // SecureStore that the JS apiClient uses, API_BASE_URL is the
      // compile-time EXPO_PUBLIC_API_URL.
      try {
        const token = await getToken();
        if (token && isOfferOverlayAvailable()) {
          setNativeAuth(token, API_BASE_URL);
          startNativeLocationPings();
          nativePingsRunning = true;
        }
      } catch {
        // Native bridge missing — foreground JS interval below
        // still keeps the driver visible while on home screen.
      }

      // Immediate fire-and-forget seed: get a fast Balanced fix and
      // POST it so location_updated_at moves the moment the driver
      // taps "На линию" — without this we wait up to the task's
      // timeInterval (3 s) for the first ping.
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
          // Network flaky right at toggle-online — the interval below
          // retries on its next tick
        }
      } catch {
        // getCurrentPositionAsync can throw when location services
        // are off; the watch path below picks up later
      }

      if (cancelled) return;

      // Foreground UI watch — drives the blue dot on the home-screen
      // map. Separate from the native heartbeat. Balanced + 5м/5с —
      // High + 3м/2с заметно греет телефон в ожидании заказа, при этом
      // навигация всё равно живёт в OrderActiveScreen, где useLocation
      // ({navigation: true}) сам поднимает точность до BestForNavigation.
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 5000,
        },
        (loc) => {
          coordsRef.current = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
          };
        },
      );

      // Foreground JS heartbeat — uploads coordsRef. Safety net for
      // когда native service не запустился (нет bg-location, OEM, старый
      // build без native-модуля). Если native pings уже работают, держим
      // редкий интервал (10 с) чтобы не дублировать сеть/CPU/батарею —
      // native шлёт каждые ~3 с, и наш JS-тик нужен лишь чтобы не
      // потерять координаты, если native-сервис вдруг убили. Без native
      // остаёмся на 3 с — это единственный источник.
      const heartbeatMs = nativePingsRunning ? 10000 : 3000;
      intervalRef.current = setInterval(async () => {
        if (coordsRef.current) {
          try {
            await updateLocation(
              coordsRef.current.latitude,
              coordsRef.current.longitude,
              coordsRef.current.heading,
            );
          } catch {
            // Silent — next interval retries
          }
        }
      }, heartbeatMs);
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Note: deliberately not stopping the native service here —
      // unmounting HomeScreen (e.g. when navigating to OrderActive)
      // should NOT take the driver off shift. The cleanup only fires
      // when enabled flips false (handled at the top of the effect).
    };
  }, [enabled]);

  return coordsRef.current;
}
