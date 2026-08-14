import type { OpenMeteoForecastResponse } from '../types/weather';

export interface WeatherFetchOptions {
  latitude: number;
  longitude: number;
  timezone?: string;
  forecastDays?: number; // default 7
  signal?: AbortSignal;
}

export interface IWeatherProvider {
  fetchForecast(options: WeatherFetchOptions): Promise<OpenMeteoForecastResponse>;
}

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

export class OpenMeteoWeatherProvider implements IWeatherProvider {
  public async fetchForecast(options: WeatherFetchOptions): Promise<OpenMeteoForecastResponse> {
    const { latitude, longitude, timezone = 'auto', forecastDays = 7, signal } = options;

    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set('latitude', latitude.toFixed(4));
    url.searchParams.set('longitude', longitude.toFixed(4));
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('forecast_days', Math.min(forecastDays, 14).toString());

    // Request only utilized meteorological parameters
    const hourlyVariables = [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
      'rain',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'surface_pressure',
      'uv_index',
      'visibility',
    ];

    url.searchParams.set('hourly', hourlyVariables.join(','));
    url.searchParams.set('daily', 'sunrise,sunset,uv_index_max');

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= MAX_RETRIES) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        // Link caller signal if provided
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
            throw new Error('Weather API rate limit reached. Please wait a moment before re-evaluating.');
          }
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            attempt++;
            await new Promise((res) => setTimeout(res, 800 * attempt));
            continue;
          }
          throw new Error(`Weather service responded with error status HTTP ${response.status}`);
        }

        const data: OpenMeteoForecastResponse = await response.json();
        if (!data || !data.hourly || !Array.isArray(data.hourly.time) || data.hourly.time.length === 0) {
          throw new Error('Received empty or malformed meteorological forecast structure from provider.');
        }

        return data;
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            lastError = new Error('Weather data request timed out. Please check your network connection and try again.');
          } else {
            lastError = err;
          }
        } else {
          lastError = new Error('Unexpected network error occurred while communicating with weather service.');
        }

        // Retry only transient network failures
        if (attempt < MAX_RETRIES && (lastError.message.includes('timed out') || lastError.message.includes('network'))) {
          attempt++;
          await new Promise((res) => setTimeout(res, 600 * attempt));
          continue;
        }

        break;
      }
    }

    throw lastError || new Error('Failed to retrieve meteorological forecast data.');
  }
}
