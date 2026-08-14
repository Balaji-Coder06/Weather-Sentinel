/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH EVALUATION
 * Module 4: Comparative Benchmarking vs Baseline Models (A, B, C, D)
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
import { ReferenceBaselines } from '../../engine/baselines';
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

// Compute deterministic Spearman Rank Correlation
function computeSpearmanRankCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const getRanks = (arr: number[]) => {
    const sorted = arr.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
    const ranks = new Array(n);
    for (let i = 0; i < n; i++) {
      ranks[sorted[i].idx] = i + 1;
    }
    return ranks;
  };

  const rx = getRanks(x);
  const ry = getRanks(y);

  let dSquaredSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = rx[i] - ry[i];
    dSquaredSum += diff * diff;
  }

  return 1 - (6 * dSquaredSum) / (n * (n * n - 1));
}

async function run() {
  console.log('\n================================================================');
  console.log('PHASE 6: MODULE 4 — COMPARATIVE BASELINE MODEL BENCHMARK');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();
  const dataset = getExpandedHistoricalDataset();

  const sentinelScores: number[] = [];
  const baseAScores: number[] = [];
  const baseBScores: number[] = [];
  const baseCScores: number[] = [];
  const baseDScores: number[] = [];

  for (const record of dataset) {
    // Weather Sentinel evaluated for Running (1.5h)
    const ws = engine.calculateHourlyRisk(record, ACTIVITY_REGISTRY.running, 1.5).riskScore;
    const ba = ReferenceBaselines.evaluateBaselineA_EqualWeight(record).riskScore;
    const bb = ReferenceBaselines.evaluateBaselineB_MaxHazard(record).riskScore;
    const bc = ReferenceBaselines.evaluateBaselineC_FixedWeight(record).riskScore;
    const bd = ReferenceBaselines.evaluateBaselineD_ThresholdHeuristic(record).riskScore;

    sentinelScores.push(ws);
    baseAScores.push(ba);
    baseBScores.push(bb);
    baseCScores.push(bc);
    baseDScores.push(bd);
  }

  const calcStats = (scores: number[]) => {
    const sum = scores.reduce((a, b) => a + b, 0);
    const mean = Math.round((sum / scores.length) * 10) / 10;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
    return { mean, median, stdDev, min: sorted[0], max: sorted[sorted.length - 1] };
  };

  const wsStats = calcStats(sentinelScores);
  const aStats = calcStats(baseAScores);
  const bStats = calcStats(baseBScores);
  const cStats = calcStats(baseCScores);
  const dStats = calcStats(baseDScores);

  console.log('-----------------------------------------------------------------------------------------');
  console.log('| Model Name                  | Mean Score | Median Score | Std Dev | Min / Max Score |');
  console.log('-----------------------------------------------------------------------------------------');
  console.log(`| Weather Sentinel (Contextual) | ${wsStats.mean.toString().padEnd(10)} | ${wsStats.median.toString().padEnd(12)} | ${wsStats.stdDev.toString().padEnd(7)} | ${wsStats.min} / ${wsStats.max.toString().padEnd(11)} |`);
  console.log(`| Baseline A (Equal-Weight)     | ${aStats.mean.toString().padEnd(10)} | ${aStats.median.toString().padEnd(12)} | ${aStats.stdDev.toString().padEnd(7)} | ${aStats.min} / ${aStats.max.toString().padEnd(11)} |`);
  console.log(`| Baseline B (Max-Hazard)       | ${bStats.mean.toString().padEnd(10)} | ${bStats.median.toString().padEnd(12)} | ${bStats.stdDev.toString().padEnd(7)} | ${bStats.min} / ${bStats.max.toString().padEnd(11)} |`);
  console.log(`| Baseline C (Fixed-Weight)     | ${cStats.mean.toString().padEnd(10)} | ${cStats.median.toString().padEnd(12)} | ${cStats.stdDev.toString().padEnd(7)} | ${cStats.min} / ${cStats.max.toString().padEnd(11)} |`);
  console.log(`| Baseline D (Threshold Alert)  | ${dStats.mean.toString().padEnd(10)} | ${dStats.median.toString().padEnd(12)} | ${dStats.stdDev.toString().padEnd(7)} | ${dStats.min} / ${dStats.max.toString().padEnd(11)} |`);
  console.log('-----------------------------------------------------------------------------------------\n');

  // Spearman Rank Correlations
  const corrA = Math.round(computeSpearmanRankCorrelation(sentinelScores, baseAScores) * 1000) / 1000;
  const corrB = Math.round(computeSpearmanRankCorrelation(sentinelScores, baseBScores) * 1000) / 1000;
  const corrC = Math.round(computeSpearmanRankCorrelation(sentinelScores, baseCScores) * 1000) / 1000;
  const corrD = Math.round(computeSpearmanRankCorrelation(sentinelScores, baseDScores) * 1000) / 1000;

  console.log('--- SPEARMAN RANK CORRELATION VS WEATHER SENTINEL ---');
  console.log(`  Vs Baseline A (Equal-Weight):    r_s = ${corrA}`);
  console.log(`  Vs Baseline B (Max-Hazard):      r_s = ${corrB}`);
  console.log(`  Vs Baseline C (Fixed-Weight):    r_s = ${corrC}`);
  console.log(`  Vs Baseline D (Threshold Alert): r_s = ${corrD}`);

  assert(corrA > 0.60 && corrA < 1.0, `Sentinel correlates with generic averages without being identical (r_s=${corrA})`);
  assert(corrB > 0.70 && corrB < 1.0, `Sentinel aligns strongly with peak hazard trends while blending composite vectors (r_s=${corrB})`);
  assert(wsStats.stdDev >= 15, `Weather Sentinel preserves broad discriminatory dynamic range (stdDev=${wsStats.stdDev})`);

  console.log(`\nMODULE 4 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
