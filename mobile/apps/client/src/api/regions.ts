import { apiClient, Region } from '@taxi/shared';

export async function getRegions(): Promise<Region[]> {
  const { data } = await apiClient.get<{ data: Region[] }>('/api/v1/client/regions');
  return data.data;
}

export type TariffRoute = {
  fromRegionId: number;
  toRegionId: number;
  dayPrice: number;
  nightPrice: number;
};

export type TariffSnapshot = {
  routes: TariffRoute[];
  roundTripSurchargePercent: number;
  detectedVillage: { id: number; name: string } | null;
  /** null = GPS не передан; true = в зоне; false = вне зоны обслуживания */
  inServiceArea: boolean | null;
};

/**
 * Матрица + автоопределение района по GPS. Передаём latitude/longitude
 * чтобы сервер вернул detectedVillage + inServiceArea. Без GPS придёт
 * только матрица — клиент должен сам поймать GPS и перезапросить.
 */
export async function getTariffs(
  latitude?: number,
  longitude?: number,
): Promise<TariffSnapshot> {
  const params: Record<string, number> = {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get<{
    routes: Array<{
      from_region_id: number;
      to_region_id: number;
      day_price: number;
      night_price: number;
    }>;
    round_trip_surcharge_percent: number;
    detected_village: { id: number; name: string } | null;
    in_service_area: boolean | null;
  }>('/api/v1/client/tariffs', { params });

  return {
    routes: data.routes.map((r) => ({
      fromRegionId: r.from_region_id,
      toRegionId: r.to_region_id,
      dayPrice: r.day_price,
      nightPrice: r.night_price,
    })),
    roundTripSurchargePercent: data.round_trip_surcharge_percent,
    detectedVillage: data.detected_village,
    inServiceArea: data.in_service_area,
  };
}

/**
 * Цена пары (from, to) на момент времени `at` (Asia/Bishkek). Возвращает
 * 0 если пары в матрице нет — UI должен подсветить «тариф не настроен».
 */
export function priceFor(
  routes: TariffRoute[],
  fromRegionId: number,
  toRegionId: number,
  at: Date = new Date(),
): number {
  const route = routes.find(
    (r) => r.fromRegionId === fromRegionId && r.toRegionId === toRegionId,
  );
  if (!route) return 0;

  const bishkekHour = (at.getUTCHours() + 6) % 24;
  const isDay = bishkekHour >= 7 && bishkekHour <= 20;
  return isDay ? route.dayPrice : route.nightPrice;
}
