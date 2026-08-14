import type { ActivityId } from './activity';
import type { DataQualityAssessment, NormalizedWeatherHour, UncertaintyProfile } from './weather';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface EnvironmentalFactorScores {
  rainRisk: number; // 0 - 100
  heatRisk: number; // 0 - 100
  windRisk: number; // 0 - 100
  uvRisk: number; // 0 - 100
  visibilityRisk: number; // 0 - 100
}

export interface ContributingFactorDetail {
  id: 'rain' | 'heat' | 'wind' | 'uv' | 'visibility' | 'duration';
  title: string;
  score: number; // 0 - 100
  level: RiskLevel;
  primaryMetric: string; // e.g. "78% rain probability", "34°C (feels like 41°C)", "42 km/h gusts"
  explanation: string;
}

export interface DynamicExplanation {
  index: number;
  factor: string;
  title: string;
  description: string;
  severity: 'normal' | 'elevated' | 'critical';
}

export interface ActivityRecommendation {
  summary: string;
  detailedGuidance: string[];
  suggestedGear: string[];
  optimalWindowAvailable: boolean;
}

export interface HourlyRiskBreakdown {
  hour: NormalizedWeatherHour;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: EnvironmentalFactorScores;
}

export interface ActivityWindowAnalysis {
  hours: HourlyRiskBreakdown[];
  peakRiskHour: HourlyRiskBreakdown;
  lowestRiskHour: HourlyRiskBreakdown;
  averageRiskScore: number;
  conditionTrajectory: 'deteriorating' | 'improving' | 'stable' | 'volatile';
}

export interface BestTimeSuggestion {
  found: boolean;
  activityId: ActivityId;
  durationHours: number;
  startTime: string; // e.g. "06:00"
  endTime: string; // e.g. "08:00"
  timeRangeFormatted: string; // e.g. "6:00 AM — 8:00 AM"
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  comparisonText: string;
}

export interface RiskAnalysisResult {
  activityId: ActivityId;
  activityName: string;
  locationName: string;
  date: string;
  startTime: string;
  durationHours: number;
  timeRangeFormatted: string;
  
  overallRiskScore: number; // 0 - 100
  overallRiskLevel: RiskLevel;
  
  factorScores: EnvironmentalFactorScores;
  contributingFactors: ContributingFactorDetail[];
  
  explanations: DynamicExplanation[];
  recommendation: ActivityRecommendation;
  
  windowAnalysis: ActivityWindowAnalysis;
  bestTimeSuggestion?: BestTimeSuggestion;
  
  dataQuality: DataQualityAssessment;
  uncertainty: UncertaintyProfile;
  calculatedAt: number;
}
