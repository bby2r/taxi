import * as Location from 'expo-location';
import { updateLocation } from '../api/driver';

// expo-task-manager is dynamically loaded so a bundle without the
// native module (older build, autolinking miss, install glitch) can't
// crash the entire app at startup. Before this guard, a missing native
// pair turned the import into a synchronous throw at module load —
// index.ts re-exported the side-effect, the JS bundle blew up before
// React mounted, and the user saw a grey screen with no login. With
// the dynamic load, the background heartbeat just silently degrades
// to "off" and the JS-interval foreground heartbeat from
// useDriverLocation keeps things alive.
type TaskManagerType = typeof import('expo-task-manager');
let TaskManager: TaskManagerType | null = null;
try {
  TaskManager = require('expo-task-manager') as TaskManagerType;
} catch {
  TaskManager = null;
}

export const DRIVER_LOCATION_TASK = 'aiyltaxi.driverLocation';

interface LocationTaskData {
  locations: Location.LocationObject[];
}

// Register the task only when the native module loaded successfully.
// defineTask() must be called at module top-level (before any React
// mounts) — so this runs synchronously on import, but is no-op when
// TaskManager is missing.
if (TaskManager) {
  try {
    TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
      if (error) {
        // OS returns a TaskManagerError when permission was revoked or
        // the location service was disabled. Either way the OS will
        // stop calling us — nothing to do client-side, and the
        // server-side heartbeat will flip this driver to Stale on its
        // own.
        return;
      }
      const payload = data as LocationTaskData | undefined;
      const latest = payload?.locations?.[payload.locations.length - 1];
      if (!latest) {
        return;
      }
      try {
        await updateLocation(
          latest.coords.latitude,
          latest.coords.longitude,
          latest.coords.heading,
        );
      } catch {
        // Silent — the task fires every few seconds, the next tick
        // retries. We deliberately don't surface this anywhere: in
        // background there's no UI to bother the driver with, and the
        // server-side heartbeat window catches sustained outages.
      }
    });
  } catch {
    // defineTask can throw if the task name is already registered.
    // Harmless — the previous registration is still active.
  }
}

/**
 * Start the native background location subscription. Idempotent —
 * calling it twice does not stack two tasks. Safe to call from React
 * effects. No-op when expo-task-manager isn't available; the foreground
 * JS interval in useDriverLocation handles pings in that case.
 */
export async function startBackgroundLocation(): Promise<void> {
  if (!TaskManager) return;

  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (started) return;

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    // Balanced over High — High locks the chip into pure-GPS mode
    // which drains battery much faster without enough accuracy gain
    // for a dispatch use case (we just need "which 100m" not "which
    // lane").
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 3000,
    distanceInterval: 3,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'AIYL Taxi — на линии',
      notificationBody: 'Принимаем заказы. Нажмите чтобы открыть.',
      notificationColor: '#FBBF24',
    },
    activityType: Location.ActivityType.Other,
  });
}

/**
 * Stop the native subscription. Idempotent — if no task is running this
 * resolves immediately. No-op when expo-task-manager isn't available.
 */
export async function stopBackgroundLocation(): Promise<void> {
  if (!TaskManager) return;

  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
}
