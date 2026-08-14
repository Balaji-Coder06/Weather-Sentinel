import React from 'react';

interface AtmosphericBackgroundProps {
  weatherCondition?: 'clear' | 'rain' | 'cloudy' | 'wind' | 'neutral';
}

export const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({
  weatherCondition = 'neutral',
}) => {
  return (
    <div className={`atmospheric-background condition-${weatherCondition}`} aria-hidden="true">
      {/* Ambient Gradient Glow Orbs */}
      <div className="ambient-orb orb-primary" />
      <div className="ambient-orb orb-secondary" />
      <div className="ambient-orb orb-tertiary" />

      {/* Topographic & Environmental Grid Mesh */}
      <div className="atmospheric-grid-mesh" />

      {/* Weather-Responsive Particle / Contour Traces */}
      {weatherCondition === 'rain' && (
        <div className="weather-effect rain-traces">
          <span className="rain-trace t1" />
          <span className="rain-trace t2" />
          <span className="rain-trace t3" />
          <span className="rain-trace t4" />
        </div>
      )}

      {weatherCondition === 'wind' && (
        <div className="weather-effect wind-traces">
          <span className="wind-flow-line f1" />
          <span className="wind-flow-line f2" />
          <span className="wind-flow-line f3" />
        </div>
      )}

      {weatherCondition === 'clear' && (
        <div className="weather-effect solar-flare-glow" />
      )}

      {/* Subtle Contour Geometry */}
      <svg className="atmospheric-contour-svg" viewBox="0 0 1440 900" fill="none">
        <path
          d="M-100 250 C 300 180, 600 320, 1100 200 C 1300 150, 1500 220, 1600 210"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="4 8"
          className="contour-line c1"
        />
        <path
          d="M-50 480 C 250 420, 700 580, 1050 460 C 1280 390, 1450 510, 1600 480"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="6 10"
          className="contour-line c2"
        />
        <path
          d="M0 720 C 400 680, 850 790, 1200 690 C 1380 640, 1500 710, 1600 700"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="4 6"
          className="contour-line c3"
        />
      </svg>
    </div>
  );
};
