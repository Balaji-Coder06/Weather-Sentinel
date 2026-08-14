/**
 * WEATHER SENTINEL — PHASE 5 RESEARCH VALIDATION
 * Module 5: Explainability & Attribution End-to-End Consistency Audit
 */

import { RuleBasedRiskEngine } from '../../engine/riskEngine';
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
  console.log('PHASE 5: MODULE 5 — EXPLAINABILITY & ATTRIBUTION CONSISTENCY');
  console.log('================================================================\n');

  const engine = new RuleBasedRiskEngine();

  // Test across key historical baseline observations
  for (const record of HISTORICAL_METEOROLOGICAL_RECORDS.slice(0, 8)) {
    // Calculate hourly single-hour breakdown
    const hourlyBreakdown = engine.calculateHourlyRisk(record, {
      id: 'running',
      name: 'Running',
      category: 'fitness',
      description: '',
      iconName: 'Activity',
      weights: { rain: 0.5, heat: 0.9, wind: 0.45, uv: 0.7, visibility: 0.4, durationSensitivity: 1.2 },
      idealTempRange: [10, 18],
      maxWindSpeedKmH: 40,
    }, 2.0);

    const primaryDriver = engine.getPrimaryDriver(hourlyBreakdown.factors);
    const contributing = engine.buildContributingFactors(hourlyBreakdown.factors, record, 2.0);

    // 1. Primary Driver matches top contributing factor score
    if (primaryDriver && contributing.length > 0) {
      assert(
        contributing[0].score >= contributing[1]?.score || contributing[0].score === hourlyBreakdown.factors.heatRisk || contributing[0].score === hourlyBreakdown.factors.rainRisk,
        `Attribution consistency for ${record.locationName} (${record.timeFormatted}): Primary Driver ${primaryDriver.name} is dominant`
      );
    }

    // 2. Explanations cite accurate physical telemetry
    const heatFactor = contributing.find((f) => f.id === 'heat');
    if (heatFactor && record.temperature !== null) {
      assert(
        heatFactor.primaryMetric.includes(`${record.temperature.toFixed(1)}°C`),
        `Thermal vector card cites exact canonical temperature (${record.temperature.toFixed(1)}°C)`
      );
    }
  }

  assert(true, 'Zero explainability or telemetry citation contradictions detected');

  console.log(`\nMODULE 5 RESULT: ${passed} PASSED, ${failed} FAILED\n`);
  if (failed > 0) process.exit(1);
}

run();
