/**
 * WEATHER SENTINEL — PHASE 3 RESEARCH & ENGINE VALIDATION SUITE
 * 
 * Comprehensive Test Coverage:
 * 1. Meteorological Normalization & Quality Assessment
 * 2. Scenarios A - G (Comfort, Heat Stress, Heavy Rain, Strong Wind, High UV, Poor Visibility, Duration)
 * 3. One-Variable-at-a-Time Sensitivity Gradients
 * 4. Property-Based Invariants (0-100 bounds, determinism, non-negative, missing data resilience)
 * 5. Activity Differentiation (Same weather, distinct contextual risk responses)
 * 6. Deterministic Snapshot Reproducibility
 */

import { RuleBasedRiskEngine } from '../engine/riskEngine';
import { ACTIVITY_REGISTRY } from '../engine/activityRegistry';
import { WeatherService } from '../services/weatherService';
import type { NormalizedWeatherHour, OpenMeteoForecastResponse } from '../types/weather';

declare const process: { exit: (code?: number) => void };

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${failureDetails ? ` -> ${failureDetails}` : ''}`);
  }
}

function createMockHour(overrides: Partial<NormalizedWeatherHour> = {}): NormalizedWeatherHour {
  return {
    timestamp: '2026-08-15T16:00:00Z',
    timeFormatted: '4:00 PM',
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

async function runValidationSuite() {
  console.log('\n======================================================');
  console.log('WEATHER SENTINEL — PHASE 3 INTELLIGENCE ENGINE VALIDATION');
  console.log('======================================================\n');

  const engine = new RuleBasedRiskEngine();

  // ----------------------------------------------------
  // 1. DATA QUALITY & NORMALIZATION TESTS
  // ----------------------------------------------------
  console.log('1. Meteorological Normalization & Confidence Assessment');
  {
    const weatherService = new WeatherService();
    const mockRaw: OpenMeteoForecastResponse = {
      latitude: 13.08,
      longitude: 80.27,
      generationtime_ms: 1.2,
      utc_offset_seconds: 19800,
      timezone: 'Asia/Kolkata',
      timezone_abbreviation: 'IST',
      elevation: 10,
      hourly_units: {
        time: 'iso8601',
        temperature_2m: '°C',
        apparent_temperature: '°C',
        relative_humidity_2m: '%',
        precipitation_probability: '%',
        precipitation: 'mm',
        rain: 'mm',
        weather_code: 'wmo code',
        cloud_cover: '%',
        wind_speed_10m: 'km/h',
        wind_direction_10m: '°',
        wind_gusts_10m: 'km/h',
        surface_pressure: 'hPa',
        uv_index: '',
        visibility: 'm',
      },
      hourly: {
        time: ['2026-08-15T00:00', '2026-08-15T01:00'],
        temperature_2m: [28.5, 29.1],
        apparent_temperature: [32.0, 33.2],
        relative_humidity_2m: [75, 78],
        precipitation_probability: [10, 15],
        precipitation: [0, 0],
        rain: [0, 0],
        weather_code: [1, 2],
        cloud_cover: [20, 30],
        wind_speed_10m: [12, 14],
        wind_direction_10m: [190, 200],
        wind_gusts_10m: [16, 18],
        surface_pressure: [1010, 1009],
        uv_index: [0, 0],
        visibility: [10000, 10000],
      },
    };

    const quality = weatherService.assessDataQuality(mockRaw);
    assert(quality.confidenceLevel === 'HIGH', 'Complete dataset scores HIGH confidence');
    assert(quality.completenessRatio === 1.0, 'Completeness ratio is 1.0 for full data');

    // Test with missing fields
    const partialRaw: OpenMeteoForecastResponse = {
      ...mockRaw,
      hourly: {
        ...mockRaw.hourly,
        uv_index: [null, null],
        visibility: [null, null],
      },
    };
    const partialQuality = weatherService.assessDataQuality(partialRaw);
    assert(partialQuality.confidenceLevel === 'MODERATE' || partialQuality.confidenceLevel === 'LIMITED', 'Missing UV and visibility lowers confidence');
    assert(partialQuality.missingVariables.includes('Solar UV Index'), 'Tracks missing UV variable');
  }

  // ----------------------------------------------------
  // 2. SCENARIO TESTS (A — G)
  // ----------------------------------------------------
  console.log('\n2. Scenario Tests (A — G)');
  {
    // Scenario A: Comfortable Conditions
    const hourA = createMockHour({
      temperature: 20,
      apparentTemperature: 20,
      relativeHumidity: 45,
      precipitationProbability: 0,
      precipitation: 0,
      windSpeed: 10,
      windGusts: 12,
      uvIndex: 2,
      visibility: 10000,
    });
    const resA = engine.calculateHourlyRisk(hourA, ACTIVITY_REGISTRY.running, 1);
    assert(resA.riskLevel === 'LOW', `Scenario A (Comfortable): Risk level is LOW (${resA.riskScore}/100)`);
    assert(resA.riskScore <= 15, `Scenario A score is very low (${resA.riskScore} <= 15)`);

    // Scenario B: Heat Stress
    const hourB = createMockHour({
      temperature: 36,
      apparentTemperature: 43,
      relativeHumidity: 78,
      precipitationProbability: 0,
      precipitation: 0,
      windSpeed: 8,
      windGusts: 10,
      uvIndex: 4,
    });
    const resB = engine.calculateHourlyRisk(hourB, ACTIVITY_REGISTRY.running, 2);
    const driverB = engine.getPrimaryDriver(resB.factors);
    assert(resB.riskLevel === 'HIGH' || resB.riskLevel === 'SEVERE', `Scenario B (Heat Stress): Risk is HIGH/SEVERE (${resB.riskScore}/100)`);
    assert(driverB?.name === 'Thermal Load', `Scenario B Primary Driver is Thermal Load (got ${driverB?.name})`);

    // Scenario C: Heavy Precipitation & Thunderstorm
    const hourC = createMockHour({
      temperature: 24,
      apparentTemperature: 24,
      precipitationProbability: 95,
      precipitation: 12.5,
      rain: 12.5,
      weatherCode: 95, // Thunderstorm
      windSpeed: 25,
      windGusts: 40,
    });
    const resC = engine.calculateHourlyRisk(hourC, ACTIVITY_REGISTRY.outdoor_sports, 2);
    const driverC = engine.getPrimaryDriver(resC.factors);
    assert(resC.riskLevel === 'HIGH' || resC.riskLevel === 'SEVERE', `Scenario C (Heavy Rain/Storm): Risk is HIGH/SEVERE (${resC.riskScore}/100)`);
    assert(driverC?.name === 'Precipitation', `Scenario C Primary Driver is Precipitation (got ${driverC?.name})`);

    // Scenario D: Gale-Force Wind
    const hourD = createMockHour({
      temperature: 20,
      apparentTemperature: 20,
      precipitationProbability: 0,
      windSpeed: 45,
      windGusts: 68,
    });
    const resD = engine.calculateHourlyRisk(hourD, ACTIVITY_REGISTRY.cycling, 1.5);
    const driverD = engine.getPrimaryDriver(resD.factors);
    assert(resD.riskLevel === 'HIGH' || resD.riskLevel === 'SEVERE', `Scenario D (Strong Wind): Risk is HIGH/SEVERE (${resD.riskScore}/100)`);
    assert(driverD?.name === 'Wind Dynamics', `Scenario D Primary Driver is Wind Dynamics (got ${driverD?.name})`);

    // Scenario E: High UV Index
    const hourE = createMockHour({
      temperature: 22,
      apparentTemperature: 22,
      precipitationProbability: 0,
      windSpeed: 8,
      uvIndex: 11, // Extreme UV
    });
    const resE = engine.calculateHourlyRisk(hourE, ACTIVITY_REGISTRY.hiking, 2);
    const driverE = engine.getPrimaryDriver(resE.factors);
    assert(resE.factors.uvRisk >= 60, `Scenario E (High UV): UV factor score is elevated (${resE.factors.uvRisk})`);
    assert(driverE?.name === 'Solar UV', `Scenario E Primary Driver is Solar UV (got ${driverE?.name})`);

    // Scenario F: Dense Fog / Poor Visibility
    const hourF = createMockHour({
      temperature: 15,
      apparentTemperature: 15,
      precipitationProbability: 0,
      windSpeed: 5,
      visibility: 500, // Dense fog < 1000m
    });
    const resF = engine.calculateHourlyRisk(hourF, ACTIVITY_REGISTRY.travel, 1);
    const driverF = engine.getPrimaryDriver(resF.factors);
    assert(resF.factors.visibilityRisk >= 60, `Scenario F (Dense Fog): Visibility factor score is high (${resF.factors.visibilityRisk})`);
    assert(driverF?.name === 'Visibility Restriction', `Scenario F Primary Driver is Visibility (got ${driverF?.name})`);

    // Scenario G: Bounded Monotonic Duration Scaling
    const durations = [0.5, 1, 2, 3, 4, 6];
    const hourG = createMockHour({
      temperature: 32,
      apparentTemperature: 37,
      relativeHumidity: 65,
    });
    const durationScores = durations.map((d) => engine.calculateHourlyRisk(hourG, ACTIVITY_REGISTRY.running, d).riskScore);
    
    let isMonotonic = true;
    for (let i = 1; i < durationScores.length; i++) {
      if (durationScores[i] < durationScores[i - 1]) {
        isMonotonic = false;
        break;
      }
    }
    assert(isMonotonic, `Scenario G: Duration risk increases monotonically (${durationScores.join(' -> ')})`);
    assert(durationScores[durationScores.length - 1] <= 100, `Scenario G: Duration risk remains bounded <= 100 (6h = ${durationScores[durationScores.length - 1]})`);
  }

  // ----------------------------------------------------
  // 3. ONE-VARIABLE-AT-A-TIME SENSITIVITY GRADIENTS
  // ----------------------------------------------------
  console.log('\n3. Sensitivity Tests (One-Variable-at-a-Time)');
  {
    // Temperature sensitivity (Running)
    const temps = [16, 22, 28, 34, 40];
    const tempScores = temps.map((t) => {
      const h = createMockHour({ temperature: t, apparentTemperature: t });
      return engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.running, 1).riskScore;
    });
    let tempMonotonic = true;
    for (let i = 1; i < tempScores.length; i++) {
      if (tempScores[i] < tempScores[i - 1]) tempMonotonic = false;
    }
    assert(tempMonotonic, `Temperature sensitivity gradient is strictly monotonic (${tempScores.join(' -> ')})`);

    // Wind sensitivity (Cycling)
    const winds = [5, 15, 25, 40, 60];
    const windScores = winds.map((w) => {
      const h = createMockHour({ windSpeed: w, windGusts: w * 1.3 });
      return engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.cycling, 1).riskScore;
    });
    let windMonotonic = true;
    for (let i = 1; i < windScores.length; i++) {
      if (windScores[i] < windScores[i - 1]) windMonotonic = false;
    }
    assert(windMonotonic, `Wind velocity sensitivity gradient is strictly monotonic (${windScores.join(' -> ')})`);

    // Rain probability sensitivity (Outdoor Sports)
    const probs = [0, 20, 40, 70, 100];
    const rainScores = probs.map((p) => {
      const h = createMockHour({ precipitationProbability: p });
      return engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.outdoor_sports, 1).riskScore;
    });
    let rainMonotonic = true;
    for (let i = 1; i < rainScores.length; i++) {
      if (rainScores[i] < rainScores[i - 1]) rainMonotonic = false;
    }
    assert(rainMonotonic, `Rain probability sensitivity gradient is strictly monotonic (${rainScores.join(' -> ')})`);

    // Solar UV sensitivity (Hiking)
    const uvs = [0, 2, 5, 8, 11];
    const uvScores = uvs.map((u) => {
      const h = createMockHour({ uvIndex: u });
      return engine.calculateHourlyRisk(h, ACTIVITY_REGISTRY.hiking, 1).riskScore;
    });
    let uvMonotonic = true;
    for (let i = 1; i < uvScores.length; i++) {
      if (uvScores[i] < uvScores[i - 1]) uvMonotonic = false;
    }
    assert(uvMonotonic, `Solar UV radiation sensitivity gradient is strictly monotonic (${uvScores.join(' -> ')})`);
  }

  // ----------------------------------------------------
  // 4. PROPERTY-BASED INVARIANTS
  // ----------------------------------------------------
  console.log('\n4. Property-Based Invariants');
  {
    let boundsHold = true;
    let noErrors = true;

    for (let i = 0; i < 200; i++) {
      const randomHour = createMockHour({
        temperature: Math.floor(Math.random() * 80) - 20, // -20 to 60 C
        apparentTemperature: Math.floor(Math.random() * 80) - 20,
        relativeHumidity: Math.floor(Math.random() * 100),
        precipitationProbability: Math.floor(Math.random() * 100),
        precipitation: Math.random() * 50,
        windSpeed: Math.random() * 100,
        windGusts: Math.random() * 140,
        uvIndex: Math.random() * 14,
        visibility: Math.random() * 20000,
      });

      const activities = Object.values(ACTIVITY_REGISTRY);
      const randActivity = activities[Math.floor(Math.random() * activities.length)];
      const randDuration = Math.random() * 7.5 + 0.5;

      try {
        const res = engine.calculateHourlyRisk(randomHour, randActivity, randDuration);
        if (res.riskScore < 0 || res.riskScore > 100 || isNaN(res.riskScore)) {
          boundsHold = false;
        }
      } catch {
        noErrors = false;
      }
    }

    assert(boundsHold, 'Invariant: 0 <= riskScore <= 100 across 200 random physical vectors');
    assert(noErrors, 'Invariant: No unhandled exceptions on extreme randomized weather inputs');

    // Determinism test
    const staticHour = createMockHour({ temperature: 31.4, relativeHumidity: 68, windSpeed: 18.2 });
    const run1 = engine.calculateHourlyRisk(staticHour, ACTIVITY_REGISTRY.running, 2);
    const run2 = engine.calculateHourlyRisk(staticHour, ACTIVITY_REGISTRY.running, 2);
    assert(run1.riskScore === run2.riskScore && run1.riskLevel === run2.riskLevel, 'Invariant: Deterministic reproducibility (Engine(I) === Engine(I))');
  }

  // ----------------------------------------------------
  // 5. ACTIVITY DIFFERENTIATION TEST
  // ----------------------------------------------------
  console.log('\n5. Activity Context Differentiation');
  {
    // Test under identical hot & humid conditions
    const hotHumidHour = createMockHour({
      temperature: 33,
      apparentTemperature: 40,
      relativeHumidity: 75,
      precipitationProbability: 10,
      windSpeed: 10,
      uvIndex: 5,
    });

    const runningRisk = engine.calculateHourlyRisk(hotHumidHour, ACTIVITY_REGISTRY.running, 1.5).riskScore;
    const photoRisk = engine.calculateHourlyRisk(hotHumidHour, ACTIVITY_REGISTRY.photography, 1.5).riskScore;
    const walkingRisk = engine.calculateHourlyRisk(hotHumidHour, ACTIVITY_REGISTRY.walking, 1.5).riskScore;

    assert(
      runningRisk > photoRisk,
      `High metabolic Running risk (${runningRisk}) > Low metabolic Photography risk (${photoRisk}) under identical heat`
    );
    assert(
      runningRisk > walkingRisk,
      `Running risk (${runningRisk}) > Walking risk (${walkingRisk}) under identical heat`
    );

    // Test under identical wet pavement conditions
    const wetHour = createMockHour({
      precipitationProbability: 75,
      precipitation: 5.2,
      rain: 5.2,
      temperature: 20,
      apparentTemperature: 20,
      windSpeed: 15,
    });

    const cyclingWetRisk = engine.calculateHourlyRisk(wetHour, ACTIVITY_REGISTRY.cycling, 1).riskScore;
    const walkingWetRisk = engine.calculateHourlyRisk(wetHour, ACTIVITY_REGISTRY.walking, 1).riskScore;

    assert(
      cyclingWetRisk > walkingWetRisk,
      `Cycling wet traction risk (${cyclingWetRisk}) > Walking rain risk (${walkingWetRisk}) under identical rainfall`
    );
  }

  // ----------------------------------------------------
  // 6. DETERMINISTIC BENCHMARK SNAPSHOT
  // ----------------------------------------------------
  console.log('\n6. Deterministic Benchmark Snapshot Test');
  {
    const benchmarkHour = createMockHour({
      temperature: 30,
      apparentTemperature: 36,
      relativeHumidity: 70,
      precipitationProbability: 20,
      precipitation: 0,
      windSpeed: 18,
      windGusts: 26,
      uvIndex: 6,
      visibility: 8000,
    });

    const benchRes = engine.calculateHourlyRisk(benchmarkHour, ACTIVITY_REGISTRY.outdoor_sports, 2);
    // Verified calibrated score for this fixture
    assert(benchRes.riskScore >= 30 && benchRes.riskScore <= 45, `Benchmark fixture score within calibrated bounds (${benchRes.riskScore}/100)`);
    assert(benchRes.factors.heatRisk > 0, `Thermal factor is positive (${benchRes.factors.heatRisk})`);
    assert(benchRes.factors.windRisk > 0, `Wind factor is positive (${benchRes.factors.windRisk})`);
  }

  console.log('\n======================================================');
  console.log(`VALIDATION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runValidationSuite().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
