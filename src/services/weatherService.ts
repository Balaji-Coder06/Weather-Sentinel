import type {
  DataConfidenceLevel,
  DataQualityAssessment,
  NormalizedForecast,
  NormalizedWeatherHour,
  OpenMeteoForecastResponse,
} from '../types/weather';
import type { IWeatherProvider, WeatherFetchOptions } from './weatherProvider';
import { OpenMeteoWeatherProvider } from './weatherProvider';

/**
 * WMO Weather interpretation codes (WW)
 * Reference: https://open-meteo.com/en/docs
 */
export function interpretWmoCode(code: number | null): { description: string; iconName: string } {
  if (code === null || code === undefined) {
    return { description: 'Data Unavailable', iconName: 'HelpCircle' };
  }

  switch (code) {
    case 0:
      return { description: 'Clear sky', iconName: 'Sun' };
    case 1:
      return { description: 'Mainly clear', iconName: 'SunMedium' };
    case 2:
      return { description: 'Partly cloudy', iconName: 'CloudSun' };
    case 3:
      return { description: 'Overcast', iconName: 'Cloud' };
    case 45:
      return { description: 'Fog', iconName: 'CloudFog' };
    case 48:
      return { description: 'Depositing rime fog', iconName: 'CloudFog' };
    case 51:
      return { description: 'Light drizzle', iconName: 'CloudDrizzle' };
    case 53:
      return { description: 'Moderate drizzle', iconName: 'CloudDrizzle' };
    case 55:
      return { description: 'Dense drizzle', iconName: 'CloudDrizzle' };
    case 56:
      return { description: 'Light freezing drizzle', iconName: 'CloudSnow' };
    case 57:
      return { description: 'Dense freezing drizzle', iconName: 'CloudSnow' };
    case 61:
      return { description: 'Slight rain', iconName: 'CloudRain' };
    case 63:
      return { description: 'Moderate rain', iconName: 'CloudRain' };
    case 65:
      return { description: 'Heavy rain', iconName: 'CloudRainWind' };
    case 66:
      return { description: 'Light freezing rain', iconName: 'CloudSnow' };
    case 67:
      return { description: 'Heavy freezing rain', iconName: 'CloudSnow' };
    case 71:
      return { description: 'Slight snowfall', iconName: 'Snowflake' };
    case 73:
      return { description: 'Moderate snowfall', iconName: 'Snowflake' };
    case 75:
      return { description: 'Heavy snowfall', iconName: 'Snowflake' };
    case 77:
      return { description: 'Snow grains', iconName: 'Snowflake' };
    case 80:
      return { description: 'Slight rain showers', iconName: 'CloudRain' };
    case 81:
      return { description: 'Moderate rain showers', iconName: 'CloudRain' };
    case 82:
      return { description: 'Violent rain showers', iconName: 'CloudLightning' };
    case 85:
      return { description: 'Slight snow showers', iconName: 'CloudSnow' };
    case 86:
      return { description: 'Heavy snow showers', iconName: 'CloudSnow' };
    case 95:
      return { description: 'Thunderstorm', iconName: 'CloudLightning' };
    case 96:
      return { description: 'Thunderstorm with slight hail', iconName: 'CloudLightning' };
    case 99:
      return { description: 'Thunderstorm with heavy hail', iconName: 'CloudLightning' };
    default:
      return { description: `Weather code ${code}`, iconName: 'Cloud' };
  }
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      const timePart = isoString.split('T')[1] || '';
      const [hourStr] = timePart.split(':');
      const h = parseInt(hourStr, 10);
      if (!isNaN(h)) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12}:00 ${ampm}`;
      }
      return isoString;
    }
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      const datePart = isoString.split('T')[0];
      return datePart;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString;
  }
}

function sanitizeBoundedMetric(
  val: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) {
    return null;
  }
  return Math.min(max, Math.max(min, Number(val)));
}

export class WeatherService {
  private provider: IWeatherProvider;
  private cache = new Map<string, { forecast: NormalizedForecast; timestamp: number }>();
  private readonly CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes cache

  constructor(provider: IWeatherProvider = new OpenMeteoWeatherProvider()) {
    this.provider = provider;
  }

  /**
   * Fetch and normalize forecast data with caching, freshness tracking, and quality assessment
   */
  public async getForecast(options: WeatherFetchOptions, forceRefresh: boolean = false): Promise<NormalizedForecast> {
    const cacheKey = `${options.latitude.toFixed(3)}_${options.longitude.toFixed(3)}_${options.timezone || 'auto'}`;
    const cached = this.cache.get(cacheKey);

    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.forecast;
    }

    const raw = await this.provider.fetchForecast(options);
    const normalized = this.normalizeResponse(raw);

    this.cache.set(cacheKey, {
      forecast: normalized,
      timestamp: Date.now(),
    });

    return normalized;
  }

  /**
   * Evaluates data quality, completeness ratio, and missing telemetry vectors
   */
  public assessDataQuality(raw: OpenMeteoForecastResponse): DataQualityAssessment {
    if (!raw || !raw.hourly || !Array.isArray(raw.hourly.time)) {
      return {
        confidenceScore: 0,
        confidenceLevel: 'LIMITED',
        completenessRatio: 0,
        missingVariables: ['time', 'temperature', 'precipitation', 'wind'],
        isForecastDegraded: true,
        rationale: 'Zero meteorological records returned from provider.',
      };
    }

    const hourly = raw.hourly;
    const totalSlots = hourly.time.length;
    
    if (totalSlots === 0) {
      return {
        confidenceScore: 0,
        confidenceLevel: 'LIMITED',
        completenessRatio: 0,
        missingVariables: ['time', 'temperature', 'precipitation', 'wind'],
        isForecastDegraded: true,
        rationale: 'Zero meteorological records returned from provider.',
      };
    }

    const keyMetrics: Array<{ key: keyof typeof hourly; name: string }> = [
      { key: 'temperature_2m', name: 'Temperature' },
      { key: 'apparent_temperature', name: 'Apparent Temperature' },
      { key: 'relative_humidity_2m', name: 'Relative Humidity' },
      { key: 'precipitation_probability', name: 'Rain Probability' },
      { key: 'precipitation', name: 'Precipitation Volume' },
      { key: 'wind_speed_10m', name: 'Wind Velocity' },
      { key: 'wind_gusts_10m', name: 'Wind Gusts' },
      { key: 'uv_index', name: 'Solar UV Index' },
      { key: 'visibility', name: 'Visibility' },
    ];

    let availableCount = 0;
    let expectedCount = keyMetrics.length * totalSlots;
    const missingVariables: string[] = [];

    for (const metric of keyMetrics) {
      const arr = hourly[metric.key] as (number | null)[] | undefined;
      if (!arr || !Array.isArray(arr)) {
        missingVariables.push(metric.name);
        continue;
      }

      let validInArray = 0;
      for (let i = 0; i < totalSlots; i++) {
        if (arr[i] !== null && arr[i] !== undefined && !isNaN(arr[i] as number)) {
          validInArray++;
        }
      }

      availableCount += validInArray;
      if (validInArray / totalSlots < 0.5) {
        missingVariables.push(metric.name);
      }
    }

    const completenessRatio = Math.round((availableCount / (expectedCount || 1)) * 100) / 100;
    const confidenceScore = Math.round(completenessRatio * 100);

    let confidenceLevel: DataConfidenceLevel = 'HIGH';
    if (confidenceScore < 70 || missingVariables.length >= 3) {
      confidenceLevel = 'LIMITED';
    } else if (confidenceScore < 90 || missingVariables.length >= 1) {
      confidenceLevel = 'MODERATE';
    }

    const isForecastDegraded = confidenceLevel === 'LIMITED';
    let rationale = 'Comprehensive numerical forecast with complete environmental parameter coverage.';
    if (missingVariables.length > 0) {
      rationale = `Telemetry active with fallback bounds applied for: ${missingVariables.join(', ')}.`;
    }

    return {
      confidenceScore,
      confidenceLevel,
      completenessRatio,
      missingVariables,
      isForecastDegraded,
      rationale,
    };
  }

  /**
   * Normalizes provider raw output into domain model with physical bounds validation
   */
  private normalizeResponse(raw: OpenMeteoForecastResponse): NormalizedForecast {
    if (!raw || !raw.hourly || !Array.isArray(raw.hourly.time) || raw.hourly.time.length === 0) {
      throw new Error('Received empty or malformed meteorological forecast structure from provider.');
    }

    const hours: NormalizedWeatherHour[] = [];
    const hourly = raw.hourly;
    const count = hourly.time.length;
    const dataQuality = this.assessDataQuality(raw);

    for (let i = 0; i < count; i++) {
      const timestamp = hourly.time[i];
      const wmo = interpretWmoCode(hourly.weather_code?.[i] ?? null);

      hours.push({
        timestamp,
        timeFormatted: formatTime(timestamp),
        dateFormatted: formatDate(timestamp),
        temperature: sanitizeBoundedMetric(hourly.temperature_2m?.[i], -60, 60),
        apparentTemperature: sanitizeBoundedMetric(hourly.apparent_temperature?.[i], -60, 60),
        relativeHumidity: sanitizeBoundedMetric(hourly.relative_humidity_2m?.[i], 0, 100),
        precipitationProbability: sanitizeBoundedMetric(hourly.precipitation_probability?.[i], 0, 100),
        precipitation: sanitizeBoundedMetric(hourly.precipitation?.[i], 0, 500),
        rain: sanitizeBoundedMetric(hourly.rain?.[i], 0, 500),
        weatherCode: hourly.weather_code?.[i] ?? null,
        weatherDescription: wmo.description,
        weatherIconName: wmo.iconName,
        cloudCover: sanitizeBoundedMetric(hourly.cloud_cover?.[i], 0, 100),
        windSpeed: sanitizeBoundedMetric(hourly.wind_speed_10m?.[i], 0, 300),
        windDirection: sanitizeBoundedMetric(hourly.wind_direction_10m?.[i], 0, 360),
        windGusts: sanitizeBoundedMetric(hourly.wind_gusts_10m?.[i], 0, 350),
        surfacePressure: sanitizeBoundedMetric(hourly.surface_pressure?.[i], 800, 1100),
        uvIndex: sanitizeBoundedMetric(hourly.uv_index?.[i], 0, 16),
        visibility: sanitizeBoundedMetric(hourly.visibility?.[i], 0, 100000),
      });
    }

    return {
      latitude: raw.latitude,
      longitude: raw.longitude,
      timezone: raw.timezone,
      elevation: raw.elevation,
      fetchedAt: Date.now(),
      dataQuality,
      hours,
    };
  }

  /**
   * Extract a continuous sequence of forecast hours matching the target date and time window
   */
  public extractActivityWindow(
    forecast: NormalizedForecast,
    targetDate: string,
    startTime: string,
    durationHours: number
  ): NormalizedWeatherHour[] {
    const startHourInt = parseInt(startTime.split(':')[0], 10);
    const startIsoPrefix = `${targetDate}T${startHourInt.toString().padStart(2, '0')}:00`;

    let startIndex = forecast.hours.findIndex((h) => h.timestamp.startsWith(startIsoPrefix));

    if (startIndex === -1) {
      startIndex = forecast.hours.findIndex((h) => h.timestamp.startsWith(targetDate));
      if (startIndex === -1) {
        return forecast.hours.slice(0, Math.max(1, Math.ceil(durationHours)));
      }
    }

    const hoursNeeded = Math.max(1, Math.ceil(durationHours));
    const windowSlice = forecast.hours.slice(startIndex, startIndex + hoursNeeded);

    return windowSlice.length > 0 ? windowSlice : [forecast.hours[0]];
  }
}
