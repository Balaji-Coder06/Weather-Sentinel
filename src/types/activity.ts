export type ActivityId =
  | 'walking'
  | 'running'
  | 'cycling'
  | 'hiking'
  | 'outdoor_sports'
  | 'outdoor_event'
  | 'travel'
  | 'photography';

export interface ActivitySensitivityWeights {
  /** Sensitivity to rain probability and precipitation volume (0.0 to 1.0) */
  rain: number;
  /** Sensitivity to thermal stress (apparent temp and humidity) (0.0 to 1.0) */
  heat: number;
  /** Sensitivity to aerodynamic drag and wind gusts (0.0 to 1.0) */
  wind: number;
  /** Sensitivity to ultraviolet radiation (0.0 to 1.0) */
  uv: number;
  /** Sensitivity to poor visibility (0.0 to 1.0) */
  visibility: number;
  /** Multiplier for how continuous duration amplifies environmental exposure (0.5 to 1.5) */
  durationSensitivity: number;
}

export interface ActivityConfig {
  id: ActivityId;
  name: string;
  category: 'fitness' | 'recreation' | 'logistics' | 'creative';
  description: string;
  iconName: string;
  /**
   * Initially defined activity sensitivity weights, designed to be replaced/calibrated
   * using empirical data in Phase 2.
   */
  weights: ActivitySensitivityWeights;
  /** Ideal temperature range in Celsius [min, max] */
  idealTempRange: [number, number];
  /** Max acceptable wind speed before severe warning in km/h */
  maxWindSpeedKmH: number;
}

export interface ActivityPlanContext {
  activityId: ActivityId;
  locationName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24-hour format)
  durationHours: number; // 0.5 to 8
}
