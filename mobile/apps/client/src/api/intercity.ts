import { apiClient } from '@taxi/shared';

export type IntercitySlot = {
  trip_id: number;
  from_region: string | null;
  to_region: string | null;
  departure_at: string;
  max_seats: number;
  price_per_seat: number;
  booked_seats: number;
  has_driver: boolean;
  driver_name: string | null;
  car_model: string | null;
  car_number: string | null;
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
  departure_date: string;
  seats_count: number;
  pickup_address?: string | null;
  total_price: number;
  seats_booked_total: number;
  trip?: {
    id: number;
    status: 'open' | 'claimed' | 'ready' | 'en_route' | 'completed' | 'cancelled';
    departure_at?: string | null;
    driver_name?: string | null;
    driver_phone?: string | null;
    car_model?: string | null;
    car_number?: string | null;
    departed_at?: string | null;
  } | null;
  matched_at?: string | null;
  created_at: string;
};

export async function getIntercitySlots(
  latitude?: number,
  longitude?: number,
): Promise<IntercitySlot[]> {
  const params: Record<string, number> = {};
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    params.latitude = latitude;
    params.longitude = longitude;
  }
  const { data } = await apiClient.get<{ slots: IntercitySlot[] }>(
    '/api/v1/client/intercity/slots',
    { params },
  );
  return data.slots;
}

export async function createIntercityBooking(payload: {
  trip_id: number;
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
