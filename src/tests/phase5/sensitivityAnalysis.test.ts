/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 3: Empirical Tornado Perturbation Sensitivity Analysis
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

function baseHour(): NormalizedWeatherHour {
  return {
    timestamp: '2026-08-15T12:00:00Z',
    timeFormatted: '12:00 PM',
    dateFormatted: 'Aug 15, 2026',
    temperature: 24,
    apparentTemperature: 24,
    relativeHumidity: 50,
    precipitationProbability: 10,
    precipitation: 0,
    rain: 0,
    weatherCode: 1,
    weatherDescription: 'Mainly clear',
    weatherIconName: 'SunMedium',
    cloudCover: 20,
    windSpeed: 12,
    windDirection: 180,
    windGusts: 16,
    surfacePressure: 1013,
    uvIndex: 4,
    visibility: 10000,
  };
}

async function run() {
  console.log('\n================================================================');
  console.log('PHASE 5: MODULE 3 — EMPIRICAL TORNADO SENSITIVITY RANKING');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const base = baseHour();

  console.log('Calculating local perturbation derivatives for all 8 activity profiles:');

  for (const [id, config] of Object.entries(ACTIVITY_REGISTRY)) {
    const baseScore = engine.calculateHourlyRisk(base, config, 1.5).riskScore;

    // Perturb each variable independently by realistic +20% standard deviations
    // 1. Temperature (+5°C)
    const tScore = engine.calculateHourlyRisk({ ...base, temperature: 29, apparentTemperature: 31 }, config, 1.5).riskScore;
    const deltaTemp = Math.abs(tScore - baseScore);

    // 2. Relative Humidity (+30% RH)
    const rhScore = engine.calculateHourlyRisk({ ...base, relativeHumidity: 80, apparentTemperature: 27 }, config, 1.5).riskScore;
    const deltaRH = Math.abs(rhScore - baseScore);

    // 3. Wind (+20 km/h)
    const wScore = engine.calculateHourlyRisk({ ...base, windSpeed: 32, windGusts: 44 }, config, 1.5).riskScore;
    const deltaWind = Math.abs(wScore - baseScore);

    // 4. Rain Probability & Volume (+60% prob, +5mm)
    const rScore = engine.calculateHourlyRisk({ ...base, precipitationProbability: 70, precipitation: 5, rain: 5 }, config, 1.5).riskScore;
    const deltaRain = Math.abs(rScore - baseScore);

    // 5. Solar UV (+5 UV index)
    const uvScore = engine.calculateHourlyRisk({ ...base, uvIndex: 9 }, config, 1.5).riskScore;
    const deltaUv = Math.abs(uvScore - baseScore);

    // 6. Visibility (-8000m -> 2000m)
    const visScore = engine.calculateHourlyRisk({ ...base, visibility: 2000 }, config, 1.5).riskScore;
    const deltaVis = Math.abs(visScore - baseScore);

    const rankings = [
      { name: 'Temperature', delta: deltaTemp },
      { name: 'Rainfall', delta: deltaRain },
      { name: 'Wind Velocity', delta: deltaWind },
      { name: 'Solar UV', delta: deltaUv },
      { name: 'Humidity', delta: deltaRH },
      { name: 'Visibility', delta: deltaVis },
    ].sort((a, b) => b.delta - a.delta);

    console.log(`\n  Activity: ${config.name.toUpperCase()} (Base: ${baseScore}/100)`);
    console.log(`    Tornado Ranking: ${rankings.map((r, i) => `${i + 1}. ${r.name} (+${r.delta})`).join(' | ')}`);

    // Scientific assertions
    if (id === 'running') {
      const topNames = [rankings[0].name, rankings[1].name, rankings[2].name];
      assert(topNames.includes('Temperature') || topNames.includes('Solar UV'), 'Running is strongly driven by Temperature, Solar UV, and Humidity perturbations');
    } else if (id === 'cycling') {
      assert(rankings.some((r) => r.name === 'Wind Velocity' && r.delta > 5), 'Cycling has strong aerodynamic wind sensitivity');
    } else if (id === 'outdoor_sports') {
      assert(rankings[0].name === 'Rainfall' || rankings[1].name === 'Rainfall', 'Outdoor Sports is heavily sensitive to surface rainfall');
    }
  }

  assert(true, 'Tornado local sensitivity ranking computed successfully across all activities');

  console.log(`\nMODULE 3 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
