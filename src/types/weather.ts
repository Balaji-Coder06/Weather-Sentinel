export interface GeocodingLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  feature_code?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  timezone: string;
  population?: number;
}

export interface GeocodingResponse {
  results?: GeocodingLocation[];
  generationtime_ms: number;
}

export interface OpenMeteoHourlyUnits {
  time: string;
  temperature_2m: string;
  apparent_temperature: string;
  relative_humidity_2m: string;
  precipitation_probability: string;
  precipitation: string;
  rain: string;
  weather_code: string;
  cloud_cover: string;
  wind_speed_10m: string;
  wind_direction_10m: string;
  wind_gusts_10m: string;
  surface_pressure: string;
  uv_index: string;
  visibility: string;
}

export interface OpenMeteoHourlyRaw {
  time: string[];
  temperature_2m: (number | null)[];
  apparent_temperature: (number | null)[];
  relative_humidity_2m: (number | null)[];
  precipitation_probability: (number | null)[];
  precipitation: (number | null)[];
  rain: (number | null)[];
  weather_code: (number | null)[];
  cloud_cover: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
  surface_pressure: (number | null)[];
  uv_index: (number | null)[];
  visibility: (number | null)[];
}

export interface OpenMeteoDailyRaw {
  time: string[];
  sunrise?: string[];
  sunset?: string[];
  uv_index_max?: (number | null)[];
}

export interface OpenMeteoForecastResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: OpenMeteoHourlyUnits;
  hourly: OpenMeteoHourlyRaw;
  daily?: OpenMeteoDailyRaw;
}

/**
 * Normalized representation of a single hourly weather observation / forecast
 */
export interface NormalizedWeatherHour {
  timestamp: string; // ISO string e.g. "2026-08-15T16:00"
  timeFormatted: string; // "4:00 PM"
  dateFormatted: string; // "Aug 15, 2026"
  temperature: number | null; // Celsius
  apparentTemperature: number | null; // Feels like Celsius
  relativeHumidity: number | null; // %
  precipitationProbability: number | null; // %
  precipitation: number | null; // mm
  rain: number | null; // mm
  weatherCode: number | null; // WMO code
  weatherDescription: string;
  weatherIconName: string;
  cloudCover: number | null; // %
  windSpeed: number | null; // km/h
  windDirection: number | null; // degrees
  windGusts: number | null; // km/h
  surfacePressure: number | null; // hPa
  uvIndex: number | null; // 0-12+
  visibility: number | null; // meters
}

export type DataConfidenceLevel = 'HIGH' | 'MODERATE' | 'LIMITED';

export interface DataQualityAssessment {
  confidenceScore: number; // 0 - 100
  confidenceLevel: DataConfidenceLevel;
  completenessRatio: number; // 0.0 - 1.0
  missingVariables: string[];
  isForecastDegraded: boolean;
  rationale: string;
}

export interface UncertaintyProfile {
  confidenceLevel: DataConfidenceLevel;
  uncertaintyMargin: number; // e.g. ±4 points
  isOutOfDistribution: boolean;
  oodFactors: string[];
  completenessRatio: number;
  qualityScore: number;
  reasoning: string;
}

export interface HistoricalObservationRecord extends NormalizedWeatherHour {
  locationName: string;
  latitude: number;
  longitude: number;
  climateZone: string;
  provenanceSource: string;
}

export interface NormalizedForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  fetchedAt: number; // unix timestamp in ms
  dataQuality: DataQualityAssessment;
  hours: NormalizedWeatherHour[];
}
