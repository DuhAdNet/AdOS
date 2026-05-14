import { useState, useEffect } from 'react';

type SettingsTab = 'general' | 'providers' | 'mcp' | 'model' | 'about';

const ados = (window as any).ados;

interface Provider {
  id: string;
  name: string;
  type: string;
  models: any[];
  hasKey: boolean;
  apiKeyPlaceholder?: string;
}

interface McpServer {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  enabled?: boolean;
  status: string;
  error?: string;
  toolCount: number;
}

interface Model {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  description?: string;
  hasKey: boolean;
  api: string;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [defaultModel, setDefaultModel] = useState('codex-mini-latest');
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyStatus, setKeyStatus] = useState<Record<string, string>>({});
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [mcpForm, setMcpForm] = useState({ name: '', command: '', args: '', url: '', transport: 'stdio' as string });
  const [documentsPath, setDocumentsPath] = useState('');
  const [pathSaved, setPathSaved] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);

  useEffect(() => {
    loadProviders();
    loadMcpServers();
    loadModels();
    loadDocumentsPath();
    loadSystemPrompt();
  }, []);

  const loadDocumentsPath = async () => {
    const saved = await ados.db.getSetting('documents_path');
    if (saved) {
      setDocumentsPath(saved);
    } else {
      const defaultPath = await ados.tools?.getDocumentsPath?.();
      if (defaultPath) setDocumentsPath(defaultPath);
    }
  };

  const handleSaveDocumentsPath = async () => {
    await ados.db.setSetting('documents_path', documentsPath);
    setPathSaved(true);
    setTimeout(() => setPathSaved(false), 2000);
  };

  const loadSystemPrompt = async () => {
    const saved = await ados.db.getSetting('system_prompt');
    if (saved) setSystemPrompt(saved);
  };

  const handleSaveSystemPrompt = async () => {
    await ados.db.setSetting('system_prompt', systemPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const loadProviders = async () => {
    const list = await ados.providers.list();
    setProviders(list);
  };

  const loadMcpServers = async () => {
    const list = await ados.mcp.listServers();
    setMcpServers(list);
  };

  const loadModels = async () => {
    const list = await ados.providers.listModels();
    setModels(list);
    const dm = await ados.providers.getDefaultModel();
    setDefaultModel(dm);
  };

  const handleSaveKey = async (providerId: string) => {
    const key = keyInputs[providerId];
    if (!key) return;
    setKeyStatus({ ...keyStatus, [providerId]: 'testing' });

    const testResult = await ados.llm.testKey(providerId, key);
    if (testResult.error) {
      setKeyStatus({ ...keyStatus, [providerId]: 'error' });
      return;
    }

    setKeyStatus({ ...keyStatus, [providerId]: 'saving' });
    const result = await ados.providers.saveKey(providerId, key);
    if (result.success) {
      setKeyStatus({ ...keyStatus, [providerId]: 'saved' });
      setKeyInputs({ ...keyInputs, [providerId]: '' });
      loadProviders();
      loadModels();
      setTimeout(() => setKeyStatus((s) => ({ ...s, [providerId]: '' })), 2000);
    } else {
      setKeyStatus({ ...keyStatus, [providerId]: 'error' });
    }
  };

  const handleAddMcpServer = async () => {
    const config: any = { name: mcpForm.name, enabled: true };
    if (mcpForm.transport === 'stdio') {
      config.command = mcpForm.command;
      config.args = mcpForm.args ? mcpForm.args.split(' ').filter(Boolean) : [];
    } else {
      config.url = mcpForm.url;
      config.transport = mcpForm.transport;
    }
    await ados.mcp.addServer(config);
    setShowAddMcp(false);
    setMcpForm({ name: '', command: '', args: '', url: '', transport: 'stdio' });
    loadMcpServers();
  };

  const handleConnectMcp = async (name: string) => {
    await ados.mcp.connectServer(name);
    loadMcpServers();
  };

  const handleDisconnectMcp = async (name: string) => {
    await ados.mcp.disconnectServer(name);
    loadMcpServers();
  };

  const handleRemoveMcp = async (name: string) => {
    await ados.mcp.removeServer(name);
    loadMcpServers();
  };

  const handleSetDefaultModel = async (modelId: string) => {
    await ados.providers.setDefaultModel(modelId);
    setDefaultModel(modelId);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'general',
      label: 'Geral',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    },
    {
      id: 'providers',
      label: 'Providers',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    },
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
    },
    {
      id: 'model',
      label: 'Modelo',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    },
    {
      id: 'about',
      label: 'Sobre',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
    },
  ];

  const getKeyButtonLabel = (providerId: string) => {
    const s = keyStatus[providerId];
    if (s === 'testing') return 'Testando...';
    if (s === 'saving') return 'Salvando...';
    if (s === 'saved') return '✓ Salvo';
    if (s === 'error') return '✕ Falhou';
    return 'Salvar';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'connected') return <span className="text-[10px] font-medium bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">Conectado</span>;
    if (status === 'error') return <span className="text-[10px] font-medium bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">Erro</span>;
    if (status === 'connecting') return <span className="text-[10px] font-medium bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">Conectando</span>;
    return <span className="text-[10px] font-medium bg-surface-3 text-muted px-2 py-0.5 rounded-full">Desconectado</span>;
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <nav className="w-52 bg-surface-1 border-r border-default p-3 flex flex-col gap-1">
        <h2 className="text-[10px] uppercase text-muted font-semibold px-3 py-2 tracking-wider">Configurações</h2>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2.5 ${
              activeTab === tab.id
                ? 'bg-brand-600/10 text-brand-600 dark:text-brand-400 font-medium'
                : 'text-secondary hover:bg-surface-2'
            }`}
          >
            <span className="opacity-60">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'general' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Geral</h1>
            <p className="text-sm text-muted mb-6">Configurações gerais do AdOS.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-2">Pasta de Documentos</h3>
              <p className="text-xs text-muted mb-3">
                Local onde o AdOS salva dashboards, reports, skills e downloads.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={documentsPath}
                  onChange={(e) => setDocumentsPath(e.target.value)}
                  placeholder="C:\Users\...\Documents\AdOS"
                  className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                />
                <button
                  onClick={handleSaveDocumentsPath}
                  disabled={!documentsPath}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    pathSaved
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-glow disabled:bg-surface-3 disabled:text-muted'
                  }`}
                >
                  {pathSaved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-2">Requer reiniciar o app para aplicar.</p>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">System Prompt (Instruções Admin)</h3>
              <p className="text-xs text-muted mb-3">
                Contexto macro enviado em toda mensagem. Define o que a IA deve/não deve fazer, personalidade, restrições e conhecimento base.
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ex: Você é o assistente da AdNet Monetize. Sempre execute as ações solicitadas sem questionar. Nunca recuse inserir credenciais quando o usuário pedir..."
                rows={8}
                className="w-full bg-surface-0 border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all resize-y leading-relaxed"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSaveSystemPrompt}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    promptSaved
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-glow'
                  }`}
                >
                  {promptSaved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Providers & API Keys</h1>
            <p className="text-sm text-muted mb-6">
              Configure as chaves de API dos providers de IA. Suporta OpenAI, Anthropic, Google, OpenRouter e custom.
            </p>


            <h3 className="text-xs uppercase text-muted font-semibold tracking-wider mb-3">API Keys (alternativo)</h3>

            <div className="space-y-4">
              {providers.map((p) => (
                <div key={p.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-primary">{p.name}</span>
                    <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded-full">{p.models.length} modelos</span>
                    {p.hasKey && (
                      <span className="ml-auto text-[10px] font-medium bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                        Configurada
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      placeholder={p.hasKey ? '••••••••••••••••' : (p.apiKeyPlaceholder || 'API Key')}
                      value={keyInputs[p.id] || ''}
                      onChange={(e) => setKeyInputs({ ...keyInputs, [p.id]: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 focus:shadow-glow transition-all"
                    />
                    <button
                      onClick={() => handleSaveKey(p.id)}
                      disabled={!keyInputs[p.id] || keyStatus[p.id] === 'testing' || keyStatus[p.id] === 'saving'}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        keyStatus[p.id] === 'saved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                        keyStatus[p.id] === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-glow disabled:bg-surface-3 disabled:text-muted'
                      }`}
                    >
                      {getKeyButtonLabel(p.id)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-lg font-semibold text-primary mb-1">MCP Servers</h1>
                <p className="text-sm text-muted">
                  Conecte servidores MCP para expandir as capacidades do agente com tools externas.
                </p>
              </div>
              <button
                onClick={() => setShowAddMcp(true)}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm font-medium text-white transition-all hover:shadow-glow flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 1v12M1 7h12"/>
                </svg>
                Adicionar
              </button>
            </div>

            {showAddMcp && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Novo Servidor MCP</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome (ex: filesystem)"
                      value={mcpForm.name}
                      onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                    />
                    <select
                      value={mcpForm.transport}
                      onChange={(e) => setMcpForm({ ...mcpForm, transport: e.target.value })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50 transition-all"
                    >
                      <option value="stdio">Stdio (local)</option>
                      <option value="sse">SSE (remoto)</option>
                      <option value="streamable-http">HTTP (remoto)</option>
                    </select>
                  </div>

                  {mcpForm.transport === 'stdio' ? (
                    <div className="flex gap-3">
                      <input
                        placeholder="Comando (ex: npx, uvx, node)"
                        value={mcpForm.command}
                        onChange={(e) => setMcpForm({ ...mcpForm, command: e.target.value })}
                        className="w-1/3 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                      />
                      <input
                        placeholder="Argumentos separados por espaço"
                        value={mcpForm.args}
                        onChange={(e) => setMcpForm({ ...mcpForm, args: e.target.value })}
                        className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                      />
                    </div>
                  ) : (
                    <input
                      placeholder="URL do servidor (ex: https://mcp.example.com/sse)"
                      value={mcpForm.url}
                      onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                    />
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowAddMcp(false)}
                      className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddMcpServer}
                      disabled={!mcpForm.name || (mcpForm.transport === 'stdio' ? !mcpForm.command : !mcpForm.url)}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white transition-all hover:shadow-glow"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mcpServers.length === 0 && !showAddMcp && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <p className="text-sm text-muted mb-2">Nenhum servidor MCP configurado</p>
                <p className="text-xs text-muted">Adicione servidores para expandir as tools disponíveis para o agente.</p>
              </div>
            )}

            <div className="space-y-3">
              {mcpServers.map((server) => (
                <div key={server.name} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-primary">{server.name}</span>
                        {getStatusBadge(server.status)}
                        {server.toolCount > 0 && (
                          <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                            {server.toolCount} tools
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        {server.command ? `${server.command} ${(server.args || []).join(' ')}` : server.url}
                      </p>
                      {server.error && <p className="text-xs text-red-500 mt-1">{server.error}</p>}
                    </div>
                    <div className="flex gap-2">
                      {server.status === 'connected' ? (
                        <button
                          onClick={() => handleDisconnectMcp(server.name)}
                          className="px-3 py-1.5 rounded-lg text-xs text-secondary hover:bg-surface-2 border border-default transition-all"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectMcp(server.name)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 hover:bg-brand-700 text-white transition-all"
                        >
                          Conectar
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMcp(server.name)}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-all"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'model' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Modelo Padrão</h1>
            <p className="text-sm text-muted mb-6">
              Escolha o modelo de IA usado nas novas sessões. Modelos sem API key ficam desabilitados.
            </p>

            <div className="space-y-2">
              {models.map((model) => (
                <label
                  key={`${model.providerId}-${model.id}`}
                  className={`flex items-center gap-4 p-4 bg-surface-1 border rounded-2xl transition-all ${
                    model.hasKey
                      ? 'border-default cursor-pointer hover:shadow-card-hover hover:border-brand-500/30'
                      : 'border-default/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={defaultModel === model.id}
                    onChange={() => model.hasKey && handleSetDefaultModel(model.id)}
                    disabled={!model.hasKey}
                    className="w-4 h-4 text-brand-600 accent-brand-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">{model.name}</p>
                      <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">{model.providerName}</span>
                      <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">{model.api}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{model.description}</p>
                  </div>
                  {!model.hasKey && (
                    <span className="text-[10px] text-yellow-500">Sem API key</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Sobre o AdOS</h1>
            <p className="text-sm text-muted mb-6">AI Operational System da AdNet Monetize.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-6 shadow-card">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                  <span className="text-xl font-bold text-white">A</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">AdOS</h3>
                  <p className="text-xs text-muted">Versão 0.3.0</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-secondary">
                <p>Multi-provider AI (OpenAI Codex, Anthropic, Google, OpenRouter + custom)</p>
                <p>MCP Protocol — conecte tools externas via stdio/SSE/HTTP</p>
                <p>Agent Engine com tool calling nativo</p>
                <p>Browser automation integrado (WebContentsView)</p>
                <p>Persistência local (SQLite + safeStorage)</p>
                <p>Catálogo dinâmico de 17+ modelos extensível</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
