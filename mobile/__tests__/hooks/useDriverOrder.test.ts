jest.mock('../../src/api/driver', () => ({
  goOnline: jest.fn(),
  goOffline: jest.fn(),
  acceptOrder: jest.fn(),
  declineOrder: jest.fn(),
  arriveAtPickup: jest.fn(),
  completeOrder: jest.fn(),
  getCurrentDriverOrder: jest.fn(),
}));

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({ user: { id: 7, name: 'Азамат', phone: '+996555111222', role: 'driver' } })),
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
import * as driverApi from '../../src/api/driver';
import { useDriverOrder } from '../../src/hooks/useDriverOrder';
import type { Order } from '../../src/api/types';

const mockedGoOnline = driverApi.goOnline as jest.MockedFunction<typeof driverApi.goOnline>;
const mockedGoOffline = driverApi.goOffline as jest.MockedFunction<typeof driverApi.goOffline>;
const mockedAcceptOrder = driverApi.acceptOrder as jest.MockedFunction<typeof driverApi.acceptOrder>;
const mockedDeclineOrder = driverApi.declineOrder as jest.MockedFunction<typeof driverApi.declineOrder>;
const mockedArriveAtPickup = driverApi.arriveAtPickup as jest.MockedFunction<typeof driverApi.arriveAtPickup>;
const mockedCompleteOrder = driverApi.completeOrder as jest.MockedFunction<typeof driverApi.completeOrder>;
const mockedGetCurrentDriverOrder = driverApi.getCurrentDriverOrder as jest.MockedFunction<typeof driverApi.getCurrentDriverOrder>;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 10,
    status: 'searching',
    price: 200,
    pickup_address: 'ул. Ленина 42',
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

beforeEach(() => {
  jest.clearAllMocks();
  capturedPusherOptions = null;
  mockedGetCurrentDriverOrder.mockResolvedValue(null);
  mockedGoOnline.mockResolvedValue(undefined);
  mockedGoOffline.mockResolvedValue(undefined);
  mockedDeclineOrder.mockResolvedValue(undefined);
});

describe('useDriverOrder', () => {
  it('initial state is offline', async () => {
    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.state.phase).toBe('offline');
    expect(result.current.isOnline).toBe(false);
  });

  it('toggleOnline transitions to online_idle', async () => {
    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    expect(mockedGoOnline).toHaveBeenCalledWith(42.87, 74.59);
    expect(result.current.state.phase).toBe('online_idle');
    expect(result.current.isOnline).toBe(true);
  });

  it('toggleOnline again transitions to offline', async () => {
    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    expect(result.current.state.phase).toBe('online_idle');

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    expect(mockedGoOffline).toHaveBeenCalled();
    expect(result.current.state.phase).toBe('offline');
    expect(result.current.isOnline).toBe(false);
  });

  it('handles order.offered event -> offer phase', async () => {
    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    expect(result.current.state.phase).toBe('online_idle');

    const order = makeOrder({ status: 'searching' });

    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order });
    });

    expect(result.current.state.phase).toBe('offer');
    if (result.current.state.phase === 'offer') {
      expect(result.current.state.order.id).toBe(10);
    }
  });

  it('acceptOffer transitions to active phase', async () => {
    const acceptedOrder = makeOrder({ status: 'accepted' });
    mockedAcceptOrder.mockResolvedValue(acceptedOrder);

    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    // Go online
    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    // Simulate offer
    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order: makeOrder() });
    });

    expect(result.current.state.phase).toBe('offer');

    // Accept
    await act(async () => {
      await result.current.acceptOffer();
    });

    expect(mockedAcceptOrder).toHaveBeenCalledWith(10);
    expect(result.current.state.phase).toBe('active');
  });

  it('declineOffer returns to online_idle', async () => {
    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order: makeOrder() });
    });

    expect(result.current.state.phase).toBe('offer');

    await act(async () => {
      await result.current.declineOffer('too_far');
    });

    expect(mockedDeclineOrder).toHaveBeenCalledWith(10, 'too_far');
    expect(result.current.state.phase).toBe('online_idle');
  });

  it('handles order.cancelled event during active -> online_idle', async () => {
    const acceptedOrder = makeOrder({ status: 'accepted' });
    mockedAcceptOrder.mockResolvedValue(acceptedOrder);

    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order: makeOrder() });
    });

    await act(async () => {
      await result.current.acceptOffer();
    });

    expect(result.current.state.phase).toBe('active');

    await act(async () => {
      capturedPusherOptions.events['order.cancelled']({});
    });

    expect(result.current.state.phase).toBe('online_idle');
  });

  it('markArrived transitions to arrived phase', async () => {
    const acceptedOrder = makeOrder({ status: 'accepted' });
    const arrivedOrder = makeOrder({ status: 'arrived' });
    mockedAcceptOrder.mockResolvedValue(acceptedOrder);
    mockedArriveAtPickup.mockResolvedValue(arrivedOrder);

    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order: makeOrder() });
    });

    await act(async () => {
      await result.current.acceptOffer();
    });

    expect(result.current.state.phase).toBe('active');

    await act(async () => {
      await result.current.markArrived();
    });

    expect(mockedArriveAtPickup).toHaveBeenCalledWith(10);
    expect(result.current.state.phase).toBe('arrived');
  });

  it('markCompleted transitions to completed phase', async () => {
    const acceptedOrder = makeOrder({ status: 'accepted' });
    const arrivedOrder = makeOrder({ status: 'arrived' });
    const completedOrder = makeOrder({ status: 'completed' });
    mockedAcceptOrder.mockResolvedValue(acceptedOrder);
    mockedArriveAtPickup.mockResolvedValue(arrivedOrder);
    mockedCompleteOrder.mockResolvedValue(completedOrder);

    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order: makeOrder() });
    });

    await act(async () => {
      await result.current.acceptOffer();
    });

    await act(async () => {
      await result.current.markArrived();
    });

    expect(result.current.state.phase).toBe('arrived');

    await act(async () => {
      await result.current.markCompleted();
    });

    expect(mockedCompleteOrder).toHaveBeenCalledWith(10);
    expect(result.current.state.phase).toBe('completed');
  });

  it('dismissCompleted returns to online_idle', async () => {
    const acceptedOrder = makeOrder({ status: 'accepted' });
    const arrivedOrder = makeOrder({ status: 'arrived' });
    const completedOrder = makeOrder({ status: 'completed' });
    mockedAcceptOrder.mockResolvedValue(acceptedOrder);
    mockedArriveAtPickup.mockResolvedValue(arrivedOrder);
    mockedCompleteOrder.mockResolvedValue(completedOrder);

    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('offline');
    });

    await act(async () => {
      await result.current.toggleOnline(42.87, 74.59);
    });

    await act(async () => {
      capturedPusherOptions.events['order.offered']({ order: makeOrder() });
    });

    await act(async () => {
      await result.current.acceptOffer();
    });

    await act(async () => {
      await result.current.markArrived();
    });

    await act(async () => {
      await result.current.markCompleted();
    });

    expect(result.current.state.phase).toBe('completed');

    act(() => {
      result.current.dismissCompleted();
    });

    expect(result.current.state.phase).toBe('online_idle');
  });

  it('restores active order on mount', async () => {
    const activeOrder = makeOrder({ status: 'accepted' });
    mockedGetCurrentDriverOrder.mockResolvedValue(activeOrder);

    const { result } = renderHook(() => useDriverOrder());

    await waitFor(() => {
      expect(result.current.state.phase).toBe('active');
    });

    if (result.current.state.phase === 'active') {
      expect(result.current.state.order.id).toBe(10);
    }
  });
});
