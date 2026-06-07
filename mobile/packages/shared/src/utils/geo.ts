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
 * Initial great-circle bearing from `a` to `b`, in degrees clockwise from
 * true north, normalized to [0, 360). This is the compass direction of
 * travel between two consecutive positions — far more stable than the
 * device's reported GPS course (`coords.heading`), which is notoriously
 * noisy at low speed. Used to orient a heading-up navigation camera.
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
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Low-pass filter for a compass bearing. Eases `prev` toward `target` along
 * the shortest angular path — so 350° → 10° rotates +20°, not −340° — by the
 * fraction `alpha` (0 = stay put, 1 = snap to target). Result is normalized
 * to [0, 360). Keeps a heading-up camera from twitching on residual noise.
 */
export function smoothBearing(prev: number, target: number, alpha: number): number {
  const delta = ((target - prev + 540) % 360) - 180; // shortest signed turn, (-180, 180]
  return (((prev + alpha * delta) % 360) + 360) % 360;
}
