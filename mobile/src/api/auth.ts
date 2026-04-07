import apiClient from './client';
import { AuthResponse, User } from './types';

export async function sendOtp(phone: string): Promise<void> {
  await apiClient.post('/api/v1/auth/send-otp', { phone });
}

export async function verifyOtp(phone: string, code: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/v1/auth/verify-otp', { phone, code });
  return data;
}

export async function driverLogin(phone: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/v1/auth/driver-login', { phone, password });
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/v1/auth/logout');
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/api/v1/auth/me');
  return data;
}

export async function registerPushToken(token: string): Promise<void> {
  await apiClient.put('/api/v1/auth/push-token', { expo_push_token: token });
}
