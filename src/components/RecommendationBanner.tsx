import React from 'react';
import {
  Check,
  ShieldAlert,
  ShieldCheck,
  Package,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { ActivityRecommendation, RiskLevel } from '../types/risk';

interface RecommendationBannerProps {
  recommendation: ActivityRecommendation;
  riskLevel: RiskLevel;
  onExploreBestTime?: () => void;
}

export const RecommendationBanner: React.FC<RecommendationBannerProps> = ({
  recommendation,
  riskLevel,
  onExploreBestTime,
}) => {
  const isSevere = riskLevel === 'SEVERE';
  const isHigh = riskLevel === 'HIGH';
  const isModerate = riskLevel === 'MODERATE';

  const getDecisionKicker = () => {
    switch (riskLevel) {
      case 'LOW':
        return 'CONDITIONS ARE FAVORABLE';
      case 'MODERATE':
        return 'CONDITIONS WARRANT PREPARATION & PACING';
      case 'HIGH':
        return 'ELEVATED ACTIVITY RISK DETECTED';
      case 'SEVERE':
        return 'SEVERE ENVIRONMENTAL STRESS — POSTPONEMENT ADVISED';
    }
  };

  return (
    <div
      className={`recommendation-card ${
        isSevere ? 'severe' : isHigh ? 'high' : isModerate ? 'moderate' : 'low'
      }`}
      id="sentinel-recommendations-section"
    >
      <div className="rec-header">
        <div className="rec-header-left">
          <div className="rec-icon-wrap">
            {isSevere || isHigh ? (
              <ShieldAlert size={22} />
            ) : isModerate ? (
              <AlertTriangle size={22} />
            ) : (
              <ShieldCheck size={22} />
            )}
          </div>
          <div>
            <span className="rec-decision-kicker">{getDecisionKicker()}</span>
            <h3 className="rec-title">Operational Activity Recommendation</h3>
          </div>
        </div>

        {recommendation.optimalWindowAvailable && onExploreBestTime && (
          <button
            type="button"
            className="btn-optimal-shortcut"
            onClick={onExploreBestTime}
          >
            <Sparkles size={14} />
            <span>Discover Optimal Window</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      <div className="rec-summary-box">
        <p className="rec-summary-text">{recommendation.summary}</p>
      </div>

      <div className="rec-details-grid">
        <div className="rec-guidance-col">
          <span className="rec-section-label">ACTIONABLE OPERATIONAL ADVISORIES</span>
          <ul className="guidance-list">
            {recommendation.detailedGuidance.map((item, idx) => (
              <li key={idx} className="guidance-list-item">
                <Check size={16} className="item-bullet-check" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {recommendation.suggestedGear.length > 0 && (
          <div className="rec-gear-col">
            <span className="rec-section-label">SUGGESTED MITIGATION GEAR</span>
            <div className="gear-pills-wrap">
              {recommendation.suggestedGear.map((gear, idx) => (
                <div key={idx} className="gear-chip">
                  <Package size={13} className="gear-icon" />
                  <span>{gear}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
