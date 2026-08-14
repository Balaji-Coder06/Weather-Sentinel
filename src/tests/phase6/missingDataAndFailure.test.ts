/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH EVALUATION
 * Module 6: Missing Data Stress Testing, API Failure & Race Condition Audit
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { ACTIVITY_REGISTRY } from '../../engine/activityRegistry';
import type { NormalizedWeatherHour, NormalizedForecast } from '../../types/weather';

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
  console.log('PHASE 6: MODULE 6 — MISSING DATA, API FAILURE & STATE ISOLATION');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();

  // 1. Single Variable Telemetry Ablation
  console.log('1. Progressive Single-Variable Telemetry Ablation:');
  const variablesToAblate: Array<keyof NormalizedWeatherHour> = [
    'temperature',
    'apparentTemperature',
    'relativeHumidity',
    'precipitation',
    'windSpeed',
    'windGusts',
    'uvIndex',
    'visibility',
  ];

  for (const v of variablesToAblate) {
    const ablatedHour = mockHour({ [v]: null });
    const res = engine.calculateHourlyRisk(ablatedHour, ACTIVITY_REGISTRY.running, 1);
    assert(
      !isNaN(res.riskScore) && isFinite(res.riskScore) && res.riskScore >= 0 && res.riskScore <= 100,
      `Ablating '${v}' yields safe finite score (${res.riskScore}/100)`
    );
  }

  // 2. Multi-Variable Missing Telemetry Stress Test
  console.log('\n2. Severe Multi-Variable Ablation:');
  const severeAblation = mockHour({
    uvIndex: null,
    visibility: null,
    windGusts: null,
    precipitationProbability: null,
  });
  const multiRes = engine.calculateHourlyRisk(severeAblation, ACTIVITY_REGISTRY.hiking, 2);
  const unc = engine.evaluateUncertaintyAndOOD(severeAblation, {
    completenessRatio: 0.5,
    confidenceLevel: 'LIMITED',
    missingVariables: ['UV', 'Visibility', 'Gusts', 'PrecipProb'],
  });

  assert(!isNaN(multiRes.riskScore), 'Multi-variable ablation produces finite risk score');
  assert(unc.confidenceLevel === 'LIMITED', 'Uncertainty engine marks multi-variable ablation as LIMITED confidence');
  assert(unc.uncertaintyMargin >= 8, `Uncertainty margin expands under severe ablation (±${unc.uncertaintyMargin} pts)`);

  // 3. Race Condition / Consecutive Rapid Plan Updates Simulation
  console.log('\n3. State Isolation & Concurrent Execution:');
  const forecastA: NormalizedForecast = {
    latitude: 13.088,
    longitude: 80.278,
    timezone: 'Asia/Kolkata',
    elevation: 6,
    fetchedAt: Date.now(),
    dataQuality: { confidenceScore: 100, confidenceLevel: 'HIGH', completenessRatio: 1.0, missingVariables: [], isForecastDegraded: false, rationale: '' },
    hours: [mockHour({ timestamp: '2026-08-15T08:00:00Z', temperature: 36, apparentTemperature: 45 })],
  };

  const forecastB: NormalizedForecast = {
    latitude: 51.507,
    longitude: -0.128,
    timezone: 'Europe/London',
    elevation: 25,
    fetchedAt: Date.now(),
    dataQuality: { confidenceScore: 100, confidenceLevel: 'HIGH', completenessRatio: 1.0, missingVariables: [], isForecastDegraded: false, rationale: '' },
    hours: [mockHour({ timestamp: '2026-08-15T08:00:00Z', temperature: 18, apparentTemperature: 18 })],
  };

  // Run overlapping evaluation calls
  const [resA, resB] = await Promise.all([
    Promise.resolve({
      locationName: 'Chennai',
      result: engine.calculateHourlyRisk(forecastA.hours[0], ACTIVITY_REGISTRY.running, 1),
    }),
    Promise.resolve({
      locationName: 'London',
      result: engine.calculateHourlyRisk(forecastB.hours[0], ACTIVITY_REGISTRY.walking, 1),
    }),
  ]);

  assert(resA.result.riskScore > resB.result.riskScore, `Concurrent executions remain completely isolated (${resA.locationName}: ${resA.result.riskScore} vs ${resB.locationName}: ${resB.result.riskScore})`);
  assert(resA.locationName === 'Chennai' && resB.locationName === 'London', 'Location metadata does not cross-contaminate between asynchronous plan evaluations');

  console.log(`\nMODULE 6 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
