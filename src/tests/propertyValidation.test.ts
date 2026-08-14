/**
 * WEATHER SENTINEL — PHASE 4 RESEARCH TEST HARNESS
 * Module 3: 1,000+ Vector Property-Based Validation & Invariant Testing
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

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateRandomHour(): NormalizedWeatherHour {
  const t = randomFloat(-30, 58);
  const appT = t + randomFloat(-8, 12);
  const wind = randomFloat(0, 150);
  const gusts = wind + randomFloat(0, 50);

  return {
    timestamp: '2026-08-15T12:00:00Z',
    timeFormatted: '12:00 PM',
    dateFormatted: 'Aug 15, 2026',
    temperature: t,
    apparentTemperature: appT,
    relativeHumidity: randomFloat(0, 100),
    precipitationProbability: randomFloat(0, 100),
    precipitation: randomFloat(0, 120),
    rain: randomFloat(0, 120),
    weatherCode: Math.floor(randomFloat(0, 99)),
    weatherDescription: 'Randomized weather',
    weatherIconName: 'Cloud',
    cloudCover: randomFloat(0, 100),
    windSpeed: wind,
    windDirection: randomFloat(0, 360),
    windGusts: gusts,
    surfacePressure: randomFloat(850, 1060),
    uvIndex: randomFloat(0, 16),
    visibility: randomFloat(0, 25000),
  };
}

async function run() {
  console.log('\n========================================================');
  console.log('PHASE 4: MODULE 3 — 1,000+ VECTOR PROPERTY INVARIANT TESTS');
  console.log('========================================================\n');

  const engine = new RuleBasedRiskEngine();
  const activities = Object.values(ACTIVITY_REGISTRY);

  let boundsViolations = 0;
  let nanViolations = 0;
  let determinismViolations = 0;
  let exceptionCount = 0;

  const totalIterations = 1000;

  for (let i = 0; i < totalIterations; i++) {
    const h = generateRandomHour();
    const act = activities[i % activities.length];
    const dur = randomFloat(0.5, 8.0);

    try {
      const res1 = engine.calculateHourlyRisk(h, act, dur);
      const res2 = engine.calculateHourlyRisk(h, act, dur);

      // 1. Range Invariant: 0 <= riskScore <= 100
      if (res1.riskScore < 0 || res1.riskScore > 100) {
        boundsViolations++;
      }

      // 2. NaN / Infinity Invariant
      if (isNaN(res1.riskScore) || !isFinite(res1.riskScore)) {
        nanViolations++;
      }

      // 3. Determinism Invariant
      if (res1.riskScore !== res2.riskScore || res1.riskLevel !== res2.riskLevel) {
        determinismViolations++;
      }

      // 4. Factor Bounds Invariant
      for (const val of Object.values(res1.factors)) {
        if (val < 0 || val > 100 || isNaN(val) || !isFinite(val)) {
          boundsViolations++;
        }
      }
    } catch {
      exceptionCount++;
    }
  }

  assert(boundsViolations === 0, `Range invariant (0 <= score <= 100) held for all ${totalIterations} random vectors`);
  assert(nanViolations === 0, `Numeric validity invariant (!NaN && !Infinity) held for all ${totalIterations} random vectors`);
  assert(determinismViolations === 0, `Determinism invariant (E(I) === E(I)) held for all ${totalIterations} random vectors`);
  assert(exceptionCount === 0, `Zero runtime exceptions across ${totalIterations} extreme random vectors`);

  console.log(`\nMODULE 3 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
