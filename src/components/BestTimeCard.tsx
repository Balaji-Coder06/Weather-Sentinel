import React, { useState } from 'react';
import { Sparkles, Clock, CheckCircle2, ArrowRight, ShieldCheck, ArrowDownRight, Check } from 'lucide-react';
import type { BestTimeSuggestion } from '../types/risk';

interface BestTimeCardProps {
  suggestion: BestTimeSuggestion;
  currentPlanRange?: string;
  currentRiskScore?: number;
  onApplyWindow?: (newStartTime: string) => void;
}

export const BestTimeCard: React.FC<BestTimeCardProps> = ({
  suggestion,
  currentPlanRange,
  currentRiskScore = 0,
  onApplyWindow,
}) => {
  const [isApplying, setIsApplying] = useState(false);

  if (!suggestion.found) {
    return null;
  }

  const {
    timeRangeFormatted,
    riskScore,
    riskLevel,
    reasons,
    comparisonText,
    startTime,
    durationHours,
  } = suggestion;

  const scoreDiff = currentRiskScore - riskScore;

  const handleApply = () => {
    if (onApplyWindow) {
      setIsApplying(true);
      onApplyWindow(startTime);
      setTimeout(() => setIsApplying(false), 1200);
    }
  };

  return (
    <div className="best-time-card" id="best-time-window-section">
      <div className="best-time-header">
        <div className="best-time-header-left">
          <div className="sparkle-icon-box">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="best-time-kicker">24-HOUR OPTIMAL TIMING DISCOVERY</span>
            <h3 className="best-time-title">Best Available Activity Window</h3>
          </div>
        </div>

        <div className="best-time-risk-pill">
          <ShieldCheck size={16} />
          <span>{riskLevel} RISK ({riskScore}/100)</span>
        </div>
      </div>

      {/* Side-by-Side Window Comparison Strip */}
      <div className="window-comparison-strip">
        <div className="comparison-box current">
          <span className="comp-label">YOUR SELECTED WINDOW</span>
          <span className="comp-time">{currentPlanRange || 'Selected Window'}</span>
          <span className="comp-risk">Risk Score: {currentRiskScore} / 100</span>
        </div>

        <div className="comparison-arrow-divider">
          {scoreDiff > 0 ? (
            <div className="comp-diff-badge" title="Risk Reduction Delta">
              <ArrowDownRight size={15} />
              <span>−{scoreDiff} PTS</span>
            </div>
          ) : (
            <ArrowRight size={18} className="comp-arrow" />
          )}
        </div>

        <div className="comparison-box optimal">
          <span className="comp-label">OPTIMAL TIME WINDOW</span>
          <span className="comp-time">{timeRangeFormatted}</span>
          <span className="comp-risk highlight">Risk Score: {riskScore} / 100 ({riskLevel})</span>
        </div>
      </div>

      <div className="best-time-body-grid">
        <div className="best-window-main">
          <div className="window-time-display">
            <Clock size={20} className="window-clock-icon" />
            <span className="window-time-text">{timeRangeFormatted}</span>
            <span className="window-duration-tag">
              {durationHours} {durationHours === 1 ? 'Hour' : 'Hours'}
            </span>
          </div>

          <p className="best-window-comparison">{comparisonText}</p>

          {onApplyWindow && (
            <button
              type="button"
              className={`btn-apply-best-time ${isApplying ? 'applying' : ''}`}
              onClick={handleApply}
              disabled={isApplying}
            >
              {isApplying ? (
                <>
                  <Check size={16} />
                  <span>Optimal Window Applied</span>
                </>
              ) : (
                <>
                  <span>Apply This Optimal Time</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>

        <div className="best-window-reasons">
          <span className="reasons-label">WHY THIS WINDOW IS OPTIMAL</span>
          <ul className="reasons-list">
            {reasons.map((reason, idx) => (
              <li key={idx} className="reason-item">
                <CheckCircle2 size={16} className="reason-check-icon" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
