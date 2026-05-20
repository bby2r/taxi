import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { updateLocation } from '../api/driver';

// Defining the task at module top-level (not inside a React component)
// is required by expo-task-manager — the OS may wake the app process and
// call this body without ever mounting any React tree, so the task must
// be registered the moment JS starts. index.ts imports this file so the
// side-effectful defineTask() call runs at app boot.
export const DRIVER_LOCATION_TASK = 'aiyltaxi.driverLocation';

interface LocationTaskData {
  locations: Location.LocationObject[];
}

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // OS returns a TaskManagerError when permission was revoked or the
    // location service was disabled. Either way the OS will stop calling
    // us — nothing to do client-side, and the server-side heartbeat will
    // flip this driver to Stale on its own.
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
    // Silent — the task fires every few seconds, the next tick retries.
    // We deliberately don't surface this anywhere: in background there's
    // no UI to bother the driver with, and the server-side heartbeat
    // window catches sustained outages anyway.
  }
});

/**
 * Start the native background location subscription. Idempotent — calling
 * it twice does not stack two tasks. Safe to call from React effects.
 *
 * `foregroundService` is what keeps Android from throttling us: it shows
 * a persistent notification (required by API 26+) and asks the OS to
 * keep the process alive even when no Activity is on screen. Without it
 * the task gets killed within minutes on most modern Android versions.
 */
export async function startBackgroundLocation(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (started) return;

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    // Balanced over High — High locks the chip into pure-GPS mode which
    // drains battery much faster without enough accuracy gain for a
    // dispatch use case (we just need "which 100m" not "which lane").
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 3000,
    distanceInterval: 3,
    // iOS-only flag — tells the system not to show the blue status bar
    // pill while we're tracking, since the driver explicitly opted in.
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'AIYL Taxi — на линии',
      notificationBody: 'Принимаем заказы. Нажмите чтобы открыть.',
      notificationColor: '#FBBF24',
    },
    // Without this, expo-location may buffer locations for several
    // minutes before delivering a batch to the task — bad for our
    // heartbeat. activityType=other tells Android+iOS we don't care
    // about driving/walking heuristics, just deliver fixes as they come.
    activityType: Location.ActivityType.Other,
  });
}

/**
 * Stop the native subscription. Idempotent — if no task is running this
 * resolves immediately. Call from the "Off-line" toggle handler.
 */
export async function stopBackgroundLocation(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (!started) return;
  await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
}
