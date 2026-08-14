import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Eye,
  Flame,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Wind,
  Layers,
  MapPin,
  Clock,
  ChevronDown,
  Info,
} from 'lucide-react';
import type { RiskAnalysisResult, RiskLevel } from '../types/risk';
import { IconRenderer } from './IconRenderer';
import { getActivityConfig } from '../engine/activityRegistry';
import { RuleBasedRiskEngine } from '../engine/riskEngine';

interface RiskOverviewProps {
  analysis: RiskAnalysisResult;
}

export const RiskOverview: React.FC<RiskOverviewProps> = ({ analysis }) => {
  const {
    activityId,
    activityName,
    locationName,
    timeRangeFormatted,
    overallRiskScore,
    overallRiskLevel,
    factorScores,
    contributingFactors,
    durationHours,
  } = analysis;

  const activityConfig = getActivityConfig(activityId);

  // Animated Count-up for the Risk Score
  const [displayedScore, setDisplayedScore] = useState<number>(0);
  const [expandedFactorId, setExpandedFactorId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayedScore(overallRiskScore);
      return;
    }

    setDisplayedScore(0);
    const durationMs = 850;
    const startTime = performance.now();

    const animateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(easeOut * overallRiskScore);
      setDisplayedScore(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animateCount);
      }
    };

    const animId = requestAnimationFrame(animateCount);
    return () => cancelAnimationFrame(animId);
  }, [overallRiskScore]);

  // Determine primary driver dynamically using the central risk engine tie-breaking logic
  const primaryDriver = new RuleBasedRiskEngine().getPrimaryDriver(factorScores)?.name ?? null;

  // SVG Gauge calculations (enlarged for balanced card layout)
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayedScore / 100) * circumference;

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case 'LOW':
        return 'var(--risk-low)';
      case 'MODERATE':
        return 'var(--risk-mod)';
      case 'HIGH':
        return 'var(--risk-high)';
      case 'SEVERE':
        return 'var(--risk-severe)';
    }
  };

  const getRiskBadgeClass = (level: RiskLevel) => {
    switch (level) {
      case 'LOW':
        return 'risk-badge-low';
      case 'MODERATE':
        return 'risk-badge-mod';
      case 'HIGH':
        return 'risk-badge-high';
      case 'SEVERE':
        return 'risk-badge-severe';
    }
  };

  const riskColor = getRiskColor(overallRiskLevel);

  const toggleFactorExpand = (id: string) => {
    setExpandedFactorId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="risk-overview-container">
      {/* Top Activity Mission Strip */}
      <div className="analysis-context-strip">
        <div className="context-item activity-badge">
          <IconRenderer name={activityConfig.iconName} size={18} />
          <span className="context-strong">{activityName.toUpperCase()}</span>
        </div>
        <div className="context-divider" aria-hidden="true">•</div>
        <div className="context-item">
          <MapPin size={16} className="context-icon" />
          <span>{locationName}</span>
        </div>
        <div className="context-divider" aria-hidden="true">•</div>
        <div className="context-item">
          <Clock size={16} className="context-icon" />
          <span>
            {timeRangeFormatted} ({durationHours} {durationHours === 1 ? 'hr' : 'hrs'})
          </span>
        </div>
      </div>

      {/* Main Risk Card Grid */}
      <div className="risk-main-grid">
        {/* Radial Meter Card */}
        <div className="risk-score-card">
          <div className="gauge-wrapper">
            <svg
              className="radial-risk-svg"
              width="196"
              height="196"
              viewBox="0 0 196 196"
              role="img"
              aria-label={`Overall Activity Risk: ${overallRiskLevel}, ${overallRiskScore} out of 100`}
            >
              {/* Background Track */}
              <circle
                className="gauge-bg-circle"
                cx="98"
                cy="98"
                r={radius}
                strokeWidth="12"
              />
              {/* Animated Foreground Arc */}
              <circle
                className="gauge-fg-circle"
                cx="98"
                cy="98"
                r={radius}
                strokeWidth="12"
                stroke={riskColor}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 98 98)"
              />
            </svg>

            {/* Inner Score Label */}
            <div className="gauge-inner-label">
              <span className="gauge-score-value">{displayedScore}</span>
              <span className="gauge-score-max">/ 100</span>
            </div>
          </div>

          <div className="risk-level-meta">
            <span className="risk-classification-title">ACTIVITY RISK ESTIMATE</span>
            <div className={`risk-level-badge ${getRiskBadgeClass(overallRiskLevel)}`}>
              {overallRiskLevel === 'LOW' && <ShieldCheck size={16} />}
              {overallRiskLevel === 'MODERATE' && <Shield size={16} />}
              {(overallRiskLevel === 'HIGH' || overallRiskLevel === 'SEVERE') && (
                <ShieldAlert size={16} />
              )}
              <span>{overallRiskLevel} RISK</span>
            </div>

            {/* Dynamic Primary Driver Subordinate Telemetry */}
            {primaryDriver && (
              <div className="risk-primary-driver" title={`Highest contributing factor: ${primaryDriver}`}>
                <span className="driver-label">PRIMARY DRIVER</span>
                <span className="driver-value">{primaryDriver}</span>
              </div>
            )}
          </div>
        </div>

        {/* Environmental Stress Vectors */}
        <div className="environmental-factors-card">
          <div className="factors-card-header">
            <div className="factors-header-left">
              <Layers size={17} className="factors-header-icon" />
              <span className="factors-title">ENVIRONMENTAL STRESS VECTORS</span>
            </div>
            <span className="factors-note">Interactive Breakdown</span>
          </div>

          <div className="factors-matrix-list">
            {/* 1. Rain Vector */}
            <div
              className={`factor-interactive-card ${expandedFactorId === 'rain' ? 'expanded' : ''}`}
              onClick={() => toggleFactorExpand('rain')}
              tabIndex={0}
              role="button"
              aria-expanded={expandedFactorId === 'rain'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFactorExpand('rain');
                }
              }}
            >
              <div className="factor-row">
                <div className="factor-row-left">
                  <div className="factor-icon-box rain">
                    <Droplets size={16} />
                  </div>
                  <div className="factor-labels">
                    <span className="factor-name">Precipitation & Rain</span>
                    <span className="factor-metric">
                      {contributingFactors.find((f) => f.id === 'rain')?.primaryMetric || '0% rain probability'}
                    </span>
                  </div>
                </div>
                <div className="factor-row-right">
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-fill rain-fill"
                      style={{ width: `${factorScores.rainRisk}%` }}
                    />
                  </div>
                  <span className="factor-score-num">{factorScores.rainRisk}%</span>
                  <ChevronDown size={15} className="factor-expand-arrow" />
                </div>
              </div>
              {expandedFactorId === 'rain' && (
                <div className="factor-deep-insight">
                  <Info size={14} className="insight-icon" />
                  <p className="insight-text">
                    {contributingFactors.find((f) => f.id === 'rain')?.explanation ||
                      'Precipitation probability and accumulation volume directly affect terrain traction and activity viability.'}
                  </p>
                </div>
              )}
            </div>

            {/* 2. Heat / Thermal Vector */}
            <div
              className={`factor-interactive-card ${expandedFactorId === 'heat' ? 'expanded' : ''}`}
              onClick={() => toggleFactorExpand('heat')}
              tabIndex={0}
              role="button"
              aria-expanded={expandedFactorId === 'heat'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFactorExpand('heat');
                }
              }}
            >
              <div className="factor-row">
                <div className="factor-row-left">
                  <div className="factor-icon-box heat">
                    <Flame size={16} />
                  </div>
                  <div className="factor-labels">
                    <span className="factor-name">Thermal Load & Humidity</span>
                    <span className="factor-metric">
                      {contributingFactors.find((f) => f.id === 'heat')?.primaryMetric || 'Nominal thermal range'}
                    </span>
                  </div>
                </div>
                <div className="factor-row-right">
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-fill heat-fill"
                      style={{ width: `${factorScores.heatRisk}%` }}
                    />
                  </div>
                  <span className="factor-score-num">{factorScores.heatRisk}%</span>
                  <ChevronDown size={15} className="factor-expand-arrow" />
                </div>
              </div>
              {expandedFactorId === 'heat' && (
                <div className="factor-deep-insight">
                  <Info size={14} className="insight-icon" />
                  <p className="insight-text">
                    {contributingFactors.find((f) => f.id === 'heat')?.explanation ||
                      'Ambient temperature combined with relative humidity determines the effective apparent heat and cardiac thermoregulatory strain.'}
                  </p>
                </div>
              )}
            </div>

            {/* 3. Wind Vector */}
            <div
              className={`factor-interactive-card ${expandedFactorId === 'wind' ? 'expanded' : ''}`}
              onClick={() => toggleFactorExpand('wind')}
              tabIndex={0}
              role="button"
              aria-expanded={expandedFactorId === 'wind'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFactorExpand('wind');
                }
              }}
            >
              <div className="factor-row">
                <div className="factor-row-left">
                  <div className="factor-icon-box wind">
                    <Wind size={16} />
                  </div>
                  <div className="factor-labels">
                    <span className="factor-name">Wind Velocity & Gusts</span>
                    <span className="factor-metric">
                      {contributingFactors.find((f) => f.id === 'wind')?.primaryMetric || 'Calm velocity'}
                    </span>
                  </div>
                </div>
                <div className="factor-row-right">
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-fill wind-fill"
                      style={{ width: `${factorScores.windRisk}%` }}
                    />
                  </div>
                  <span className="factor-score-num">{factorScores.windRisk}%</span>
                  <ChevronDown size={15} className="factor-expand-arrow" />
                </div>
              </div>
              {expandedFactorId === 'wind' && (
                <div className="factor-deep-insight">
                  <Info size={14} className="insight-icon" />
                  <p className="insight-text">
                    {contributingFactors.find((f) => f.id === 'wind')?.explanation ||
                      'Sustained wind velocities and turbulence gusts impact aerodynamic drag, equipment stability, and projectile flight.'}
                  </p>
                </div>
              )}
            </div>

            {/* 4. UV Vector */}
            <div
              className={`factor-interactive-card ${expandedFactorId === 'uv' ? 'expanded' : ''}`}
              onClick={() => toggleFactorExpand('uv')}
              tabIndex={0}
              role="button"
              aria-expanded={expandedFactorId === 'uv'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFactorExpand('uv');
                }
              }}
            >
              <div className="factor-row">
                <div className="factor-row-left">
                  <div className="factor-icon-box uv">
                    <Sun size={16} />
                  </div>
                  <div className="factor-labels">
                    <span className="factor-name">Solar UV Exposure</span>
                    <span className="factor-metric">
                      {contributingFactors.find((f) => f.id === 'uv')?.primaryMetric || 'UV 0'}
                    </span>
                  </div>
                </div>
                <div className="factor-row-right">
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-fill uv-fill"
                      style={{ width: `${factorScores.uvRisk}%` }}
                    />
                  </div>
                  <span className="factor-score-num">{factorScores.uvRisk}%</span>
                  <ChevronDown size={15} className="factor-expand-arrow" />
                </div>
              </div>
              {expandedFactorId === 'uv' && (
                <div className="factor-deep-insight">
                  <Info size={14} className="insight-icon" />
                  <p className="insight-text">
                    {contributingFactors.find((f) => f.id === 'uv')?.explanation ||
                      'Solar ultraviolet radiation requires photo-protection to prevent skin damage and ocular strain during sustained exposure.'}
                  </p>
                </div>
              )}
            </div>

            {/* 5. Visibility Vector */}
            <div
              className={`factor-interactive-card ${expandedFactorId === 'vis' ? 'expanded' : ''}`}
              onClick={() => toggleFactorExpand('vis')}
              tabIndex={0}
              role="button"
              aria-expanded={expandedFactorId === 'vis'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFactorExpand('vis');
                }
              }}
            >
              <div className="factor-row">
                <div className="factor-row-left">
                  <div className="factor-icon-box vis">
                    <Eye size={16} />
                  </div>
                  <div className="factor-labels">
                    <span className="factor-name">Atmospheric Visibility</span>
                    <span className="factor-metric">
                      {analysis.windowAnalysis.hours[0]?.hour.visibility
                        ? `${(analysis.windowAnalysis.hours[0].hour.visibility / 1000).toFixed(1)} km clear`
                        : 'Good visibility'}
                    </span>
                  </div>
                </div>
                <div className="factor-row-right">
                  <div className="factor-progress-track">
                    <div
                      className="factor-progress-fill vis-fill"
                      style={{ width: `${factorScores.visibilityRisk}%` }}
                    />
                  </div>
                  <span className="factor-score-num">{factorScores.visibilityRisk}%</span>
                  <ChevronDown size={15} className="factor-expand-arrow" />
                </div>
              </div>
              {expandedFactorId === 'vis' && (
                <div className="factor-deep-insight">
                  <Info size={14} className="insight-icon" />
                  <p className="insight-text">
                    Horizontal atmospheric optical clarity determines obstacle perception, optical focal quality, and transit safety.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
