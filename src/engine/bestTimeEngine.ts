import type { ActivityConfig } from '../types/activity';
import type { BestTimeSuggestion, RiskLevel } from '../types/risk';
import type { NormalizedForecast, NormalizedWeatherHour } from '../types/weather';
import type { IRiskEngine } from './riskEngine';

export class BestTimeEngine {
  private riskEngine: IRiskEngine;

  constructor(riskEngine: IRiskEngine) {
    this.riskEngine = riskEngine;
  }

  /**
   * Scans all available windows on the target date to identify the lowest-risk operational window.
   */
  public findBestWindow(
    forecast: NormalizedForecast,
    targetDate: string,
    activityConfig: ActivityConfig,
    durationHours: number,
    currentSelectedStartHour: string,
    currentRiskScore: number
  ): BestTimeSuggestion {
    const dayHours = forecast.hours.filter((h) => h.timestamp.startsWith(targetDate));

    if (dayHours.length === 0) {
      return {
        found: false,
        activityId: activityConfig.id,
        durationHours,
        startTime: '',
        endTime: '',
        timeRangeFormatted: '',
        riskScore: 0,
        riskLevel: 'LOW',
        reasons: [],
        comparisonText: 'Insufficient forecast data to evaluate alternative windows.',
      };
    }

    const durationInt = Math.max(1, Math.ceil(durationHours));
    let bestStartIndex = -1;
    let minAvgScore = Infinity;
    let bestWindowHours: NormalizedWeatherHour[] = [];

    for (let i = 0; i <= dayHours.length - durationInt; i++) {
      const slice = dayHours.slice(i, i + durationInt);
      
      // Verify slice is strictly contiguous in time (1 hour intervals)
      let isContiguous = true;
      for (let k = 0; k < slice.length - 1; k++) {
        const t0 = new Date(slice[k].timestamp).getTime();
        const t1 = new Date(slice[k + 1].timestamp).getTime();
        if (!isNaN(t0) && !isNaN(t1)) {
          if (Math.abs(t1 - t0 - 3600000) > 60000) {
            isContiguous = false;
            break;
          }
        }
      }

      if (!isContiguous) {
        continue;
      }

      const scores = slice.map(
        (h) => this.riskEngine.calculateHourlyRisk(h, activityConfig, durationHours).riskScore
      );
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      const hourNumber = parseInt(slice[0].timestamp.split('T')[1]?.split(':')[0] || '12', 10);
      const isNightTime = hourNumber < 5 || hourNumber > 22;
      const penalty = isNightTime ? 12 : 0;
      const adjustedScore = avgScore + penalty;

      if (adjustedScore < minAvgScore) {
        minAvgScore = adjustedScore;
        bestStartIndex = i;
        bestWindowHours = slice;
      } else if (Math.abs(adjustedScore - minAvgScore) < 0.001 && bestStartIndex !== -1) {
        // Deterministic tie-breaker: prefer daytime hours (7am - 6pm) over peripheral hours
        const currentBestHour = parseInt(bestWindowHours[0].timestamp.split('T')[1]?.split(':')[0] || '12', 10);
        const candidateIsDaytime = hourNumber >= 7 && hourNumber <= 18;
        const currentIsDaytime = currentBestHour >= 7 && currentBestHour <= 18;
        if (candidateIsDaytime && !currentIsDaytime) {
          minAvgScore = adjustedScore;
          bestStartIndex = i;
          bestWindowHours = slice;
        }
      }
    }

    if (bestStartIndex === -1 || bestWindowHours.length === 0) {
      return {
        found: false,
        activityId: activityConfig.id,
        durationHours,
        startTime: '',
        endTime: '',
        timeRangeFormatted: '',
        riskScore: 0,
        riskLevel: 'LOW',
        reasons: [],
        comparisonText: 'No viable alternative window found for this date.',
      };
    }

    const firstHour = bestWindowHours[0];

    const startIso = firstHour.timestamp;
    const startTimeOnly = startIso.split('T')[1]?.substring(0, 5) || '06:00';
    
    const startHourInt = parseInt(startTimeOnly.split(':')[0], 10);
    const startMinInt = parseInt(startTimeOnly.split(':')[1] || '0', 10);
    const totalStartMins = startHourInt * 60 + startMinInt;
    const totalEndMins = Math.round(totalStartMins + durationHours * 60) % 1440;
    const endHourInt = Math.floor(totalEndMins / 60);
    const endMinInt = totalEndMins % 60;
    const endTimeOnly = `${endHourInt.toString().padStart(2, '0')}:${endMinInt.toString().padStart(2, '0')}`;

    const formatSingle = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const mStr = m > 0 ? `:${m.toString().padStart(2, '0')}` : ':00';
      return `${h12}${mStr} ${ampm}`;
    };

    const timeRangeFormatted = `${formatSingle(startHourInt, startMinInt)} — ${formatSingle(endHourInt, endMinInt)}`;

    const rawBestScore = Math.round(
      bestWindowHours
        .map((h) => this.riskEngine.calculateHourlyRisk(h, activityConfig, durationHours).riskScore)
        .reduce((a, b) => a + b, 0) / bestWindowHours.length
    );

    const bestRiskLevel: RiskLevel = this.riskEngine.classifyRiskLevel(rawBestScore);
    const reasons = this.generateReasons(bestWindowHours, activityConfig);

    const diff = currentRiskScore - rawBestScore;
    let comparisonText = '';
    if (diff > 15) {
      comparisonText = `Reduces estimated activity risk by ${diff} points (${currentRiskScore} → ${rawBestScore}) compared to your selected ${currentSelectedStartHour} window.`;
    } else if (diff > 0) {
      comparisonText = `Provides slightly more favorable conditions (${rawBestScore} vs ${currentRiskScore}) during ${timeRangeFormatted}.`;
    } else {
      comparisonText = `Your selected window at ${currentSelectedStartHour} is already among the most favorable times today.`;
    }

    return {
      found: true,
      activityId: activityConfig.id,
      durationHours,
      startTime: startTimeOnly,
      endTime: endTimeOnly,
      timeRangeFormatted,
      riskScore: rawBestScore,
      riskLevel: bestRiskLevel,
      reasons,
      comparisonText,
    };
  }

  private generateReasons(
    windowHours: NormalizedWeatherHour[],
    config: ActivityConfig
  ): string[] {
    const reasons: string[] = [];
    const maxRainProb = Math.max(...windowHours.map((h) => h.precipitationProbability ?? 0));
    const avgTemp =
      windowHours.reduce((acc, h) => acc + (h.temperature ?? 20), 0) / windowHours.length;
    const avgAppTemp =
      windowHours.reduce((acc, h) => acc + (h.apparentTemperature ?? 20), 0) / windowHours.length;
    const maxUv = Math.max(...windowHours.map((h) => h.uvIndex ?? 0));
    const maxWind = Math.max(...windowHours.map((h) => h.windSpeed ?? 0));

    if (maxRainProb <= 15) {
      reasons.push(`Low precipitation probability (${maxRainProb}% peak chance of rain)`);
    } else if (maxRainProb <= 35) {
      reasons.push(`Moderate precipitation probability (${maxRainProb}%) with minimal surface moisture`);
    }

    if (avgAppTemp >= config.idealTempRange[0] && avgAppTemp <= config.idealTempRange[1]) {
      reasons.push(`Comfortable apparent temperature averaging ${avgAppTemp.toFixed(1)}°C`);
    } else if (avgAppTemp < 28) {
      reasons.push(`Lower thermal stress with apparent temperature around ${avgAppTemp.toFixed(1)}°C`);
    }

    if (maxUv <= 3) {
      reasons.push(`Minimal ultraviolet solar radiation (UV index ${maxUv.toFixed(1)})`);
    } else if (maxUv <= 6) {
      reasons.push(`Moderate UV exposure (peak UV ${maxUv.toFixed(1)})`);
    }

    if (maxWind <= 15) {
      reasons.push(`Calm wind conditions (${maxWind.toFixed(0)} km/h max velocity)`);
    }

    if (reasons.length === 0) {
      reasons.push(`Optimal balance of temperature (${avgTemp.toFixed(1)}°C) and minimal rain risk`);
    }

    return reasons;
  }
}
