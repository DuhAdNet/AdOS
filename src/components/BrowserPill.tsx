interface BrowserPillProps {
  url: string;
  onClick: () => void;
}

export default function BrowserPill({ url, onClick }: BrowserPillProps) {
  const displayUrl = url ? new URL(url).hostname : 'Navegador';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-default hover:border-brand-500/50 hover:bg-surface-3 transition-all text-xs text-secondary"
      title="Abrir navegador integrado"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-500">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <span className="max-w-[120px] truncate">{displayUrl}</span>
    </button>
  );
}
