import { useState } from 'react';

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface SidebarProps {
  sessions: Session[];
  activeSession: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ sessions, activeSession, onSelectSession, onNewSession, onDeleteSession, onOpenSettings }: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  return (
    <aside className="w-[260px] bg-surface-1 border-r border-default flex flex-col" onClick={() => setContextMenu(null)}>
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm font-medium text-white transition-all hover:shadow-card flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12"/>
          </svg>
          Nova Sessão
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        <div className="text-[10px] uppercase text-muted font-semibold px-3 py-2 tracking-wider">
          Sessões ({sessions.length})
        </div>
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            onContextMenu={(e) => handleContextMenu(e, session.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm mb-0.5 transition-all flex items-center gap-2.5 group ${
              activeSession === session.id
                ? 'bg-brand-600/10 text-brand-600 dark:text-brand-400 font-medium'
                : 'text-secondary hover:bg-surface-2'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-50">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="truncate flex-1">{session.title}</span>
          </button>
        ))}
      </div>

      {contextMenu && (
        <div
          className="fixed bg-surface-2 border border-default rounded-xl shadow-card-hover py-1 z-50 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => { onDeleteSession(contextMenu.id); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface-3 transition-colors"
          >
            Excluir sessão
          </button>
        </div>
      )}

      <div className="p-3 border-t border-default">
        <button
          onClick={onOpenSettings}
          className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-secondary hover:bg-surface-2 transition-colors flex items-center gap-2.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 9 3V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Configurações
        </button>
      </div>
    </aside>
  );
}
