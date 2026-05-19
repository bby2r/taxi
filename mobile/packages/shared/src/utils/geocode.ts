import * as Location from 'expo-location';

// Google Plus Code (Open Location Code) pattern — when the reverse
// geocoder can't resolve a street, expo-location's `name` field often
// falls back to a Plus Code like "VJFJ+6CV" or "9G8FXJV4+R9". Pushing
// that to the driver as the pickup address is worse than nothing —
// it's gibberish that doesn't help them find the client. Detect and
// skip it so we fall back to the city / "Геолокация клиента" instead.
const PLUS_CODE = /\b[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}\b/i;

function looksLikePlusCode(value: string): boolean {
  return PLUS_CODE.test(value);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | undefined> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results[0];
    if (!first) {
      return undefined;
    }

    const parts: string[] = [];
    if (first.street) {
      parts.push(first.street);
    }
    if (first.streetNumber) {
      parts.push(first.streetNumber);
    }
    if (parts.length === 0 && first.name && !looksLikePlusCode(first.name)) {
      parts.push(first.name);
    }
    if (first.city) {
      parts.push(first.city);
    }

    const joined = parts.join(', ').trim();
    return joined.length > 0 ? joined : undefined;
  } catch {
    return undefined;
  }
}
