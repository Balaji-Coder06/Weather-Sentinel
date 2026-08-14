import type { ActivityConfig } from '../types/activity';
import type {
  ActivityRecommendation,
  ActivityWindowAnalysis,
  BestTimeSuggestion,
  EnvironmentalFactorScores,
  RiskLevel,
} from '../types/risk';

export class RecommendationEngine {
  /**
   * Generates actionable, cautious forecast-based guidance
   */
  public generateRecommendation(
    overallRiskScore: number,
    overallRiskLevel: RiskLevel,
    factors: EnvironmentalFactorScores,
    windowAnalysis: ActivityWindowAnalysis,
    activityConfig: ActivityConfig,
    bestTimeSuggestion?: BestTimeSuggestion
  ): ActivityRecommendation {
    const guidance: string[] = [];
    const gear: string[] = [];

    let summary = '';
    if (overallRiskLevel === 'LOW') {
      summary = `Conditions are favorable for ${activityConfig.name.toLowerCase()}. Meteorological parameters remain well within comfortable thresholds.`;
    } else if (overallRiskLevel === 'MODERATE') {
      summary = `Moderate conditions for ${activityConfig.name.toLowerCase()}. Key environmental variables warrant preparation or pacing adjustments.`;
    } else if (overallRiskLevel === 'HIGH') {
      summary = `Elevated activity risk detected. Consider adjusting start time, reducing exposure duration, or adopting protective mitigations.`;
    } else {
      summary = `Severe conditions projected during this window. High probability of significant disruption, adverse environmental stress, or safety risks. Postponement advised.`;
    }

    if (factors.rainRisk >= 65) {
      guidance.push('High likelihood of precipitation: inspect drainage, prepare waterproof coverage, and anticipate surface slippage.');
      gear.push('Waterproof outer layer', 'Waterproof footwear / traction soles', 'Equipment dry bags');
    } else if (factors.rainRisk >= 35) {
      guidance.push('Light to moderate showers possible: keep a packable rain shell accessible.');
      gear.push('Compact rain shell / umbrella');
    }

    if (factors.heatRisk >= 70) {
      guidance.push('High thermal strain: schedule mandatory hydration breaks every 20-30 minutes, wear breathable moisture-wicking fabrics, and pace intensity.');
      gear.push('Electrolyte hydration reservoir', 'Breathable technical fabrics', 'Cooling neck towel / cap');
    } else if (factors.heatRisk >= 45) {
      guidance.push('Warm and humid ambient conditions: ensure regular fluid intake to offset elevated sweat rates.');
      gear.push('Hydration bottle', 'Lightweight attire');
    }

    if (factors.windRisk >= 60) {
      guidance.push('Strong wind gusts present: secure loose gear, be prepared for crosswind drag, and exercise caution near exposed elevations.');
      gear.push('Windbreaker / wind-resistant layer', 'Eye protection / cycling glasses');
    } else if (factors.windRisk >= 35) {
      guidance.push('Noticeable breeze: anticipate minor aerodynamic resistance.');
    }

    if (factors.uvRisk >= 55) {
      guidance.push('Elevated solar UV index: apply broad-spectrum SPF 30+ sunscreen and wear UV-rated eyewear and headwear.');
      gear.push('SPF 30+ Broad-Spectrum Sunscreen', 'UV400 Polarized Sunglasses', 'Wide-brimmed cap');
    }

    if (windowAnalysis.conditionTrajectory === 'deteriorating') {
      guidance.push('Conditions worsen as the activity progresses; front-load essential portions of your activity into the earliest segment.');
    } else if (windowAnalysis.conditionTrajectory === 'improving') {
      guidance.push('Conditions improve toward the latter half of your window; delaying your start slightly will offer smoother weather.');
    }

    if (bestTimeSuggestion && bestTimeSuggestion.found && bestTimeSuggestion.riskScore < overallRiskScore - 15) {
      guidance.push(`Optimal window available: moving to ${bestTimeSuggestion.timeRangeFormatted} reduces estimated risk to ${bestTimeSuggestion.riskLevel} (${bestTimeSuggestion.riskScore}/100).`);
    }

    if (guidance.length === 0) {
      guidance.push('Standard hydration and activity preparedness recommended.');
      gear.push('Standard activity footwear', 'Hydration pack');
    }

    return {
      summary,
      detailedGuidance: guidance,
      suggestedGear: [...new Set(gear)],
      optimalWindowAvailable: Boolean(bestTimeSuggestion?.found && bestTimeSuggestion.riskScore < overallRiskScore - 15),
    };
  }
}
