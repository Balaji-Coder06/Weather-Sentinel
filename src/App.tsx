import React, { useState, useRef, useEffect } from 'react';
import { ActivityPlanner } from './components/ActivityPlanner';
import { AtmosphericBackground } from './components/AtmosphericBackground';
import { DataTransparency } from './components/DataTransparency';
import { ErrorDisplay } from './components/ErrorDisplay';
import { HeroHeader } from './components/HeroHeader';
import type { ThemeMode, FeedStatus } from './components/HeroHeader';
import { SentinelAnalysisView } from './components/SentinelAnalysisView';
import { SentinelLoader } from './components/SentinelLoader';
import { SentinelCore } from './engine/sentinelCore';
import type { ActivityPlanContext } from './types/activity';
import type { RiskAnalysisResult } from './types/risk';
import './App.css';

const sentinelCore = new SentinelCore();

export const App: React.FC = () => {
  // Theme State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sentinel_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'dark';
  });

  // Feed Telemetry State
  const [feedStatus, setFeedStatus] = useState<FeedStatus>('live');
  const [lastFetchedTimestamp, setLastFetchedTimestamp] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Application Workflow State
  const [currentPlan, setCurrentPlan] = useState<ActivityPlanContext | null>(null);
  const [analysisResult, setAnalysisResult] = useState<RiskAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPlanner, setShowPlanner] = useState<boolean>(true);

  const resultsRef = useRef<HTMLDivElement>(null);
  const plannerRef = useRef<HTMLDivElement>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Handle Theme switching & System sync
  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('sentinel_theme', theme);

    const applyTheme = () => {
      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', theme);
      }
    };

    applyTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Track seconds elapsed since last fetch for live telemetry badge
  useEffect(() => {
    if (!lastFetchedTimestamp) return;

    const interval = setInterval(() => {
      const diffSec = Math.floor((Date.now() - lastFetchedTimestamp) / 1000);
      setSecondsAgo(diffSec);
      if (diffSec > 60) {
        setFeedStatus('cached');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [lastFetchedTimestamp]);

  // Online / Offline network listeners
  useEffect(() => {
    const handleOnline = () => setFeedStatus('live');
    const handleOffline = () => setFeedStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAnalyze = async (plan: ActivityPlanContext, forceRefresh: boolean = false) => {
    // Cancel in-flight request if user rapidly changed plan or location
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    setCurrentPlan(plan);
    setIsLoading(true);
    setFeedStatus('updating');
    setErrorMessage(null);
    setLoadingStage('Connecting to Open-Meteo live meteorological feed...');

    try {
      const result = await sentinelCore.analyzePlan(
        plan,
        (stage) => {
          setLoadingStage(stage);
        },
        forceRefresh,
        abortController.signal
      );
      setAnalysisResult(result);
      setLastFetchedTimestamp(Date.now());
      setFeedStatus('live');
      setSecondsAgo(0);
      setShowPlanner(false);

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // Request was superseded by a newer request
      }
      setFeedStatus('offline');
      setErrorMessage(
        err.message ||
          'Failed to retrieve weather data or compute risk profile. Please verify connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifyPlan = () => {
    setShowPlanner(true);
    setTimeout(() => {
      plannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleReAnalyze = () => {
    if (currentPlan) {
      handleAnalyze(currentPlan, true);
    }
  };

  const handleApplyBestTime = (newStartTime: string) => {
    if (currentPlan) {
      const updatedPlan: ActivityPlanContext = {
        ...currentPlan,
        startTime: newStartTime,
      };
      handleAnalyze(updatedPlan, false);
    }
  };

  const handleScrollToPlanner = () => {
    setShowPlanner(true);
    plannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Derive atmospheric background condition nuance from active weather analysis
  const getWeatherConditionCategory = (): 'clear' | 'rain' | 'cloudy' | 'wind' | 'neutral' => {
    if (!analysisResult) return 'neutral';
    const firstHour = analysisResult.windowAnalysis.hours[0]?.hour;
    if (!firstHour) return 'neutral';

    if (analysisResult.factorScores.rainRisk >= 40 || (firstHour.precipitationProbability && firstHour.precipitationProbability > 45)) {
      return 'rain';
    }
    if (analysisResult.factorScores.windRisk >= 50 || (firstHour.windSpeed && firstHour.windSpeed > 25)) {
      return 'wind';
    }
    if (firstHour.weatherCode === 0 || firstHour.weatherCode === 1) {
      return 'clear';
    }
    if (firstHour.weatherCode && firstHour.weatherCode >= 2 && firstHour.weatherCode <= 3) {
      return 'cloudy';
    }
    return 'neutral';
  };

  return (
    <div className="sentinel-app-shell">
      {/* Weather-Responsive Ambient Atmospheric Motion */}
      <AtmosphericBackground weatherCondition={getWeatherConditionCategory()} />

      <div className="app-content-container">
        {/* Hero & System Status Banner */}
        <HeroHeader
          theme={theme}
          onThemeChange={setTheme}
          feedStatus={feedStatus}
          lastFetchedSeconds={secondsAgo}
          onPlanClick={handleScrollToPlanner}
        />

        <main className="main-content-flow">
          {/* Activity Planner Form */}
          <div
            ref={plannerRef}
            className={`planner-wrapper ${!showPlanner && analysisResult ? 'collapsed' : ''}`}
          >
            {showPlanner ? (
              <ActivityPlanner
                onAnalyze={handleAnalyze}
                isLoading={isLoading}
                initialPlan={currentPlan}
              />
            ) : (
              <div className="collapsed-planner-strip">
                <div className="collapsed-plan-info">
                  <div className="mission-status-indicator" aria-hidden="true" />
                  <span className="collapsed-label">CURRENT ACTIVE PLAN:</span>
                  <span className="collapsed-val">
                    {currentPlan?.activityId.replace('_', ' ').toUpperCase()} in{' '}
                    {currentPlan?.locationName} • {analysisResult?.timeRangeFormatted || `${currentPlan?.startTime} (${currentPlan?.durationHours}h)`}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-expand-planner"
                  onClick={handleModifyPlan}
                >
                  Edit Configuration
                </button>
              </div>
            )}
          </div>

          {/* Staged Sentinel Loader */}
          {isLoading && (
            <div className="loader-anchor-wrapper">
              <SentinelLoader currentStageText={loadingStage} />
            </div>
          )}

          {/* Error State */}
          {errorMessage && !isLoading && (
            <ErrorDisplay
              errorMessage={errorMessage}
              onRetry={handleReAnalyze}
              onReset={() => {
                setErrorMessage(null);
                setShowPlanner(true);
              }}
            />
          )}

          {/* Results Analysis View */}
          {analysisResult && !isLoading && !errorMessage && (
            <div ref={resultsRef} className="analysis-anchor-wrapper">
              <SentinelAnalysisView
                analysis={analysisResult}
                onModifyPlan={handleModifyPlan}
                onReAnalyze={handleReAnalyze}
                onApplyBestTime={handleApplyBestTime}
              />
            </div>
          )}
        </main>

        {/* Data Attribution & Methodology Footer */}
        <DataTransparency />
      </div>
    </div>
  );
};

export default App;
