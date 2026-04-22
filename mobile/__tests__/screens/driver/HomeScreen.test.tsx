jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 42.87, longitude: 74.59 },
  }),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: jest.fn() })),
}));

jest.mock('../../../src/hooks/useDriverOrder', () => ({
  useDriverOrder: jest.fn(),
}));

jest.mock('../../../src/hooks/useDriverLocation', () => ({
  useDriverLocation: jest.fn(() => null),
}));

jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 7, name: 'Азамат', phone: '+996555111222', role: 'driver' },
    logout: jest.fn(),
  })),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../../../src/screens/driver/HomeScreen';
import { useDriverOrder } from '../../../src/hooks/useDriverOrder';
import { useAuth } from '../../../src/context/AuthContext';
import type { Order } from '../../../src/api/types';

const mockedUseDriverOrder = useDriverOrder as jest.MockedFunction<typeof useDriverOrder>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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

const defaultHookReturn: ReturnType<typeof useDriverOrder> = {
  state: { phase: 'offline', order: null },
  isOnline: false,
  toggleOnline: jest.fn(),
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
  markArrived: jest.fn(),
  markCompleted: jest.fn(),
  dismissCompleted: jest.fn(),
  loading: false,
  error: null,
};

const mockLogout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseDriverOrder.mockReturnValue(defaultHookReturn);
  mockedUseAuth.mockReturnValue({
    user: { id: 7, name: 'Азамат', phone: '+996555111222', role: 'driver' },
    logout: mockLogout,
    isLoading: false,
    isAuthenticated: true,
    login: jest.fn(),
  });
});

describe('Driver HomeScreen', () => {
  it('shows offline toggle by default', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('OFF')).toBeTruthy();
    expect(getByText('Не на линии')).toBeTruthy();
  });

  it('shows online toggle after going online', () => {
    mockedUseDriverOrder.mockReturnValue({
      ...defaultHookReturn,
      state: { phase: 'online_idle', order: null },
      isOnline: true,
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('ON')).toBeTruthy();
    expect(getByText('На линии')).toBeTruthy();
  });

  it('shows "Ожидаем заказ..." when online', () => {
    mockedUseDriverOrder.mockReturnValue({
      ...defaultHookReturn,
      state: { phase: 'online_idle', order: null },
      isOnline: true,
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Ожидаем заказ...')).toBeTruthy();
  });

  it('shows OrderOfferCard when order offered', () => {
    const order = makeOrder();
    mockedUseDriverOrder.mockReturnValue({
      ...defaultHookReturn,
      state: { phase: 'offer', order },
      isOnline: true,
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('ул. Ленина 42')).toBeTruthy();
    expect(getByText('200 сом')).toBeTruthy();
    expect(getByText('Принять')).toBeTruthy();
    expect(getByText('Отказаться')).toBeTruthy();
  });

  it('shows driver name in header', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Привет, Азамат')).toBeTruthy();
  });

  it('logout button calls auth.logout', () => {
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Выйти'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
