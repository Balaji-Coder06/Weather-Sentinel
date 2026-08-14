import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface ErrorDisplayProps {
  errorMessage: string;
  onRetry?: () => void;
  onReset?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errorMessage,
  onRetry,
  onReset,
}) => {
  return (
    <div className="error-display-card" role="alert" aria-live="assertive">
      <div className="error-icon-box">
        <AlertTriangle size={28} className="error-icon" />
      </div>

      <div className="error-content">
        <h3 className="error-title">Unable to Complete Risk Analysis</h3>
        <p className="error-desc">{errorMessage}</p>

        <div className="error-actions">
          {onRetry && (
            <button type="button" className="btn-error-retry" onClick={onRetry}>
              <RefreshCw size={16} />
              <span>Retry Analysis</span>
            </button>
          )}

          {onReset && (
            <button type="button" className="btn-error-reset" onClick={onReset}>
              <ArrowLeft size={16} />
              <span>Adjust Activity Plan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
