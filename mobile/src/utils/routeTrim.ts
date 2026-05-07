import type { RoutePoint } from '../api/routing';

const KM_PER_DEG_LAT = 111.32;

interface SegmentSnap {
  distanceMeters: number;
  projection: RoutePoint;
}

/**
 * Snap a point onto a polyline segment using a flat equirectangular
 * approximation. Accurate enough for village-scale distances.
 */
function snapToSegment(
  point: RoutePoint,
  a: RoutePoint,
  b: RoutePoint,
): SegmentSnap {
  const meanLatRad = (((a.latitude + b.latitude) / 2) * Math.PI) / 180;
  const cosLat = Math.cos(meanLatRad);

  const ax = a.longitude * KM_PER_DEG_LAT * cosLat;
  const ay = a.latitude * KM_PER_DEG_LAT;
  const bx = b.longitude * KM_PER_DEG_LAT * cosLat;
  const by = b.latitude * KM_PER_DEG_LAT;
  const px = point.longitude * KM_PER_DEG_LAT * cosLat;
  const py = point.latitude * KM_PER_DEG_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  const tRaw = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  const t = Math.max(0, Math.min(1, tRaw));

  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const distKm = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);

  return {
    distanceMeters: distKm * 1000,
    projection: {
      latitude: projY / KM_PER_DEG_LAT,
      longitude: projX / (KM_PER_DEG_LAT * cosLat),
    },
  };
}

export interface TrimResult {
  trimmed: RoutePoint[];
  offRouteMeters: number;
}

/**
 * Trim everything before the driver's current position so the polyline
 * shrinks as the driver progresses. Walks every segment, finds the
 * closest one, projects the driver onto it, and returns the projection
 * + the rest of the polyline. `offRouteMeters` lets the caller decide
 * whether to refetch a new route (driver took a different street).
 */
export function trimRouteFromPosition(
  coords: RoutePoint[],
  driverPos: RoutePoint,
): TrimResult {
  if (coords.length < 2) {
    return { trimmed: coords, offRouteMeters: 0 };
  }

  let bestIdx = 0;
  let bestDist = Infinity;
  let bestProj: RoutePoint = coords[0];

  for (let i = 0; i < coords.length - 1; i++) {
    const snap = snapToSegment(driverPos, coords[i], coords[i + 1]);
    if (snap.distanceMeters < bestDist) {
      bestDist = snap.distanceMeters;
      bestIdx = i;
      bestProj = snap.projection;
    }
  }

  return {
    trimmed: [bestProj, ...coords.slice(bestIdx + 1)],
    offRouteMeters: bestDist,
  };
}
