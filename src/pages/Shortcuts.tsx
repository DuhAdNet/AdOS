import { useState } from 'react';

const SHORTCUTS = [
  { action: 'new-session', label: 'Nova Sessão', keys: 'Ctrl+N' },
  { action: 'search', label: 'Buscar', keys: 'Ctrl+K' },
  { action: 'settings', label: 'Configurações', keys: 'Ctrl+,' },
  { action: 'toggle-theme', label: 'Alternar Tema', keys: 'Ctrl+Shift+D' },
  { action: 'send-message', label: 'Enviar Mensagem', keys: 'Enter' },
  { action: 'new-line', label: 'Nova Linha', keys: 'Shift+Enter' },
  { action: 'voice-input', label: 'Input por Voz', keys: 'Ctrl+Shift+V' },
  { action: 'close-session', label: 'Fechar Sessão', keys: 'Ctrl+W' },
  { action: 'next-session', label: 'Próxima Sessão', keys: 'Ctrl+Tab' },
  { action: 'prev-session', label: 'Sessão Anterior', keys: 'Ctrl+Shift+Tab' },
];

export default function Shortcuts() {
  const [filter, setFilter] = useState('');

  const filtered = SHORTCUTS.filter(s =>
    s.label.toLowerCase().includes(filter.toLowerCase()) ||
    s.keys.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Atalhos de Teclado</h1>
        <p className="text-sm text-muted mt-1">Referência de shortcuts disponíveis no AdOS.</p>
        <div className="mt-4 flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-2 max-w-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar atalhos..."
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-1">
          {filtered.map(s => (
            <div key={s.action} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-surface-1 transition-colors">
              <span className="text-sm text-primary">{s.label}</span>
              <kbd className="px-2.5 py-1 bg-surface-2 border border-default rounded-lg text-xs font-mono text-secondary">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
