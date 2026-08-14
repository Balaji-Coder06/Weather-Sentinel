import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Droplets, Wind, Sun } from 'lucide-react';

interface SentinelLoaderProps {
  currentStageText?: string;
}

const DEFAULT_STAGES = [
  'Connecting to Open-Meteo meteorological feed...',
  'Scanning hourly temperature, precipitation & wind fields...',
  'Evaluating continuous activity duration window...',
  'Computing thermal discomfort and apparent heat load...',
  'Calculating aerodynamic resistance & gust exposure...',
  'Synthesizing dynamic attribution & optimal timing...',
];

export const SentinelLoader: React.FC<SentinelLoaderProps> = ({ currentStageText }) => {
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % DEFAULT_STAGES.length);
    }, 700);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sentinel-loader-container" role="status" aria-live="polite">
      <div className="sentinel-loader-visual">
        <div className="radar-sweep-ring">
          <div className="radar-sweep-beam" />
        </div>
        <div className="loader-center-shield">
          <Shield className="loader-shield-icon" size={32} />
        </div>
        <div className="satellite-orbit-icon icon-1">
          <Droplets size={14} />
        </div>
        <div className="satellite-orbit-icon icon-2">
          <Wind size={14} />
        </div>
        <div className="satellite-orbit-icon icon-3">
          <Sun size={14} />
        </div>
      </div>

      <div className="sentinel-loader-meta">
        <div className="sentinel-loader-tag">
          <Sparkles size={14} className="animate-spin-slow" />
          <span>SENTINEL RISK PIPELINE ACTIVE</span>
        </div>
        <h3 className="sentinel-loader-title">Analyzing Activity Context</h3>
        <p className="sentinel-loader-stage">
          {currentStageText || DEFAULT_STAGES[activeStageIndex]}
        </p>

        <div className="loader-progress-steps">
          {DEFAULT_STAGES.slice(0, 4).map((_, idx) => (
            <div
              key={idx}
              className={`progress-step-pill ${
                idx <= activeStageIndex % 4 ? 'filled' : ''
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
