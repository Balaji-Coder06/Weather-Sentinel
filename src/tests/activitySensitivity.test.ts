/**
 * WEATHER SENTINEL — PHASE 4 RESEARCH TEST HARNESS
 * Module 4: Activity Context Sensitivity & Differentiation Matrix
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
    timestamp: '2026-08-15T10:00:00Z',
    timeFormatted: '10:00 AM',
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
  console.log('PHASE 4: MODULE 4 — ACTIVITY SENSITIVITY MATRIX TESTS');
  console.log('========================================================\n');

  const engine = new RuleBasedRiskEngine();

  // Test 1: Heat Stress Scenario (34°C, 75% RH, Apparent Temp 41°C)
  console.log('1. Heat Stress Scenario Matrix:');
  const heatHour = mockHour({
    temperature: 34,
    apparentTemperature: 41,
    relativeHumidity: 75,
    windSpeed: 12,
  });

  const heatScores: Record<string, number> = {};
  for (const [id, config] of Object.entries(ACTIVITY_REGISTRY)) {
    const res = engine.calculateHourlyRisk(heatHour, config, 1.5);
    heatScores[id] = res.riskScore;
    console.log(`    ${config.name.padEnd(16)} -> Risk: ${res.riskScore}/100 [${res.riskLevel}], Driver: ${engine.getPrimaryDriver(res.factors)?.name}`);
  }

  assert(
    heatScores.running > heatScores.photography,
    `Running (${heatScores.running}) > Photography (${heatScores.photography}) for heat stress`
  );
  assert(
    heatScores.running > heatScores.walking,
    `Running (${heatScores.running}) > Walking (${heatScores.walking}) for heat stress`
  );

  // Test 2: Wet Surface & Precipitation Scenario (80% Rain, 8mm volume)
  console.log('\n2. Heavy Wet Surface Scenario Matrix:');
  const wetHour = mockHour({
    precipitationProbability: 85,
    precipitation: 8.0,
    rain: 8.0,
    weatherCode: 65,
    temperature: 20,
    apparentTemperature: 20,
  });

  const wetScores: Record<string, number> = {};
  for (const [id, config] of Object.entries(ACTIVITY_REGISTRY)) {
    const res = engine.calculateHourlyRisk(wetHour, config, 1.5);
    wetScores[id] = res.riskScore;
    console.log(`    ${config.name.padEnd(16)} -> Risk: ${res.riskScore}/100 [${res.riskLevel}], Driver: ${engine.getPrimaryDriver(res.factors)?.name}`);
  }

  assert(
    wetScores.outdoor_sports > wetScores.walking,
    `Outdoor Sports (${wetScores.outdoor_sports}) > Walking (${wetScores.walking}) for heavy rain`
  );
  assert(
    wetScores.cycling > wetScores.walking,
    `Cycling (${wetScores.cycling}) > Walking (${wetScores.walking}) for tyre traction/pavement hazard`
  );

  // Test 3: Wind Aerodynamics Scenario (35 km/h sustained, 55 km/h gusts)
  console.log('\n3. Aerodynamic Wind Drag Scenario Matrix:');
  const windHour = mockHour({
    windSpeed: 35,
    windGusts: 55,
    temperature: 20,
    apparentTemperature: 20,
  });

  const windScores: Record<string, number> = {};
  for (const [id, config] of Object.entries(ACTIVITY_REGISTRY)) {
    const res = engine.calculateHourlyRisk(windHour, config, 1.5);
    windScores[id] = res.riskScore;
    console.log(`    ${config.name.padEnd(16)} -> Risk: ${res.riskScore}/100 [${res.riskLevel}], Driver: ${engine.getPrimaryDriver(res.factors)?.name}`);
  }

  assert(
    windScores.cycling > windScores.walking,
    `Cycling (${windScores.cycling}) > Walking (${windScores.walking}) for crosswind aero drag`
  );
  assert(
    windScores.outdoor_event > windScores.walking,
    `Outdoor Event (${windScores.outdoor_event}) > Walking (${windScores.walking}) for temporary structure hazards`
  );

  // Test 4: Duration Compounding Comparison (0.5h vs 1h vs 2h vs 4h vs 8h)
  console.log('\n4. Duration Scaling Response Across Activities:');
  for (const act of [ACTIVITY_REGISTRY.running, ACTIVITY_REGISTRY.hiking, ACTIVITY_REGISTRY.walking]) {
    const s05 = engine.calculateHourlyRisk(heatHour, act, 0.5).riskScore;
    const s10 = engine.calculateHourlyRisk(heatHour, act, 1.0).riskScore;
    const s20 = engine.calculateHourlyRisk(heatHour, act, 2.0).riskScore;
    const s40 = engine.calculateHourlyRisk(heatHour, act, 4.0).riskScore;
    const s80 = engine.calculateHourlyRisk(heatHour, act, 8.0).riskScore;

    console.log(`    ${act.name.padEnd(10)} duration curve: 0.5h=${s05} -> 1h=${s10} -> 2h=${s20} -> 4h=${s40} -> 8h=${s80}`);
    assert(
      s80 >= s40 && s40 >= s20 && s20 >= s10 && s10 >= s05,
      `${act.name} duration response is strictly monotonic`
    );
    assert(s80 <= 100, `${act.name} at 8h remains bounded <= 100 (${s80})`);
  }

  console.log(`\nMODULE 4 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
