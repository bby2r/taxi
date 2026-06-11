/**
 * Great-circle distance between two lat/lng points in meters.
 * Accurate to a couple of meters for everything in / around a village.
 */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
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

export function formatMeters(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} м`;
  }
  return `${(meters / 1000).toFixed(1)} км`;
}

/**
 * Выбор bearing'а из двух источников: компас (магнитометр телефона) и
 * GPS-heading. Android-провайдер возвращает heading=0 когда курс НЕ
 * вычислен (или когда едешь идеально на север) — поэтому требуем
 * строго > 0, иначе это «нет данных».
 */
export function pickBearing(
  compass: number | null,
  gpsHeading: number | null | undefined,
): number {
  if (compass !== null) return compass;
  if (typeof gpsHeading === 'number' && gpsHeading > 0) return gpsHeading;
  return 0;
}

/**
 * Initial great-circle bearing from `a` to `b`, in degrees clockwise from
 * true north, normalized to [0, 360). This is the compass direction of
 * travel between two consecutive positions — far more stable than the
 * device magnetometer, which is what we want driving a heading-up camera.
 */
export function bearingBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Shortest angular distance between two compass bearings, in degrees
 * (0..180). 350° and 10° are 20° apart, not 340°.
 */
export function angularGapDeg(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Low-pass a compass bearing toward `target` along the shortest arc —
 * 350° → 10° rotates +20°, not −340° — by fraction `alpha` (0 = keep
 * prev, 1 = snap to target). Result normalized to [0, 360). Keeps a
 * heading-up navigation camera from snapping on a single noisy reading.
 */
export function smoothBearing(prev: number, target: number, alpha: number): number {
  const delta = ((target - prev + 540) % 360) - 180;
  return (((prev + alpha * delta) % 360) + 360) % 360;
}

/**
 * Rolling state for a "course-up" map camera driven by GPS movement instead
 * of the magnetometer. `anchor` is the position the current `bearing` was
 * computed from; `bearing` is the smoothed map heading in degrees [0, 360).
 */
export interface CourseUpState {
  anchor: { latitude: number; longitude: number };
  bearing: number;
}

/**
 * Advance a course-up map bearing from a new GPS fix.
 *
 * The heading follows the driver's actual direction of travel — the
 * great-circle bearing from the anchor to the new fix — low-pass smoothed,
 * and ONLY once they've moved at least `minMoveMeters` (real motion, not GPS
 * jitter). Below that threshold the previous bearing and anchor are returned
 * unchanged, so a parked or merely re-oriented phone never rotates the map.
 *
 * This is the deliberate alternative to a magnetometer-driven camera: turning
 * the device in your hand changes the compass but not your GPS track, so the
 * map stays put until you actually drive somewhere.
 *
 * @param state Previous `{ anchor, bearing }`.
 * @param fix   Latest GPS position.
 * @param opts  `minMoveMeters` (default 12) gates motion vs. jitter; `alpha`
 *              (default 0.2) is the low-pass factor (0 = frozen, 1 = snap).
 * @returns The next state — a new object when it advanced, or the SAME
 *          `state` reference when the move was below threshold (lets callers
 *          cheaply detect "no change").
 */
export function advanceCourseUp(
  state: CourseUpState,
  fix: { latitude: number; longitude: number },
  opts?: { minMoveMeters?: number; alpha?: number },
): CourseUpState {
  const minMoveMeters = opts?.minMoveMeters ?? 12;
  const alpha = opts?.alpha ?? 0.2;
  if (haversineMeters(state.anchor, fix) < minMoveMeters) {
    return state;
  }
  const course = bearingBetween(state.anchor, fix);
  return {
    anchor: { latitude: fix.latitude, longitude: fix.longitude },
    bearing: smoothBearing(state.bearing, course, alpha),
  };
}

export interface SnapResult {
  latitude: number;
  longitude: number;
  perpMeters: number;
  segmentIndex: number;
}

/**
 * Project a point onto the nearest segment of a polyline (route line) and
 * return the snapped position + perpendicular distance from the input point.
 *
 * This is the "snap to road" step that keeps the driver pin on the route
 * polyline instead of drifting onto the pavement when GPS error pushes the
 * raw fix 10-20m off the actual street — common in dense city blocks. The
 * heading is left alone; callers should keep their Kalman/velocity bearing.
 *
 * Equirectangular local projection with cos(lat) scaling — sub-meter
 * accurate over the ~100m segments of a routed polyline, vastly cheaper
 * than per-segment haversine when iterating 200+ points.
 *
 * Caller decides whether to USE the snap: if `perpMeters` is large the
 * driver has likely diverged from the route (wrong turn, missing segment)
 * and the raw fix should be kept until the backend reroutes.
 *
 * Returns `null` for routes with < 2 points (nothing to project onto).
 */
export function snapToPolyline(
  point: { latitude: number; longitude: number },
  polyline: ReadonlyArray<{ latitude: number; longitude: number }>,
): SnapResult | null {
  if (polyline.length < 2) return null;

  const M_PER_DEG_LAT = 111_320;
  const cosLat = Math.cos((point.latitude * Math.PI) / 180);
  const mPerDegLng = M_PER_DEG_LAT * cosLat;

  const px = point.longitude * mPerDegLng;
  const py = point.latitude * M_PER_DEG_LAT;

  let bestDist = Infinity;
  let bestLat = polyline[0].latitude;
  let bestLng = polyline[0].longitude;
  let bestIdx = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const ax = a.longitude * mPerDegLng;
    const ay = a.latitude * M_PER_DEG_LAT;
    const bx = b.longitude * mPerDegLng;
    const by = b.latitude * M_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    const sx = ax + t * dx;
    const sy = ay + t * dy;
    const ex = px - sx;
    const ey = py - sy;
    const distSq = ex * ex + ey * ey;
    if (distSq < bestDist) {
      bestDist = distSq;
      bestLat = sy / M_PER_DEG_LAT;
      bestLng = sx / mPerDegLng;
      bestIdx = i;
    }
  }

  return {
    latitude: bestLat,
    longitude: bestLng,
    perpMeters: Math.sqrt(bestDist),
    segmentIndex: bestIdx,
  };
}
