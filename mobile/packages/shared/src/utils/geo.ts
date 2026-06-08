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
