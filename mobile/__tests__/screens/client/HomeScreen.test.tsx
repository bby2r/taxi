jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef((props: any, ref: any) => (
    <View testID="map-view" ref={ref} {...props} />
  ));
  MapView.displayName = 'MapView';
  const Marker = (props: any) => <View {...props} />;
  return {
    __esModule: true,
    default: MapView,
    Marker,
  };
});

jest.mock('../../../src/hooks/useLocation', () => ({
  useLocation: jest.fn(() => ({
    latitude: 42.87,
    longitude: 74.59,
    heading: null,
    loading: false,
    error: null,
  })),
}));

jest.mock('../../../src/hooks/useOrder', () => ({
  useOrder: jest.fn(),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../../../src/screens/client/HomeScreen';
import { useOrder } from '../../../src/hooks/useOrder';
import type { Order, Driver } from '../../../src/api/types';

const mockedUseOrder = useOrder as jest.MockedFunction<typeof useOrder>;

const mockDriver: Driver = {
  name: 'Азамат',
  phone: '+996555111222',
  car_model: 'Toyota Camry',
  car_number: '01KG123ABC',
  latitude: 42.88,
  longitude: 74.60,
};

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

const defaultHookReturn = {
  state: { phase: 'idle' as const },
  callTaxi: jest.fn(),
  cancelOrder: jest.fn(),
  dismissCompleted: jest.fn(),
  loading: false,
  error: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseOrder.mockReturnValue(defaultHookReturn);
});

describe('HomeScreen', () => {
  it('renders map and bottom card in idle state', () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
    expect(getByText('80 сом')).toBeTruthy();
  });

  it('shows "Вызвать такси" button when idle', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Вызвать такси')).toBeTruthy();
  });

  it('shows "Ищем водителя..." when searching', () => {
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: { phase: 'searching', order: makeOrder() },
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Ищем водителя...')).toBeTruthy();
  });

  it('shows DriverCard when order accepted', () => {
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: {
        phase: 'accepted',
        order: makeOrder({ status: 'accepted', driver: mockDriver }),
      },
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Азамат')).toBeTruthy();
    expect(getByText('В пути к вам')).toBeTruthy();
  });

  it('shows "Водитель прибыл!" when driver arrived', () => {
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: {
        phase: 'arrived',
        order: makeOrder({ status: 'arrived', driver: mockDriver }),
      },
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Водитель прибыл!')).toBeTruthy();
  });

  it('shows completed modal with price', () => {
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: {
        phase: 'completed',
        order: makeOrder({ status: 'completed', price: 80, driver: mockDriver }),
      },
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Поездка завершена!')).toBeTruthy();
    expect(getByText('80 сом')).toBeTruthy();
  });

  it('shows cancelled toast', () => {
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: { phase: 'cancelled' },
    });

    const { getByText } = render(<HomeScreen />);
    expect(getByText('Заказ отменён')).toBeTruthy();
  });

  it('cancel button calls cancelOrder', () => {
    const cancelOrder = jest.fn();
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: { phase: 'searching', order: makeOrder() },
      cancelOrder,
    });

    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Отменить'));
    expect(cancelOrder).toHaveBeenCalledTimes(1);
  });

  it('"Готово" button returns to idle', () => {
    const dismissCompleted = jest.fn();
    mockedUseOrder.mockReturnValue({
      ...defaultHookReturn,
      state: {
        phase: 'completed',
        order: makeOrder({ status: 'completed', price: 80, driver: mockDriver }),
      },
      dismissCompleted,
    });

    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Готово'));
    expect(dismissCompleted).toHaveBeenCalledTimes(1);
  });
});
