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
};

/**
 * Матрица всех цен «откуда → куда». Клиент получает её один раз и
 * вычисляет цену любой пары локально — без сетевого вызова на каждый
 * тап пикера.
 */
export async function getTariffs(): Promise<TariffSnapshot> {
  const { data } = await apiClient.get<{
    routes: Array<{
      from_region_id: number;
      to_region_id: number;
      day_price: number;
      night_price: number;
    }>;
    round_trip_surcharge_percent: number;
  }>('/api/v1/client/tariffs');

  return {
    routes: data.routes.map((r) => ({
      fromRegionId: r.from_region_id,
      toRegionId: r.to_region_id,
      dayPrice: r.day_price,
      nightPrice: r.night_price,
    })),
    roundTripSurchargePercent: data.round_trip_surcharge_percent,
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

  // Asia/Bishkek = UTC+6. Простое смещение часа достаточно — DST там нет.
  const bishkekHour = (at.getUTCHours() + 6) % 24;
  const isDay = bishkekHour >= 7 && bishkekHour <= 20;
  return isDay ? route.dayPrice : route.nightPrice;
}
