export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface Route {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
}

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function fetchRoute(from: RoutePoint, to: RoutePoint): Promise<Route> {
  const url =
    `${OSRM_BASE_URL}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Routing request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    routes?: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
    }>;
  };

  if (!json.routes || json.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = json.routes[0];
  const coordinates: RoutePoint[] = route.geometry.coordinates.map(
    ([longitude, latitude]) => ({ latitude, longitude })
  );

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
