import { useState, useMemo } from 'react';

interface Session {
  id: string;
  title: string;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return 'Hoje';
  if (date >= yesterday) return 'Ontem';
  if (date >= weekAgo) return 'Esta Semana';
  return 'Mais Antigas';
}

interface SessionPanelProps {
  sessions: Session[];
  activeSession: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleArchived?: (id: string) => void;
}

type Tab = 'recent' | 'favorites' | 'archived';

const ados = (window as any).ados;

export default function SessionPanel({ sessions, activeSession, onSelectSession, onNewSession, onDeleteSession, onToggleFavorite, onToggleArchived }: SessionPanelProps) {
  const [tab, setTab] = useState<Tab>('recent');
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const filtered = sessions.filter(s => {
    if (!s.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (tab === 'favorites') return s.favorite;
    if (tab === 'archived') return s.archived;
    return !s.archived;
  });

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const contextSession = sessions.find(s => s.id === contextMenu?.id);

  return (
    <div className="w-[260px] bg-surface-1 border-r border-default flex flex-col" onClick={() => setContextMenu(null)}>
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
          Nova Sessão
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="flex gap-1 text-[11px] font-medium">
          {(['recent', 'favorites', 'archived'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                tab === t ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
              }`}
            >
              {t === 'recent' ? 'Recentes' : t === 'favorites' ? 'Favoritas' : 'Arquivadas'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 bg-surface-2 rounded-lg px-2.5 py-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sessões..."
            className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted px-3 py-4 text-center">Nenhuma sessão encontrada.</p>
        )}
        {(() => {
          const groups: Record<string, Session[]> = {};
          for (const s of filtered) {
            const group = tab === 'favorites' ? 'Favoritas' : tab === 'archived' ? 'Arquivadas' : getDateGroup(s.updatedAt || s.createdAt);
            if (!groups[group]) groups[group] = [];
            groups[group].push(s);
          }
          const order = ['Hoje', 'Ontem', 'Esta Semana', 'Mais Antigas', 'Favoritas', 'Arquivadas'];
          return order.filter(g => groups[g]).map(group => (
            <div key={group}>
              <div className="text-[10px] uppercase text-muted font-semibold px-3 py-2 tracking-wider mt-1">
                {group}
              </div>
              {groups[group].map((session) => (
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
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="truncate flex-1">{session.title}</span>
                  {session.favorite && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-brand-400 shrink-0">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ));
        })()}
      </div>

      {contextMenu && (
        <div
          className="fixed bg-surface-2 border border-default rounded-xl shadow-card-hover py-1 z-50 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => { onToggleFavorite?.(contextMenu.id); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-sm text-secondary hover:bg-surface-3 transition-colors"
          >
            {contextSession?.favorite ? 'Remover favorito' : 'Favoritar'}
          </button>
          <button
            onClick={() => { onToggleArchived?.(contextMenu.id); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-sm text-secondary hover:bg-surface-3 transition-colors"
          >
            {contextSession?.archived ? 'Desarquivar' : 'Arquivar'}
          </button>
          <button
            onClick={() => { onDeleteSession(contextMenu.id); setContextMenu(null); }}
            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-surface-3 transition-colors"
          >
            Excluir sessão
          </button>
        </div>
      )}
    </div>
  );
}
