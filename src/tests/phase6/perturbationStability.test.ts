/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH EVALUATION
 * Module 5: Recommendation Stability & Primary Driver Tie-Breaking Audit
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { RecommendationEngine } from '../../engine/recommendationEngine';
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
  console.log('PHASE 6: MODULE 5 — RECOMMENDATION & PRIMARY DRIVER STABILITY');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const recEngine = new RecommendationEngine();
  const config = ACTIVITY_REGISTRY.running;

  // 1. Recommendation Stability under Local Environmental Perturbations
  console.log('1. Recommendation Perturbation Stability Audit:');
  let suspiciousFlips = 0;
  let stableRecommendations = 0;

  for (const sample of HISTORICAL_METEOROLOGICAL_RECORDS.slice(0, 10)) {
    const res1 = engine.calculateHourlyRisk(sample, config, 1.5);

    // Perturb by +0.2°C temperature and +1 km/h wind
    const perturbedHour = {
      ...sample,
      temperature: (sample.temperature ?? 20) + 0.2,
      apparentTemperature: (sample.apparentTemperature ?? 20) + 0.2,
      windSpeed: (sample.windSpeed ?? 10) + 1.0,
    };

    const res2 = engine.calculateHourlyRisk(perturbedHour, config, 1.5);

    const mockWindow1 = {
      hours: [res1],
      peakRiskHour: res1,
      lowestRiskHour: res1,
      averageRiskScore: res1.riskScore,
      conditionTrajectory: 'stable' as const,
    };

    const mockWindow2 = {
      hours: [res2],
      peakRiskHour: res2,
      lowestRiskHour: res2,
      averageRiskScore: res2.riskScore,
      conditionTrajectory: 'stable' as const,
    };

    const rec1 = recEngine.generateRecommendation(res1.riskScore, res1.riskLevel, res1.factors, mockWindow1, config);
    const rec2 = recEngine.generateRecommendation(res2.riskScore, res2.riskLevel, res2.factors, mockWindow2, config);

    // If risk score change is small (<= 2 pts), summary should remain identical unless crossing a major category boundary
    const scoreDiff = Math.abs(res1.riskScore - res2.riskScore);
    if (scoreDiff <= 2 && res1.riskLevel === res2.riskLevel) {
      if (rec1.summary === rec2.summary) {
        stableRecommendations++;
      } else {
        suspiciousFlips++;
      }
    }
  }

  assert(suspiciousFlips === 0, `Zero suspicious recommendation flips detected under small perturbations (0 flips, ${stableRecommendations} stable)`);

  // 2. Primary Driver Deterministic Tie-Breaking (Factor A = Factor B vs Factor A = Factor B ± eps)
  console.log('\n2. Primary Driver Deterministic Tie-Breaking Audit:');
  {
    // Equal scores: Rain 60, Wind 60
    // Life-safety priority hierarchy: Precipitation > Wind Dynamics > Thermal Load > Solar UV > Visibility
    const equalScores = {
      rainRisk: 60,
      heatRisk: 40,
      windRisk: 60,
      uvRisk: 20,
      visibilityRisk: 10,
    };

    const driverEqual = engine.getPrimaryDriver(equalScores);
    assert(driverEqual?.name === 'Precipitation', `Equal rain/wind (60/60) prioritizes Precipitation by safety hierarchy (got ${driverEqual?.name})`);

    // Perturb Wind by +1 (Rain 60, Wind 61)
    const windDominant = { ...equalScores, windRisk: 61 };
    const driverWind = engine.getPrimaryDriver(windDominant);
    assert(driverWind?.name === 'Wind Dynamics', `Perturbed wind (61 vs 60) deterministically switches to Wind Dynamics (got ${driverWind?.name})`);

    // Perturb Heat by +2 (Rain 60, Heat 62, Wind 60)
    const heatDominant = { ...equalScores, heatRisk: 62 };
    const driverHeat = engine.getPrimaryDriver(heatDominant);
    assert(driverHeat?.name === 'Thermal Load', `Perturbed heat (62 vs 60) deterministically switches to Thermal Load (got ${driverHeat?.name})`);
  }

  console.log(`\nMODULE 5 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
