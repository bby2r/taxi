jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    SafeAreaProvider: ({ children }: any) => <>{children}</>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('../../../src/api/driver', () => ({
  getDriverStats: jest.fn(),
}));

import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import StatsScreen from '../../../src/screens/driver/StatsScreen';
import { getDriverStats } from '../../../src/api/driver';
import type { DriverStats } from '../../../src/api/types';

const mockedGetDriverStats = getDriverStats as jest.MockedFunction<typeof getDriverStats>;

const mockStats: DriverStats = {
  today: { orders: 5, earnings: 1200 },
  week: { orders: 22, earnings: 5400 },
  month: { orders: 80, earnings: 18000 },
  total: { orders: 350, earnings: 75000 },
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('Driver StatsScreen', () => {
  it('shows loading indicator initially', () => {
    mockedGetDriverStats.mockReturnValue(new Promise(() => {})); // never resolves
    const { queryByText } = render(<StatsScreen />);

    expect(queryByText('Сегодня')).toBeNull();
    expect(queryByText('Статистика')).toBeNull();
  });

  it('renders 4 stat cards after fetch', async () => {
    mockedGetDriverStats.mockResolvedValueOnce(mockStats);

    const { getByText } = render(<StatsScreen />);

    await waitFor(() => {
      expect(getByText('Сегодня')).toBeTruthy();
    });

    expect(getByText('Неделя')).toBeTruthy();
    expect(getByText('Месяц')).toBeTruthy();
    expect(getByText('Всего')).toBeTruthy();

    expect(getByText('1200 сом')).toBeTruthy();
    expect(getByText('5400 сом')).toBeTruthy();
    expect(getByText('18000 сом')).toBeTruthy();
    expect(getByText('75000 сом')).toBeTruthy();
  });

  it('pull-to-refresh triggers re-fetch', async () => {
    mockedGetDriverStats.mockResolvedValueOnce(mockStats);

    const screen = render(<StatsScreen />);

    await waitFor(() => {
      expect(screen.getByText('Сегодня')).toBeTruthy();
    });

    expect(mockedGetDriverStats).toHaveBeenCalledTimes(1);

    const updatedStats: DriverStats = {
      ...mockStats,
      today: { orders: 6, earnings: 1400 },
    };
    mockedGetDriverStats.mockResolvedValueOnce(updatedStats);

    // Trigger onRefresh via the RefreshControl
    const refreshControl = screen.UNSAFE_getByType(RefreshControl);
    fireEvent(refreshControl, 'refresh');

    await waitFor(() => {
      expect(mockedGetDriverStats).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText('1400 сом')).toBeTruthy();
    });
  });

  it('shows error message and retry button on failure', async () => {
    mockedGetDriverStats.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<StatsScreen />);

    await waitFor(() => {
      expect(getByText('Не удалось загрузить статистику')).toBeTruthy();
    });

    expect(getByText('Повторить')).toBeTruthy();
  });

  it('retry button re-fetches stats', async () => {
    mockedGetDriverStats.mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<StatsScreen />);

    await waitFor(() => {
      expect(getByText('Не удалось загрузить статистику')).toBeTruthy();
    });

    mockedGetDriverStats.mockResolvedValueOnce(mockStats);

    fireEvent.press(getByText('Повторить'));

    await waitFor(() => {
      expect(getByText('Сегодня')).toBeTruthy();
    });

    expect(mockedGetDriverStats).toHaveBeenCalledTimes(2);
  });
});
