import React from 'react';
import { HelpCircle, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DynamicExplanation } from '../types/risk';

interface DynamicExplanationsProps {
  explanations: DynamicExplanation[];
}

export const DynamicExplanations: React.FC<DynamicExplanationsProps> = ({
  explanations,
}) => {
  return (
    <div className="explanations-card" id="why-this-risk-section">
      <div className="explanations-header">
        <div className="explanations-title-left">
          <HelpCircle size={18} className="title-icon" />
          <div>
            <span className="explanations-badge">DYNAMIC FACTOR ATTRIBUTION</span>
            <h3 className="explanations-heading">Why This Risk Estimate?</h3>
          </div>
        </div>
        <span className="explanations-sub-note">Meteorological Vector Analysis</span>
      </div>

      <div className="explanations-list">
        {explanations.map((item, idx) => {
          const isCritical = item.severity === 'critical';
          const isElevated = item.severity === 'elevated';

          return (
            <div
              key={item.index}
              className={`explanation-item ${
                isCritical ? 'critical' : isElevated ? 'elevated' : 'normal'
              }`}
              style={{ animationDelay: `${idx * 120}ms` }}
            >
              <div className="explanation-num-col">
                <span className="explanation-num">
                  {item.index.toString().padStart(2, '0')}
                </span>
                {isCritical && <AlertTriangle size={16} className="item-icon-crit" />}
                {isElevated && <AlertCircle size={16} className="item-icon-elev" />}
                {!isCritical && !isElevated && (
                  <CheckCircle2 size={16} className="item-icon-norm" />
                )}
              </div>

              <div className="explanation-content-col">
                <div className="explanation-top">
                  <span className="explanation-factor-tag">{item.factor}</span>
                  <h4 className="explanation-title">{item.title}</h4>
                  <span className={`explanation-impact-pill ${item.severity}`}>
                    {isCritical ? 'High Risk Impact' : isElevated ? 'Moderate Impact' : 'Favorable Alignment'}
                  </span>
                </div>
                <p className="explanation-desc">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
