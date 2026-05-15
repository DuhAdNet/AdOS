import { useState } from 'react';

type ToolsTab = 'connections' | 'skills' | 'workflows' | 'dashboards';

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('connections');

  const tabs: Array<{ id: ToolsTab; label: string; count: number }> = [
    { id: 'connections', label: 'Conexões', count: 0 },
    { id: 'skills', label: 'Skills', count: 0 },
    { id: 'workflows', label: 'Workflows', count: 0 },
    { id: 'dashboards', label: 'Dashboards', count: 0 },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-primary">Ferramentas</h1>
          <button className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors">
            + Adicionar
          </button>
        </div>
        <p className="text-sm text-muted mb-4">0 conexões, 0 skills, 0 workflows, 0 dashboards</p>

        <div className="flex gap-1 bg-surface-1 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
              }`}
            >
              {t.label} <span className="text-xs opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-secondary mb-1">Nenhuma ferramenta encontrada</p>
          <p className="text-xs text-muted">Adicione conexões, skills ou workflows para começar.</p>
        </div>
      </div>
    </div>
  );
}
