/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 6: Historical Hourly Optimal Window & Diurnal Transition Tests
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { BestTimeEngine } from '../../engine/bestTimeEngine';
import { ACTIVITY_REGISTRY } from '../../engine/activityRegistry';
import { getExpandedHistoricalDataset } from '../../data/historicalWeatherDataset';
import type { NormalizedForecast } from '../../types/weather';

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
  console.log('PHASE 5: MODULE 6 — HISTORICAL OPTIMAL WINDOW DISCOVERY');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const bestTime = new BestTimeEngine(engine);
  const dataset = getExpandedHistoricalDataset();

  // Extract a 24-hour sequence for Phoenix (Hot Desert) on Aug 1, 2023
  const phoenixHours = dataset.filter(
    (r) => r.locationName.includes('Phoenix') && r.timestamp.startsWith('2023-08-01')
  );

  const forecastPhoenix: NormalizedForecast = {
    latitude: 33.448,
    longitude: -112.074,
    timezone: 'America/Phoenix',
    elevation: 331,
    fetchedAt: Date.now(),
    dataQuality: {
      confidenceScore: 100,
      confidenceLevel: 'HIGH',
      completenessRatio: 1.0,
      missingVariables: [],
      isForecastDegraded: false,
      rationale: 'Complete historical ERA5 dataset',
    },
    hours: phoenixHours,
  };

  // Test Running (2 hours duration, user selected 2:00 PM extreme heat)
  const phoenixSuggestion = bestTime.findBestWindow(
    forecastPhoenix,
    '2023-08-01',
    ACTIVITY_REGISTRY.running,
    2,
    '2:00 PM',
    74
  );

  assert(phoenixSuggestion.found === true, 'Optimal window found in Phoenix historical diurnal sequence');
  assert(
    parseInt(phoenixSuggestion.startTime.split(':')[0], 10) <= 9 || parseInt(phoenixSuggestion.startTime.split(':')[0], 10) >= 18,
    `Optimal window avoids extreme midday afternoon heat in Phoenix (selected ${phoenixSuggestion.timeRangeFormatted})`
  );
  assert(
    phoenixSuggestion.riskScore < 74,
    `Optimal window reduces risk score below peak afternoon risk (${phoenixSuggestion.riskScore} vs 74)`
  );

  // Extract 24-hour London sequence (moderate diurnal cycle)
  const londonHours = dataset.filter(
    (r) => r.locationName.includes('London') && r.timestamp.startsWith('2023-08-01')
  );

  const forecastLondon: NormalizedForecast = {
    latitude: 51.507,
    longitude: -0.128,
    timezone: 'Europe/London',
    elevation: 25,
    fetchedAt: Date.now(),
    dataQuality: {
      confidenceScore: 100,
      confidenceLevel: 'HIGH',
      completenessRatio: 1.0,
      missingVariables: [],
      isForecastDegraded: false,
      rationale: 'Complete historical ERA5 dataset',
    },
    hours: londonHours,
  };

  const londonSuggestion = bestTime.findBestWindow(
    forecastLondon,
    '2023-08-01',
    ACTIVITY_REGISTRY.walking,
    1,
    '4:00 PM',
    25
  );

  assert(londonSuggestion.found === true, 'Optimal window found in London historical sequence');
  assert(londonSuggestion.riskScore <= 20, `London optimal window achieves low risk (${londonSuggestion.riskScore}/100)`);

  console.log(`\nMODULE 6 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
