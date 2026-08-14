import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import type { RiskAnalysisResult } from '../types/risk';
import { ActivityTimeline } from './ActivityTimeline';
import { BestTimeCard } from './BestTimeCard';
import { DynamicExplanations } from './DynamicExplanations';
import { RecommendationBanner } from './RecommendationBanner';
import { RiskOverview } from './RiskOverview';

interface SentinelAnalysisViewProps {
  analysis: RiskAnalysisResult;
  onModifyPlan: () => void;
  onReAnalyze: () => void;
  onApplyBestTime: (startTime: string) => void;
}

export const SentinelAnalysisView: React.FC<SentinelAnalysisViewProps> = ({
  analysis,
  onModifyPlan,
  onReAnalyze,
  onApplyBestTime,
}) => {
  const scrollToBestTime = () => {
    const el = document.getElementById('best-time-window-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="analysis-view-wrapper" aria-label="Sentinel Analysis Results">
      {/* Action Toolbar */}
      <div className="analysis-toolbar">
        <button
          type="button"
          className="btn-toolbar-secondary"
          onClick={onModifyPlan}
          id="btn-modify-plan"
        >
          <ArrowLeft size={16} />
          <span>Edit Activity Plan</span>
        </button>

        <div className="toolbar-right-actions">
          <button
            type="button"
            className="btn-toolbar-secondary"
            onClick={onReAnalyze}
            title="Refresh with latest live meteorological telemetry"
          >
            <RefreshCw size={16} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {/* 1. Primary Risk Overview & Factor Matrix */}
      <RiskOverview analysis={analysis} />

      {/* 2. Actionable Recommendation Banner */}
      <RecommendationBanner
        recommendation={analysis.recommendation}
        riskLevel={analysis.overallRiskLevel}
        onExploreBestTime={analysis.bestTimeSuggestion?.found ? scrollToBestTime : undefined}
      />

      {/* 3. Why This Risk? Dynamic Factor Attribution */}
      <DynamicExplanations explanations={analysis.explanations} />

      {/* 4. Forecast Progression Timeline */}
      <ActivityTimeline windowAnalysis={analysis.windowAnalysis} />

      {/* 5. 24-Hour Best Time Window Discovery */}
      {analysis.bestTimeSuggestion && (
        <BestTimeCard
          suggestion={analysis.bestTimeSuggestion}
          currentPlanRange={analysis.timeRangeFormatted}
          currentRiskScore={analysis.overallRiskScore}
          onApplyWindow={onApplyBestTime}
        />
      )}
    </section>
  );
};
