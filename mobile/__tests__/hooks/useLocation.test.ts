jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import { renderHook, waitFor, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useLocation } from '../../src/hooks/useLocation';

const mockedRequestPerms = Location.requestForegroundPermissionsAsync as jest.MockedFunction<
  typeof Location.requestForegroundPermissionsAsync
>;
const mockedGetCurrent = Location.getCurrentPositionAsync as jest.MockedFunction<
  typeof Location.getCurrentPositionAsync
>;
const mockedWatch = Location.watchPositionAsync as jest.MockedFunction<
  typeof Location.watchPositionAsync
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useLocation', () => {
  it('returns loading true initially', () => {
    // Never resolve permission so it stays loading
    mockedRequestPerms.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useLocation());

    expect(result.current.loading).toBe(true);
    expect(result.current.latitude).toBe(42.87);
    expect(result.current.longitude).toBe(74.59);
    expect(result.current.error).toBeNull();
  });

  it('returns coordinates after permission granted', async () => {
    mockedRequestPerms.mockResolvedValue({ status: 'granted' } as any);
    mockedGetCurrent.mockResolvedValue({
      coords: { latitude: 42.88, longitude: 74.60, heading: 90 },
    } as any);
    mockedWatch.mockResolvedValue({ remove: jest.fn() } as any);

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.latitude).toBe(42.88);
    expect(result.current.longitude).toBe(74.60);
    expect(result.current.heading).toBe(90);
    expect(result.current.error).toBeNull();
  });

  it('sets error when permission denied', async () => {
    mockedRequestPerms.mockResolvedValue({ status: 'denied' } as any);

    const { result } = renderHook(() => useLocation());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Нет доступа к геолокации');
    // Should still have default coords
    expect(result.current.latitude).toBe(42.87);
    expect(result.current.longitude).toBe(74.59);
  });
});
