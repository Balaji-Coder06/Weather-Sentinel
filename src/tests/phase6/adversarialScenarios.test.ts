/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH EVALUATION
 * Module 2: Adversarial & Extreme Compound Weather Scenarios (A — J)
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { ACTIVITY_REGISTRY } from '../../engine/activityRegistry';
import type { NormalizedWeatherHour } from '../../types/weather';

declare const process: { exit: (code?: number) => void };

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}${failureDetails ? ` -> ${failureDetails}` : ''}`);
  }
}

function mockHour(overrides: Partial<NormalizedWeatherHour> = {}): NormalizedWeatherHour {
  return {
    timestamp: '2026-08-15T12:00:00Z',
    timeFormatted: '12:00 PM',
    dateFormatted: 'Aug 15, 2026',
    temperature: 20,
    apparentTemperature: 20,
    relativeHumidity: 50,
    precipitationProbability: 0,
    precipitation: 0,
    rain: 0,
    weatherCode: 0,
    weatherDescription: 'Clear',
    weatherIconName: 'Sun',
    cloudCover: 0,
    windSpeed: 10,
    windDirection: 180,
    windGusts: 14,
    surfacePressure: 1013,
    uvIndex: 2,
    visibility: 10000,
    ...overrides,
  };
}

async function run() {
  console.log('\n================================================================');
  console.log('PHASE 6: MODULE 2 — ADVERSARIAL METEOROLOGICAL SCENARIOS (A-J)');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();

  const adversarialCases = [
    {
      code: 'A',
      name: 'Extreme Heat (60°C, 95% RH, low wind, 6h)',
      hour: mockHour({ temperature: 60, apparentTemperature: 65, relativeHumidity: 95, windSpeed: 5 }),
      activity: ACTIVITY_REGISTRY.running,
      duration: 6,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Thermal Load',
    },
    {
      code: 'B',
      name: 'Extreme Cold (-25°C, high wind, 4h)',
      hour: mockHour({ temperature: -25, apparentTemperature: -36, windSpeed: 45, windGusts: 70 }),
      activity: ACTIVITY_REGISTRY.hiking,
      duration: 4,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Thermal Load',
    },
    {
      code: 'C',
      name: 'Extreme Gale Wind (180 km/h sustained, 180 km/h gusts)',
      hour: mockHour({ windSpeed: 180, windGusts: 180 }),
      activity: ACTIVITY_REGISTRY.cycling,
      duration: 1,
      expectedLevel: 'HIGH', // or SEVERE
      expectedDriver: 'Wind Dynamics',
    },
    {
      code: 'D',
      name: 'Extreme Deluge (200 mm precipitation, 100% prob, storm)',
      hour: mockHour({ precipitationProbability: 100, precipitation: 200, rain: 200, weatherCode: 95 }),
      activity: ACTIVITY_REGISTRY.outdoor_sports,
      duration: 2,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Precipitation',
    },
    {
      code: 'E',
      name: 'Extreme UV (UV 20, 0% cloud cover)',
      hour: mockHour({ uvIndex: 20, cloudCover: 0 }),
      activity: ACTIVITY_REGISTRY.hiking,
      duration: 3,
      expectedLevel: 'HIGH',
      expectedDriver: 'Solar UV',
    },
    {
      code: 'F',
      name: 'Dense Fog (0m visibility, low wind)',
      hour: mockHour({ visibility: 0, windSpeed: 4 }),
      activity: ACTIVITY_REGISTRY.travel,
      duration: 1,
      expectedLevel: 'HIGH',
      expectedDriver: 'Visibility Restriction',
    },
    {
      code: 'G',
      name: 'Compound Heat Hazard (45°C, 90% RH, UV 12, 6h exposure)',
      hour: mockHour({ temperature: 45, apparentTemperature: 54, relativeHumidity: 90, uvIndex: 12 }),
      activity: ACTIVITY_REGISTRY.running,
      duration: 6,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Thermal Load',
    },
    {
      code: 'H',
      name: 'Compound Storm (50mm rain, 85 km/h gusts, 300m vis, 4h)',
      hour: mockHour({ precipitationProbability: 100, precipitation: 50, rain: 50, windSpeed: 60, windGusts: 85, visibility: 300, weatherCode: 95 }),
      activity: ACTIVITY_REGISTRY.outdoor_sports,
      duration: 4,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Precipitation',
    },
    {
      code: 'I',
      name: 'Conflicting Signals (UV 11, 100% cloud cover, 20°C temp)',
      hour: mockHour({ uvIndex: 11, cloudCover: 100, temperature: 20, apparentTemperature: 20 }),
      activity: ACTIVITY_REGISTRY.hiking,
      duration: 2,
      expectedLevel: 'HIGH',
      expectedDriver: 'Solar UV',
    },
    {
      code: 'J',
      name: 'Benign Environment (20°C, 45% RH, 5 km/h wind, 0% rain, UV 1, 10km vis)',
      hour: mockHour({ temperature: 20, apparentTemperature: 20, relativeHumidity: 45, windSpeed: 5, uvIndex: 1, visibility: 10000 }),
      activity: ACTIVITY_REGISTRY.walking,
      duration: 1,
      expectedLevel: 'LOW',
      expectedDriver: null, // Nominal baseline
    },
  ];

  for (const c of adversarialCases) {
    const res = engine.calculateHourlyRisk(c.hour, c.activity, c.duration);
    const driver = engine.getPrimaryDriver(res.factors)?.name || null;

    console.log(`  Case ${c.code}: ${c.name} -> Score: ${res.riskScore}/100 [${res.riskLevel}], Driver: ${driver ?? 'None'}`);

    assert(
      res.riskScore >= 0 && res.riskScore <= 100 && !isNaN(res.riskScore) && isFinite(res.riskScore),
      `Case ${c.code} score is validly bounded in [0, 100]`
    );

    if (c.code === 'J') {
      assert(res.riskLevel === 'LOW' && res.riskScore <= 15, `Case J benign conditions score as LOW (${res.riskScore}/100)`);
    } else {
      assert(res.riskLevel === 'HIGH' || res.riskLevel === 'SEVERE', `Case ${c.code} hazard flags elevated risk (${res.riskScore}/100 [${res.riskLevel}])`);
      if (c.expectedDriver) {
        assert(driver === c.expectedDriver, `Case ${c.code} primary driver is ${driver} (Expected ${c.expectedDriver})`);
      }
    }
  }

  console.log(`\nMODULE 2 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
