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

export interface Order {
  id: number;
  status: OrderStatus;
  price: number;
  pickup_address: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  driver: Driver | null;
  created_at: string;
  accepted_at: string | null;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  role: 'client' | 'driver';
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

export interface DriverStats {
  today: { orders: number; earnings: number };
  week: { orders: number; earnings: number };
  month: { orders: number; earnings: number };
  total: { orders: number; earnings: number };
}
