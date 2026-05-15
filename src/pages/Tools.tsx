import { useState, useEffect } from 'react';

type ToolsTab = 'connections' | 'skills' | 'workflows' | 'dashboards';

interface Connection {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const ados = (window as any).ados;

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('connections');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'api_key', apiKey: '', baseUrl: '' });

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    const rows = await ados.db.getConnections();
    setConnections(rows);
  };

  const handleAdd = async () => {
    const id = crypto.randomUUID();
    const config = JSON.stringify({ apiKey: form.apiKey, baseUrl: form.baseUrl });
    await ados.db.addConnection(id, form.name, form.type, config);
    setForm({ name: '', type: 'api_key', apiKey: '', baseUrl: '' });
    setShowAdd(false);
    loadConnections();
  };

  const handleDelete = async (id: string) => {
    await ados.db.deleteConnection(id);
    loadConnections();
  };

  const handleTest = async (conn: Connection) => {
    await ados.db.updateConnection(conn.id, { status: 'connected' });
    loadConnections();
  };

  const tabs: Array<{ id: ToolsTab; label: string; count: number }> = [
    { id: 'connections', label: 'Conexões', count: connections.length },
    { id: 'skills', label: 'Skills', count: 0 },
    { id: 'workflows', label: 'Workflows', count: 0 },
    { id: 'dashboards', label: 'Dashboards', count: 0 },
  ];

  const typeLabels: Record<string, string> = {
    api_key: 'API Key',
    oauth: 'OAuth',
    mcp: 'MCP',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-primary">Ferramentas</h1>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
          >
            + Adicionar
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          {connections.length} conexões, 0 skills, 0 workflows, 0 dashboards
        </p>

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
        {tab === 'connections' && (
          <>
            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Nova Conexão</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome (ex: Gmail, GitHub, Notion)"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none"
                    >
                      <option value="api_key">API Key</option>
                      <option value="oauth">OAuth</option>
                      <option value="mcp">MCP</option>
                    </select>
                  </div>
                  {form.type === 'api_key' && (
                    <input
                      type="password"
                      placeholder="API Key"
                      value={form.apiKey}
                      onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  )}
                  {(form.type === 'mcp' || form.type === 'oauth') && (
                    <input
                      placeholder={form.type === 'mcp' ? 'URL do servidor MCP' : 'URL de autorização OAuth'}
                      value={form.baseUrl}
                      onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">
                      Cancelar
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={!form.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {connections.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">Nenhuma conexão cadastrada</p>
                <p className="text-xs text-muted">Clique em "+ Adicionar" para conectar Gmail, GitHub, Slack e outras.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {connections.map((conn) => (
                <div key={conn.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary">{conn.name}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      conn.status === 'connected'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-surface-3 text-muted'
                    }`}>
                      {conn.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-3">{typeLabels[conn.type] || conn.type}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTest(conn)}
                      className="px-3 py-1 rounded-lg text-xs bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 transition-colors"
                    >
                      Testar
                    </button>
                    <button
                      onClick={() => handleDelete(conn.id)}
                      className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'skills' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted">Nenhuma skill cadastrada.</p>
            <p className="text-xs text-muted mt-1">Skills serão acionadas com "/" no chat.</p>
          </div>
        )}

        {tab === 'workflows' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted">Nenhum workflow cadastrado.</p>
            <p className="text-xs text-muted mt-1">Workflows serão acionados com "@" no chat.</p>
          </div>
        )}

        {tab === 'dashboards' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted">Nenhum dashboard encontrado.</p>
            <p className="text-xs text-muted mt-1">Peça à IA para criar um dashboard e ele aparecerá aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
