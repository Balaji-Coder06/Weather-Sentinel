/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 1: Historical Dataset Quality, Provenance & Risk Distribution Analysis
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { ACTIVITY_REGISTRY } from '../../engine/activityRegistry';
import { getExpandedHistoricalDataset } from '../../data/historicalWeatherDataset';

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
  console.log('PHASE 5: MODULE 1 — HISTORICAL DATASET & DISTRIBUTION ANALYSIS');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const dataset = getExpandedHistoricalDataset();

  console.log(`Total Historical Dataset Records Loaded: ${dataset.length}`);
  assert(dataset.length >= 1000, `Dataset contains at least 1,000 physical hourly records (got ${dataset.length})`);

  // Data Quality & Provenance Layer
  let validCount = 0;
  let invalidCount = 0;
  let highConfidenceCount = 0;
  let moderateConfidenceCount = 0;
  let limitedConfidenceCount = 0;
  let oodCount = 0;

  const riskScores: number[] = [];
  const riskLevels = { LOW: 0, MODERATE: 0, HIGH: 0, SEVERE: 0 };
  const primaryDriverCounts: Record<string, number> = {};

  for (const record of dataset) {
    // Provenance & Validity Checks
    const hasValidCoordinates = !isNaN(record.latitude) && !isNaN(record.longitude);
    const hasValidTimestamp = Boolean(record.timestamp && !isNaN(new Date(record.timestamp).getTime()));
    const hasPhysicalBounds = (record.temperature ?? 0) >= -60 && (record.temperature ?? 0) <= 65 &&
      (record.relativeHumidity ?? 0) >= 0 && (record.relativeHumidity ?? 0) <= 100 &&
      (record.windSpeed ?? 0) >= 0 && (record.windSpeed ?? 0) <= 300;

    if (!hasValidCoordinates || !hasValidTimestamp || !hasPhysicalBounds) {
      invalidCount++;
      continue;
    }

    validCount++;

    // Evaluate risk across primary fitness activity (Running, 1.5h duration)
    const result = engine.calculateHourlyRisk(record, ACTIVITY_REGISTRY.running, 1.5);
    riskScores.push(result.riskScore);
    riskLevels[result.riskLevel]++;

    const driver = engine.getPrimaryDriver(result.factors);
    if (driver) {
      primaryDriverCounts[driver.name] = (primaryDriverCounts[driver.name] || 0) + 1;
    }

    // Evaluate Uncertainty & OOD
    const uncertainty = engine.evaluateUncertaintyAndOOD(record);
    if (uncertainty.confidenceLevel === 'HIGH') highConfidenceCount++;
    else if (uncertainty.confidenceLevel === 'MODERATE') moderateConfidenceCount++;
    else limitedConfidenceCount++;

    if (uncertainty.isOutOfDistribution) oodCount++;
  }

  assert(invalidCount === 0, `All physical historical records pass physical bounds validation (0 invalid, ${validCount} valid)`);
  assert(highConfidenceCount + moderateConfidenceCount + limitedConfidenceCount === validCount, 'Every record classified into confidence level');

  // Distribution Statistics Calculation
  riskScores.sort((a, b) => a - b);
  const min = riskScores[0];
  const max = riskScores[riskScores.length - 1];
  const sum = riskScores.reduce((a, b) => a + b, 0);
  const mean = Math.round((sum / riskScores.length) * 10) / 10;
  const median = riskScores[Math.floor(riskScores.length / 2)];

  const p25 = riskScores[Math.floor(riskScores.length * 0.25)];
  const p75 = riskScores[Math.floor(riskScores.length * 0.75)];
  const p90 = riskScores[Math.floor(riskScores.length * 0.90)];
  const p99 = riskScores[Math.floor(riskScores.length * 0.99)];

  const variance = riskScores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / riskScores.length;
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

  console.log('\n--- EMPIRICAL RISK DISTRIBUTION METRICS ---');
  console.log(`  Sample Count:       ${riskScores.length}`);
  console.log(`  Mean Risk Score:    ${mean}/100`);
  console.log(`  Median Risk Score:  ${median}/100`);
  console.log(`  Standard Deviation: ${stdDev}`);
  console.log(`  Min / Max Score:    ${min} / ${max}`);
  console.log(`  Percentiles (p25 / p50 / p75 / p90 / p99): ${p25} / ${median} / ${p75} / ${p90} / ${p99}`);
  console.log(`  Risk Frequencies:   LOW: ${riskLevels.LOW} | MODERATE: ${riskLevels.MODERATE} | HIGH: ${riskLevels.HIGH} | SEVERE: ${riskLevels.SEVERE}`);
  console.log(`  Confidence Bands:   HIGH: ${highConfidenceCount} | MODERATE: ${moderateConfidenceCount} | LIMITED: ${limitedConfidenceCount}`);
  console.log(`  Out-Of-Distribution: ${oodCount} extreme records detected`);
  console.log('  Primary Drivers:   ', JSON.stringify(primaryDriverCounts));

  assert(min >= 0 && max <= 100, `Score distribution bounded in [0, 100] (min=${min}, max=${max})`);
  assert(stdDev > 5, `Distribution exhibits natural variance across multi-climate weather (stdDev=${stdDev})`);
  assert(riskLevels.LOW > 0 && riskLevels.MODERATE > 0 && (riskLevels.HIGH > 0 || riskLevels.SEVERE > 0), 'Distribution spans multiple operational risk bands without artificial collapsing');

  console.log(`\nMODULE 1 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
