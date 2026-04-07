jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { High: 5 },
}));

jest.mock('../../src/api/driver', () => ({
  updateLocation: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { updateLocation } from '../../src/api/driver';
import { useDriverLocation } from '../../src/hooks/useDriverLocation';

const mockedRequestForeground = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;
const mockedRequestBackground = Location.requestBackgroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestBackgroundPermissionsAsync
>;
const mockedWatch = Location.watchPositionAsync as jest.MockedFunction<
  typeof Location.watchPositionAsync
>;
const mockedUpdateLocation = updateLocation as jest.MockedFunction<typeof updateLocation>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useDriverLocation', () => {
  it('does not start tracking when enabled=false', () => {
    renderHook(() => useDriverLocation({ enabled: false }));

    expect(mockedRequestForeground).not.toHaveBeenCalled();
    expect(mockedWatch).not.toHaveBeenCalled();
  });

  it('requests foreground permission when enabled', async () => {
    mockedRequestForeground.mockResolvedValue({ status: 'granted' } as any);
    mockedRequestBackground.mockResolvedValue({ status: 'granted' } as any);
    mockedWatch.mockResolvedValue({ remove: jest.fn() } as any);

    renderHook(() => useDriverLocation({ enabled: true }));

    // Flush the async IIFE
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedRequestForeground).toHaveBeenCalled();
  });

  it('starts watching position after permissions granted', async () => {
    mockedRequestForeground.mockResolvedValue({ status: 'granted' } as any);
    mockedRequestBackground.mockResolvedValue({ status: 'granted' } as any);
    mockedWatch.mockResolvedValue({ remove: jest.fn() } as any);

    renderHook(() => useDriverLocation({ enabled: true }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockedWatch).toHaveBeenCalledWith(
      expect.objectContaining({
        accuracy: Location.Accuracy.High,
        distanceInterval: 5,
        timeInterval: 5000,
      }),
      expect.any(Function)
    );
  });

  it('sends location to server at intervals', async () => {
    let locationCallback: (loc: any) => void = () => {};
    mockedRequestForeground.mockResolvedValue({ status: 'granted' } as any);
    mockedRequestBackground.mockResolvedValue({ status: 'granted' } as any);
    mockedWatch.mockImplementation(async (_opts, cb) => {
      locationCallback = cb;
      return { remove: jest.fn() } as any;
    });
    mockedUpdateLocation.mockResolvedValue(undefined);

    renderHook(() => useDriverLocation({ enabled: true }));

    // Let the async setup complete
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Simulate a location update from the watcher
    act(() => {
      locationCallback({
        coords: { latitude: 42.87, longitude: 74.59, heading: 90 },
      });
    });

    // Advance timer by 10s to trigger the interval
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });

    expect(mockedUpdateLocation).toHaveBeenCalledWith(42.87, 74.59, 90);
  });

  it('cleans up subscription and interval on disable', async () => {
    const removeSpy = jest.fn();
    mockedRequestForeground.mockResolvedValue({ status: 'granted' } as any);
    mockedRequestBackground.mockResolvedValue({ status: 'granted' } as any);
    mockedWatch.mockResolvedValue({ remove: removeSpy } as any);

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useDriverLocation({ enabled }),
      { initialProps: { enabled: true } }
    );

    // Let the async setup complete
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Disable — triggers the cleanup
    rerender({ enabled: false });

    // The subscription's remove should have been called by the effect cleanup
    expect(removeSpy).toHaveBeenCalled();
  });

  it('does not request background permissions when foreground denied', async () => {
    mockedRequestForeground.mockResolvedValue({ status: 'denied' } as any);

    renderHook(() => useDriverLocation({ enabled: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedRequestBackground).not.toHaveBeenCalled();
    expect(mockedWatch).not.toHaveBeenCalled();
  });
});
