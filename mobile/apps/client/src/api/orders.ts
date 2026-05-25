import { apiClient, Order, PaginatedResponse } from '@taxi/shared';

export async function createOrder(
  latitude: number,
  longitude: number,
  toRegionId: number,
  address?: string,
  comment?: string,
  isRoundTrip?: boolean,
): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>('/api/v1/client/orders', {
    pickup_latitude: latitude,
    pickup_longitude: longitude,
    to_region_id: toRegionId,
    pickup_address: address,
    client_comment: comment,
    is_round_trip: isRoundTrip,
  });
  return data.data;
}

export async function getCurrentOrder(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/client/orders/active');
    return data.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getOrder(id: number): Promise<Order> {
  const { data } = await apiClient.get<{ data: Order }>(`/api/v1/client/orders/${id}`);
  return data.data;
}

export async function cancelOrder(id: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/client/orders/${id}/cancel`);
  return data.data;
}

export async function getOrderHistory(page: number = 1): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<PaginatedResponse<Order>>('/api/v1/client/orders', {
    params: { page },
  });
  return data;
}
