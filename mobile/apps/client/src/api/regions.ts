import { apiClient, Region } from '@taxi/shared';

export async function getRegions(): Promise<Region[]> {
  const { data } = await apiClient.get<{ data: Region[] }>('/api/v1/client/regions');
  return data.data;
}

export async function getCurrentPrice(): Promise<number> {
  const { data } = await apiClient.get<{ price: number }>('/api/v1/client/price');
  return data.price;
}
