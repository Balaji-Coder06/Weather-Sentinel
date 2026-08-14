/**
 * WEATHER SENTINEL — PHASE 6 RESEARCH REFERENCE BASELINES
 * 
 * Reference comparative models for scientific evaluation:
 * - Baseline A: Equal-Weight Average Model
 * - Baseline B: Maximum Hazard Dominant Floor Model
 * - Baseline C: Generic Fixed-Weight Average Model (Non-Contextual)
 * - Baseline D: Threshold Heuristic Classifier (NOAA/NWS Alert Step-Function)
 */

import type { NormalizedWeatherHour } from '../types/weather';
import type { RiskLevel } from '../types/risk';

export interface BaselineEvaluationResult {
  name: string;
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  primaryDriver: string;
}

export class ReferenceBaselines {
  private static classifyLevel(score: number): RiskLevel {
    if (score <= 20) return 'LOW';
    if (score <= 40) return 'MODERATE';
    if (score <= 70) return 'HIGH';
    return 'SEVERE';
  }

  private static computeGenericFactors(hour: NormalizedWeatherHour): {
    rain: number;
    heat: number;
    wind: number;
    uv: number;
    vis: number;
  } {
    const prob = hour.precipitationProbability ?? 0;
    const precip = Math.max(hour.precipitation ?? 0, hour.rain ?? 0);
    const rain = Math.min(100, (prob / 100) * 55 + Math.min(45, precip * 10));

    const temp = hour.apparentTemperature ?? hour.temperature ?? 20;
    let heat = 4;
    if (temp > 24) {
      heat = Math.min(100, (temp - 24) * 3.5 + 4);
    } else if (temp < 12) {
      heat = Math.min(100, (12 - temp) * 3.0 + 4);
    }

    const windSpeed = hour.windSpeed ?? 0;
    const gusts = hour.windGusts ?? windSpeed;
    const effWind = Math.max(windSpeed, gusts * 0.75);
    const wind = Math.min(100, (effWind / 35) * 65);

    const uvVal = hour.uvIndex ?? 0;
    const uv = Math.min(100, uvVal <= 2 ? uvVal * 8 : uvVal <= 5 ? 16 + (uvVal - 2) * 12 : 52 + (uvVal - 5) * 14);

    const visM = hour.visibility ?? 10000;
    const vis = visM < 1000 ? 85 : visM < 3000 ? 55 : visM < 6000 ? 25 : 4;

    return { rain: Math.round(rain), heat: Math.round(heat), wind: Math.round(wind), uv: Math.round(uv), vis: Math.round(vis) };
  }

  /**
   * Baseline A: Equal-Weight Average Model
   * Averages all 5 factors with equal 20% weight.
   */
  public static evaluateBaselineA_EqualWeight(hour: NormalizedWeatherHour): BaselineEvaluationResult {
    const f = this.computeGenericFactors(hour);
    const score = Math.round((f.rain + f.heat + f.wind + f.uv + f.vis) / 5);
    return {
      name: 'Baseline A (Equal-Weight)',
      riskScore: score,
      riskLevel: this.classifyLevel(score),
      primaryDriver: 'Equal Aggregate',
    };
  }

  /**
   * Baseline B: Maximum Hazard Floor Model
   * Evaluates risk solely on the single most hazardous factor.
   */
  public static evaluateBaselineB_MaxHazard(hour: NormalizedWeatherHour): BaselineEvaluationResult {
    const f = this.computeGenericFactors(hour);
    const maxVal = Math.max(f.rain, f.heat, f.wind, f.uv, f.vis);
    let driver = 'Thermal Load';
    if (maxVal === f.rain) driver = 'Precipitation';
    else if (maxVal === f.wind) driver = 'Wind Dynamics';
    else if (maxVal === f.uv) driver = 'Solar UV';
    else if (maxVal === f.vis) driver = 'Visibility';

    return {
      name: 'Baseline B (Max-Hazard)',
      riskScore: maxVal,
      riskLevel: this.classifyLevel(maxVal),
      primaryDriver: driver,
    };
  }

  /**
   * Baseline C: Generic Fixed-Weight Average Model
   * Fixed non-contextual weights (Rain 30%, Heat 25%, Wind 20%, UV 15%, Visibility 10%).
   */
  public static evaluateBaselineC_FixedWeight(hour: NormalizedWeatherHour): BaselineEvaluationResult {
    const f = this.computeGenericFactors(hour);
    const score = Math.round(f.rain * 0.30 + f.heat * 0.25 + f.wind * 0.20 + f.uv * 0.15 + f.vis * 0.10);
    return {
      name: 'Baseline C (Fixed-Weight)',
      riskScore: score,
      riskLevel: this.classifyLevel(score),
      primaryDriver: 'Generic Weighted',
    };
  }

  /**
   * Baseline D: Threshold Heuristic Classifier
   * Standard NOAA/NWS alert step-function.
   */
  public static evaluateBaselineD_ThresholdHeuristic(hour: NormalizedWeatherHour): BaselineEvaluationResult {
    const temp = hour.apparentTemperature ?? hour.temperature ?? 20;
    const wind = Math.max(hour.windSpeed ?? 0, (hour.windGusts ?? 0) * 0.75);
    const precip = Math.max(hour.precipitation ?? 0, hour.rain ?? 0);
    const uv = hour.uvIndex ?? 0;
    const vis = hour.visibility ?? 10000;

    let score = 10;
    let driver = 'Nominal';

    if (temp >= 42 || wind >= 80 || precip >= 25 || uv >= 11 || vis < 500) {
      score = 85;
      driver = 'Severe Advisory';
    } else if (temp >= 35 || wind >= 50 || precip >= 10 || uv >= 8 || vis < 1500) {
      score = 60;
      driver = 'Moderate Watch';
    } else if (temp >= 30 || wind >= 30 || precip >= 2 || uv >= 6 || vis < 4000) {
      score = 35;
      driver = 'Minor Caution';
    }

    return {
      name: 'Baseline D (Threshold-Heuristic)',
      riskScore: score,
      riskLevel: this.classifyLevel(score),
      primaryDriver: driver,
    };
  }
}
