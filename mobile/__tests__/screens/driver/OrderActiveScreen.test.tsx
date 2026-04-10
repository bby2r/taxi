const mockFitToCoordinates = jest.fn();

jest.mock('react-native-maps', () => {
  const RN = require('react-native');
  const RealReact = require('react');
  const MockMapView = RealReact.forwardRef((props: any, ref: any) => {
    RealReact.useImperativeHandle(ref, () => ({
      fitToCoordinates: mockFitToCoordinates,
    }));
    return RealReact.createElement(RN.View, { ...props, testID: 'map-view' });
  });
  MockMapView.displayName = 'MapView';
  const MockMarker = (props: any) =>
    RealReact.createElement(RN.View, { ...props, testID: props.testID || 'map-marker' });
  MockMarker.displayName = 'Marker';
  const MockPolyline = (props: any) =>
    RealReact.createElement(RN.View, { ...props, testID: props.testID || 'map-polyline' });
  MockPolyline.displayName = 'Polyline';
  return {
    __esModule: true,
    default: MockMapView,
    Marker: MockMarker,
    Polyline: MockPolyline,
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ goBack: mockGoBack })),
}));

jest.mock('../../../src/hooks/useDriverOrder', () => ({
  useDriverOrder: jest.fn(),
}));

jest.mock('../../../src/hooks/useLocation', () => ({
  useLocation: jest.fn(),
}));

jest.mock('../../../src/hooks/useRoute', () => ({
  useRoute: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import OrderActiveScreen from '../../../src/screens/driver/OrderActiveScreen';
import { useDriverOrder } from '../../../src/hooks/useDriverOrder';
import { useLocation } from '../../../src/hooks/useLocation';
import { useRoute } from '../../../src/hooks/useRoute';
import type { Order } from '../../../src/api/types';

const mockedUseDriverOrder = useDriverOrder as jest.MockedFunction<typeof useDriverOrder>;
const mockedUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockedUseRoute = useRoute as jest.MockedFunction<typeof useRoute>;
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
  mockedUseLocation.mockReturnValue({
    latitude: 42.86,
    longitude: 74.58,
    heading: null,
    loading: false,
    error: null,
  });
  mockedUseRoute.mockReturnValue({
    route: {
      coordinates: [
        { latitude: 42.86, longitude: 74.58 },
        { latitude: 42.865, longitude: 74.585 },
        { latitude: 42.87, longitude: 74.59 },
      ],
      distanceMeters: 1500,
      durationSeconds: 240,
    },
    loading: false,
    error: null,
  });
});

describe('OrderActiveScreen', () => {
  it('renders map with pickup marker', () => {
    const { getByTestId } = render(<OrderActiveScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
    expect(getByTestId('map-marker')).toBeTruthy();
  });

  it('renders polyline and driver marker when route is available', () => {
    const { getByTestId } = render(<OrderActiveScreen />);
    expect(getByTestId('route-polyline')).toBeTruthy();
    expect(getByTestId('driver-marker')).toBeTruthy();
  });

  it('shows ETA and distance when route is available', () => {
    const { getByTestId } = render(<OrderActiveScreen />);
    expect(getByTestId('route-eta').props.children).toBe('4 мин');
    expect(getByTestId('route-distance').props.children).toBe('1.5 км');
  });

  it('passes driver + pickup to useRoute while en-route', () => {
    render(<OrderActiveScreen />);
    expect(mockedUseRoute).toHaveBeenCalledWith(
      { latitude: 42.86, longitude: 74.58 },
      { latitude: 42.87, longitude: 74.59 },
    );
  });

  it('does not request a route while in arrived phase', () => {
    mockedUseDriverOrder.mockReturnValue({
      ...baseHookReturn,
      state: { phase: 'arrived', order: { ...mockOrder, status: 'arrived' } },
    });
    render(<OrderActiveScreen />);
    expect(mockedUseRoute).toHaveBeenCalledWith(null, null);
  });

  it('shows loading placeholder while route is being built', () => {
    mockedUseRoute.mockReturnValue({
      route: null,
      loading: true,
      error: null,
    });
    const { getByTestId, queryByTestId } = render(<OrderActiveScreen />);
    expect(getByTestId('route-loading')).toBeTruthy();
    expect(queryByTestId('route-polyline')).toBeNull();
  });

  it('shows error hint when route fetch fails', () => {
    mockedUseRoute.mockReturnValue({
      route: null,
      loading: false,
      error: 'Routing request failed: 503',
    });
    const { getByTestId } = render(<OrderActiveScreen />);
    expect(getByTestId('route-error')).toBeTruthy();
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
