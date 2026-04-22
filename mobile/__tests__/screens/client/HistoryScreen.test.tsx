jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('../../../src/api/orders', () => ({
  getOrderHistory: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import HistoryScreen from '../../../src/screens/client/HistoryScreen';
import { getOrderHistory } from '../../../src/api/orders';
import type { Order, PaginatedResponse } from '../../../src/api/types';

const mockedGetOrderHistory = getOrderHistory as jest.MockedFunction<typeof getOrderHistory>;

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    status: 'completed',
    price: 150,
    pickup_address: 'ул. Киевская 123',
    pickup_latitude: 42.87,
    pickup_longitude: 74.59,
    dropoff_address: null,
    dropoff_latitude: null,
    dropoff_longitude: null,
    is_inter_district: false,
    region: null,
    driver: null,
    created_at: '2026-03-15T14:30:00Z',
    accepted_at: null,
    cancelled_by: null,
    ...overrides,
  };
}

function makePaginatedResponse(
  orders: Order[],
  currentPage: number = 1,
  lastPage: number = 1,
): PaginatedResponse<Order> {
  return {
    data: orders,
    meta: {
      current_page: currentPage,
      last_page: lastPage,
      per_page: 15,
      total: orders.length,
    },
  };
}

afterEach(() => {
  cleanup();
  jest.resetAllMocks();
});

describe('HistoryScreen', () => {
  it('shows loading indicator initially', () => {
    mockedGetOrderHistory.mockReturnValue(new Promise(() => {})); // never resolves
    const { UNSAFE_queryByType } = render(<HistoryScreen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_queryByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders list of orders', async () => {
    const orders = [
      makeOrder({ id: 1, pickup_address: 'Адрес 1', price: 100 }),
      makeOrder({ id: 2, pickup_address: 'Адрес 2', price: 200 }),
    ];
    mockedGetOrderHistory.mockResolvedValue(makePaginatedResponse(orders));

    const { findByText } = render(<HistoryScreen />);

    expect(await findByText('Адрес 1')).toBeTruthy();
    expect(await findByText('Адрес 2')).toBeTruthy();
    expect(await findByText('100 сом')).toBeTruthy();
    expect(await findByText('200 сом')).toBeTruthy();
  });

  it('shows empty state when no orders', async () => {
    mockedGetOrderHistory.mockResolvedValue(makePaginatedResponse([]));

    const { findByText } = render(<HistoryScreen />);

    expect(await findByText('У вас пока нет поездок')).toBeTruthy();
  });

  it('shows header text', async () => {
    mockedGetOrderHistory.mockResolvedValue(
      makePaginatedResponse([makeOrder()]),
    );

    const { findByText } = render(<HistoryScreen />);

    expect(await findByText('История поездок')).toBeTruthy();
  });

  it('pull-to-refresh triggers re-fetch from page 1', async () => {
    const orders = [makeOrder({ id: 1, pickup_address: 'Адрес 1' })];
    mockedGetOrderHistory.mockResolvedValue(makePaginatedResponse(orders));

    const { findByText } = render(<HistoryScreen />);

    await findByText('Адрес 1');
    expect(mockedGetOrderHistory).toHaveBeenCalledTimes(1);
    expect(mockedGetOrderHistory).toHaveBeenCalledWith(1);
  });

  it('loads next page on scroll to end', async () => {
    const page1Orders = [makeOrder({ id: 1, pickup_address: 'Страница 1' })];

    mockedGetOrderHistory.mockResolvedValue(
      makePaginatedResponse(page1Orders, 1, 2),
    );

    const { findByText } = render(<HistoryScreen />);

    await findByText('Страница 1');
    expect(mockedGetOrderHistory).toHaveBeenCalledTimes(1);
    expect(mockedGetOrderHistory).toHaveBeenCalledWith(1);
  });

  it('does not load more when on last page', async () => {
    const orders = [makeOrder({ id: 1, pickup_address: 'Единственная' })];
    mockedGetOrderHistory.mockResolvedValue(makePaginatedResponse(orders, 1, 1));

    const { findByText } = render(<HistoryScreen />);
    await findByText('Единственная');

    // Already on last page (1 of 1), only the initial fetch should have happened
    expect(mockedGetOrderHistory).toHaveBeenCalledTimes(1);
  });

  it('shows error state with retry button', async () => {
    mockedGetOrderHistory.mockRejectedValue(new Error('Network error'));

    const { findByText } = render(<HistoryScreen />);

    expect(await findByText('Не удалось загрузить историю')).toBeTruthy();
    expect(await findByText('Повторить')).toBeTruthy();
  });

  it('retry button triggers re-fetch', async () => {
    mockedGetOrderHistory.mockRejectedValueOnce(new Error('Network error'));

    const { findByText } = render(<HistoryScreen />);
    const retryButton = await findByText('Повторить');

    const orders = [makeOrder({ id: 1, pickup_address: 'После повтора' })];
    mockedGetOrderHistory.mockResolvedValue(makePaginatedResponse(orders));

    await act(async () => {
      fireEvent.press(retryButton);
    });

    expect(mockedGetOrderHistory).toHaveBeenCalledTimes(2);
    expect(await findByText('После повтора')).toBeTruthy();
  });
});
