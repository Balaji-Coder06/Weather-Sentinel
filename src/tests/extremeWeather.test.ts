/**
 * WEATHER SENTINEL — PHASE 4 RESEARCH TEST HARNESS
 * Module 1: Extreme Weather Robustness & Boundary Value Analysis
 */

import { RuleBasedRiskEngine } from '../engine/riskEngine';
import { ACTIVITY_REGISTRY } from '../engine/activityRegistry';
import type { NormalizedWeatherHour } from '../types/weather';

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
    temperature: 20,
    apparentTemperature: 20,
    relativeHumidity: 50,
    precipitationProbability: 0,
    precipitation: 0,
    rain: 0,
    weatherCode: 0,
    weatherDescription: 'Clear sky',
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
  console.log('\n========================================================');
  console.log('PHASE 4: MODULE 1 — EXTREME WEATHER ROBUSTNESS TESTS');
  console.log('========================================================\n');

  const engine = new RuleBasedRiskEngine();

  // 1. Extreme Heat (45°C, 50°C, 55°C)
  console.log('1. Extreme Heat Invariant Tests:');
  for (const t of [45, 50, 55, 60]) {
    const h = mockHour({ temperature: t, apparentTemperature: t + 6, relativeHumidity: 70 });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.running, 2);
    assert(
      res.riskScore >= 70 && res.riskScore <= 100 && !isNaN(res.riskScore) && isFinite(res.riskScore),
      `Extreme heat ${t}°C -> score ${res.riskScore}/100 [${res.riskLevel}]`
    );
  }

  // 2. Extreme Cold (0°C, -10°C, -25°C)
  console.log('\n2. Extreme Cold Invariant Tests:');
  for (const t of [0, -10, -25]) {
    const h = mockHour({ temperature: t, apparentTemperature: t - 5, windSpeed: 25 });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.running, 1);
    assert(
      res.riskScore >= 0 && res.riskScore <= 100 && !isNaN(res.riskScore) && isFinite(res.riskScore),
      `Extreme cold ${t}°C -> score ${res.riskScore}/100 [${res.riskLevel}]`
    );
  }

  // 3. Extreme Gale-Force Wind (80, 120, 180 km/h)
  console.log('\n3. Extreme Wind Invariant Tests:');
  for (const w of [80, 120, 180]) {
    const h = mockHour({ windSpeed: w, windGusts: w * 1.4 });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.cycling, 1);
    assert(
      res.riskScore >= 60 && res.riskScore <= 100 && !isNaN(res.riskScore) && isFinite(res.riskScore),
      `Extreme wind ${w} km/h (gusts ${(w * 1.4).toFixed(0)} km/h) -> score ${res.riskScore}/100`
    );
  }

  // 4. Extreme Precipitation Deluge (50 mm, 100 mm, 200 mm)
  console.log('\n4. Extreme Precipitation Invariant Tests:');
  for (const p of [50, 100, 200]) {
    const h = mockHour({ precipitationProbability: 100, precipitation: p, rain: p, weatherCode: 95 });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.outdoor_sports, 1);
    assert(
      res.riskScore >= 65 && res.riskScore <= 100 && !isNaN(res.riskScore) && isFinite(res.riskScore),
      `Extreme deluge ${p} mm -> score ${res.riskScore}/100 [${res.riskLevel}]`
    );
  }

  // 5. Extreme UV Radiation (UV 11, 15, 20)
  console.log('\n5. Extreme UV Radiation Invariant Tests:');
  for (const uv of [11, 15, 20]) {
    const h = mockHour({ uvIndex: uv });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.hiking, 2);
    assert(
      res.riskScore >= 0 && res.riskScore <= 100 && !isNaN(res.riskScore) && isFinite(res.riskScore),
      `Extreme UV ${uv} -> score ${res.riskScore}/100, UV vector = ${res.factors.uvRisk}`
    );
  }

  // 6. Zero & Sub-1000m Visibility
  console.log('\n6. Extreme Fog / Zero Visibility Tests:');
  for (const vis of [800, 500, 100, 10, 0]) {
    const h = mockHour({ visibility: vis });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.travel, 1);
    assert(
      res.factors.visibilityRisk >= 70 && res.riskScore <= 100 && !isNaN(res.riskScore),
      `Visibility ${vis}m -> visibility factor = ${res.factors.visibilityRisk}`
    );
  }

  console.log(`\nMODULE 1 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
