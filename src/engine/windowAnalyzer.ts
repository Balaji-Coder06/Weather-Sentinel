import type { ActivityConfig } from '../types/activity';
import type { ActivityWindowAnalysis, HourlyRiskBreakdown } from '../types/risk';
import type { NormalizedWeatherHour } from '../types/weather';
import type { IRiskEngine } from './riskEngine';

export class WindowAnalyzer {
  private riskEngine: IRiskEngine;

  constructor(riskEngine: IRiskEngine) {
    this.riskEngine = riskEngine;
  }

  /**
   * Performs fine-grained hourly analysis across the continuous activity duration
   */
  public analyzeWindow(
    windowHours: NormalizedWeatherHour[],
    activityConfig: ActivityConfig,
    durationHours: number
  ): ActivityWindowAnalysis {
    if (!windowHours || windowHours.length === 0) {
      throw new Error('Cannot analyze empty weather window.');
    }

    const hourlyBreakdowns: HourlyRiskBreakdown[] = windowHours.map((hour) =>
      this.riskEngine.calculateHourlyRisk(hour, activityConfig, durationHours)
    );

    let peak = hourlyBreakdowns[0];
    let lowest = hourlyBreakdowns[0];
    let totalScore = 0;

    for (const item of hourlyBreakdowns) {
      totalScore += item.riskScore;
      if (item.riskScore > peak.riskScore) {
        peak = item;
      }
      if (item.riskScore < lowest.riskScore) {
        lowest = item;
      }
    }

    const avgScore = Math.round(totalScore / hourlyBreakdowns.length);

    let trajectory: ActivityWindowAnalysis['conditionTrajectory'] = 'stable';
    if (hourlyBreakdowns.length >= 2) {
      const first = hourlyBreakdowns[0].riskScore;
      const last = hourlyBreakdowns[hourlyBreakdowns.length - 1].riskScore;
      const diff = last - first;

      if (diff >= 15) {
        trajectory = 'deteriorating';
      } else if (diff <= -15) {
        trajectory = 'improving';
      } else {
        const maxDelta = Math.max(...hourlyBreakdowns.map((h) => Math.abs(h.riskScore - avgScore)));
        trajectory = maxDelta > 20 ? 'volatile' : 'stable';
      }
    }

    return {
      hours: hourlyBreakdowns,
      peakRiskHour: peak,
      lowestRiskHour: lowest,
      averageRiskScore: avgScore,
      conditionTrajectory: trajectory,
    };
  }
}
