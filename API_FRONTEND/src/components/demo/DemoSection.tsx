// ============================================================
// DemoSection — Reusable section wrapper for every demo
//
// Handles:
//   - Section header (number badge, method, title, subtitle)
//   - Endpoint badge
//   - Run / Auto-run controls with countdown
//   - 55/45 split layout (visual left, code right)
//   - Anchor ID for quick-nav scrolling
//
// Integration note for developers:
//   Each DemoSection is a standalone unit. You can embed it in
//   any page that imports the IntegrationPanel.
// ============================================================

import { type ReactNode } from 'react';
import { Play, RefreshCw, Timer } from 'lucide-react';
import { useAutoRun } from '../../hooks/useDemoApi';
import IntegrationPanel from './IntegrationPanel';

interface DemoSectionProps {
  number: number;
  title: string;
  subtitle: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  autoRunIntervalSec: number;
  codeContent: string;
  requestContent: string;
  onRun: () => Promise<void>;
  responseJson: string | null;
  responseTimeMs: number;
  responseSizeKb: string;
  lastRunTime: Date | null;
  isLoading: boolean;
  highlightedZone?: string | null;
  children: ReactNode;
}

const DemoSection = ({
  number,
  title,
  subtitle,
  method,
  endpoint,
  autoRunIntervalSec,
  codeContent,
  requestContent,
  onRun,
  responseJson,
  responseTimeMs,
  responseSizeKb,
  lastRunTime,
  isLoading,
  highlightedZone,
  children,
}: DemoSectionProps) => {
  const { autoRun, setAutoRun, countdown } = useAutoRun(onRun, autoRunIntervalSec);

  return (
    <section id={`demo-${number}`} className="demo-section">
      {/* ── Header ──────────────────────────────────── */}
      <div className="demo-header">
        <div className="demo-header-top">
          <div className="flex items-center gap-3">
            <span className="demo-number">{number}</span>
            <span className={`demo-method-badge method-${method.toLowerCase()}`}>{method}</span>
          </div>

          {/* Meta chips */}
          <div className="flex items-center gap-2">
            {responseTimeMs > 0 && (
              <span className="demo-meta-chip">{responseTimeMs}ms</span>
            )}
            {responseSizeKb && responseJson && (
              <span className="demo-meta-chip">{responseSizeKb}</span>
            )}
            {lastRunTime && (
              <span className="demo-meta-chip">
                {lastRunTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <h2 className="demo-title">{title}</h2>
        <p className="demo-subtitle">{subtitle}</p>
        <div className="demo-endpoint-badge">
          <span className={`w-1.5 h-1.5 rounded-full ${lastRunTime ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          <code>{endpoint}</code>
        </div>

        {/* ── Controls ──────────────────────────────── */}
        <div className="demo-controls">
          <button
            onClick={onRun}
            disabled={isLoading}
            className="demo-run-btn"
          >
            {isLoading ? (
              <div className="spinner" />
            ) : (
              <Play size={14} fill="white" />
            )}
            {isLoading ? 'Running…' : 'Run Demo'}
          </button>

          <button
            onClick={() => setAutoRun(!autoRun)}
            className={`demo-auto-toggle ${autoRun ? 'auto-active' : ''}`}
          >
            <RefreshCw size={13} className={autoRun ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
            <span className="text-[11px] font-semibold">Auto</span>
          </button>

          {autoRun && (
            <span className="demo-countdown">
              <Timer size={11} />
              {countdown}s
            </span>
          )}
        </div>
      </div>

      {/* ── Content: 55% visual · 45% code ──────────── */}
      <div className="demo-content">
        <div className="demo-left">{children}</div>
        <div className="demo-right">
          <IntegrationPanel
            codeContent={codeContent}
            requestContent={requestContent}
            responseContent={responseJson}
            responseTimeMs={responseTimeMs}
            responseSizeKb={responseSizeKb}
            highlightedZone={highlightedZone}
          />
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
