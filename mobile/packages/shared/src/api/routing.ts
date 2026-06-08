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
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

// Если в build-time прокинут EXPO_PUBLIC_ORS_KEY — используем
// OpenRouteService, который отдаёт готовые русские инструкции прямо в
// поле `instruction` каждого шага (без локальной сборки через
// buildInstruction). Free tier 2k req/день. Без ключа fallback на
// публичный OSRM demo — работает, но фразы строим сами.
const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY ?? '';

export async function fetchRoute(from: RoutePoint, to: RoutePoint): Promise<Route> {
  if (ORS_KEY.length > 0) {
    try {
      return await fetchRouteOrs(from, to);
    } catch (err) {
      // ORS превысил daily quota / сеть упала / отдал не тот формат —
      // не блокируем водителя, переходим на OSRM. UI продолжит работать
      // с локально-собранными инструкциями.
      // eslint-disable-next-line no-console
      console.warn('[routing] ORS failed, falling back to OSRM:', err);
    }
  }
  return fetchRouteOsrm(from, to);
}

async function fetchRouteOrs(from: RoutePoint, to: RoutePoint): Promise<Route> {
  const response = await fetch(ORS_URL, {
    method: 'POST',
    headers: {
      Authorization: ORS_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/geo+json',
    },
    body: JSON.stringify({
      coordinates: [
        [from.longitude, from.latitude],
        [to.longitude, to.latitude],
      ],
      language: 'ru',
      instructions: true,
      units: 'm',
    }),
  });
  if (!response.ok) {
    throw new Error(`ORS request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number][] };
      properties: {
        summary: { distance: number; duration: number };
        segments: Array<{
          steps: Array<{
            distance: number;
            duration: number;
            type: number;
            instruction: string;
            name?: string;
            way_points: [number, number];
          }>;
        }>;
      };
    }>;
  };

  const feature = json.features?.[0];
  if (!feature) {
    throw new Error('No route found');
  }

  const coordinates: RoutePoint[] = feature.geometry.coordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));
  const rawSteps = feature.properties.segments.flatMap((s) => s.steps);
  const steps: RouteStep[] = rawSteps.map((raw) => {
    const startIdx = raw.way_points[0];
    const startCoord = feature.geometry.coordinates[startIdx] ?? feature.geometry.coordinates[0];
    return {
      location: { longitude: startCoord[0], latitude: startCoord[1] },
      maneuver: orsTypeToManeuver(raw.type),
      // ORS отдаёт фразу готовой на русском — пихаем прямо в баннер
      // и Speech.speak без локальной сборки.
      instruction: raw.instruction,
      distanceMeters: raw.distance,
      durationSeconds: raw.duration,
      streetName: raw.name || undefined,
    };
  });

  return {
    coordinates,
    distanceMeters: feature.properties.summary.distance,
    durationSeconds: feature.properties.summary.duration,
    steps,
  };
}

async function fetchRouteOsrm(from: RoutePoint, to: RoutePoint): Promise<Route> {
  // OSRM public demo не поддерживает `language=` (это расширение
  // Mapbox Directions), и при его передаче возвращает HTTP 400
  // "Query string malformed". Локализация инструкций делается ниже в
  // buildInstruction() — OSRM нужно только geometry+maneuver
  // type+modifier.
  const url =
    `${OSRM_BASE_URL}/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson&steps=true`;

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
  const coordinates: RoutePoint[] = route.geometry.coordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));

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

// ORS-коды → наш ManeuverType. Полный список:
// https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/instruction-types.html
function orsTypeToManeuver(type: number): ManeuverType {
  switch (type) {
    case 0:
      return 'left';
    case 1:
      return 'right';
    case 2:
      return 'sharp-left';
    case 3:
      return 'sharp-right';
    case 4:
      return 'slight-left';
    case 5:
      return 'slight-right';
    case 6:
      return 'straight';
    case 9:
      return 'uturn';
    case 10:
      return 'arrive';
    case 11:
      return 'depart';
    case 12:
      return 'slight-left'; // keep-left → trat как slight-left
    case 13:
      return 'slight-right';
    case 7:
    case 8:
    default:
      return 'straight';
  }
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
