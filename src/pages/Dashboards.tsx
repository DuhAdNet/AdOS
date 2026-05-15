import { useState, useEffect, useCallback } from 'react';

const ados = (window as any).ados;

interface Dashboard {
  id: string;
  name: string;
  layout: string;
  createdAt: string;
  updatedAt: string;
}

interface Widget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'text';
  title: string;
  config: string;
  value?: string | number;
}

const BUILTIN_METRICS: Record<string, () => Promise<string | number>> = {
  'Total de Sessões': async () => { const s = await ados.db.getSessions(); return s.length; },
  'Sessões Favoritas': async () => { const s = await ados.db.getSessions(); return s.filter((x: any) => x.favorite).length; },
  'Labels Criadas': async () => { const l = await ados.db.getLabels(); return l.length; },
  'Memórias Salvas': async () => { const m = await ados.db.getMemories(); return m.length; },
  'MCP Servers': async () => { const s = await ados.mcp.listServers(); return s.length; },
  'Automações Ativas': async () => { const a = await ados.db.getAutomations(); return a.filter((x: any) => x.enabled).length; },
};

export default function Dashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [active, setActive] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const rows = await ados.db.getDashboards?.() || [];
    setDashboards(rows);
    if (rows.length > 0 && !active) {
      setActive(rows[0]);
      loadWidgets(rows[0]);
    }
  };

  const refreshWidgetValues = useCallback(async (wList: Widget[]) => {
    const updated = await Promise.all(wList.map(async (w) => {
      if (w.type === 'metric' && BUILTIN_METRICS[w.title]) {
        const value = await BUILTIN_METRICS[w.title]();
        return { ...w, value };
      }
      return w;
    }));
    setWidgets(updated);
  }, []);

  const loadWidgets = (dash: Dashboard) => {
    try {
      const parsed = JSON.parse(dash.layout || '[]');
      setWidgets(parsed);
      refreshWidgetValues(parsed);
    } catch {
      setWidgets([]);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dash: Dashboard = { id, name: newName.trim(), layout: '[]', createdAt: now, updatedAt: now };
    await ados.db.createDashboard?.(id, newName.trim(), '[]');
    setDashboards([...dashboards, dash]);
    setActive(dash);
    setWidgets([]);
    setNewName('');
    setShowCreate(false);
  };

  const handleAddWidget = async (type: Widget['type']) => {
    const metricNames = Object.keys(BUILTIN_METRICS);
    const usedTitles = widgets.filter(w => w.type === 'metric').map(w => w.title);
    const nextMetric = metricNames.find(n => !usedTitles.includes(n)) || metricNames[0];

    const widget: Widget = {
      id: crypto.randomUUID(),
      type,
      title: type === 'metric' ? nextMetric : type === 'chart' ? 'Novo Gráfico' : type === 'list' ? 'Nova Lista' : 'Novo Texto',
      config: '{}',
    };
    const updated = [...widgets, widget];
    setWidgets(updated);
    if (active) {
      await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
    }
    refreshWidgetValues(updated);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    const updated = widgets.filter(w => w.id !== widgetId);
    setWidgets(updated);
    if (active) {
      await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    await ados.db.deleteDashboard?.(id);
    const rows = dashboards.filter(d => d.id !== id);
    setDashboards(rows);
    if (active?.id === id) {
      setActive(rows[0] || null);
      if (rows[0]) loadWidgets(rows[0]);
      else setWidgets([]);
    }
  };

  const widgetTypeIcon = (type: string) => {
    switch (type) {
      case 'metric': return 'M3 3v18h18';
      case 'chart': return 'M18 20V10M12 20V4M6 20v-6';
      case 'list': return 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
      default: return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Dashboards</h1>
            <p className="text-sm text-muted mt-1">Painéis customizáveis com widgets de métricas, gráficos e listas.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium text-white transition-all"
          >
            + Novo Dashboard
          </button>
        </div>

        {dashboards.length > 1 && (
          <div className="flex gap-2 mt-4">
            {dashboards.map(d => (
              <button
                key={d.id}
                onClick={() => { setActive(d); loadWidgets(d); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active?.id === d.id ? 'bg-brand-600/10 text-brand-500 font-medium' : 'text-muted hover:text-secondary hover:bg-surface-2'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {showCreate && (
          <div className="bg-surface-1 border border-default rounded-2xl p-5 mb-6 max-w-md">
            <h3 className="text-sm font-medium text-primary mb-3">Criar Dashboard</h3>
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do dashboard"
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
                autoFocus
              />
              <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white">Criar</button>
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-muted hover:text-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {!active && !showCreate && (
          <div className="text-center py-16">
            <p className="text-sm text-muted mb-2">Nenhum dashboard criado.</p>
            <p className="text-xs text-muted">Clique em "+ Novo Dashboard" para começar.</p>
          </div>
        )}

        {active && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-semibold text-primary">{active.name}</h2>
              <div className="flex gap-1.5 ml-auto">
                {(['metric', 'chart', 'list', 'text'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => handleAddWidget(type)}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors flex items-center gap-1.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={widgetTypeIcon(type)} />
                    </svg>
                    {type}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleDeleteDashboard(active.id)}
                className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Excluir
              </button>
            </div>

            {widgets.length === 0 ? (
              <div className="border-2 border-dashed border-default rounded-2xl p-12 text-center">
                <p className="text-sm text-muted">Dashboard vazio.</p>
                <p className="text-xs text-muted mt-1">Adicione widgets usando os botões acima.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {widgets.map(w => (
                  <div key={w.id} className="bg-surface-1 border border-default rounded-2xl p-5 relative group">
                    <button
                      onClick={() => handleDeleteWidget(w.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-all"
                    >
                      ×
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                        <path d={widgetTypeIcon(w.type)} />
                      </svg>
                      <span className="text-xs uppercase text-muted font-semibold tracking-wider">{w.type}</span>
                    </div>
                    <p className="text-sm font-medium text-primary">{w.title}</p>
                    <p className="text-2xl font-bold text-primary mt-2">{w.value !== undefined ? w.value : '—'}</p>
                    {w.value === undefined && <p className="text-[10px] text-muted mt-1">Métrica não reconhecida</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
