import * as Location from 'expo-location';

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
    if (parts.length === 0 && first.name) {
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
