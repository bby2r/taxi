jest.mock('../../src/utils/storage', () => ({
  getToken: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../src/api/client', () => {
  const mockClient = {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    defaults: { baseURL: '', headers: {} },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: mockClient,
    setOnUnauthorized: jest.fn(),
  };
});

import apiClient from '../../src/api/client';
import {
  goOnline,
  goOffline,
  updateLocation,
  acceptOrder,
  declineOrder,
  arriveAtPickup,
  completeOrder,
  getCurrentDriverOrder,
  getDriverStats,
} from '../../src/api/driver';

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('goOnline', () => {
  it('calls POST /api/v1/driver/go-online with coordinates', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await goOnline(42.87, 74.59);
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/go-online', {
      latitude: 42.87,
      longitude: 74.59,
    });
  });
});

describe('goOffline', () => {
  it('calls POST /api/v1/driver/go-offline', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await goOffline();
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/go-offline');
  });
});

describe('updateLocation', () => {
  it('includes heading when provided', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await updateLocation(42.87, 74.59, 180);
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/location', {
      latitude: 42.87,
      longitude: 74.59,
      heading: 180,
    });
  });

  it('omits heading when null', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await updateLocation(42.87, 74.59, null);
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/location', {
      latitude: 42.87,
      longitude: 74.59,
    });
  });

  it('omits heading when undefined', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await updateLocation(42.87, 74.59);
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/location', {
      latitude: 42.87,
      longitude: 74.59,
    });
  });
});

describe('acceptOrder', () => {
  it('returns parsed order', async () => {
    const order = {
      id: 1,
      status: 'accepted',
      price: 200,
      pickup_address: 'Test St',
      pickup_latitude: 42.87,
      pickup_longitude: 74.59,
      driver: null,
      created_at: '2026-01-01T00:00:00Z',
      accepted_at: '2026-01-01T00:01:00Z',
    };
    mockedClient.post.mockResolvedValue({ data: { data: order } });

    const result = await acceptOrder(1);

    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/orders/1/accept');
    expect(result).toEqual(order);
  });
});

describe('declineOrder', () => {
  it('calls correct endpoint with reason', async () => {
    mockedClient.post.mockResolvedValue({ data: null });
    await declineOrder(5, 'too_far');
    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/orders/5/decline', {
      reason: 'too_far',
    });
  });
});

describe('arriveAtPickup', () => {
  it('returns updated order', async () => {
    const order = {
      id: 2,
      status: 'arrived',
      price: 300,
      pickup_address: null,
      pickup_latitude: 42.87,
      pickup_longitude: 74.59,
      driver: null,
      created_at: '2026-01-01T00:00:00Z',
      accepted_at: '2026-01-01T00:01:00Z',
    };
    mockedClient.post.mockResolvedValue({ data: { data: order } });

    const result = await arriveAtPickup(2);

    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/orders/2/arrived');
    expect(result).toEqual(order);
  });
});

describe('completeOrder', () => {
  it('returns updated order', async () => {
    const order = {
      id: 3,
      status: 'completed',
      price: 400,
      pickup_address: 'End St',
      pickup_latitude: 42.87,
      pickup_longitude: 74.59,
      driver: null,
      created_at: '2026-01-01T00:00:00Z',
      accepted_at: '2026-01-01T00:01:00Z',
    };
    mockedClient.post.mockResolvedValue({ data: { data: order } });

    const result = await completeOrder(3);

    expect(mockedClient.post).toHaveBeenCalledWith('/api/v1/driver/orders/3/complete');
    expect(result).toEqual(order);
  });
});

describe('getCurrentDriverOrder', () => {
  it('returns order when found', async () => {
    const order = {
      id: 10,
      status: 'in_progress',
      price: 500,
      pickup_address: 'Pickup St',
      pickup_latitude: 42.87,
      pickup_longitude: 74.59,
      driver: null,
      created_at: '2026-01-01T00:00:00Z',
      accepted_at: '2026-01-01T00:01:00Z',
    };
    mockedClient.get.mockResolvedValue({ data: { data: order } });

    const result = await getCurrentDriverOrder();

    expect(mockedClient.get).toHaveBeenCalledWith('/api/v1/driver/orders/active');
    expect(result).toEqual(order);
  });

  it('returns null on 404', async () => {
    mockedClient.get.mockRejectedValue({ response: { status: 404 } });

    const result = await getCurrentDriverOrder();

    expect(result).toBeNull();
  });

  it('rethrows non-404 errors', async () => {
    mockedClient.get.mockRejectedValue({ response: { status: 500 } });

    await expect(getCurrentDriverOrder()).rejects.toEqual({ response: { status: 500 } });
  });
});

describe('getDriverStats', () => {
  it('returns parsed stats', async () => {
    const stats = {
      today: { orders: 5, earnings: 1000 },
      week: { orders: 20, earnings: 5000 },
      month: { orders: 80, earnings: 20000 },
      total: { orders: 300, earnings: 100000 },
    };
    mockedClient.get.mockResolvedValue({ data: { data: stats } });

    const result = await getDriverStats();

    expect(mockedClient.get).toHaveBeenCalledWith('/api/v1/driver/stats');
    expect(result).toEqual(stats);
  });
});
