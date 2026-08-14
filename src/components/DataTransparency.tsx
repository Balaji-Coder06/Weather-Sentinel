import React from 'react';
import { ExternalLink, Shield } from 'lucide-react';

export const DataTransparency: React.FC = () => {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-container">
        <div className="footer-left">
          <Shield size={14} className="footer-shield-icon" />
          <span className="footer-copyright">
            © {new Date().getFullYear()} Weather Sentinel. Environmental Risk Intelligence.
          </span>
        </div>

        <div className="footer-right">
          <span className="footer-attribution">
            Weather telemetry via{' '}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noreferrer noopener"
              className="footer-link"
            >
              Open-Meteo <ExternalLink size={11} className="inline-icon" />
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
};
