import apiClient from './client';
import {
  Order,
  DriverStats,
  DriverBalance,
  DeclineReason,
  DriverCancellationReason,
} from './types';

export async function goOnline(latitude: number, longitude: number): Promise<void> {
  await apiClient.post('/api/v1/driver/go-online', { latitude, longitude });
}

export async function goOffline(): Promise<void> {
  await apiClient.post('/api/v1/driver/go-offline');
}

export async function updateLocation(
  latitude: number,
  longitude: number,
  heading?: number | null
): Promise<void> {
  await apiClient.post('/api/v1/driver/location', {
    latitude,
    longitude,
    ...(heading !== null && heading !== undefined ? { heading } : {}),
  });
}

export async function acceptOrder(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/accept`);
  return data.data;
}

export async function declineOrder(orderId: number, reason: DeclineReason): Promise<void> {
  await apiClient.post(`/api/v1/driver/orders/${orderId}/decline`, { reason });
}

export async function arriveAtPickup(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/arrived`);
  return data.data;
}

export async function startRide(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/start`);
  return data.data;
}

export async function completeOrder(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/complete`);
  return data.data;
}

export async function cancelOrderByDriver(
  orderId: number,
  reason: DriverCancellationReason
): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(
    `/api/v1/driver/orders/${orderId}/cancel`,
    { reason }
  );
  return data.data;
}

export async function getCurrentDriverOrder(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/driver/orders/active');
    // Only treat a strictly well-formed response as authoritative. ngrok's
    // auth wall, Render's cold-start HTML, and partial proxy responses all
    // surface as 200 OK with a body that doesn't contain `data.data`, and
    // the active-order poller treats null as "order was cancelled" and
    // resets the driver's screen. Throw instead so the poller's catch
    // branch logs and ignores the tick.
    if (!data || typeof data !== 'object' || !data.data) {
      throw new Error('malformed active-order response');
    }
    return data.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getPendingOffer(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/driver/orders/pending-offer');
    return data.data;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getDriverStats(): Promise<DriverStats> {
  const { data } = await apiClient.get<{ data: DriverStats }>('/api/v1/driver/stats');
  return data.data;
}

export async function getDriverBalance(): Promise<DriverBalance> {
  const { data } = await apiClient.get<{ data: DriverBalance }>('/api/v1/driver/balance');
  return data.data;
}
