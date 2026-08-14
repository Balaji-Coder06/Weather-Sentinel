/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 2: Uncertainty Quantification, Data Quality & Out-Of-Distribution (OOD) Tests
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
    temperature: 24,
    apparentTemperature: 24,
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
    uvIndex: 4,
    visibility: 10000,
    ...overrides,
  };
}

async function run() {
  console.log('\n================================================================');
  console.log('PHASE 5: MODULE 2 — UNCERTAINTY QUANTIFICATION & OOD TESTS');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();

  // 1. Nominal Conditions Uncertainty
  console.log('1. Nominal Environmental Conditions:');
  {
    const nominal = mockHour();
    const unc = engine.evaluateUncertaintyAndOOD(nominal, {
      completenessRatio: 1.0,
      confidenceLevel: 'HIGH',
      missingVariables: [],
    });

    assert(unc.confidenceLevel === 'HIGH', 'Nominal conditions yield HIGH confidence');
    assert(unc.isOutOfDistribution === false, 'Nominal conditions are not out-of-distribution');
    assert(unc.uncertaintyMargin <= 3, `Low uncertainty margin (±${unc.uncertaintyMargin} pts)`);
  }

  // 2. Missing Telemetry Variables
  console.log('\n2. Degraded Telemetry Quality:');
  {
    const degradedHour = mockHour({ uvIndex: null, visibility: null });
    const unc = engine.evaluateUncertaintyAndOOD(degradedHour, {
      completenessRatio: 0.75,
      confidenceLevel: 'MODERATE',
      missingVariables: ['Solar UV Index', 'Visibility'],
    });

    assert(unc.confidenceLevel === 'MODERATE', 'Degraded telemetry produces MODERATE confidence');
    assert(unc.uncertaintyMargin >= 4, `Uncertainty margin increases appropriately (±${unc.uncertaintyMargin} pts)`);
  }

  // 3. Out-Of-Distribution Extreme Heat Detection (e.g. 50°C in Desert)
  console.log('\n3. Out-Of-Distribution Heat Detection:');
  {
    const extremeHeat = mockHour({ temperature: 50, apparentTemperature: 51 });
    const unc = engine.evaluateUncertaintyAndOOD(extremeHeat);

    assert(unc.isOutOfDistribution === true, 'Extreme 50°C heat triggers Out-Of-Distribution detection');
    assert(unc.oodFactors.some((f) => f.includes('Extreme Heat Shock')), 'Specific heat shock factor identified in OOD reasoning');
    assert(unc.uncertaintyMargin >= 4, `OOD conditions expand uncertainty margin (±${unc.uncertaintyMargin} pts)`);

    // Verify deterministic score is preserved without artificial distortion
    const score = engine.calculateHourlyRisk(extremeHeat, ACTIVITY_REGISTRY.running, 1).riskScore;
    assert(score >= 70 && score <= 100, `Deterministic score remains mathematically valid (${score}/100)`);
  }

  // 4. Out-Of-Distribution Deluge & Typhoon Wind Detection
  console.log('\n4. Out-Of-Distribution Deluge & Gale Detection:');
  {
    const typhoon = mockHour({ precipitation: 55, windSpeed: 95, windGusts: 135 });
    const unc = engine.evaluateUncertaintyAndOOD(typhoon);

    assert(unc.isOutOfDistribution === true, 'Typhoon deluge triggers Out-Of-Distribution detection');
    assert(unc.oodFactors.length >= 2, `Multiple severe OOD factors detected (${unc.oodFactors.length})`);
  }

  console.log(`\nMODULE 2 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
