/**
 * WEATHER SENTINEL — PHASE 4 RESEARCH TEST HARNESS
 * Module 5: Temporal Consistency & Optimal Window Discovery Validation
 */

import { RuleBasedRiskEngine } from '../engine/riskEngine';
import { BestTimeEngine } from '../engine/bestTimeEngine';
import { ACTIVITY_REGISTRY } from '../engine/activityRegistry';
import type { NormalizedForecast, NormalizedWeatherHour } from '../types/weather';

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

function createHour(isoTime: string, temp: number, rainProb: number, wind: number): NormalizedWeatherHour {
  const timePart = isoTime.split('T')[1].substring(0, 5);
  const hourInt = parseInt(timePart.split(':')[0], 10);
  const ampm = hourInt >= 12 ? 'PM' : 'AM';
  const h12 = hourInt % 12 === 0 ? 12 : hourInt % 12;

  return {
    timestamp: isoTime,
    timeFormatted: `${h12}:00 ${ampm}`,
    dateFormatted: 'Aug 15, 2026',
    temperature: temp,
    apparentTemperature: temp,
    relativeHumidity: 50,
    precipitationProbability: rainProb,
    precipitation: rainProb > 50 ? 5 : 0,
    rain: rainProb > 50 ? 5 : 0,
    weatherCode: rainProb > 50 ? 61 : 0,
    weatherDescription: rainProb > 50 ? 'Rain' : 'Clear',
    weatherIconName: 'Sun',
    cloudCover: 10,
    windSpeed: wind,
    windDirection: 180,
    windGusts: wind * 1.3,
    surfacePressure: 1013,
    uvIndex: 3,
    visibility: 10000,
  };
}

async function run() {
  console.log('\n========================================================');
  console.log('PHASE 4: MODULE 5 — TEMPORAL & OPTIMAL WINDOW TESTS');
  console.log('========================================================\n');

  const engine = new RuleBasedRiskEngine();
  const bestTimeEngine = new BestTimeEngine(engine);

  const targetDate = '2026-08-15';

  // 1. Synthetic 24-Hour Forecast with Known Minimum at 06:00 - 08:00
  // Profile: Midday severe heat (38°C), afternoon rain (80%), early morning cool & dry (20°C, 0% rain)
  console.log('1. Known Synthetic Minimum Discovery:');
  const hours24: NormalizedWeatherHour[] = [];
  for (let h = 0; h < 24; h++) {
    const timeIso = `${targetDate}T${h.toString().padStart(2, '0')}:00:00Z`;
    let temp = 22;
    let rainProb = 0;
    let wind = 10;

    if (h >= 6 && h <= 7) {
      temp = 18; // Unique lowest 2-hour window (06:00 - 08:00)
      rainProb = 0;
      wind = 8;
    } else if (h >= 11 && h <= 15) {
      temp = 38; // Harsh midday heat
      wind = 25;
    } else if (h >= 16 && h <= 19) {
      rainProb = 85; // Evening storms
      temp = 27;
    } else {
      temp = 24; // Moderate baseline
    }

    hours24.push(createHour(timeIso, temp, rainProb, wind));
  }

  const forecast: NormalizedForecast = {
    latitude: 13.08,
    longitude: 80.27,
    timezone: 'Asia/Kolkata',
    elevation: 10,
    fetchedAt: Date.now(),
    dataQuality: {
      confidenceScore: 100,
      confidenceLevel: 'HIGH',
      completenessRatio: 1.0,
      missingVariables: [],
      isForecastDegraded: false,
      rationale: 'Complete telemetry',
    },
    hours: hours24,
  };

  const suggestion2h = bestTimeEngine.findBestWindow(
    forecast,
    targetDate,
    ACTIVITY_REGISTRY.running,
    2,
    '2:00 PM',
    55
  );

  assert(suggestion2h.found === true, 'Optimal window found in 24h forecast');
  assert(suggestion2h.startTime === '06:00', `Optimal window starts at known minimum 06:00 (got ${suggestion2h.startTime})`);
  assert(suggestion2h.endTime === '08:00', `Optimal window ends at 08:00 (got ${suggestion2h.endTime})`);
  assert(suggestion2h.riskScore < 20, `Optimal window risk score is favorable (${suggestion2h.riskScore}/100)`);

  // 2. Window with Missing Hourly Gap (Ensure non-contiguous gap is rejected)
  console.log('\n2. Non-Contiguous Forecast Gap Validation:');
  const gappedHours = hours24.filter((h) => {
    const hr = parseInt(h.timestamp.split('T')[1].split(':')[0], 10);
    return hr !== 7; // Cut out 07:00, leaving a gap between 06:00 and 08:00
  });

  const gappedForecast: NormalizedForecast = {
    ...forecast,
    hours: gappedHours,
  };

  const gapSuggestion = bestTimeEngine.findBestWindow(
    gappedForecast,
    targetDate,
    ACTIVITY_REGISTRY.running,
    2,
    '2:00 PM',
    55
  );

  assert(gapSuggestion.found === true, 'Engine recovers and finds alternative contiguous window');
  assert(gapSuggestion.startTime !== '06:00', `Engine skips gapped 06:00 window (selected ${gapSuggestion.startTime})`);

  // 3. All Hours Low Risk (Equally favorable day)
  console.log('\n3. All Hours Low Risk Behavior:');
  const mildHours = hours24.map((h) => createHour(h.timestamp, 19, 0, 8));
  const mildForecast: NormalizedForecast = { ...forecast, hours: mildHours };
  const mildSuggestion = bestTimeEngine.findBestWindow(
    mildForecast,
    targetDate,
    ACTIVITY_REGISTRY.walking,
    1,
    '10:00 AM',
    10
  );
  assert(mildSuggestion.found === true, 'Found window in uniformly mild forecast');
  assert(mildSuggestion.riskScore <= 15, `Score remains low (${mildSuggestion.riskScore})`);

  console.log(`\nMODULE 5 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
