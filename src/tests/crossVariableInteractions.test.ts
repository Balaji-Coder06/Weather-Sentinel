/**
 * WEATHER SENTINEL — PHASE 4 RESEARCH TEST HARNESS
 * Module 2: Cross-Variable Interaction & Non-Double-Counting Experiments
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
    timestamp: '2026-08-15T15:00:00Z',
    timeFormatted: '3:00 PM',
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
  console.log('PHASE 4: MODULE 2 — CROSS-VARIABLE INTERACTION TESTS');
  console.log('========================================================\n');

  const engine = new RuleBasedRiskEngine();

  // 1. Heat + Humidity Interaction
  console.log('1. Heat & Relative Humidity Interaction:');
  {
    const dryHeat = mockHour({ temperature: 35, apparentTemperature: 36, relativeHumidity: 40 });
    const humidHeat = mockHour({ temperature: 35, apparentTemperature: 43, relativeHumidity: 80 });
    const resDry = engine.calculateHourlyRisk(dryHeat, ACTIVITY_REGISTRY.running, 1.5);
    const resHumid = engine.calculateHourlyRisk(humidHeat, ACTIVITY_REGISTRY.running, 1.5);

    assert(
      resHumid.riskScore > resDry.riskScore,
      `35°C at 80% RH (${resHumid.riskScore}) > 35°C at 40% RH (${resDry.riskScore})`
    );
    assert(
      resHumid.factors.heatRisk > resDry.factors.heatRisk,
      `Thermal vector reflects humidity evaporation restriction (${resHumid.factors.heatRisk} vs ${resDry.factors.heatRisk})`
    );

    // Monotonic thermal curve under constant high humidity
    const t34 = engine.calculateHourlyRisk(mockHour({ temperature: 34, apparentTemperature: 41, relativeHumidity: 80 }), ACTIVITY_REGISTRY.running, 1).riskScore;
    const t35 = engine.calculateHourlyRisk(mockHour({ temperature: 35, apparentTemperature: 43, relativeHumidity: 80 }), ACTIVITY_REGISTRY.running, 1).riskScore;
    const t36 = engine.calculateHourlyRisk(mockHour({ temperature: 36, apparentTemperature: 45, relativeHumidity: 80 }), ACTIVITY_REGISTRY.running, 1).riskScore;
    assert(t36 >= t35 && t35 >= t34, `Monotonic thermal scaling at 80% RH: 34°C (${t34}) <= 35°C (${t35}) <= 36°C (${t36})`);
  }

  // 2. Wind Velocity & Gusts Non-Double-Counting
  console.log('\n2. Wind Speed vs Gusts Aerodynamic Governing Vector:');
  {
    const calmGusts = mockHour({ windSpeed: 20, windGusts: 20 });
    const gustyWind = mockHour({ windSpeed: 20, windGusts: 50 });
    const sustainedHigh = mockHour({ windSpeed: 50, windGusts: 50 });

    const resCalm = engine.calculateHourlyRisk(calmGusts, ACTIVITY_REGISTRY.cycling, 1);
    const resGusty = engine.calculateHourlyRisk(gustyWind, ACTIVITY_REGISTRY.cycling, 1);
    const resSustained = engine.calculateHourlyRisk(sustainedHigh, ACTIVITY_REGISTRY.cycling, 1);

    assert(
      resGusty.factors.windRisk > resCalm.factors.windRisk,
      `Gusts (50 km/h) elevate wind risk over flat 20 km/h (${resGusty.factors.windRisk} > ${resCalm.factors.windRisk})`
    );
    assert(
      resSustained.factors.windRisk >= resGusty.factors.windRisk,
      `Sustained 50 km/h provides continuous aerodynamic drag (${resSustained.factors.windRisk} >= ${resGusty.factors.windRisk})`
    );
  }

  // 3. Rain Probability vs Accumulation vs Convective Storm Codes
  console.log('\n3. Rain Probability vs Volume vs Convective Storm:');
  {
    const lightRain = mockHour({ precipitationProbability: 70, precipitation: 2.0, rain: 2.0, weatherCode: 61 });
    const heavyRain = mockHour({ precipitationProbability: 70, precipitation: 20.0, rain: 20.0, weatherCode: 65 });
    const stormRain = mockHour({ precipitationProbability: 70, precipitation: 20.0, rain: 20.0, weatherCode: 95 });

    const resLight = engine.calculateHourlyRisk(lightRain, ACTIVITY_REGISTRY.outdoor_sports, 1);
    const resHeavy = engine.calculateHourlyRisk(heavyRain, ACTIVITY_REGISTRY.outdoor_sports, 1);
    const resStorm = engine.calculateHourlyRisk(stormRain, ACTIVITY_REGISTRY.outdoor_sports, 1);

    assert(
      resHeavy.factors.rainRisk > resLight.factors.rainRisk,
      `20mm accumulation (${resHeavy.factors.rainRisk}) > 2mm accumulation (${resLight.factors.rainRisk})`
    );
    assert(
      resStorm.factors.rainRisk >= resHeavy.factors.rainRisk,
      `Convective thunderstorm bonus applied appropriately (${resStorm.factors.rainRisk} >= ${resHeavy.factors.rainRisk})`
    );
    assert(
      resStorm.factors.rainRisk <= 100,
      `Precipitation risk bounded at 100 max without overflow (${resStorm.factors.rainRisk})`
    );
  }

  // 4. Solar UV Index vs Cloud Cover Interaction
  console.log('\n4. Solar UV Index Evaluation:');
  {
    const uvClear = mockHour({ uvIndex: 8, cloudCover: 10 });
    const uvCloudy = mockHour({ uvIndex: 8, cloudCover: 90 });
    const resClear = engine.calculateHourlyRisk(uvClear, ACTIVITY_REGISTRY.hiking, 2);
    const resCloudy = engine.calculateHourlyRisk(uvCloudy, ACTIVITY_REGISTRY.hiking, 2);

    assert(
      resClear.factors.uvRisk === resCloudy.factors.uvRisk,
      `Model evaluates surface UV Index directly as measured/forecasted (${resClear.factors.uvRisk} === ${resCloudy.factors.uvRisk})`
    );
  }

  console.log(`\nMODULE 2 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
