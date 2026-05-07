import { useState, useEffect, useRef } from 'react';
import { fetchRoute, Route, RoutePoint } from '../api/routing';
import { trimRouteFromPosition } from '../utils/routeTrim';

interface UseRouteState {
  route: Route | null;
  trimmedCoordinates: RoutePoint[];
  offRouteMeters: number;
  loading: boolean;
  error: string | null;
}

// Re-fetch the full route after this much linear drift even if the driver
// is still on-route. Keeps the polyline fresh on long trips without forcing
// a fetch on every position update.
const REFETCH_THRESHOLD_METERS = 300;
// If the driver wanders this far from the current polyline, treat them as
// off-route and rebuild the route from their current position immediately
// (Yandex/Google Maps style).
const OFF_ROUTE_REFETCH_METERS = 50;
// Don't fetch more than once per this interval. Prevents a storm if GPS
// jitters around the threshold or the routing service is slow.
const REFETCH_COOLDOWN_MS = 4000;

function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function useRoute(
  from: RoutePoint | null,
  to: RoutePoint | null
): UseRouteState {
  const [state, setState] = useState<UseRouteState>({
    route: null,
    trimmedCoordinates: [],
    offRouteMeters: 0,
    loading: false,
    error: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastFetchedFromRef = useRef<RoutePoint | null>(null);
  const lastToRef = useRef<RoutePoint | null>(null);
  const lastFetchAtRef = useRef<number>(0);

  useEffect(() => {
    if (!from || !to) {
      return;
    }

    const toChanged =
      !lastToRef.current ||
      lastToRef.current.latitude !== to.latitude ||
      lastToRef.current.longitude !== to.longitude;

    // If destination changed (e.g. start_ride flips driver→pickup to
    // driver→dropoff), drop the cached route — it's pointing at a stale
    // place and will mis-trim until the next fetch returns.
    const currentRoute = toChanged ? null : stateRef.current.route;

    let shouldFetch = currentRoute === null;
    let trimmedCoords: RoutePoint[] = [];
    let offRouteMeters = 0;

    if (currentRoute) {
      const trim = trimRouteFromPosition(currentRoute.coordinates, from);
      trimmedCoords = trim.trimmed;
      offRouteMeters = trim.offRouteMeters;

      const now = Date.now();
      const cooldownPassed = now - lastFetchAtRef.current > REFETCH_COOLDOWN_MS;
      const offRouteRefetch =
        offRouteMeters > OFF_ROUTE_REFETCH_METERS && cooldownPassed;
      const drift = lastFetchedFromRef.current
        ? haversineMeters(lastFetchedFromRef.current, from)
        : Infinity;
      const driftRefetch = drift >= REFETCH_THRESHOLD_METERS;

      shouldFetch = offRouteRefetch || driftRefetch;
    }

    if (!shouldFetch) {
      setState((prev) => ({
        ...prev,
        trimmedCoordinates: trimmedCoords,
        offRouteMeters,
      }));
      return;
    }

    let cancelled = false;
    lastFetchAtRef.current = Date.now();
    lastToRef.current = to;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchRoute(from, to)
      .then((route) => {
        if (cancelled) {
          return;
        }
        lastFetchedFromRef.current = from;
        const trim = trimRouteFromPosition(route.coordinates, from);
        setState({
          route,
          trimmedCoordinates: trim.trimmed,
          offRouteMeters: trim.offRouteMeters,
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Не удалось построить маршрут';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      });

    return () => {
      cancelled = true;
    };
  }, [from?.latitude, from?.longitude, to?.latitude, to?.longitude]);

  return state;
}
