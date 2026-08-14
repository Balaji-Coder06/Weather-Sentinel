/**
 * WEATHER SENTINEL — PHASE 8 PRODUCT & REAL-WORLD USER VALIDATION
 * 
 * Verifies:
 * 1. Live Open-Meteo Multi-Location Weather Ingestion (Chennai, Mumbai, Delhi, London, Tokyo)
 * 2. Activity Differentiation over Real Weather
 * 3. Real-World User Scenarios (Walking, Sports, Cycling, Event)
 * 4. Recommendation Quality & Non-Guaranteed Safety Language
 * 5. Uncertainty & Data Transparency
 */

import { OpenMeteoWeatherProvider } from '../../services/weatherProvider';
import { WeatherService } from '../../services/weatherService';
import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { BestTimeEngine } from '../../engine/bestTimeEngine';
import { RecommendationEngine } from '../../engine/recommendationEngine';
import { ACTIVITY_REGISTRY } from '../../engine/activityRegistry';

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

async function run() {
  console.log('\n================================================================');
  console.log('PHASE 8: PRODUCT & REAL-WORLD USER VALIDATION');
  console.log('================================================================\n');

  const provider = new OpenMeteoWeatherProvider();
  const weatherService = new WeatherService(provider);
  const riskEngine = new RuleBasedRiskEngine();
  const bestTimeEngine = new BestTimeEngine(riskEngine);
  const recEngine = new RecommendationEngine();

  // 1. Live Multi-Location Open-Meteo Weather Fetching
  console.log('1. Live Multi-Location Weather Integration:');
  const targetLocations = [
    { name: 'Chennai, India', lat: 13.088, lon: 80.278, tz: 'Asia/Kolkata' },
    { name: 'Mumbai, India', lat: 19.076, lon: 72.877, tz: 'Asia/Kolkata' },
    { name: 'Delhi, India', lat: 28.614, lon: 77.209, tz: 'Asia/Kolkata' },
    { name: 'London, UK', lat: 51.507, lon: -0.128, tz: 'Europe/London' },
    { name: 'Tokyo, Japan', lat: 35.676, lon: 139.650, tz: 'Asia/Tokyo' },
  ];

  let liveForecastChennai: any = null;

  for (const loc of targetLocations) {
    try {
      const forecast = await weatherService.getForecast({
        latitude: loc.lat,
        longitude: loc.lon,
        timezone: loc.tz,
        forecastDays: 7,
      });

      if (loc.name.includes('Chennai')) {
        liveForecastChennai = forecast;
      }

      assert(forecast.hours.length >= 168, `Location ${loc.name}: 7-day hourly forecast loaded (${forecast.hours.length} hours)`);
      assert(forecast.dataQuality.confidenceLevel === 'HIGH' || forecast.dataQuality.confidenceLevel === 'MODERATE', `Location ${loc.name}: Data confidence is ${forecast.dataQuality.confidenceLevel}`);
      
      const sampleHour = forecast.hours[12];
      assert(sampleHour.temperature !== null && sampleHour.relativeHumidity !== null, `Location ${loc.name}: Core meteorological variables populated`);
      console.log(`    ${loc.name}: ${sampleHour.temperature}°C, ${sampleHour.relativeHumidity}% RH, Wind ${sampleHour.windSpeed} km/h, UV ${sampleHour.uvIndex}`);
    } catch (err: any) {
      assert(false, `Live fetch failed for ${loc.name}: ${err.message}`);
    }
  }

  // 2. Activity Differentiation over Real Live Weather (Chennai Midday)
  console.log('\n2. Contextual Activity Differentiation under Identical Live Weather:');
  if (liveForecastChennai) {
    const middayHour = liveForecastChennai.hours[14]; // 2:00 PM
    console.log(`  Evaluating identical conditions at ${middayHour.timeFormatted} (${middayHour.temperature}°C, Feels ${middayHour.apparentTemperature}°C, ${middayHour.relativeHumidity}% RH):`);

    const activityScores: Record<string, number> = {};
    for (const [, config] of Object.entries(ACTIVITY_REGISTRY)) {
      const res = riskEngine.calculateHourlyRisk(middayHour, config, 1.5);
      activityScores[config.name] = res.riskScore;
      console.log(`    ${config.name.padEnd(18)}: Risk ${res.riskScore.toString().padStart(3)}/100 [${res.riskLevel}], Driver: ${riskEngine.getPrimaryDriver(res.factors)?.name}`);
    }

    assert(activityScores['Running'] !== undefined && activityScores['Photography'] !== undefined, 'Activity profiles evaluated successfully');
    assert(activityScores['Running'] >= activityScores['Photography'], `Running risk (${activityScores['Running']}) >= Photography risk (${activityScores['Photography']}) under identical midday heat`);
  }

  // 3. Real-World User Scenarios
  console.log('\n3. Real-World User Question Scenarios:');
  if (liveForecastChennai) {
    const todayDate = liveForecastChennai.hours[0].timestamp.split('T')[0];

    // Scenario A: "I want to walk to college at 4 PM"
    const walkRes = bestTimeEngine.findBestWindow(
      liveForecastChennai,
      todayDate,
      ACTIVITY_REGISTRY.walking,
      1,
      '16:00',
      35
    );
    assert(walkRes.found === true, 'Scenario A (Walking 4 PM): Decision window computed');
    console.log(`    Walk Recommendation: Selected ${walkRes.timeRangeFormatted} (Risk ${walkRes.riskScore}/100)`);

    // Scenario B: "Play outdoor sports from 4–6 PM (2 hours)"
    const sportsRes = bestTimeEngine.findBestWindow(
      liveForecastChennai,
      todayDate,
      ACTIVITY_REGISTRY.outdoor_sports,
      2,
      '16:00',
      45
    );
    assert(sportsRes.found === true, 'Scenario B (Outdoor Sports 4-6 PM): Decision window computed');
    console.log(`    Sports Recommendation: Selected ${sportsRes.timeRangeFormatted} (Risk ${sportsRes.riskScore}/100)`);

    // Scenario C: "Cycle for 2 hours"
    const cycleRes = bestTimeEngine.findBestWindow(
      liveForecastChennai,
      todayDate,
      ACTIVITY_REGISTRY.cycling,
      2,
      '07:00',
      30
    );
    assert(cycleRes.found === true, 'Scenario C (Cycling 2 hours): Decision window computed');
    console.log(`    Cycling Recommendation: Selected ${cycleRes.timeRangeFormatted} (Risk ${cycleRes.riskScore}/100)`);
  }

  // 4. Recommendation Language Safety Audit
  console.log('\n4. Recommendation Language Safety Audit:');
  {
    const mockWindow = {
      hours: [],
      peakRiskHour: null as any,
      lowestRiskHour: null as any,
      averageRiskScore: 15,
      conditionTrajectory: 'stable' as const,
    };
    const rec = recEngine.generateRecommendation(15, 'LOW', { rainRisk: 0, heatRisk: 5, windRisk: 5, uvRisk: 5, visibilityRisk: 0 }, mockWindow, ACTIVITY_REGISTRY.walking);
    
    assert(!rec.summary.includes('100% safe') && !rec.summary.includes('guaranteed'), 'Recommendation avoids absolute safety guarantees');
    assert(rec.detailedGuidance.length >= 1, 'Actionable guidance generated for activity');
  }

  console.log(`\nMODULE RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
