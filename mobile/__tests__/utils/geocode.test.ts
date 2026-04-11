jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
}));

import * as Location from 'expo-location';
import { reverseGeocode } from '../../src/utils/geocode';

const mockedReverseGeocodeAsync = Location.reverseGeocodeAsync as jest.MockedFunction<
  typeof Location.reverseGeocodeAsync
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reverseGeocode', () => {
  it('formats street, number, and city', async () => {
    mockedReverseGeocodeAsync.mockResolvedValue([
      {
        street: 'ул. Ленина',
        streetNumber: '5',
        city: 'Бишкек',
        country: 'Кыргызстан',
        district: null,
        isoCountryCode: 'KG',
        name: 'Ленина 5',
        postalCode: null,
        region: null,
        subregion: null,
        timezone: null,
        formattedAddress: null,
      } as any,
    ]);

    const result = await reverseGeocode(42.87, 74.59);
    expect(result).toBe('ул. Ленина, 5, Бишкек');
    expect(mockedReverseGeocodeAsync).toHaveBeenCalledWith({
      latitude: 42.87,
      longitude: 74.59,
    });
  });

  it('falls back to name when street is missing', async () => {
    mockedReverseGeocodeAsync.mockResolvedValue([
      {
        street: null,
        streetNumber: null,
        city: 'Бишкек',
        name: 'Южные ворота',
      } as any,
    ]);

    const result = await reverseGeocode(42.87, 74.59);
    expect(result).toBe('Южные ворота, Бишкек');
  });

  it('returns undefined when results are empty', async () => {
    mockedReverseGeocodeAsync.mockResolvedValue([]);
    expect(await reverseGeocode(42.87, 74.59)).toBeUndefined();
  });

  it('returns undefined when geocoding throws', async () => {
    mockedReverseGeocodeAsync.mockRejectedValue(new Error('offline'));
    expect(await reverseGeocode(42.87, 74.59)).toBeUndefined();
  });
});
