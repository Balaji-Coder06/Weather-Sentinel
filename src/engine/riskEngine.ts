import type { ActivityConfig } from '../types/activity';
import type {
  ContributingFactorDetail,
  EnvironmentalFactorScores,
  HourlyRiskBreakdown,
  RiskLevel,
} from '../types/risk';
import type { DataQualityAssessment, NormalizedWeatherHour, UncertaintyProfile } from '../types/weather';

export interface IRiskEngine {
  calculateHourlyRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig,
    durationHours: number
  ): HourlyRiskBreakdown;
  
  classifyRiskLevel(score: number): RiskLevel;
  getPrimaryDriver(factors: EnvironmentalFactorScores): { name: string; score: number } | null;
  evaluateUncertaintyAndOOD(
    hour: NormalizedWeatherHour,
    dataQuality?: DataQualityAssessment
  ): UncertaintyProfile;
}

/**
 * Context-Aware Environmental Activity Risk Engine
 * 
 * Deterministic calculation model:
 * 1. Physical Weather Normalization
 * 2. Activity-Specific Heuristic Sensitivity Weighting
 * 3. De-duplicated Composite Stress Formulations (Thermal, Aerodynamic, Precipitation, Solar UV, Visibility)
 * 4. Bounded Monotonic Duration Compounding
 * 5. Composite Risk with Peak Hazard Floor
 */
export class RuleBasedRiskEngine implements IRiskEngine {
  /**
   * Evaluates the risk for a specific hourly observation given an activity configuration.
   */
  public calculateHourlyRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig,
    durationHours: number
  ): HourlyRiskBreakdown {
    const rainRisk = this.calculateRainRisk(hour, config, durationHours);
    const heatRisk = this.calculateHeatRisk(hour, config, durationHours);
    const windRisk = this.calculateWindRisk(hour, config, durationHours);
    const uvRisk = this.calculateUvRisk(hour, config, durationHours);
    const visibilityRisk = this.calculateVisibilityRisk(hour, config);

    const factors: EnvironmentalFactorScores = {
      rainRisk,
      heatRisk,
      windRisk,
      uvRisk,
      visibilityRisk,
    };

    // Calculate composite risk score using activity-specific factor weights
    const compositeScore = this.calculateCompositeRisk(factors, config, durationHours);
    const riskLevel = this.classifyRiskLevel(compositeScore);

    return {
      hour,
      riskScore: compositeScore,
      riskLevel,
      factors,
    };
  }

  /**
   * Bounded monotonic duration compounding factor.
   * Uses an asymptotic saturation curve to prevent runaway scoring:
   * D(t) = 1 + s * (0.35 * (t - 1)) / (1 + 0.25 * (t - 1)) for t >= 1
   * D(t) in [0.85, 1.45]
   */
  public calculateDurationMultiplier(durationHours: number, sensitivity = 1.0): number {
    const t = Math.max(0.5, Math.min(12, durationHours));
    if (t < 1.0) {
      return Math.max(0.85, 1.0 - 0.15 * (1.0 - t));
    }
    const delta = t - 1.0;
    const saturation = (0.35 * delta) / (1.0 + 0.25 * delta);
    return Math.min(1.45, 1.0 + sensitivity * saturation);
  }

  /**
   * Precipitation Risk Model:
   * Combines rain probability, accumulation volume (mm), and convective storm codes
   * without double-counting volume over probability.
   */
  private calculateRainRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig,
    durationHours: number
  ): number {
    const prob = Math.max(0, Math.min(100, hour.precipitationProbability ?? 0));
    const precipMm = Math.max(0, Math.max(hour.precipitation ?? 0, hour.rain ?? 0));
    const code = hour.weatherCode ?? 0;

    const probComponent = (prob / 100) * 55;
    const intensityComponent = Math.min(45, precipMm * 10);

    let stormComponent = 0;
    if (code >= 95) {
      stormComponent = 30; // Thunderstorms with lightning
    } else if (code >= 80 && code <= 82) {
      stormComponent = 12; // Convective showers
    }

    const rawRainScore = Math.min(100, probComponent + intensityComponent + stormComponent);
    const durationMult = this.calculateDurationMultiplier(durationHours, config.weights.durationSensitivity * 0.7);
    const weighted = rawRainScore * config.weights.rain * durationMult;

    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  /**
   * Composite Thermal Load Model:
   * Combines dry-bulb temperature, apparent temperature (Steadman / Heat Index), and relative humidity.
   * Assesses deviation from activity-specific ideal thermal comfort thresholds.
   */
  private calculateHeatRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig,
    durationHours: number
  ): number {
    const temp = hour.temperature ?? 20;
    const apparentTemp = hour.apparentTemperature ?? temp;
    const humidity = Math.max(0, Math.min(100, hour.relativeHumidity ?? 50));
    const [idealMin, idealMax] = config.idealTempRange;

    let thermalScore = 0;

    if (apparentTemp > idealMax) {
      const degreesOver = apparentTemp - idealMax;
      // High humidity (>60%) restricts sweat evaporation, compounding cardiac fatigue
      const humidityMultiplier = 1.0 + Math.max(0, (humidity - 50) / 120);
      thermalScore = degreesOver * 3.8 * humidityMultiplier;

      // Extreme apparent heat threshold (>= 38°C dangerous heat stress)
      if (apparentTemp >= 38) {
        thermalScore += 20;
      } else if (apparentTemp >= 33) {
        thermalScore += 10;
      }
    } else if (apparentTemp < idealMin) {
      const degreesUnder = idealMin - apparentTemp;
      thermalScore = degreesUnder * 3.2;
      if (apparentTemp <= 0) {
        thermalScore += 15; // Freezing threshold
      }
    } else {
      thermalScore = 4; // Baseline nominal comfort
    }

    const durationMult = this.calculateDurationMultiplier(durationHours, config.weights.durationSensitivity);
    const weighted = thermalScore * config.weights.heat * durationMult;

    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  /**
   * Aerodynamic & Wind Dynamics Model:
   * Uses governing wind vector V_effective = max(V_sustained, V_gusts * 0.75) to prevent double counting.
   */
  private calculateWindRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig,
    _durationHours: number
  ): number {
    const windSpeed = Math.max(0, hour.windSpeed ?? 0);
    const gusts = Math.max(windSpeed, hour.windGusts ?? windSpeed);
    const maxSafeWind = Math.max(15, config.maxWindSpeedKmH);

    const effectiveWind = Math.max(windSpeed, gusts * 0.75);
    const speedRatio = effectiveWind / maxSafeWind;

    let windScore = Math.min(100, Math.pow(speedRatio, 1.25) * 65);

    if (gusts > maxSafeWind) {
      const excess = gusts - maxSafeWind;
      windScore = Math.min(100, windScore + excess * 1.6);
    }

    const weighted = windScore * config.weights.wind;
    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  /**
   * Solar UV Radiation Model:
   * Grounded in WHO UV Index standards (0-2 Low, 3-5 Mod, 6-7 High, 8-10 Very High, 11+ Extreme).
   */
  private calculateUvRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig,
    durationHours: number
  ): number {
    const uv = Math.max(0, hour.uvIndex ?? 0);

    let baseUvScore = 0;
    if (uv <= 2) {
      baseUvScore = uv * 8; // 0 - 16
    } else if (uv <= 5) {
      baseUvScore = 16 + (uv - 2) * 12; // 16 - 52
    } else if (uv <= 7) {
      baseUvScore = 52 + (uv - 5) * 14; // 52 - 80
    } else {
      baseUvScore = 80 + Math.min(20, (uv - 7) * 6.5); // 80 - 100
    }

    const durationMult = this.calculateDurationMultiplier(durationHours, config.weights.durationSensitivity * 0.8);
    const weighted = baseUvScore * config.weights.uv * durationMult;

    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  /**
   * Atmospheric Visibility Model:
   * Assesses visual occlusion hazards based on critical stopping distance and navigation thresholds.
   */
  private calculateVisibilityRisk(
    hour: NormalizedWeatherHour,
    config: ActivityConfig
  ): number {
    const vis = Math.max(0, hour.visibility ?? 10000);

    let score = 0;
    if (vis < 1000) {
      score = 85; // Dense fog
    } else if (vis < 3000) {
      score = 55; // Moderate fog / heavy haze
    } else if (vis < 6000) {
      score = 25; // Light haze
    } else {
      score = 4; // Clear line of sight
    }

    const weighted = score * config.weights.visibility;
    return Math.round(Math.min(100, Math.max(0, weighted)));
  }

  /**
   * Composite Risk Aggregator:
   * Blends weighted average of all environmental vectors (40%) with the peak hazard vector floor (60%).
   * Ensures that a single severe hazard (e.g. hurricane wind, deluge, or extreme heat stress)
   * establishes an appropriate operational safety ceiling and is not mathematically diluted to safe levels.
   */
  private calculateCompositeRisk(
    factors: EnvironmentalFactorScores,
    config: ActivityConfig,
    _durationHours: number
  ): number {
    const w = config.weights;
    const totalWeight = w.rain + w.heat + w.wind + w.uv + w.visibility;

    const weightedAverage =
      (factors.rainRisk * w.rain +
        factors.heatRisk * w.heat +
        factors.windRisk * w.wind +
        factors.uvRisk * w.uv +
        factors.visibilityRisk * w.visibility) /
      (totalWeight || 1);

    const peakHazard = Math.max(
      factors.rainRisk,
      factors.heatRisk,
      factors.windRisk,
      factors.uvRisk,
      factors.visibilityRisk
    );

    // Peak hazard floor: if a single hazard is severe (>= 60), it maintains strong authority
    const composite = Math.max(weightedAverage, weightedAverage * 0.40 + peakHazard * 0.60);
    return Math.round(Math.min(100, Math.max(0, composite)));
  }

  /**
   * Deterministically determines the primary environmental driver with explicit tie-breaking order:
   * Precipitation > Wind Dynamics > Thermal Load > Solar UV > Visibility Restriction
   */
  public getPrimaryDriver(factors: EnvironmentalFactorScores): { name: string; score: number } | null {
    const candidateList = [
      { name: 'Precipitation', score: factors.rainRisk, priority: 5 },
      { name: 'Wind Dynamics', score: factors.windRisk, priority: 4 },
      { name: 'Thermal Load', score: factors.heatRisk, priority: 3 },
      { name: 'Solar UV', score: factors.uvRisk, priority: 2 },
      { name: 'Visibility Restriction', score: factors.visibilityRisk, priority: 1 },
    ];

    candidateList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.priority - a.priority; // Tie-breaking by life-safety / operational severity priority
    });

    const top = candidateList[0];
    return top && top.score > 0 ? { name: top.name, score: top.score } : null;
  }

  /**
   * Centralized risk level classification
   * 0–20: LOW | 21–40: MODERATE | 41–70: HIGH | 71–100: SEVERE
   */
  public classifyRiskLevel(score: number): RiskLevel {
    if (score <= 20) return 'LOW';
    if (score <= 40) return 'MODERATE';
    if (score <= 70) return 'HIGH';
    return 'SEVERE';
  }

  /**
   * Evaluates uncertainty and flags Out-Of-Distribution (OOD) meteorological conditions.
   * Does NOT alter the deterministic core score; provides scientifically bounded uncertainty margins.
   */
  public evaluateUncertaintyAndOOD(
    hour: NormalizedWeatherHour,
    dataQuality?: { completenessRatio: number; confidenceLevel: 'HIGH' | 'MODERATE' | 'LIMITED'; missingVariables: string[] }
  ): {
    confidenceLevel: 'HIGH' | 'MODERATE' | 'LIMITED';
    uncertaintyMargin: number;
    isOutOfDistribution: boolean;
    oodFactors: string[];
    completenessRatio: number;
    qualityScore: number;
    reasoning: string;
  } {
    const oodFactors: string[] = [];

    const temp = hour.apparentTemperature ?? hour.temperature ?? 20;
    if (temp >= 48) oodFactors.push(`Extreme Heat Shock (${temp.toFixed(1)}°C feels-like)`);
    if (temp <= -15) oodFactors.push(`Sub-Zero Frost Hazard (${temp.toFixed(1)}°C feels-like)`);

    const wind = hour.windSpeed ?? 0;
    const gusts = hour.windGusts ?? wind;
    if (wind >= 90 || gusts >= 130) oodFactors.push(`Severe Gale Velocity (${gusts.toFixed(0)} km/h peak)`);

    const precip = Math.max(hour.precipitation ?? 0, hour.rain ?? 0);
    if (precip >= 40) oodFactors.push(`Torrential Deluge (${precip.toFixed(1)} mm/hr)`);

    const uv = hour.uvIndex ?? 0;
    if (uv >= 13) oodFactors.push(`Extreme Solar Radiation (UV Index ${uv.toFixed(1)})`);

    const vis = hour.visibility ?? 10000;
    if (vis <= 150) oodFactors.push(`Zero-Distance Fog Occlusion (${vis}m)`);

    const isOutOfDistribution = oodFactors.length > 0;
    const completenessRatio = dataQuality?.completenessRatio ?? 1.0;
    const baseConfidence = dataQuality?.confidenceLevel ?? 'HIGH';

    let finalConfidence = baseConfidence;
    if (isOutOfDistribution && finalConfidence === 'HIGH') {
      finalConfidence = 'MODERATE';
    }

    let uncertaintyMargin = 3;
    if (finalConfidence === 'LIMITED') {
      uncertaintyMargin = isOutOfDistribution ? 10 : 8;
    } else if (finalConfidence === 'MODERATE' || isOutOfDistribution) {
      uncertaintyMargin = isOutOfDistribution ? 6 : 4;
    }

    const qualityScore = Math.round(completenessRatio * 100);
    let reasoning = 'Telemetry complete and operating within standard meteorological regimes.';
    if (isOutOfDistribution) {
      reasoning = `Out-of-distribution conditions detected: ${oodFactors.join('; ')}. Bounded uncertainty interval applied.`;
    } else if (dataQuality && dataQuality.missingVariables.length > 0) {
      reasoning = `Telemetry active with degraded coverage for: ${dataQuality.missingVariables.join(', ')}.`;
    }

    return {
      confidenceLevel: finalConfidence,
      uncertaintyMargin,
      isOutOfDistribution,
      oodFactors,
      completenessRatio,
      qualityScore,
      reasoning,
    };
  }

  /**
   * Extracts contributing factor details with primary metrics and deterministic explanations
   */
  public buildContributingFactors(
    factors: EnvironmentalFactorScores,
    hour: NormalizedWeatherHour,
    durationHours: number
  ): ContributingFactorDetail[] {
    const items: ContributingFactorDetail[] = [];

    const prob = hour.precipitationProbability ?? 0;
    const precip = Math.max(hour.precipitation ?? 0, hour.rain ?? 0);
    items.push({
      id: 'rain',
      title: 'Precipitation',
      score: factors.rainRisk,
      level: this.classifyRiskLevel(factors.rainRisk),
      primaryMetric: `${prob}% probability${precip > 0 ? ` (${precip.toFixed(1)} mm)` : ''}`,
      explanation:
        factors.rainRisk >= 40
          ? 'Elevated rain probability and surface moisture directly impact activity viability.'
          : 'Low precipitation probability expected during this window.',
    });

    const temp = hour.temperature ?? 20;
    const appTemp = hour.apparentTemperature ?? temp;
    const humidity = hour.relativeHumidity ?? 50;
    items.push({
      id: 'heat',
      title: 'Thermal Stress',
      score: factors.heatRisk,
      level: this.classifyRiskLevel(factors.heatRisk),
      primaryMetric: `${temp.toFixed(1)}°C (feels ${appTemp.toFixed(1)}°C, ${humidity}% RH)`,
      explanation:
        factors.heatRisk >= 40
          ? 'High apparent temperature and relative humidity increase cardiac and thermoregulatory load.'
          : 'Thermal conditions remain within a manageable physiological range.',
    });

    const wind = hour.windSpeed ?? 0;
    const gusts = hour.windGusts ?? wind;
    items.push({
      id: 'wind',
      title: 'Wind & Gusts',
      score: factors.windRisk,
      level: this.classifyRiskLevel(factors.windRisk),
      primaryMetric: `${wind.toFixed(0)} km/h (gusts ${gusts.toFixed(0)} km/h)`,
      explanation:
        factors.windRisk >= 40
          ? 'Strong wind gusts increase aerodynamic resistance and stability hazards.'
          : 'Wind velocity is light to moderate with minimal turbulence.',
    });

    const uv = hour.uvIndex ?? 0;
    items.push({
      id: 'uv',
      title: 'UV Exposure',
      score: factors.uvRisk,
      level: this.classifyRiskLevel(factors.uvRisk),
      primaryMetric: `UV Index ${uv.toFixed(1)}`,
      explanation:
        factors.uvRisk >= 40
          ? 'Intense solar ultraviolet radiation requires skin and eye protection.'
          : 'Low to moderate ultraviolet solar radiation.',
    });

    const vis = hour.visibility ?? 10000;
    items.push({
      id: 'visibility',
      title: 'Visibility',
      score: factors.visibilityRisk,
      level: this.classifyRiskLevel(factors.visibilityRisk),
      primaryMetric: `${(vis / 1000).toFixed(1)} km`,
      explanation:
        factors.visibilityRisk >= 40
          ? 'Reduced atmospheric visibility increases navigation and collision risks.'
          : 'Clear line of sight with unrestricted visibility.',
    });

    if (durationHours >= 2) {
      items.push({
        id: 'duration',
        title: 'Duration Exposure',
        score: Math.min(100, Math.round(durationHours * 16)),
        level: durationHours >= 4 ? 'HIGH' : durationHours >= 2.5 ? 'MODERATE' : 'LOW',
        primaryMetric: `${durationHours} continuous hours`,
        explanation: 'Extended exposure time multiplies the cumulative effect of ambient weather factors.',
      });
    }

    return items.sort((a, b) => b.score - a.score);
  }
}
