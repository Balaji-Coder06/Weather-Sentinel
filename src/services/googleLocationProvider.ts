/**
 * Google Maps Platform Location Provider
 * Integrates Places Autocomplete, Geocoding, and Place Details
 * Uses VITE_GOOGLE_MAPS_API_KEY from environment.
 * Zero-credential fallback if key is missing or unavailable.
 */

import type { NormalizedLocation, PlaceType } from '../types/weather';

declare global {
  interface Window {
    google?: any;
    __googleMapsLoadingPromise?: Promise<boolean>;
  }
}

export class GoogleLocationProvider {
  private static getApiKey(): string {
    try {
      if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
        return (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';
      }
      const proc = (globalThis as any).process;
      if (proc && proc.env) {
        return proc.env.VITE_GOOGLE_MAPS_API_KEY || '';
      }
    } catch {
      // Fallback if env access fails
    }
    return '';
  }

  /**
   * Check if Google Maps Platform API key is available
   */
  public static isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 5 && key !== 'your_google_maps_api_key_here');
  }

  /**
   * Asynchronously loads the Google Maps JavaScript API script once if configured
   */
  public static async loadScript(): Promise<boolean> {
    if (window.google?.maps?.places) {
      return true;
    }

    if (!this.isConfigured()) {
      return false;
    }

    if (window.__googleMapsLoadingPromise) {
      return window.__googleMapsLoadingPromise;
    }

    window.__googleMapsLoadingPromise = new Promise<boolean>((resolve) => {
      try {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          this.getApiKey()
        )}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          resolve(true);
        };

        script.onerror = () => {
          resolve(false);
        };

        document.head.appendChild(script);
      } catch {
        resolve(false);
      }
    });

    return window.__googleMapsLoadingPromise;
  }

  /**
   * Search for locations, addresses, landmarks, and Plus Codes via Google
   */
  public static async searchLocations(
    query: string,
    signal?: AbortSignal
  ): Promise<NormalizedLocation[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const loaded = await this.loadScript();
    if (!loaded || !window.google?.maps?.places) {
      return [];
    }

    if (signal?.aborted) {
      return [];
    }

    return new Promise<NormalizedLocation[]>((resolve) => {
      try {
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        const geocoder = new window.google.maps.Geocoder();

        // 1. If it looks like a Plus Code, run direct Geocoding lookup first
        if (trimmed.includes('+')) {
          geocoder.geocode(
            { address: trimmed },
            (results: any[], status: string) => {
              if (status === 'OK' && results && results.length > 0) {
                const normalized = results.slice(0, 5).map((r, idx) =>
                  this.normalizeGeocodeResult(r, idx, 'plus_code')
                );
                resolve(normalized);
              } else {
                this.fallbackPlacesSearch(autocompleteService, geocoder, trimmed, resolve);
              }
            }
          );
          return;
        }

        // 2. Standard Places Autocomplete Search
        this.fallbackPlacesSearch(autocompleteService, geocoder, trimmed, resolve);
      } catch {
        resolve([]);
      }
    });
  }

  private static fallbackPlacesSearch(
    autocompleteService: any,
    geocoder: any,
    query: string,
    resolve: (val: NormalizedLocation[]) => void
  ) {
    autocompleteService.getPlacePredictions(
      {
        input: query,
      },
      async (predictions: any[], status: string) => {
        if (status !== 'OK' || !predictions || predictions.length === 0) {
          // Attempt geocoding directly as fallback
          geocoder.geocode(
            { address: query },
            (geoResults: any[], geoStatus: string) => {
              if (geoStatus === 'OK' && geoResults && geoResults.length > 0) {
                resolve(
                  geoResults.slice(0, 6).map((r, idx) =>
                    this.normalizeGeocodeResult(r, idx, this.inferPlaceType(r.types))
                  )
                );
              } else {
                resolve([]);
              }
            }
          );
          return;
        }

        // Resolve top predictions to coordinates
        const normalizedList: NormalizedLocation[] = [];
        const topPredictions = predictions.slice(0, 6);

        const resolutionPromises = topPredictions.map((pred) => {
          return new Promise<NormalizedLocation | null>((resPred) => {
            geocoder.geocode(
              { placeId: pred.place_id },
              (details: any[], detailStatus: string) => {
                if (detailStatus === 'OK' && details && details[0]) {
                  const r = details[0];
                  const placeType = this.inferPlaceType(pred.types || r.types);
                  resPred({
                    id: pred.place_id || `google_${pred.description}`,
                    name: pred.structured_formatting?.main_text || pred.description.split(',')[0],
                    formattedAddress: pred.description || r.formatted_address,
                    latitude: r.geometry.location.lat(),
                    longitude: r.geometry.location.lng(),
                    city: this.extractAddressComponent(r, 'locality') || this.extractAddressComponent(r, 'administrative_area_level_2'),
                    region: this.extractAddressComponent(r, 'administrative_area_level_1'),
                    country: this.extractAddressComponent(r, 'country'),
                    placeType,
                    source: 'google',
                  });
                } else {
                  resPred(null);
                }
              }
            );
          });
        });

        const results = await Promise.all(resolutionPromises);
        for (const r of results) {
          if (r) normalizedList.push(r);
        }

        resolve(normalizedList);
      }
    );
  }

  private static normalizeGeocodeResult(
    r: any,
    idx: number,
    placeType: PlaceType = 'general'
  ): NormalizedLocation {
    const mainName =
      this.extractAddressComponent(r, 'point_of_interest') ||
      this.extractAddressComponent(r, 'establishment') ||
      this.extractAddressComponent(r, 'locality') ||
      r.formatted_address.split(',')[0];

    return {
      id: r.place_id || `geo_${idx}_${r.formatted_address}`,
      name: mainName,
      formattedAddress: r.formatted_address,
      latitude: r.geometry.location.lat(),
      longitude: r.geometry.location.lng(),
      city: this.extractAddressComponent(r, 'locality') || this.extractAddressComponent(r, 'administrative_area_level_2'),
      region: this.extractAddressComponent(r, 'administrative_area_level_1'),
      country: this.extractAddressComponent(r, 'country'),
      placeType,
      source: 'google',
    };
  }

  private static extractAddressComponent(result: any, type: string): string | undefined {
    const component = result.address_components?.find((c: any) =>
      c.types.includes(type)
    );
    return component?.long_name;
  }

  private static inferPlaceType(types?: string[]): PlaceType {
    if (!types || types.length === 0) return 'general';
    if (types.includes('locality') || types.includes('administrative_area_level_2')) return 'city';
    if (types.includes('street_address') || types.includes('route') || types.includes('premise')) return 'address';
    if (types.includes('airport')) return 'airport';
    if (types.includes('point_of_interest') || types.includes('landmark') || types.includes('tourist_attraction')) return 'landmark';
    if (types.includes('establishment')) return 'establishment';
    return 'general';
  }
}
