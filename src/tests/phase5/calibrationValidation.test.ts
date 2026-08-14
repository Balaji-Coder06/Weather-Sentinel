/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 4: Real-World Calibration Matrix (Scenarios 1 — 8)
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
    timestamp: '2026-08-15T14:00:00Z',
    timeFormatted: '2:00 PM',
    dateFormatted: 'Aug 15, 2026',
    temperature: 22,
    apparentTemperature: 22,
    relativeHumidity: 50,
    precipitationProbability: 0,
    precipitation: 0,
    rain: 0,
    weatherCode: 0,
    weatherDescription: 'Clear sky',
    weatherIconName: 'Sun',
    cloudCover: 10,
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
  console.log('PHASE 5: MODULE 4 — REAL-WORLD CALIBRATION MATRIX (SCENARIOS 1-8)');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();

  const scenarios = [
    {
      id: 1,
      title: 'High Heat + High Humidity (Chennai Summer)',
      hour: mockHour({ temperature: 36, apparentTemperature: 45, relativeHumidity: 82, precipitationProbability: 0 }),
      activity: ACTIVITY_REGISTRY.running,
      duration: 1.5,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Thermal Load',
    },
    {
      id: 2,
      title: 'High Heat + Low Humidity (Phoenix Desert)',
      hour: mockHour({ temperature: 46, apparentTemperature: 44, relativeHumidity: 12, precipitationProbability: 0 }),
      activity: ACTIVITY_REGISTRY.running,
      duration: 1.5,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Thermal Load',
    },
    {
      id: 3,
      title: 'High Wind + Extreme Gusts (London Atlantic Storm)',
      hour: mockHour({ windSpeed: 45, windGusts: 75, temperature: 18 }),
      activity: ACTIVITY_REGISTRY.cycling,
      duration: 1.0,
      expectedLevel: 'HIGH',
      expectedDriver: 'Wind Dynamics',
    },
    {
      id: 4,
      title: 'Heavy Rain + Convective Storm (Michaung Cyclone)',
      hour: mockHour({ precipitationProbability: 100, precipitation: 35, rain: 35, weatherCode: 95 }),
      activity: ACTIVITY_REGISTRY.outdoor_sports,
      duration: 2.0,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Precipitation',
    },
    {
      id: 5,
      title: 'High Solar UV + Clear Sky (Athens Midday)',
      hour: mockHour({ temperature: 28, apparentTemperature: 28, uvIndex: 11, cloudCover: 0 }),
      activity: ACTIVITY_REGISTRY.hiking,
      duration: 3.0,
      expectedLevel: 'HIGH',
      expectedDriver: 'Solar UV',
    },
    {
      id: 6,
      title: 'Low Visibility Fog + Moderate Wind',
      hour: mockHour({ visibility: 400, windSpeed: 20, temperature: 12 }),
      activity: ACTIVITY_REGISTRY.travel,
      duration: 1.0,
      expectedLevel: 'HIGH',
      expectedDriver: 'Visibility Restriction',
    },
    {
      id: 7,
      title: 'High Heat + High Humidity + Extended Duration (4h)',
      hour: mockHour({ temperature: 34, apparentTemperature: 42, relativeHumidity: 78 }),
      activity: ACTIVITY_REGISTRY.hiking,
      duration: 4.0,
      expectedLevel: 'SEVERE',
      expectedDriver: 'Thermal Load',
    },
    {
      id: 8,
      title: 'Moderate Temp + Heavy Rain + Cycling Traction',
      hour: mockHour({ temperature: 18, apparentTemperature: 18, precipitationProbability: 90, precipitation: 12, rain: 12 }),
      activity: ACTIVITY_REGISTRY.cycling,
      duration: 1.5,
      expectedLevel: 'HIGH',
      expectedDriver: 'Precipitation',
    },
  ];

  console.log('-----------------------------------------------------------------------------------------------------');
  console.log('| # | Scenario Description                    | Activity       | Risk Score | Level    | Primary Driver     |');
  console.log('-----------------------------------------------------------------------------------------------------');

  for (const s of scenarios) {
    const res = engine.calculateHourlyRisk(s.hour, s.activity, s.duration);
    const driver = engine.getPrimaryDriver(res.factors)?.name || 'None';

    console.log(
      `| ${s.id.toString().padEnd(1)} | ${s.title.padEnd(40)} | ${s.activity.name.padEnd(14)} | ${res.riskScore.toString().padStart(3)}/100   | ${res.riskLevel.padEnd(8)} | ${driver.padEnd(18)} |`
    );

    assert(
      res.riskLevel === s.expectedLevel || (s.expectedLevel === 'SEVERE' && res.riskLevel === 'HIGH') || (s.expectedLevel === 'HIGH' && res.riskLevel === 'SEVERE'),
      `Scenario ${s.id} (${s.title}): Risk Level is ${res.riskLevel} (Expected ~${s.expectedLevel})`
    );
    assert(
      driver === s.expectedDriver,
      `Scenario ${s.id}: Primary Driver is ${driver} (Expected ${s.expectedDriver})`
    );
  }
  console.log('-----------------------------------------------------------------------------------------------------\n');

  console.log(`\nMODULE 4 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
