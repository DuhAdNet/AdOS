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

const toolCategories: Record<string, string> = {
  thinking: 'thinking',
  'delegated:': 'agent',
  read: 'file', file: 'file', write: 'file', edit: 'file',
  bash: 'terminal', shell: 'terminal', exec: 'terminal', run: 'terminal', command: 'terminal',
  search: 'search', grep: 'search', find: 'search',
  web: 'globe', fetch: 'globe', browse: 'globe', navigate: 'globe', open_browser: 'globe',
  gmail: 'mail', email: 'mail', mail: 'mail',
  slack: 'chat', message: 'chat',
  github: 'code', git: 'code',
  drive: 'folder', folder: 'folder', list_directory: 'folder', create_directory: 'folder',
};

function getToolCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, cat] of Object.entries(toolCategories)) {
    if (lower.includes(key)) return cat;
  }
  return 'gear';
}

function ToolIcon({ category }: { category: string }) {
  const cls = "w-3 h-3 text-muted shrink-0";
  switch (category) {
    case 'thinking':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2l1.09 3.26L16.35 6l-3.26 1.09L12 10.35l-1.09-3.26L7.65 6l3.26-1.09L12 2z"/><path d="M18 12l.72 2.18L20.9 15l-2.18.72L18 17.9l-.72-2.18L15.1 15l2.18-.72L18 12z"/><path d="M6 15l.72 2.18L8.9 18l-2.18.72L6 20.9l-.72-2.18L3.1 18l2.18-.72L6 15z"/></svg>;
    case 'agent':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
    case 'file':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    case 'terminal':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>;
    case 'search':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
    case 'globe':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
    case 'mail':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    case 'chat':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'code':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
    case 'folder':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    default:
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  }
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
          {isRunning
            ? steps.length === 1 && steps[0].name === 'thinking'
              ? 'Pensando...'
              : `Executando... ${steps.length} ${steps.length === 1 ? 'etapa' : 'etapas'}`
            : `${steps.length} ${steps.length === 1 ? 'etapa concluída' : 'etapas concluídas'}`}
        </span>
        <div className="flex gap-1 mx-1 items-center">
          {steps.slice(-6).map((step, i) => (
            <ToolIcon key={i} category={getToolCategory(step.name)} />
          ))}
          {isRunning && <span className="w-1 h-1 rounded-full bg-brand-500 animate-pulse" />}
        </div>
        <span className="text-[10px] text-muted ml-auto">{formatTime(elapsed)}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="space-y-0.5 pl-6 mt-1 max-h-40 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
              <ToolIcon category={getToolCategory(step.name)} />
              <span className="text-muted font-medium">{formatToolName(step.name)}</span>
              <span className="text-muted/50 ml-auto text-[9px]">
                {i > 0 ? `+${Math.round((step.timestamp - steps[i-1].timestamp) / 1000)}s` : '0s'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatToolName(name: string): string {
  if (name === 'thinking') return 'Pensando...';
  if (name.startsWith('delegated:')) return `Delegado → ${name.slice(10)}`;
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
