import type { GeocodingLocation, GeocodingResponse } from '../types/weather';

const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// In-memory cache for recent search queries
const geocodingCache = new Map<string, { data: GeocodingLocation[]; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache

export class GeocodingService {
  /**
   * Search locations by place or city name using official Open-Meteo Geocoding API
   */
  public static async searchLocations(
    query: string,
    count: number = 8,
    signal?: AbortSignal
  ): Promise<GeocodingLocation[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const cacheKey = `${trimmed.toLowerCase()}_${count}`;
    const cached = geocodingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const url = new URL(GEOCODING_API_URL);
    url.searchParams.set('name', trimmed);
    url.searchParams.set('count', count.toString());
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, 8000);

    try {
      const compositeSignal = signal || timeoutController.signal;
      const response = await fetch(url.toString(), {
        signal: compositeSignal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Geocoding rate limit reached. Please wait a moment.');
        }
        throw new Error(`Location search failed with status ${response.status}`);
      }

      const data: GeocodingResponse = await response.json();
      const results = data.results || [];

      geocodingCache.set(cacheKey, {
        data: results,
        timestamp: Date.now(),
      });

      return results;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return []; // Graceful cancellation during typing
        }
        throw err;
      }
      throw new Error('An unexpected network error occurred while searching locations.');
    }
  }

  /**
   * Helper to format a location for human display (e.g. "Chennai, Tamil Nadu, India")
   */
  public static formatLocationName(loc: GeocodingLocation): string {
    const parts = [loc.name];
    if (loc.admin1 && loc.admin1 !== loc.name) {
      parts.push(loc.admin1);
    }
    if (loc.country) {
      parts.push(loc.country);
    }
    return parts.join(', ');
  }
}
