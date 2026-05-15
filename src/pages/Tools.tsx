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

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
}

interface Workflow {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
}

interface Dashboard {
  id: string;
  name: string;
  slug: string;
  html: string;
  createdAt: string;
  updatedAt: string;
}

const ados = (window as any).ados;

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('connections');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [viewingDashboard, setViewingDashboard] = useState<Dashboard | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [connForm, setConnForm] = useState({ name: '', type: 'api_key', apiKey: '', baseUrl: '' });
  const [skillForm, setSkillForm] = useState({ name: '', slug: '', description: '', instructions: '' });
  const [workflowForm, setWorkflowForm] = useState({ name: '', slug: '', description: '', instructions: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [conns, sk, wf, dash] = await Promise.all([
      ados.db.getConnections(),
      ados.db.getSkills(),
      ados.db.getWorkflows(),
      ados.db.getDashboards(),
    ]);
    setConnections(conns);
    setSkills(sk);
    setWorkflows(wf);
    setDashboards(dash);
  };

  const handleDeleteDashboard = async (id: string) => {
    await ados.db.deleteDashboard(id);
    setViewingDashboard(null);
    loadAll();
  };

  const handleAddConnection = async () => {
    const id = crypto.randomUUID();
    const config = JSON.stringify({ apiKey: connForm.apiKey, baseUrl: connForm.baseUrl });
    await ados.db.addConnection(id, connForm.name, connForm.type, config);
    setConnForm({ name: '', type: 'api_key', apiKey: '', baseUrl: '' });
    setShowAdd(false);
    loadAll();
  };

  const handleDeleteConnection = async (id: string) => {
    await ados.db.deleteConnection(id);
    loadAll();
  };

  const handleTestConnection = async (conn: Connection) => {
    await ados.db.updateConnection(conn.id, { status: 'connected' });
    loadAll();
  };

  const handleAddSkill = async () => {
    const id = crypto.randomUUID();
    const slug = skillForm.slug || skillForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await ados.db.addSkill(id, skillForm.name, slug, skillForm.description, skillForm.instructions);
    setSkillForm({ name: '', slug: '', description: '', instructions: '' });
    setShowAdd(false);
    loadAll();
  };

  const handleDeleteSkill = async (id: string) => {
    await ados.db.deleteSkill(id);
    loadAll();
  };

  const handleAddWorkflow = async () => {
    const id = crypto.randomUUID();
    const slug = workflowForm.slug || workflowForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await ados.db.addWorkflow(id, workflowForm.name, slug, workflowForm.description, workflowForm.instructions);
    setWorkflowForm({ name: '', slug: '', description: '', instructions: '' });
    setShowAdd(false);
    loadAll();
  };

  const handleDeleteWorkflow = async (id: string) => {
    await ados.db.deleteWorkflow(id);
    loadAll();
  };

  const tabs: Array<{ id: ToolsTab; label: string; count: number }> = [
    { id: 'connections', label: 'Conexões', count: connections.length },
    { id: 'skills', label: 'Skills', count: skills.length },
    { id: 'workflows', label: 'Workflows', count: workflows.length },
    { id: 'dashboards', label: 'Dashboards', count: dashboards.length },
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
          {tab !== 'dashboards' && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
            >
              + Adicionar
            </button>
          )}
        </div>
        <p className="text-sm text-muted mb-4">
          {connections.length} conexões, {skills.length} skills, {workflows.length} workflows, {dashboards.length} dashboards
        </p>

        <div className="flex gap-1 bg-surface-1 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShowAdd(false); }}
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
        {/* CONNECTIONS TAB */}
        {tab === 'connections' && (
          <>
            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Nova Conexão</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome (ex: Gmail, GitHub, Notion)"
                      value={connForm.name}
                      onChange={(e) => setConnForm({ ...connForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <select
                      value={connForm.type}
                      onChange={(e) => setConnForm({ ...connForm, type: e.target.value })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none"
                    >
                      <option value="api_key">API Key</option>
                      <option value="oauth">OAuth</option>
                      <option value="mcp">MCP</option>
                    </select>
                  </div>
                  {connForm.type === 'api_key' && (
                    <input
                      type="password"
                      placeholder="API Key"
                      value={connForm.apiKey}
                      onChange={(e) => setConnForm({ ...connForm, apiKey: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  )}
                  {(connForm.type === 'mcp' || connForm.type === 'oauth') && (
                    <input
                      placeholder={connForm.type === 'mcp' ? 'URL do servidor MCP' : 'URL de autorização OAuth'}
                      value={connForm.baseUrl}
                      onChange={(e) => setConnForm({ ...connForm, baseUrl: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddConnection}
                      disabled={!connForm.name}
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
                      conn.status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-surface-3 text-muted'
                    }`}>
                      {conn.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-3">{typeLabels[conn.type] || conn.type}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleTestConnection(conn)} className="px-3 py-1 rounded-lg text-xs bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 transition-colors">Testar</button>
                    <button onClick={() => handleDeleteConnection(conn.id)} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SKILLS TAB */}
        {tab === 'skills' && (
          <>
            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Nova Skill</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome da skill"
                      value={skillForm.name}
                      onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <input
                      placeholder="Slug (auto)"
                      value={skillForm.slug}
                      onChange={(e) => setSkillForm({ ...skillForm, slug: e.target.value })}
                      className="w-40 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  </div>
                  <input
                    placeholder="Descrição curta"
                    value={skillForm.description}
                    onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                  />
                  <textarea
                    placeholder="Instruções (prompt da skill)"
                    value={skillForm.instructions}
                    onChange={(e) => setSkillForm({ ...skillForm, instructions: e.target.value })}
                    rows={4}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddSkill}
                      disabled={!skillForm.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Criar Skill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {skills.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">Nenhuma skill cadastrada</p>
                <p className="text-xs text-muted">Skills são acionadas com "/" no chat. Clique em "+ Adicionar" para criar.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {skills.map((skill) => (
                <div key={skill.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary">{skill.name}</span>
                    <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">/{skill.slug}</span>
                  </div>
                  <p className="text-xs text-muted mb-3 line-clamp-2">{skill.description || 'Sem descrição'}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteSkill(skill.id)} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* WORKFLOWS TAB */}
        {tab === 'workflows' && (
          <>
            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Novo Workflow</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome do workflow"
                      value={workflowForm.name}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <input
                      placeholder="Slug (auto)"
                      value={workflowForm.slug}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, slug: e.target.value })}
                      className="w-40 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  </div>
                  <input
                    placeholder="Descrição curta"
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                  />
                  <textarea
                    placeholder="Instruções (prompt do workflow)"
                    value={workflowForm.instructions}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, instructions: e.target.value })}
                    rows={4}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddWorkflow}
                      disabled={!workflowForm.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Criar Workflow
                    </button>
                  </div>
                </div>
              </div>
            )}

            {workflows.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">Nenhum workflow cadastrado</p>
                <p className="text-xs text-muted">Workflows são acionados com "@" no chat. Clique em "+ Adicionar" para criar.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {workflows.map((wf) => (
                <div key={wf.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-primary">{wf.name}</span>
                    <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">@{wf.slug}</span>
                  </div>
                  <p className="text-xs text-muted mb-3 line-clamp-2">{wf.description || 'Sem descrição'}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeleteWorkflow(wf.id)} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">Remover</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* DASHBOARDS TAB */}
        {tab === 'dashboards' && (
          <>
            {viewingDashboard ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewingDashboard(null)} className="text-xs text-muted hover:text-secondary">← Voltar</button>
                    <span className="text-sm font-medium text-primary">{viewingDashboard.name}</span>
                  </div>
                  <button onClick={() => handleDeleteDashboard(viewingDashboard.id)} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10">Remover</button>
                </div>
                <div className="flex-1 rounded-xl overflow-hidden border border-default bg-white">
                  <iframe
                    srcDoc={viewingDashboard.html}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts"
                    title={viewingDashboard.name}
                  />
                </div>
              </div>
            ) : (
              <>
                {dashboards.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="14" y="3" width="7" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="14" y="10" width="7" height="11" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="13" width="7" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-secondary mb-1">Nenhum dashboard encontrado</p>
                    <p className="text-xs text-muted">Peça à IA para criar um dashboard e ele aparecerá aqui.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {dashboards.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setViewingDashboard(d)}
                      className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">{d.name}</span>
                        <span className="text-[10px] text-muted">{new Date(d.updatedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-muted">/{d.slug}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
