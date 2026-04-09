import apiClient from './client';
import { User, DriverProfile, DriverChangeRequest } from './types';

export async function updateClientProfile(name: string): Promise<User> {
  const { data } = await apiClient.put<{ data: User }>('/api/v1/client/profile', { name });
  return data.data;
}

export async function getDriverProfile(): Promise<DriverProfile> {
  const { data } = await apiClient.get<{ data: DriverProfile }>('/api/v1/driver/profile');
  return data.data;
}

export async function requestDriverChanges(changes: {
  name?: string;
  car_model?: string;
  car_number?: string;
}): Promise<void> {
  await apiClient.post('/api/v1/driver/profile/request-changes', changes);
}

export async function getDriverChangeRequests(): Promise<DriverChangeRequest[]> {
  const { data } = await apiClient.get<{ data: DriverChangeRequest[] }>('/api/v1/driver/profile/change-requests');
  return data.data;
}

export async function sendChangePhoneOtp(phone: string): Promise<void> {
  await apiClient.post('/api/v1/auth/change-phone/send-otp', { phone });
}

export async function verifyChangePhone(phone: string, code: string): Promise<void> {
  await apiClient.post('/api/v1/auth/change-phone/verify', { phone, code });
}
