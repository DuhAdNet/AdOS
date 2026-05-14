import { useState, useEffect } from 'react';

interface ToolStep {
  name: string;
  timestamp: number;
}

interface ToolStepsProps {
  steps: ToolStep[];
  isRunning: boolean;
  startTime: number;
}

export default function ToolSteps({ steps, isRunning, startTime }: ToolStepsProps) {
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  if (steps.length === 0) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-surface-3/50 rounded-lg px-2 py-1.5 transition-colors"
      >
        {isRunning ? (
          <span className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          <span className="w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        )}
        <span className="text-xs font-medium text-secondary">
          {isRunning ? `Executando... ${steps.length} etapas` : `${steps.length} etapas concluídas`}
        </span>
        <div className="flex gap-0.5 mx-1">
          {steps.slice(-8).map((_, i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-green-500" />
          ))}
          {isRunning && <span className="w-1 h-1 rounded-full bg-brand-500 animate-pulse" />}
        </div>
        <span className="text-[10px] text-muted ml-auto">{formatTime(elapsed)}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="space-y-0.5 pl-6 mt-1 max-h-40 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
              <span className="w-3 h-3 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span className="text-muted">{formatToolName(step.name)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
