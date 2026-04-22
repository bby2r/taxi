jest.mock('../../src/api/orders', () => ({
  createOrder: jest.fn(),
  getCurrentOrder: jest.fn(),
  getOrder: jest.fn(),
  cancelOrder: jest.fn(),
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 1 } })),
}));

jest.mock('../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue('test-token'),
}));

let capturedPusherOptions: any = null;
jest.mock('../../src/hooks/usePusher', () => ({
  usePusher: jest.fn((options: any) => {
    capturedPusherOptions = options;
  }),
}));

import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as ordersApi from '../../src/api/orders';
import { useOrder } from '../../src/hooks/useOrder';
import type { Order } from '../../src/api/types';

const mockedCreateOrder = ordersApi.createOrder as jest.MockedFunction<typeof ordersApi.createOrder>;
const mockedGetCurrentOrder = ordersApi.getCurrentOrder as jest.MockedFunction<typeof ordersApi.getCurrentOrder>;
const mockedGetOrder = ordersApi.getOrder as jest.MockedFunction<typeof ordersApi.getOrder>;
const mockedCancelOrder = ordersApi.cancelOrder as jest.MockedFunction<typeof ordersApi.cancelOrder>;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    status: 'searching',
    price: 80,
    pickup_address: null,
    pickup_latitude: 42.87,
    pickup_longitude: 74.59,
    dropoff_address: null,
    dropoff_latitude: null,
    dropoff_longitude: null,
    is_inter_district: false,
    region: null,
    driver: null,
    created_at: '2026-04-07T10:00:00Z',
    accepted_at: null,
    cancelled_by: null,
    ...overrides,
  };
}

const driverData = {
  name: 'Азамат',
  phone: '+996555111222',
  car_model: 'Toyota Camry',
  car_number: '01KG123ABC',
  latitude: 42.88,
  longitude: 74.60,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  capturedPusherOptions = null;
  mockedGetCurrentOrder.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useOrder', () => {
  it('initial state is idle', async () => {
    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.state.phase).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('callTaxi transitions to searching phase', async () => {
    const order = makeOrder();
    mockedCreateOrder.mockResolvedValue(order);

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59, 'ул. Ленина');
    });

    expect(mockedCreateOrder).toHaveBeenCalledWith(42.87, 74.59, 'ул. Ленина');
    expect(result.current.state.phase).toBe('searching');
    if (result.current.state.phase === 'searching') {
      expect(result.current.state.order.id).toBe(1);
    }
  });

  it('handles OrderAccepted event -> accepted phase with driver data', async () => {
    const order = makeOrder();
    mockedCreateOrder.mockResolvedValue(order);

    const acceptedOrder = makeOrder({
      status: 'accepted',
      driver: driverData,
      accepted_at: '2026-04-07T10:01:00Z',
    });
    mockedGetOrder.mockResolvedValue(acceptedOrder);

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59);
    });

    expect(result.current.state.phase).toBe('searching');

    // Simulate Pusher event
    await act(async () => {
      capturedPusherOptions.events['order.accepted']({});
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('accepted');
    });

    if (result.current.state.phase === 'accepted') {
      expect(result.current.state.order.driver?.name).toBe('Азамат');
    }
  });

  it('handles DriverArrived event -> arrived phase', async () => {
    const order = makeOrder();
    mockedCreateOrder.mockResolvedValue(order);

    const arrivedOrder = makeOrder({
      status: 'arrived',
      driver: driverData,
    });
    mockedGetOrder.mockResolvedValue(arrivedOrder);

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.driver_arrived']({});
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('arrived');
    });
  });

  it('handles OrderCompleted event -> completed phase', async () => {
    const order = makeOrder();
    mockedCreateOrder.mockResolvedValue(order);

    const completedOrder = makeOrder({
      status: 'completed',
      price: 80,
      driver: driverData,
    });
    mockedGetOrder.mockResolvedValue(completedOrder);

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.completed']({});
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('completed');
    });

    if (result.current.state.phase === 'completed') {
      expect(result.current.state.order.price).toBe(80);
    }
  });

  it('handles OrderCancelled event -> cancelled phase, auto-clears to idle after 3s', async () => {
    const order = makeOrder();
    mockedCreateOrder.mockResolvedValue(order);

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.cancelled']({});
    });

    expect(result.current.state.phase).toBe('cancelled');

    // After 3 seconds, should auto-clear to idle
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.state.phase).toBe('idle');
  });

  it('cancelOrder calls API and transitions to cancelled', async () => {
    const order = makeOrder();
    mockedCreateOrder.mockResolvedValue(order);
    mockedCancelOrder.mockResolvedValue(makeOrder({ status: 'cancelled' }));

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59);
    });

    await act(async () => {
      await result.current.cancelOrder();
    });

    expect(mockedCancelOrder).toHaveBeenCalledWith(1);
    expect(result.current.state.phase).toBe('cancelled');

    // Auto-clears to idle after 3s
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.state.phase).toBe('idle');
  });

  it('restores current order on mount', async () => {
    const activeOrder = makeOrder({
      status: 'accepted',
      driver: driverData,
    });
    mockedGetCurrentOrder.mockResolvedValue(activeOrder);

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('accepted');
    });

    if (result.current.state.phase === 'accepted') {
      expect(result.current.state.order.driver?.name).toBe('Азамат');
    }
  });

  it('error state set on API failure', async () => {
    mockedCreateOrder.mockRejectedValue({
      response: { data: { message: 'Сервер недоступен' } },
    });

    const { result } = renderHook(() => useOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('idle');
    });

    await act(async () => {
      await result.current.callTaxi(42.87, 74.59);
    });

    expect(result.current.state.phase).toBe('idle');
    expect(result.current.error).toBe('Сервер недоступен');
  });
});
