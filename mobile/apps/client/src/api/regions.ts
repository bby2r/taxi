import { apiClient, Region } from '@taxi/shared';

export async function getRegions(latitude?: number, longitude?: number): Promise<Region[]> {
  const params: Record<string, number> = {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get<{ data: Region[] }>('/api/v1/client/regions', { params });
  return data.data;
}

export async function getCurrentPrice(): Promise<number> {
  const { data } = await apiClient.get<{ price: number }>('/api/v1/client/price');
  return data.price;
}

export type TariffSnapshot = {
  price: number;
  roundTripSurchargePercent: number;
  district: { id: number; name: string } | null;
  inVillageAvailable: boolean;
};

/**
 * Full tariff snapshot — base price + round-trip surcharge percent +
 * detected district. When latitude/longitude are provided the server
 * resolves the nearest district centre and returns that district's
 * in-village price; without coords it falls back to the global tariff.
 */
export async function getTariff(
  latitude?: number,
  longitude?: number,
): Promise<TariffSnapshot> {
  const params: Record<string, number> = {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get<{
    price: number;
    round_trip_surcharge_percent: number;
    district: { id: number; name: string } | null;
    in_village_available: boolean;
  }>('/api/v1/client/price', { params });
  return {
    price: data.price,
    roundTripSurchargePercent: data.round_trip_surcharge_percent,
    district: data.district,
    inVillageAvailable: data.in_village_available,
  };
}
