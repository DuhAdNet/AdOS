interface TitleBarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function TitleBar({ theme, onToggleTheme }: TitleBarProps) {
  return (
    <div
      className="flex items-center justify-between h-10 bg-surface-1 border-b border-default px-4 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-surface-2 border border-default flex items-center justify-center">
          <span className="text-[10px] font-semibold text-secondary">J</span>
        </div>
        <span className="text-xs font-medium text-secondary tracking-wide">JVOS</span>
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={onToggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted transition-all duration-300 hover:rotate-45 active:rotate-180"
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <div className="w-px h-4 bg-surface-3 mx-1" />

        <button
          onClick={() => (window as any).ados?.window.minimize()}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <button
          onClick={() => (window as any).ados?.window.maximize()}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
        </button>
        <button
          onClick={() => (window as any).ados?.window.close()}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
  );
}
