import { apiClient } from '@taxi/shared';

export type IntercitySlotOffer = {
  trip_id: number;
  from_region: string | null;
  to_region: string | null;
  departure_at: string;
  max_seats: number;
  price_per_seat: number;
  booked_seats: number;
  total_revenue: number;
};

export type IntercityTripStatus =
  | 'open'
  | 'claimed'
  | 'ready'
  | 'en_route'
  | 'completed'
  | 'cancelled';

export type IntercityPassenger = {
  id: number;
  name: string | null;
  phone: string | null;
  seats_count: number;
  pickup_address: string | null;
  status: string;
};

export type IntercityTrip = {
  id: number;
  status: IntercityTripStatus;
  is_closed: boolean;
  route?: { id: number; from_region: string; to_region: string };
  departure_at: string;
  max_seats: number;
  price_per_seat: number;
  seats_booked?: number;
  total_revenue?: number;
  commission_amount?: number | null;
  passengers?: IntercityPassenger[];
  accepted_at?: string | null;
  departed_at?: string | null;
  completed_at?: string | null;
};

export async function getAvailableIntercitySlots(): Promise<IntercitySlotOffer[]> {
  const { data } = await apiClient.get<{ offers: IntercitySlotOffer[] }>(
    '/api/v1/driver/intercity/available',
  );
  return data.offers;
}

export async function claimIntercitySlot(tripId: number): Promise<IntercityTrip> {
  const { data } = await apiClient.post<{ data: IntercityTrip }>(
    `/api/v1/driver/intercity/trips/${tripId}/claim`,
  );
  return data.data;
}

export async function getActiveIntercityTrip(): Promise<IntercityTrip | null> {
  try {
    const { data } = await apiClient.get<{ data: IntercityTrip }>(
      '/api/v1/driver/intercity/trips/active',
    );
    return data.data;
  } catch (e: unknown) {
    if ((e as { response?: { status?: number } }).response?.status === 404) {
      return null;
    }
    throw e;
  }
}

export async function closeIntercitySlot(tripId: number): Promise<IntercityTrip> {
  const { data } = await apiClient.post<{ data: IntercityTrip }>(
    `/api/v1/driver/intercity/trips/${tripId}/close`,
  );
  return data.data;
}

export async function startIntercityTrip(tripId: number): Promise<IntercityTrip> {
  const { data } = await apiClient.post<{ data: IntercityTrip }>(
    `/api/v1/driver/intercity/trips/${tripId}/start`,
  );
  return data.data;
}

export async function completeIntercityTrip(tripId: number): Promise<IntercityTrip> {
  const { data } = await apiClient.post<{ data: IntercityTrip }>(
    `/api/v1/driver/intercity/trips/${tripId}/complete`,
  );
  return data.data;
}

export async function cancelIntercityTrip(tripId: number): Promise<IntercityTrip> {
  const { data } = await apiClient.post<{ data: IntercityTrip }>(
    `/api/v1/driver/intercity/trips/${tripId}/cancel`,
  );
  return data.data;
}

export async function markPassengerNoShow(
  bookingId: number,
): Promise<{ id: number; status: string }> {
  const { data } = await apiClient.post<{ id: number; status: string }>(
    `/api/v1/driver/intercity/bookings/${bookingId}/no-show`,
  );
  return data;
}
