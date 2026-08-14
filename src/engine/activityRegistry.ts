import type { ActivityConfig, ActivityId } from '../types/activity';

/**
 * Registry of supported activity profiles.
 * Note: Sensitivity weights are initially defined heuristic baselines,
 * designed to be replaced/calibrated using empirical data in Phase 2.
 */
export const ACTIVITY_REGISTRY: Record<ActivityId, ActivityConfig> = {
  walking: {
    id: 'walking',
    name: 'Walking',
    category: 'fitness',
    description: 'Casual or brisk walking, low to moderate metabolic output.',
    iconName: 'Footprints',
    weights: {
      rain: 0.65,
      heat: 0.55,
      wind: 0.35,
      uv: 0.50,
      visibility: 0.40,
      durationSensitivity: 0.85,
    },
    idealTempRange: [14, 24],
    maxWindSpeedKmH: 45,
  },
  running: {
    id: 'running',
    name: 'Running',
    category: 'fitness',
    description: 'High cardiovascular intensity with elevated metabolic heat and sweat rate.',
    iconName: 'Activity',
    weights: {
      rain: 0.50,
      heat: 0.90, // Highly sensitive to apparent temperature + humidity
      wind: 0.45,
      uv: 0.70,
      visibility: 0.40,
      durationSensitivity: 1.20, // Duration heavily compounds cardiac/thermal strain
    },
    idealTempRange: [10, 18],
    maxWindSpeedKmH: 40,
  },
  cycling: {
    id: 'cycling',
    name: 'Cycling',
    category: 'fitness',
    description: 'High aerodynamic exposure, road traction risks, and sustained wind resistance.',
    iconName: 'Bike',
    weights: {
      rain: 0.85, // Wet pavement significantly degrades tyre grip and braking
      heat: 0.65,
      wind: 0.85, // Crosswinds and head winds heavily impact safety and stability
      uv: 0.60,
      visibility: 0.80, // High-speed transit requires crisp visibility
      durationSensitivity: 1.10,
    },
    idealTempRange: [12, 22],
    maxWindSpeedKmH: 35,
  },
  hiking: {
    id: 'hiking',
    name: 'Hiking',
    category: 'recreation',
    description: 'Terrain exposure, prolonged backcountry duration, and sudden weather shifts.',
    iconName: 'Mountain',
    weights: {
      rain: 0.80, // Trail mud, slipping, and hypothermia danger
      heat: 0.75,
      wind: 0.60,
      uv: 0.75,
      visibility: 0.75,
      durationSensitivity: 1.30, // Remote wilderness exposure compounds over time
    },
    idealTempRange: [12, 22],
    maxWindSpeedKmH: 45,
  },
  outdoor_sports: {
    id: 'outdoor_sports',
    name: 'Outdoor Sports',
    category: 'recreation',
    description: 'Field sports (cricket, football, tennis) requiring ball trajectory and field traction.',
    iconName: 'Trophy',
    weights: {
      rain: 0.95, // Wet grass/court causes waterlogging, ball slippage, cancellations
      heat: 0.70,
      wind: 0.75, // Severe gusts disrupt ball flight and projectile physics
      uv: 0.65,
      visibility: 0.70,
      durationSensitivity: 1.05,
    },
    idealTempRange: [15, 26],
    maxWindSpeedKmH: 35,
  },
  outdoor_event: {
    id: 'outdoor_event',
    name: 'Outdoor Event',
    category: 'recreation',
    description: 'Concerts, gatherings, ceremonies, and fixed outdoor installations.',
    iconName: 'PartyPopper',
    weights: {
      rain: 0.90, // Uncovered guest seating, electronics, stage safety
      heat: 0.75, // Heat exhaustion among stationary attendees
      wind: 0.80, // Canopies, marquees, and temporary structures vulnerable to wind
      uv: 0.65,
      visibility: 0.40,
      durationSensitivity: 1.15,
    },
    idealTempRange: [16, 26],
    maxWindSpeedKmH: 30,
  },
  travel: {
    id: 'travel',
    name: 'Travel & Commute',
    category: 'logistics',
    description: 'Road transit, sightseeing, and pedestrian transfers.',
    iconName: 'Compass',
    weights: {
      rain: 0.70,
      heat: 0.50,
      wind: 0.50,
      uv: 0.40,
      visibility: 0.85, // Critical for traffic flow and transit safety
      durationSensitivity: 0.90,
    },
    idealTempRange: [12, 28],
    maxWindSpeedKmH: 55,
  },
  photography: {
    id: 'photography',
    name: 'Photography',
    category: 'creative',
    description: 'Outdoor photo shoots requiring camera protection, steady light, and tripod stability.',
    iconName: 'Camera',
    weights: {
      rain: 0.90, // Optical equipment vulnerability
      heat: 0.45,
      wind: 0.70, // Tripod camera shake in high winds
      uv: 0.35,
      visibility: 0.65, // Fog/haze impacts long lenses and contrast
      durationSensitivity: 0.90,
    },
    idealTempRange: [10, 25],
    maxWindSpeedKmH: 35,
  },
};

export function getActivityConfig(id: ActivityId): ActivityConfig {
  const config = ACTIVITY_REGISTRY[id];
  if (!config) {
    return ACTIVITY_REGISTRY.walking;
  }
  return config;
}

export const ALL_ACTIVITIES = Object.values(ACTIVITY_REGISTRY);
