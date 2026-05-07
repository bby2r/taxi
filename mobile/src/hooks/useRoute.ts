import { useState, useEffect, useRef } from 'react';
import { fetchRoute, Route, RoutePoint } from '../api/routing';

interface UseRouteState {
  route: Route | null;
  loading: boolean;
  error: string | null;
}

// Re-fetch the full route only after a meaningful drift. Between refetches
// the consumer trims the polyline locally against the live driver position,
// so a wide threshold keeps the polyline stable and reduces OSRM chatter.
const REFETCH_THRESHOLD_METERS = 300;

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
    loading: false,
    error: null,
  });
  const lastFetchedFrom = useRef<RoutePoint | null>(null);

  useEffect(() => {
    if (!from || !to) {
      return;
    }

    if (
      lastFetchedFrom.current &&
      haversineMeters(lastFetchedFrom.current, from) < REFETCH_THRESHOLD_METERS
    ) {
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchRoute(from, to)
      .then((route) => {
        if (cancelled) {
          return;
        }
        lastFetchedFrom.current = from;
        setState({ route, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Не удалось построить маршрут';
        setState({ route: null, loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [from?.latitude, from?.longitude, to?.latitude, to?.longitude]);

  return state;
}
