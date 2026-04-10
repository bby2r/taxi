import { fetchRoute } from '../../src/api/routing';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe('fetchRoute', () => {
  it('calls OSRM with lng,lat order and parses the response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            geometry: {
              coordinates: [
                [74.59, 42.87],
                [74.6, 42.88],
                [74.61, 42.89],
              ],
            },
            distance: 2500,
            duration: 420,
          },
        ],
      }),
    });
    global.fetch = mockFetch as any;

    const result = await fetchRoute(
      { latitude: 42.87, longitude: 74.59 },
      { latitude: 42.89, longitude: 74.61 },
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('74.59,42.87;74.61,42.89');
    expect(calledUrl).toContain('overview=full');
    expect(calledUrl).toContain('geometries=geojson');

    expect(result.distanceMeters).toBe(2500);
    expect(result.durationSeconds).toBe(420);
    expect(result.coordinates).toEqual([
      { latitude: 42.87, longitude: 74.59 },
      { latitude: 42.88, longitude: 74.6 },
      { latitude: 42.89, longitude: 74.61 },
    ]);
  });

  it('throws when the HTTP response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as any;

    await expect(
      fetchRoute(
        { latitude: 42.87, longitude: 74.59 },
        { latitude: 42.89, longitude: 74.61 },
      ),
    ).rejects.toThrow('Routing request failed: 503');
  });

  it('throws when no routes are returned', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    }) as any;

    await expect(
      fetchRoute(
        { latitude: 42.87, longitude: 74.59 },
        { latitude: 42.89, longitude: 74.61 },
      ),
    ).rejects.toThrow('No route found');
  });
});
