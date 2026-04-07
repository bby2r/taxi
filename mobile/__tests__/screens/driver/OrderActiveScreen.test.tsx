jest.mock('react-native-maps', () => {
  const RN = require('react-native');
  const RealReact = require('react');
  const MockMapView = RealReact.forwardRef((props: any, ref: any) => {
    RealReact.useImperativeHandle(ref, () => ({
      fitToCoordinates: jest.fn(),
    }));
    return RealReact.createElement(RN.View, { ...props, testID: 'map-view' });
  });
  MockMapView.displayName = 'MapView';
  const MockMarker = (props: any) =>
    RealReact.createElement(RN.View, { ...props, testID: 'map-marker' });
  MockMarker.displayName = 'Marker';
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ goBack: mockGoBack })),
}));

jest.mock('../../../src/hooks/useDriverOrder', () => ({
  useDriverOrder: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import OrderActiveScreen from '../../../src/screens/driver/OrderActiveScreen';
import { useDriverOrder } from '../../../src/hooks/useDriverOrder';
import type { Order } from '../../../src/api/types';

const mockedUseDriverOrder = useDriverOrder as jest.MockedFunction<typeof useDriverOrder>;
const mockGoBack = jest.fn();

const mockOrder: Order = {
  id: 1,
  status: 'accepted',
  price: 80,
  pickup_address: 'ул. Ленина 5',
  pickup_latitude: 42.87,
  pickup_longitude: 74.59,
  driver: null,
  created_at: '2026-04-07T10:00:00Z',
  accepted_at: '2026-04-07T10:01:00Z',
};

const baseHookReturn: ReturnType<typeof useDriverOrder> = {
  state: { phase: 'active', order: mockOrder },
  isOnline: true,
  toggleOnline: jest.fn(),
  acceptOffer: jest.fn(),
  declineOffer: jest.fn(),
  markArrived: jest.fn(),
  markCompleted: jest.fn(),
  dismissCompleted: jest.fn(),
  loading: false,
  error: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseDriverOrder.mockReturnValue(baseHookReturn);
});

describe('OrderActiveScreen', () => {
  it('renders map with pickup marker', () => {
    const { getByTestId } = render(<OrderActiveScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
    expect(getByTestId('map-marker')).toBeTruthy();
  });

  it('shows pickup address in active phase', () => {
    const { getByText } = render(<OrderActiveScreen />);
    expect(getByText('ул. Ленина 5')).toBeTruthy();
  });

  it('shows "Я на месте" button in active phase', () => {
    const { getByText } = render(<OrderActiveScreen />);
    expect(getByText('Я на месте')).toBeTruthy();
  });

  it('"Я на месте" calls markArrived', () => {
    const markArrived = jest.fn();
    mockedUseDriverOrder.mockReturnValue({
      ...baseHookReturn,
      markArrived,
    });

    const { getByText } = render(<OrderActiveScreen />);
    fireEvent.press(getByText('Я на месте'));
    expect(markArrived).toHaveBeenCalledTimes(1);
  });

  it('shows "Вы на месте" and "Завершить поездку" in arrived phase', () => {
    mockedUseDriverOrder.mockReturnValue({
      ...baseHookReturn,
      state: { phase: 'arrived', order: { ...mockOrder, status: 'arrived' } },
    });

    const { getByText } = render(<OrderActiveScreen />);
    expect(getByText(/Вы на месте/)).toBeTruthy();
    expect(getByText('Завершить поездку')).toBeTruthy();
  });

  it('"Завершить поездку" calls markCompleted', () => {
    const markCompleted = jest.fn();
    mockedUseDriverOrder.mockReturnValue({
      ...baseHookReturn,
      state: { phase: 'arrived', order: { ...mockOrder, status: 'arrived' } },
      markCompleted,
    });

    const { getByText } = render(<OrderActiveScreen />);
    fireEvent.press(getByText('Завершить поездку'));
    expect(markCompleted).toHaveBeenCalledTimes(1);
  });

  it('shows completed card with price', () => {
    mockedUseDriverOrder.mockReturnValue({
      ...baseHookReturn,
      state: { phase: 'completed', order: { ...mockOrder, status: 'completed' } },
    });

    const { getByText } = render(<OrderActiveScreen />);
    expect(getByText('Заказ завершён!')).toBeTruthy();
    expect(getByText('+ 80 сом')).toBeTruthy();
  });

  it('"Готово" dismisses and returns to home', () => {
    const dismissCompleted = jest.fn();
    mockedUseDriverOrder.mockReturnValue({
      ...baseHookReturn,
      state: { phase: 'completed', order: { ...mockOrder, status: 'completed' } },
      dismissCompleted,
    });

    const { getByText } = render(<OrderActiveScreen />);
    fireEvent.press(getByText('Готово'));
    expect(dismissCompleted).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('"Навигация" button calls Linking.openURL with correct URL', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
    const originalSelect = Platform.select;
    Platform.select = jest.fn((options: any) => options.ios) as any;

    const { getByLabelText } = render(<OrderActiveScreen />);
    fireEvent.press(getByLabelText('Навигация'));

    expect(openURLSpy).toHaveBeenCalledWith(
      'maps://app?daddr=42.87,74.59&dirflg=d'
    );

    Platform.select = originalSelect;
    openURLSpy.mockRestore();
  });
});
