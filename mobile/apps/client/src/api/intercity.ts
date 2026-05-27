import { apiClient } from '@taxi/shared';

export type IntercityRoute = {
  id: number;
  from_region: { id: number; name: string };
  to_region: { id: number; name: string };
  max_seats: number;
  price_per_seat: number;
};

export type IntercityBookingStatus =
  | 'pending'
  | 'matched'
  | 'en_route'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type IntercityBooking = {
  id: number;
  status: IntercityBookingStatus;
  route?: {
    id: number;
    from_region: string;
    to_region: string;
    max_seats: number;
    price_per_seat: number;
  };
  departure_date: string; // YYYY-MM-DD
  seats_count: number;
  pickup_address?: string | null;
  total_price: number;
  seats_booked_total: number;
  trip?: {
    id: number;
    status: 'matched' | 'en_route' | 'completed' | 'cancelled';
    driver_name?: string;
    driver_phone?: string;
    car_model?: string;
    car_number?: string;
    departed_at?: string | null;
  } | null;
  matched_at?: string | null;
  created_at: string;
};

export async function getIntercityRoutes(
  latitude?: number,
  longitude?: number,
): Promise<IntercityRoute[]> {
  const params: Record<string, number> = {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get<{ data: IntercityRoute[] }>(
    '/api/v1/client/intercity/routes',
    { params },
  );
  return data.data;
}

export async function createIntercityBooking(payload: {
  route_id: number;
  departure_date: string; // YYYY-MM-DD
  seats_count: number;
  pickup_address?: string;
}): Promise<IntercityBooking> {
  const { data } = await apiClient.post<{ data: IntercityBooking }>(
    '/api/v1/client/intercity/bookings',
    payload,
  );
  return data.data;
}

export async function getActiveIntercityBooking(): Promise<IntercityBooking | null> {
  try {
    const { data } = await apiClient.get<{ data: IntercityBooking }>(
      '/api/v1/client/intercity/bookings/active',
    );
    return data.data;
  } catch (e: unknown) {
    if ((e as { response?: { status?: number } }).response?.status === 404) {
      return null;
    }
    throw e;
  }
}

export async function cancelIntercityBooking(id: number): Promise<IntercityBooking> {
  const { data } = await apiClient.post<{ data: IntercityBooking }>(
    `/api/v1/client/intercity/bookings/${id}/cancel`,
  );
  return data.data;
}
