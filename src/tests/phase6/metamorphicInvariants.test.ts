/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH EVALUATION
 * Module 3: Metamorphic Testing & Directional Invariants
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
  console.log('PHASE 6: MODULE 3 — METAMORPHIC DIRECTIONAL INVARIANTS');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();

  // 1. Temperature Metamorphic Invariant (Above ideal max: T1 < T2 => ThermalRisk(T1) <= ThermalRisk(T2))
  console.log('1. Temperature Increase Metamorphic Invariant:');
  const tempSteps = [22, 26, 30, 34, 38, 42, 46, 50];
  let tempMonotonic = true;
  let prevTempScore = -1;
  for (const t of tempSteps) {
    const res = engine.calculateHourlyRisk(mockHour({ temperature: t, apparentTemperature: t }), ACTIVITY_REGISTRY.running, 1);
    if (res.factors.heatRisk < prevTempScore) {
      tempMonotonic = false;
    }
    prevTempScore = res.factors.heatRisk;
  }
  assert(tempMonotonic, 'Thermal vector risk increases monotonically with temperature above ideal range');

  // 2. Wind Speed Metamorphic Invariant (W1 < W2 => WindRisk(W1) <= WindRisk(W2))
  console.log('\n2. Wind Speed Metamorphic Invariant:');
  const windSteps = [5, 15, 25, 35, 50, 75, 100];
  let windMonotonic = true;
  let prevWindScore = -1;
  for (const w of windSteps) {
    const res = engine.calculateHourlyRisk(mockHour({ windSpeed: w, windGusts: w * 1.3 }), ACTIVITY_REGISTRY.cycling, 1);
    if (res.factors.windRisk < prevWindScore) {
      windMonotonic = false;
    }
    prevWindScore = res.factors.windRisk;
  }
  assert(windMonotonic, 'Wind vector risk increases monotonically with wind velocity');

  // 3. Rainfall Metamorphic Invariant (R1 < R2 => RainRisk(R1) <= RainRisk(R2))
  console.log('\n3. Rainfall Metamorphic Invariant:');
  const rainSteps = [0, 2, 5, 10, 20, 50];
  let rainMonotonic = true;
  let prevRainScore = -1;
  for (const r of rainSteps) {
    const res = engine.calculateHourlyRisk(mockHour({ precipitationProbability: 80, precipitation: r, rain: r }), ACTIVITY_REGISTRY.outdoor_sports, 1);
    if (res.factors.rainRisk < prevRainScore) {
      rainMonotonic = false;
    }
    prevRainScore = res.factors.rainRisk;
  }
  assert(rainMonotonic, 'Precipitation vector risk increases monotonically with rainfall accumulation');

  // 4. Solar UV Metamorphic Invariant (UV1 < UV2 => UVRisk(UV1) <= UVRisk(UV2))
  console.log('\n4. Solar UV Metamorphic Invariant:');
  const uvSteps = [0, 2, 4, 6, 8, 10, 12, 15];
  let uvMonotonic = true;
  let prevUvScore = -1;
  for (const uv of uvSteps) {
    const res = engine.calculateHourlyRisk(mockHour({ uvIndex: uv }), ACTIVITY_REGISTRY.hiking, 1);
    if (res.factors.uvRisk < prevUvScore) {
      uvMonotonic = false;
    }
    prevUvScore = res.factors.uvRisk;
  }
  assert(uvMonotonic, 'Solar UV vector risk increases monotonically with UV index');

  // 5. Visibility Inverse Metamorphic Invariant (V1 > V2 => VisRisk(V1) <= VisRisk(V2))
  console.log('\n5. Visibility Inverse Metamorphic Invariant:');
  const visSteps = [10000, 5000, 2500, 1200, 800, 200, 0];
  let visMonotonic = true;
  let prevVisScore = -1;
  for (const vis of visSteps) {
    const res = engine.calculateHourlyRisk(mockHour({ visibility: vis }), ACTIVITY_REGISTRY.travel, 1);
    if (res.factors.visibilityRisk < prevVisScore) {
      visMonotonic = false;
    }
    prevVisScore = res.factors.visibilityRisk;
  }
  assert(visMonotonic, 'Visibility vector risk increases inversely as visibility distance degrades');

  // 6. Duration Compounding Metamorphic Invariant (D1 < D2 => Score(D1) <= Score(D2))
  console.log('\n6. Duration Metamorphic Invariant:');
  const durSteps = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0];
  let durMonotonic = true;
  let prevDurScore = -1;
  const severeHour = mockHour({ temperature: 34, apparentTemperature: 40, relativeHumidity: 70 });
  for (const d of durSteps) {
    const res = engine.calculateHourlyRisk(severeHour, ACTIVITY_REGISTRY.running, d);
    if (res.riskScore < prevDurScore) {
      durMonotonic = false;
    }
    prevDurScore = res.riskScore;
  }
  assert(durMonotonic, 'Overall risk score scales monotonically with exposure duration');

  console.log(`\nMODULE 3 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
