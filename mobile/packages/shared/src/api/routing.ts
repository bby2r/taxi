export interface RoutePoint {
  latitude: number;
  longitude: number;
}

// Поворот / манёвр на маршруте. OSRM возвращает их в steps[] —
// мы парсим в более удобную для UI форму. Тип manoeuvre — нормализованный
// (left / right / straight / arrive), чтобы баннер мог рисовать стрелку
// без знания всех 30+ типов OSRM (slight left, sharp right, и т.д.).
export type ManeuverType =
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'straight'
  | 'uturn'
  | 'arrive'
  | 'depart';

export interface RouteStep {
  location: RoutePoint; // где происходит манёвр
  maneuver: ManeuverType;
  instruction: string; // русский текст для голоса и баннера
  distanceMeters: number; // длина этого шага (от начала до манёвра)
  durationSeconds: number;
  streetName?: string;
}

export interface Route {
  coordinates: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function fetchRoute(from: RoutePoint, to: RoutePoint): Promise<Route> {
  const url =
    `${OSRM_BASE_URL}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson&steps=true&language=ru`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Routing request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    routes?: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
      legs?: Array<{
        steps?: Array<{
          maneuver: {
            location: [number, number];
            type: string;
            modifier?: string;
          };
          distance: number;
          duration: number;
          name?: string;
        }>;
      }>;
    }>;
  };

  if (!json.routes || json.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = json.routes[0];
  const coordinates: RoutePoint[] = route.geometry.coordinates.map(
    ([longitude, latitude]) => ({ latitude, longitude })
  );

  const rawSteps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
  const steps: RouteStep[] = rawSteps.map((raw) => {
    const maneuver = normalizeManeuver(raw.maneuver.type, raw.maneuver.modifier);
    return {
      location: {
        longitude: raw.maneuver.location[0],
        latitude: raw.maneuver.location[1],
      },
      maneuver,
      instruction: buildInstruction(maneuver, raw.name),
      distanceMeters: raw.distance,
      durationSeconds: raw.duration,
      streetName: raw.name || undefined,
    };
  });

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps,
  };
}

function normalizeManeuver(type: string, modifier?: string): ManeuverType {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'roundabout' || type === 'rotary') return 'straight';
  switch (modifier) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'uturn':
      return 'uturn';
    case 'straight':
    default:
      return 'straight';
  }
}

const MANEUVER_TEXT: Record<ManeuverType, string> = {
  left: 'Поверните налево',
  right: 'Поверните направо',
  'slight-left': 'Возьмите левее',
  'slight-right': 'Возьмите правее',
  'sharp-left': 'Резко налево',
  'sharp-right': 'Резко направо',
  straight: 'Продолжайте прямо',
  uturn: 'Развернитесь',
  arrive: 'Вы прибыли',
  depart: 'Начинайте движение',
};

function buildInstruction(maneuver: ManeuverType, streetName?: string): string {
  const base = MANEUVER_TEXT[maneuver];
  if (streetName && maneuver !== 'arrive' && maneuver !== 'straight') {
    return `${base} на ${streetName}`;
  }
  return base;
}
