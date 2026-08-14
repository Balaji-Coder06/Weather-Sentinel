import type { ActivityPlanContext } from '../types/activity';
import type { RiskAnalysisResult } from '../types/risk';
import { WeatherService } from '../services/weatherService';
import { getActivityConfig } from './activityRegistry';
import { BestTimeEngine } from './bestTimeEngine';
import { ExplanationEngine } from './explanationEngine';
import { RecommendationEngine } from './recommendationEngine';
import type { IRiskEngine } from './riskEngine';
import { RuleBasedRiskEngine } from './riskEngine';
import { WindowAnalyzer } from './windowAnalyzer';

export class SentinelCore {
  private weatherService: WeatherService;
  private riskEngine: IRiskEngine;
  private windowAnalyzer: WindowAnalyzer;
  private bestTimeEngine: BestTimeEngine;
  private explanationEngine: ExplanationEngine;
  private recommendationEngine: RecommendationEngine;

  constructor(
    weatherService: WeatherService = new WeatherService(),
    riskEngine: IRiskEngine = new RuleBasedRiskEngine()
  ) {
    this.weatherService = weatherService;
    this.riskEngine = riskEngine;
    this.windowAnalyzer = new WindowAnalyzer(this.riskEngine);
    this.bestTimeEngine = new BestTimeEngine(this.riskEngine);
    this.explanationEngine = new ExplanationEngine();
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Main analysis execution pipeline:
   * Location + Activity + Date + Time + Duration -> Live Weather Data -> Context Risk Engine -> Analysis
   */
  public async analyzePlan(
    context: ActivityPlanContext,
    onProgress?: (stage: string) => void,
    forceRefresh: boolean = false,
    signal?: AbortSignal
  ): Promise<RiskAnalysisResult> {
    const activityConfig = getActivityConfig(context.activityId);

    // Stage 1: Scanning forecast data
    onProgress?.('Scanning live meteorological forecast from Open-Meteo...');
    const forecast = await this.weatherService.getForecast({
      latitude: context.latitude,
      longitude: context.longitude,
      timezone: context.timezone || 'auto',
      forecastDays: 7,
      signal,
    }, forceRefresh);

    // Stage 2: Slicing and evaluating activity window
    onProgress?.('Extracting and evaluating activity duration window...');
    const windowHours = this.weatherService.extractActivityWindow(
      forecast,
      context.date,
      context.startTime,
      context.durationHours
    );

    // Stage 3: Running Window Risk Analysis
    onProgress?.('Calculating environmental stress & aerodynamic factors...');
    const windowAnalysis = this.windowAnalyzer.analyzeWindow(
      windowHours,
      activityConfig,
      context.durationHours
    );

    // Central composite score based on average window condition with peak risk weight
    const overallRiskScore = windowAnalysis.averageRiskScore;
    const overallRiskLevel = this.riskEngine.classifyRiskLevel(overallRiskScore);

    // Extract average factor scores across the window
    const factorScores = {
      rainRisk: Math.round(
        windowAnalysis.hours.reduce((acc, h) => acc + h.factors.rainRisk, 0) / windowAnalysis.hours.length
      ),
      heatRisk: Math.round(
        windowAnalysis.hours.reduce((acc, h) => acc + h.factors.heatRisk, 0) / windowAnalysis.hours.length
      ),
      windRisk: Math.round(
        windowAnalysis.hours.reduce((acc, h) => acc + h.factors.windRisk, 0) / windowAnalysis.hours.length
      ),
      uvRisk: Math.round(
        windowAnalysis.hours.reduce((acc, h) => acc + h.factors.uvRisk, 0) / windowAnalysis.hours.length
      ),
      visibilityRisk: Math.round(
        windowAnalysis.hours.reduce((acc, h) => acc + h.factors.visibilityRisk, 0) /
          windowAnalysis.hours.length
      ),
    };

    // Stage 4: Scanning best alternative window
    onProgress?.('Scanning 24-hour forecast for optimal timing windows...');
    const bestTimeSuggestion = this.bestTimeEngine.findBestWindow(
      forecast,
      context.date,
      activityConfig,
      context.durationHours,
      windowHours[0].timeFormatted,
      overallRiskScore
    );

    // Stage 5: Building contributing factor details
    const peakHourData = windowAnalysis.peakRiskHour.hour;
    const ruleEngine = this.riskEngine instanceof RuleBasedRiskEngine ? this.riskEngine : new RuleBasedRiskEngine();
    const contributingFactors = ruleEngine.buildContributingFactors(
      factorScores,
      peakHourData,
      context.durationHours
    );

    // Stage 6: Generating dynamic explanations
    onProgress?.('Synthesizing dynamic factor attribution and recommendations...');
    const explanations = this.explanationEngine.generateExplanations(
      windowAnalysis,
      factorScores,
      activityConfig,
      context.durationHours
    );

    // Stage 7: Generating actionable recommendations
    const recommendation = this.recommendationEngine.generateRecommendation(
      overallRiskScore,
      overallRiskLevel,
      factorScores,
      windowAnalysis,
      activityConfig,
      bestTimeSuggestion
    );

    // Helper to format start to true end time range (e.g. 4:00 PM — 5:00 PM)
    const [hStr, mStr] = context.startTime.split(':');
    const startH = parseInt(hStr, 10) || 0;
    const startM = parseInt(mStr, 10) || 0;
    const totalStartMins = startH * 60 + startM;
    const totalEndMins = Math.round(totalStartMins + context.durationHours * 60) % 1440;
    const endH = Math.floor(totalEndMins / 60);
    const endM = totalEndMins % 60;

    const formatSingle = (h: number, m: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const mStr = m > 0 ? `:${m.toString().padStart(2, '0')}` : ':00';
      return `${h12}${mStr} ${ampm}`;
    };

    const timeRangeFormatted = `${formatSingle(startH, startM)} — ${formatSingle(endH, endM)}`;

    // Stage 8: Evaluating uncertainty profile and out-of-distribution extremes
    const uncertainty = this.riskEngine.evaluateUncertaintyAndOOD(peakHourData, forecast.dataQuality);

    return {
      activityId: context.activityId,
      activityName: activityConfig.name,
      locationName: context.locationName,
      date: context.date,
      startTime: context.startTime,
      durationHours: context.durationHours,
      timeRangeFormatted,
      overallRiskScore,
      overallRiskLevel,
      factorScores,
      contributingFactors,
      explanations,
      recommendation,
      windowAnalysis,
      bestTimeSuggestion,
      dataQuality: forecast.dataQuality,
      uncertainty,
      calculatedAt: Date.now(),
    };
  }
}
