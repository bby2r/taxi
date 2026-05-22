export type OrderStatus =
  | 'searching'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Driver {
  name: string;
  phone: string;
  car_model: string;
  car_number: string;
  latitude: number;
  longitude: number;
}

export type DeclineReason =
  | 'too_far'
  | 'wrong_district'
  | 'client_no_answer'
  | 'personal';

export type DriverCancellationReason =
  | 'client_no_show'
  | 'client_no_answer'
  | 'long_wait';

export interface OrderClient {
  id: number;
  name: string;
  phone: string;
}

export interface Order {
  id: number;
  status: OrderStatus;
  price: number;
  pickup_address: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  dropoff_address: string | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  client_comment: string | null;
  is_round_trip: boolean;
  is_inter_district: boolean;
  region: { id: number; name: string } | null;
  client: OrderClient;
  driver: Driver | null;
  created_at: string;
  accepted_at: string | null;
  cancelled_by: string | null;
  // Populated only on the freshly-offered order: ISO timestamp when the
  // server set offered_driver_id, ETA in minutes from offered driver to
  // pickup, and the distance used to compute it. Driver app uses these
  // to sync its in-card countdown with the server-side OfferTimeoutJob
  // and to show "~N мин до клиента" on the offer card.
  offered_at?: string | null;
  eta_minutes?: number;
  distance_km?: number;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  role: 'client' | 'driver';
  has_push_token?: boolean;
  // Driver-only — server returns it from /auth/me when role is driver, so
  // the driver app can restore its "online" state on cold start instead
  // of waiting for the user to manually toggle the switch again.
  is_online?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface Region {
  id: number;
  name: string;
  price: number;
}

export interface DriverStats {
  today: { orders: number; earnings: number };
  week: { orders: number; earnings: number };
  month: { orders: number; earnings: number };
  total: { orders: number; earnings: number };
}

export interface DriverPeriodEarnings {
  orders: number;
  earnings: number;
  commission: number;
}

export interface DriverSettlement {
  id: number;
  amount: number;
  paid_at: string;
  notes: string | null;
}

export interface DriverBalance {
  today: DriverPeriodEarnings;
  week: DriverPeriodEarnings;
  month: DriverPeriodEarnings;
  total: DriverPeriodEarnings;
  balance: number;
  last_settlement_at: string | null;
  recent_settlements: DriverSettlement[];
}

export interface DriverProfile {
  id: number;
  name: string;
  phone: string;
  car_model: string;
  car_number: string;
}

export interface DriverChangeRequest {
  id: number;
  field: string;
  old_value: string;
  new_value: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
}
