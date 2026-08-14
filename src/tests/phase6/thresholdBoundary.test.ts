/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH EVALUATION
 * Module 1: Threshold Boundary & Epsilon Transition Tests
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
  console.log('PHASE 6: MODULE 1 — THRESHOLD BOUNDARY & EPSILON STABILITY');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const eps = 0.01;

  // 1. Classification Boundaries (20, 40, 70)
  console.log('1. Risk Classification Decision Boundaries:');
  const boundaryTests = [
    { score: 20 - eps, expected: 'LOW' },
    { score: 20, expected: 'LOW' },
    { score: 20 + eps, expected: 'MODERATE' },
    { score: 40 - eps, expected: 'MODERATE' },
    { score: 40, expected: 'MODERATE' },
    { score: 40 + eps, expected: 'HIGH' },
    { score: 70 - eps, expected: 'HIGH' },
    { score: 70, expected: 'HIGH' },
    { score: 70 + eps, expected: 'SEVERE' },
  ];

  for (const b of boundaryTests) {
    const level = engine.classifyRiskLevel(b.score);
    assert(level === b.expected, `Score ${b.score.toFixed(2)} classifies as ${b.expected} (got ${level})`);
  }

  // 2. Solar UV Index Step Boundaries (2.0, 5.0, 7.0)
  console.log('\n2. Solar UV Boundary Stability:');
  const uvBoundaries = [1.99, 2.0, 2.01, 4.99, 5.0, 5.01, 6.99, 7.0, 7.01];
  for (const uv of uvBoundaries) {
    const h = mockHour({ uvIndex: uv });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.hiking, 1);
    assert(!isNaN(res.factors.uvRisk) && res.factors.uvRisk >= 0 && res.factors.uvRisk <= 100, `UV ${uv} produces bounded factor ${res.factors.uvRisk}`);
  }

  // 3. Visibility Critical Boundaries (1000m, 3000m, 6000m)
  console.log('\n3. Visibility Distance Boundaries:');
  const visBoundaries = [999, 1000, 1001, 2999, 3000, 3001, 5999, 6000, 6001];
  for (const vis of visBoundaries) {
    const h = mockHour({ visibility: vis });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.travel, 1);
    assert(!isNaN(res.factors.visibilityRisk) && res.factors.visibilityRisk >= 0 && res.factors.visibilityRisk <= 100, `Visibility ${vis}m produces bounded factor ${res.factors.visibilityRisk}`);
  }

  // 4. Activity Max Safe Wind Boundary (e.g. 35 km/h for Cycling)
  console.log('\n4. Aerodynamic Wind Safety Boundary:');
  const windBoundaries = [34.9, 35.0, 35.1];
  for (const w of windBoundaries) {
    const h = mockHour({ windSpeed: w, windGusts: w });
    const res = engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.cycling, 1);
    assert(!isNaN(res.factors.windRisk) && res.factors.windRisk >= 50, `Cycling wind ${w} km/h produces elevated risk ${res.factors.windRisk}`);
  }

  console.log(`\nMODULE 1 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
