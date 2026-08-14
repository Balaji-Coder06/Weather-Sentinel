import React, { useState } from 'react';
import {
  Clock,
  Droplets,
  Flame,
  Sun,
  Wind,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  Award,
} from 'lucide-react';
import type { ActivityWindowAnalysis, RiskLevel } from '../types/risk';
import { IconRenderer } from './IconRenderer';

interface ActivityTimelineProps {
  windowAnalysis: ActivityWindowAnalysis;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ windowAnalysis }) => {
  const { hours, peakRiskHour, lowestRiskHour, conditionTrajectory } = windowAnalysis;
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(0);

  const activeItem = hours[selectedHourIndex] || hours[0];
  const { hour, riskScore, riskLevel, factors } = activeItem;

  const getRiskBadgeClass = (level: RiskLevel) => {
    switch (level) {
      case 'LOW':
        return 'timeline-risk-low';
      case 'MODERATE':
        return 'timeline-risk-mod';
      case 'HIGH':
        return 'timeline-risk-high';
      case 'SEVERE':
        return 'timeline-risk-severe';
    }
  };

  const getTrajectoryIcon = () => {
    switch (conditionTrajectory) {
      case 'deteriorating':
        return <TrendingUp className="traj-icon bad" size={16} />;
      case 'improving':
        return <TrendingDown className="traj-icon good" size={16} />;
      default:
        return <Minus className="traj-icon neutral" size={16} />;
    }
  };

  // Build SVG Risk Curve points
  const count = hours.length;
  const svgWidth = 740;
  const svgHeight = 150;
  const paddingX = 54;
  const paddingTop = 28;
  const paddingBottom = 32;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingTop - paddingBottom;
  const baselineY = paddingTop + chartH;

  const points = hours.map((h, i) => {
    const x = count > 1 ? paddingX + (i / (count - 1)) * chartW : svgWidth / 2;
    // Map score 0-100 to Y mathematically without artificial exaggeration
    const y = paddingTop + chartH - (h.riskScore / 100) * chartH;
    return { x, y, hour: h };
  });

  // Build smooth SVG curve path
  let pathD = '';
  let areaD = '';

  if (points.length === 1) {
    pathD = `M ${points[0].x - 60} ${points[0].y} L ${points[0].x + 60} ${points[0].y}`;
    areaD = `M ${points[0].x - 60} ${points[0].y} L ${points[0].x + 60} ${points[0].y} L ${points[0].x + 60} ${baselineY} L ${points[0].x - 60} ${baselineY} Z`;
  } else if (points.length === 2) {
    pathD = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    areaD = `${pathD} L ${points[1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  } else {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    areaD = `${pathD} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  }

  const isPeak = hour.timestamp === peakRiskHour.hour.timestamp;
  const isLowest =
    hour.timestamp === lowestRiskHour.hour.timestamp &&
    hours.length > 1 &&
    peakRiskHour.riskScore !== lowestRiskHour.riskScore;

  return (
    <div className="timeline-section" id="forecast-timeline-section">
      <div className="timeline-header">
        <div className="timeline-header-left">
          <Clock size={18} className="timeline-clock-icon" />
          <h3 className="timeline-title">Forecast Risk Curve & Progression</h3>
        </div>

        <div className="trajectory-badge">
          {getTrajectoryIcon()}
          <span className="traj-label">Trajectory: {conditionTrajectory.toUpperCase()}</span>
        </div>
      </div>

      <p className="timeline-subtitle">
        Continuous environmental risk curve across your activity duration window. Select any hour point to inspect localized telemetry.
      </p>

      {/* 1. Continuous SVG Risk Trend Chart */}
      <div className="timeline-curve-wrapper" role="region" aria-label="Risk Curve Visualization">
        <svg
          className="risk-curve-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="riskAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="riskLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* Reference Grid lines & Risk Threshold Indicators */}
          {/* 75 Severe/High Threshold */}
          <line
            x1={paddingX}
            y1={paddingTop + chartH * 0.25}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartH * 0.25}
            stroke="var(--border-subtle)"
            strokeDasharray="2 3"
            strokeOpacity="0.7"
          />
          <text
            x={paddingX - 10}
            y={paddingTop + chartH * 0.25 + 3}
            textAnchor="end"
            fill="var(--text-dim)"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="600"
          >
            75
          </text>

          {/* 50 Moderate Threshold */}
          <line
            x1={paddingX}
            y1={paddingTop + chartH * 0.5}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartH * 0.5}
            stroke="var(--border-subtle)"
            strokeDasharray="2 3"
            strokeOpacity="0.7"
          />
          <text
            x={paddingX - 10}
            y={paddingTop + chartH * 0.5 + 3}
            textAnchor="end"
            fill="var(--text-dim)"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="600"
          >
            50
          </text>

          {/* 25 Low Threshold */}
          <line
            x1={paddingX}
            y1={paddingTop + chartH * 0.75}
            x2={svgWidth - paddingX}
            y2={paddingTop + chartH * 0.75}
            stroke="var(--border-subtle)"
            strokeDasharray="2 3"
            strokeOpacity="0.7"
          />
          <text
            x={paddingX - 10}
            y={paddingTop + chartH * 0.75 + 3}
            textAnchor="end"
            fill="var(--text-dim)"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="600"
          >
            25
          </text>

          {/* Baseline */}
          <line
            x1={paddingX}
            y1={baselineY}
            x2={svgWidth - paddingX}
            y2={baselineY}
            stroke="var(--border-medium)"
            strokeWidth="1.25"
          />

          {/* Gradient Area under Curve */}
          <path d={areaD} fill="url(#riskAreaGrad)" />

          {/* Continuous Curve Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#riskLineGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            className="curve-path-animated"
          />

          {/* Vertical drop lines for all points */}
          {points.map((p, idx) => {
            const isSelected = idx === selectedHourIndex;
            return (
              <line
                key={`guide-${p.hour.hour.timestamp}`}
                x1={p.x}
                y1={p.y + 6}
                x2={p.x}
                y2={baselineY + (isSelected ? 6 : 0)}
                stroke={isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}
                strokeWidth={isSelected ? '1.5' : '1'}
                strokeDasharray={isSelected ? '3 2' : '2 2'}
                strokeOpacity={isSelected ? '1' : '0.6'}
              />
            );
          })}

          {/* Interactive Data Points and Risk Badges */}
          {points.map((p, idx) => {
            const isSelected = idx === selectedHourIndex;
            const score = p.hour.riskScore;

            return (
              <g
                key={p.hour.hour.timestamp}
                className={`curve-node-group ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedHourIndex(idx)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hit area */}
                <circle cx={p.x} cy={p.y} r="22" fill="transparent" />

                {/* Score Pill directly above point */}
                <g className="point-score-badge">
                  <rect
                    x={p.x - 14}
                    y={p.y - 20}
                    width="28"
                    height="14"
                    rx="4"
                    fill={isSelected ? 'var(--accent-cyan)' : 'var(--bg-surface)'}
                    stroke={isSelected ? 'var(--accent-cyan)' : 'var(--border-medium)'}
                    strokeWidth="1"
                    className="score-badge-rect"
                  />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    fill={isSelected ? '#ffffff' : 'var(--text-primary)'}
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    {score}
                  </text>
                </g>

                {/* Selected Point Pulse Ring */}
                {isSelected && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="10"
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="2"
                    className="pulse-node-ring"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? '6.5' : '5'}
                  fill={isSelected ? 'var(--accent-cyan)' : 'var(--bg-surface)'}
                  stroke={isSelected ? '#ffffff' : 'var(--accent-cyan)'}
                  strokeWidth="2.5"
                />

                {/* Hour Label below baseline */}
                <text
                  x={p.x}
                  y={baselineY + 18}
                  textAnchor="middle"
                  fill={isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fontWeight={isSelected ? '800' : '600'}
                >
                  {p.hour.hour.timeFormatted}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 2. Focused Hour Detail Inspection Card */}
      <div className="timeline-focused-detail-card">
        <div className="focused-top-row">
          <div className="focused-time-box">
            <div className="focused-weather-icon">
              <IconRenderer name={hour.weatherIconName} size={24} />
            </div>
            <div>
              <span className="focused-time-val">{hour.timeFormatted}</span>
              <span className="focused-weather-desc">{hour.weatherDescription}</span>
            </div>
          </div>

          <div className="focused-risk-box">
            {isPeak && (
              <span className="hour-highlight-tag peak">
                <AlertTriangle size={12} />
                <span>PEAK WINDOW RISK</span>
              </span>
            )}
            {isLowest && (
              <span className="hour-highlight-tag favorable">
                <Award size={12} />
                <span>LOWEST IN WINDOW</span>
              </span>
            )}

            <div className="focused-score-pill">
              <span className="focused-score-num">{riskScore} / 100</span>
              <span className={`hour-risk-pill ${getRiskBadgeClass(riskLevel)}`}>{riskLevel}</span>
            </div>
          </div>
        </div>

        {/* Focused Metrics Grid */}
        <div className="focused-metrics-grid">
          <div className="focused-metric-cell">
            <Flame size={15} className="chip-icon heat-color" />
            <div className="cell-data">
              <span className="cell-label">TEMPERATURE</span>
              <span className="cell-value">
                {hour.temperature !== null ? `${hour.temperature.toFixed(1)}°C` : '--'}
              </span>
              <span className="cell-sub">
                Feels {hour.apparentTemperature !== null ? `${hour.apparentTemperature.toFixed(1)}°C` : '--'} ({factors.heatRisk}% heat risk)
              </span>
            </div>
          </div>

          <div className="focused-metric-cell">
            <Droplets size={15} className="chip-icon rain-color" />
            <div className="cell-data">
              <span className="cell-label">PRECIPITATION</span>
              <span className="cell-value">
                {hour.precipitationProbability !== null ? `${hour.precipitationProbability}%` : '--'}
              </span>
              <span className="cell-sub">
                {hour.precipitation && hour.precipitation > 0
                  ? `${hour.precipitation.toFixed(1)} mm accumulation`
                  : '0.0 mm expected'} ({factors.rainRisk}% rain risk)
              </span>
            </div>
          </div>

          <div className="focused-metric-cell">
            <Wind size={15} className="chip-icon wind-color" />
            <div className="cell-data">
              <span className="cell-label">WIND & GUSTS</span>
              <span className="cell-value">
                {hour.windSpeed !== null ? `${hour.windSpeed.toFixed(0)} km/h` : '--'}
              </span>
              <span className="cell-sub">
                {hour.windGusts ? `Gusts up to ${hour.windGusts.toFixed(0)} km/h` : 'Calm air flow'} ({factors.windRisk}% wind risk)
              </span>
            </div>
          </div>

          <div className="focused-metric-cell">
            <Sun size={15} className="chip-icon uv-color" />
            <div className="cell-data">
              <span className="cell-label">SOLAR UV & CLOUD</span>
              <span className="cell-value">
                {hour.uvIndex !== null ? `UV Index ${hour.uvIndex.toFixed(1)}` : 'UV --'}
              </span>
              <span className="cell-sub">
                {hour.cloudCover !== null ? `${hour.cloudCover}% cloud cover` : ''} ({factors.uvRisk}% UV risk)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Hourly Interval Selector Strip */}
      <div className="timeline-mini-selector" role="tablist" aria-label="Hourly timeline interval selector">
        {hours.map((item, idx) => {
          const isSelected = idx === selectedHourIndex;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={isSelected}
              key={item.hour.timestamp}
              className={`mini-hour-pill ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedHourIndex(idx)}
            >
              <span className="mini-hour-time">{item.hour.timeFormatted}</span>
              <span className={`mini-hour-risk-tag ${getRiskBadgeClass(item.riskLevel)}`}>
                {item.riskScore}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
