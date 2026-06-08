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
