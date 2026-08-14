import React from 'react';
import { Shield, Sparkles, Activity, Layers, Sun, Moon, Laptop, ArrowRight } from 'lucide-react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type FeedStatus = 'live' | 'updating' | 'cached' | 'offline';

interface HeroHeaderProps {
  theme: ThemeMode;
  onThemeChange: (newTheme: ThemeMode) => void;
  feedStatus: FeedStatus;
  lastFetchedSeconds?: number;
  onPlanClick?: () => void;
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({
  theme,
  onThemeChange,
  feedStatus,
  lastFetchedSeconds,
  onPlanClick,
}) => {
  const getFeedStatusLabel = () => {
    switch (feedStatus) {
      case 'updating':
        return 'UPDATING FEED...';
      case 'cached':
        return lastFetchedSeconds !== undefined && lastFetchedSeconds > 0
          ? `FETCHED ${lastFetchedSeconds}s AGO`
          : 'CACHED FEED';
      case 'offline':
        return 'NETWORK OFFLINE';
      default:
        return 'OPEN-METEO LIVE FEED';
    }
  };

  const getFeedDotClass = () => {
    switch (feedStatus) {
      case 'updating':
        return 'updating';
      case 'cached':
        return 'cached';
      case 'offline':
        return 'offline';
      default:
        return 'live';
    }
  };

  return (
    <header className="hero-section" role="banner">
      {/* Top Telemetry & Controls Bar */}
      <div className="hero-top-bar">
        <div className="brand-badge">
          <div className="brand-icon-wrapper">
            <Shield className="brand-shield-icon" size={22} />
            <div className={`pulse-indicator ${getFeedDotClass()}`} aria-hidden="true" />
          </div>
          <div className="brand-text">
            <span className="brand-title">WEATHER SENTINEL</span>
            <span className="brand-sub">ENVIRONMENTAL INTELLIGENCE</span>
          </div>
        </div>

        <div className="top-bar-right-controls">
          {/* Live Feed Status Pill */}
          <div className={`system-telemetry-badge status-${getFeedDotClass()}`} title="Live Meteorological Feed Status">
            <span className={`telemetry-dot ${getFeedDotClass()}`} />
            <span className="telemetry-label">{getFeedStatusLabel()}</span>
          </div>

          {/* Theme Selector (Dark, Light, System) */}
          <div className="theme-toggle-group" role="radiogroup" aria-label="Theme selection">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onThemeChange('dark')}
              title="Dark Theme"
              aria-label="Dark Theme"
            >
              <Moon size={14} />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onThemeChange('light')}
              title="Light Theme"
              aria-label="Light Theme"
            >
              <Sun size={14} />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'system'}
              className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => onThemeChange('system')}
              title="System Preference"
              aria-label="System Theme"
            >
              <Laptop size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Body Content */}
      <div className="hero-content">
        <div className="hero-tag-pill">
          <Sparkles size={14} className="tag-icon" />
          <span>CONTEXT-AWARE ENVIRONMENTAL DECISION SUPPORT</span>
        </div>

        <h1 className="hero-headline">
          Weather tells you what is coming.{' '}
          <span className="hero-highlight">Sentinel tells you what it means.</span>
        </h1>

        <p className="hero-description">
          A generic weather app gives you raw degrees and rain percentages. Weather Sentinel computes 
          the exact risk profile, thermal strain, aerodynamic resistance, and timing viability for your 
          specific outdoor activity.
        </p>

        <div className="hero-capabilities-grid">
          <div className="capability-chip">
            <Activity size={15} className="chip-icon" />
            <span>Activity Sensitivity Weighting</span>
          </div>
          <div className="capability-chip">
            <Layers size={15} className="chip-icon" />
            <span>Duration Window Evaluation</span>
          </div>
          <div className="capability-chip">
            <Sparkles size={15} className="chip-icon" />
            <span>24-Hour Optimal Timing Discovery</span>
          </div>
        </div>

        {onPlanClick && (
          <div className="hero-action-row">
            <button
              type="button"
              className="btn-hero-action"
              onClick={onPlanClick}
              id="hero-plan-activity-btn"
            >
              <span>PLAN AN ACTIVITY</span>
              <ArrowRight size={16} className="btn-arrow" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
