import { apiClient, Region } from '@taxi/shared';

export async function getRegions(): Promise<Region[]> {
  const { data } = await apiClient.get<{ data: Region[] }>('/api/v1/client/regions');
  return data.data;
}

export async function getCurrentPrice(): Promise<number> {
  const { data } = await apiClient.get<{ price: number }>('/api/v1/client/price');
  return data.price;
}

/**
 * Full tariff snapshot — base price plus the round-trip surcharge
 * percent. Server bundles both so the home screen can re-render the
 * preview total locally when the "Туда и обратно" toggle flips, with
 * no extra HTTP round-trip per checkbox tap.
 */
export async function getTariff(): Promise<{ price: number; roundTripSurchargePercent: number }> {
  const { data } = await apiClient.get<{ price: number; round_trip_surcharge_percent: number }>(
    '/api/v1/client/price',
  );
  return {
    price: data.price,
    roundTripSurchargePercent: data.round_trip_surcharge_percent,
  };
}
