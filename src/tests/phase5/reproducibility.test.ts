/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 7: 100-Iteration Statistical Reproducibility & State Isolation Tests
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { ACTIVITY_REGISTRY } from '../../engine/activityRegistry';
import { HISTORICAL_METEOROLOGICAL_RECORDS } from '../../data/historicalWeatherDataset';

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
  console.log('PHASE 5: MODULE 7 — 100-ITERATION STATISTICAL REPRODUCIBILITY');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const testSample = HISTORICAL_METEOROLOGICAL_RECORDS[0]; // Chennai May 2023 6am

  const runResults: number[] = [];
  const runFactors: string[] = [];
  const runDrivers: string[] = [];
  const runUncertainties: string[] = [];

  for (let i = 0; i < 100; i++) {
    const res = engine.calculateHourlyRisk(testSample, ACTIVITY_REGISTRY.running, 1.5);
    const driver = engine.getPrimaryDriver(res.factors)?.name || 'None';
    const unc = engine.evaluateUncertaintyAndOOD(testSample);

    runResults.push(res.riskScore);
    runFactors.push(JSON.stringify(res.factors));
    runDrivers.push(driver);
    runUncertainties.push(JSON.stringify(unc));
  }

  const scoreIdentical = runResults.every((s) => s === runResults[0]);
  const factorsIdentical = runFactors.every((f) => f === runFactors[0]);
  const driversIdentical = runDrivers.every((d) => d === runDrivers[0]);
  const uncertaintyIdentical = runUncertainties.every((u) => u === runUncertainties[0]);

  assert(scoreIdentical, `100 repeated executions produced bitwise identical score (${runResults[0]}/100)`);
  assert(factorsIdentical, '100 repeated executions produced identical 5-vector stress profiles');
  assert(driversIdentical, `100 repeated executions produced identical primary driver (${runDrivers[0]})`);
  assert(uncertaintyIdentical, '100 repeated executions produced identical uncertainty margins and OOD status');

  console.log(`\nMODULE 7 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
