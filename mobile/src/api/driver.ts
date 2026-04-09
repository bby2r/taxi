import apiClient from './client';
import { Order, DriverStats } from './types';

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

export async function declineOrder(orderId: number): Promise<void> {
  await apiClient.post(`/api/v1/driver/orders/${orderId}/decline`);
}

export async function arriveAtPickup(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/arrived`);
  return data.data;
}

export async function completeOrder(orderId: number): Promise<Order> {
  const { data } = await apiClient.post<{ data: Order }>(`/api/v1/driver/orders/${orderId}/complete`);
  return data.data;
}

export async function getCurrentDriverOrder(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/driver/orders/active');
    return data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getPendingOffer(): Promise<Order | null> {
  try {
    const { data } = await apiClient.get<{ data: Order }>('/api/v1/driver/orders/pending-offer');
    return data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getDriverStats(): Promise<DriverStats> {
  const { data } = await apiClient.get<{ data: DriverStats }>('/api/v1/driver/stats');
  return data.data;
}
