/**
 * Unified Location Resolution Service
 * Handles Global Places, Street Addresses, Landmarks, and Google Plus Codes.
 * Priority:
 * 1. Plus Code Decoding / Resolution
 * 2. Google Maps Platform Places / Geocoding (if configured)
 * 3. Open-Meteo Geocoding API (Fallback)
 */

import { GoogleLocationProvider } from './googleLocationProvider';
import { GeocodingService } from './geocodingService';
import { PlusCodeDecoder } from './plusCodeDecoder';
import type { NormalizedLocation, GeocodingLocation, PlaceType } from '../types/weather';

const locationCache = new Map<string, { data: NormalizedLocation[]; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes cache

export class LocationService {
  /**
   * Universal location search supporting addresses, landmarks, cities, and Plus Codes
   */
  public static async searchLocations(
    query: string,
    signal?: AbortSignal
  ): Promise<NormalizedLocation[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const cacheKey = trimmed.toLowerCase();
    const cached = locationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    let results: NormalizedLocation[] = [];

    // 1. Check for Plus Codes (e.g. "37J9+8H Chennai, Tamil Nadu" or "87G8P27Q+5M")
    if (PlusCodeDecoder.isPlusCode(trimmed)) {
      results = await this.resolvePlusCode(trimmed, signal);
      if (results.length > 0) {
        locationCache.set(cacheKey, { data: results, timestamp: Date.now() });
        return results;
      }
    }

    // 2. Try Google Maps Platform if configured
    if (GoogleLocationProvider.isConfigured()) {
      try {
        const googleResults = await GoogleLocationProvider.searchLocations(trimmed, signal);
        if (googleResults && googleResults.length > 0) {
          results = googleResults;
          locationCache.set(cacheKey, { data: results, timestamp: Date.now() });
          return results;
        }
      } catch {
        // Fall through to Open-Meteo fallback
      }
    }

    // 3. Fallback to Open-Meteo Geocoding Service
    try {
      const openMeteoResults = await GeocodingService.searchLocations(trimmed, 8, signal);
      results = openMeteoResults.map((loc) => this.normalizeOpenMeteoLocation(loc));
      if (results.length > 0) {
        locationCache.set(cacheKey, { data: results, timestamp: Date.now() });
      }
      return results;
    } catch (err: unknown) {
      if (signal?.aborted) return [];
      throw err;
    }
  }

  /**
   * Resolves a Plus Code to geographic coordinates and formatted address
   */
  public static async resolvePlusCode(
    query: string,
    signal?: AbortSignal
  ): Promise<NormalizedLocation[]> {
    // If Google is configured, try Google Geocoder first
    if (GoogleLocationProvider.isConfigured()) {
      try {
        const googleResults = await GoogleLocationProvider.searchLocations(query, signal);
        if (googleResults.length > 0) return googleResults;
      } catch {
        // Continue to fallback decoder
      }
    }

    const compound = PlusCodeDecoder.parseCompoundCode(query);
    if (!compound) return [];

    let lat = 0;
    let lon = 0;
    let localityDisplay = compound.locality;
    let timezone = 'auto';

    if (compound.code.length >= 10 && compound.code.indexOf('+') === 8) {
      // Full 10-char Plus Code
      const decoded = PlusCodeDecoder.decodeFullCode(compound.code);
      lat = decoded.latitude;
      lon = decoded.longitude;
    } else {
      // Compound short code + locality name
      let refLat = 13.0827; // Default reference
      let refLon = 80.2707;

      if (compound.locality && compound.locality !== 'Global') {
        try {
          const geo = await GeocodingService.searchLocations(compound.locality, 1, signal);
          if (geo && geo.length > 0) {
            refLat = geo[0].latitude;
            refLon = geo[0].longitude;
            localityDisplay = GeocodingService.formatLocationName(geo[0]);
            timezone = geo[0].timezone;
          }
        } catch {
          // Use default reference
        }
      }

      const fullCode = PlusCodeDecoder.recoverNearest(compound.code, refLat, refLon);
      const decoded = PlusCodeDecoder.decodeFullCode(fullCode);
      lat = decoded.latitude;
      lon = decoded.longitude;
    }

    const formattedAddress = `${compound.code} ${localityDisplay}`.trim();

    return [
      {
        id: `pluscode_${compound.code}`,
        name: compound.code,
        formattedAddress,
        latitude: lat,
        longitude: lon,
        city: localityDisplay.split(',')[0],
        region: localityDisplay.split(',')[1]?.trim(),
        country: localityDisplay.split(',').pop()?.trim(),
        timezone,
        placeType: 'plus_code' as PlaceType,
        source: 'plus_code',
      },
    ];
  }

  /**
   * Normalizes Open-Meteo Geocoding result into universal NormalizedLocation
   */
  public static normalizeOpenMeteoLocation(loc: GeocodingLocation): NormalizedLocation {
    const formattedAddress = GeocodingService.formatLocationName(loc);
    let placeType: PlaceType = 'city';
    if (loc.feature_code?.startsWith('PPL')) placeType = 'city';
    else if (loc.feature_code?.startsWith('AIR')) placeType = 'airport';
    else if (loc.feature_code?.startsWith('LND')) placeType = 'landmark';

    return {
      id: loc.id,
      name: loc.name,
      formattedAddress,
      latitude: loc.latitude,
      longitude: loc.longitude,
      city: loc.name,
      region: loc.admin1,
      country: loc.country,
      timezone: loc.timezone,
      placeType,
      source: 'open-meteo',
    };
  }

  /**
   * Helper to format human-readable display string
   */
  public static formatLocationName(loc: NormalizedLocation | GeocodingLocation): string {
    if ('formattedAddress' in loc && loc.formattedAddress) {
      return loc.formattedAddress;
    }
    return GeocodingService.formatLocationName(loc as GeocodingLocation);
  }
}
