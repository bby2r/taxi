import { apiClient } from '@taxi/shared';

export type IntercityOffer = {
  route_id: number;
  from_region: string;
  to_region: string;
  departure_date: string; // YYYY-MM-DD
  max_seats: number;
  price_per_seat: number;
  total_revenue: number;
  passengers_count: number;
};

export type IntercityTrip = {
  id: number;
  status: 'matched' | 'en_route' | 'completed' | 'cancelled';
  route?: { id: number; from_region: string; to_region: string };
  departure_date: string;
  max_seats: number;
  price_per_seat: number;
  total_revenue?: number;
  commission_amount?: number | null;
  passengers?: Array<{
    id: number;
    name: string | null;
    phone: string | null;
    seats_count: number;
    pickup_address: string | null;
    status: string;
  }>;
  accepted_at?: string | null;
  departed_at?: string | null;
  completed_at?: string | null;
};

export async function getAvailableIntercityOffers(): Promise<IntercityOffer[]> {
  const { data } = await apiClient.get<{ offers: IntercityOffer[] }>(
    '/api/v1/driver/intercity/available',
  );
  return data.offers;
}

export async function acceptIntercityOffer(
  route_id: number,
  departure_date: string,
): Promise<IntercityTrip> {
  const { data } = await apiClient.post<{ data: IntercityTrip }>(
    '/api/v1/driver/intercity/accept',
    { route_id, departure_date },
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
