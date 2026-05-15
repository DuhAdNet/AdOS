import { useState, useEffect } from 'react';

type SettingsTab = 'app' | 'appearance' | 'input' | 'workspace' | 'providers' | 'mcp' | 'model' | 'agents' | 'permissions' | 'preferences' | 'about';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('app');
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('dark');
  const [font, setFont] = useState<'manrope' | 'system'>('manrope');
  const [sendKey, setSendKey] = useState<'enter' | 'ctrl-enter'>('enter');
  const [autoCapitalize, setAutoCapitalize] = useState(true);
  const [spellCheck, setSpellCheck] = useState(true);
  const [userName, setUserName] = useState('');
  const [userTimezone, setUserTimezone] = useState('America/Sao_Paulo');
  const [userLanguage, setUserLanguage] = useState('pt-BR');
  const [userNotes, setUserNotes] = useState('');
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
    loadAppearanceSettings();
    loadInputSettings();
    loadPreferences();
  }, []);

  const loadAppearanceSettings = async () => {
    const savedTheme = await ados.db.getSetting('theme_mode');
    if (savedTheme) setThemeMode(savedTheme as any);
    const savedFont = await ados.db.getSetting('font');
    if (savedFont) setFont(savedFont as any);
  };

  const loadInputSettings = async () => {
    const savedSendKey = await ados.db.getSetting('send_key');
    if (savedSendKey) setSendKey(savedSendKey as any);
    const savedAutoCap = await ados.db.getSetting('auto_capitalize');
    if (savedAutoCap) setAutoCapitalize(savedAutoCap === 'true');
    const savedSpell = await ados.db.getSetting('spell_check');
    if (savedSpell) setSpellCheck(savedSpell === 'true');
  };

  const loadPreferences = async () => {
    const savedName = await ados.db.getSetting('user_name');
    if (savedName) setUserName(savedName);
    const savedTz = await ados.db.getSetting('user_timezone');
    if (savedTz) setUserTimezone(savedTz);
    const savedLang = await ados.db.getSetting('user_language');
    if (savedLang) setUserLanguage(savedLang);
    const savedNotes = await ados.db.getSetting('user_notes');
    if (savedNotes) setUserNotes(savedNotes);
  };

  const handleSaveAppearance = async (key: string, value: string) => {
    await ados.db.setSetting(key, value);
  };

  const handleSavePreferences = async () => {
    await ados.db.setSetting('user_name', userName);
    await ados.db.setSetting('user_timezone', userTimezone);
    await ados.db.setSetting('user_language', userLanguage);
    await ados.db.setSetting('user_notes', userNotes);
  };

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

  const tabs: { id: SettingsTab; label: string; section?: string }[] = [
    { id: 'app', label: 'App', section: 'APP' },
    { id: 'appearance', label: 'Aparência' },
    { id: 'input', label: 'Entrada' },
    { id: 'workspace', label: 'Workspace', section: 'WORKSPACE' },
    { id: 'providers', label: 'Providers' },
    { id: 'mcp', label: 'MCP Servers' },
    { id: 'model', label: 'Modelo' },
    { id: 'agents', label: 'Agentes', section: 'SISTEMA' },
    { id: 'permissions', label: 'Permissões' },
    { id: 'preferences', label: 'Preferências' },
    { id: 'about', label: 'Sobre' },
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
      <nav className="w-52 bg-surface-1 border-r border-default p-3 flex flex-col gap-0.5 overflow-y-auto">
        <h2 className="text-xs font-semibold text-primary px-3 py-2">Configurações</h2>
        {tabs.map((tab) => (
          <div key={tab.id}>
            {tab.section && (
              <p className="text-[10px] uppercase text-muted font-semibold px-3 pt-3 pb-1 tracking-wider">{tab.section}</p>
            )}
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-600/10 text-brand-600 dark:text-brand-400 font-medium'
                  : 'text-secondary hover:bg-surface-2'
              }`}
            >
              {tab.label}
            </button>
          </div>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-8">
        {activeTab === 'app' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">App</h1>
            <p className="text-sm text-muted mb-6">Notificações, diretórios e instruções do sistema.</p>

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

        {activeTab === 'appearance' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Aparência</h1>
            <p className="text-sm text-muted mb-6">Tema, fonte e ícones de ferramenta.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-3">Tema padrão</h3>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-secondary">Modo</span>
                <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
                  {(['system', 'light', 'dark'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setThemeMode(m); handleSaveAppearance('theme_mode', m); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        themeMode === m ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                      }`}
                    >
                      {m === 'system' ? '💻 Sistema' : m === 'light' ? '☀️ Claro' : '🌙 Escuro'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Fonte</span>
                <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
                  {(['manrope', 'system'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setFont(f); handleSaveAppearance('font', f); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        font === f ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                      }`}
                    >
                      {f === 'manrope' ? 'Manrope' : 'Sistema'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Entrada</h1>
            <p className="text-sm text-muted mb-6">Tecla de envio e corretor ortográfico.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Digitação</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Auto-capitalização</p>
                    <p className="text-xs text-muted">Capitaliza automaticamente a primeira letra ao digitar.</p>
                  </div>
                  <button
                    onClick={() => { const v = !autoCapitalize; setAutoCapitalize(v); handleSaveAppearance('auto_capitalize', String(v)); }}
                    className={`w-10 h-5 rounded-full transition-colors ${autoCapitalize ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoCapitalize ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Corretor ortográfico</p>
                    <p className="text-xs text-muted">Sublinha palavras com possíveis erros enquanto você digita.</p>
                  </div>
                  <button
                    onClick={() => { const v = !spellCheck; setSpellCheck(v); handleSaveAppearance('spell_check', String(v)); }}
                    className={`w-10 h-5 rounded-full transition-colors ${spellCheck ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${spellCheck ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-4">Envio</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary">Enviar mensagem com</p>
                  <p className="text-xs text-muted">Atalho de teclado para enviar mensagens.</p>
                </div>
                <select
                  value={sendKey}
                  onChange={(e) => { const v = e.target.value as any; setSendKey(v); handleSaveAppearance('send_key', v); }}
                  className="bg-surface-2 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="enter">Enter</option>
                  <option value="ctrl-enter">Ctrl+Enter</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Configurações do Workspace</h1>
            <p className="text-sm text-muted mb-6">Nome, ícone, permissões e fontes padrão.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Informações do Workspace</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Nome</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">AdOS</span>
                    <button className="text-xs text-brand-500">Editar</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Diretório de trabalho</span>
                  <span className="text-xs text-muted font-mono">~/Documents/AdOS</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Permissões</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Modo padrão</span>
                <select className="bg-surface-2 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none">
                  <option value="execute">Executar</option>
                  <option value="ask">Perguntar antes de editar</option>
                  <option value="explore">Explorar</option>
                </select>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-4">Avançado</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Servidores MCP Locais</p>
                    <p className="text-xs text-muted">Habilitar servidores de subprocesso stdio.</p>
                  </div>
                  <div className="w-10 h-5 rounded-full bg-brand-600">
                    <div className="w-4 h-4 rounded-full bg-white translate-x-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Preferências</h1>
            <p className="text-sm text-muted mb-6">Ajude a IA a personalizar respostas para você.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Informações básicas</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1">Nome</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Como o AdOS deve se referir a você"
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Fuso horário</label>
                  <input
                    type="text"
                    value={userTimezone}
                    onChange={(e) => setUserTimezone(e.target.value)}
                    placeholder="America/Sao_Paulo"
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Idioma</label>
                  <input
                    type="text"
                    value={userLanguage}
                    onChange={(e) => setUserLanguage(e.target.value)}
                    placeholder="pt-BR"
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-2">Notas</h3>
              <p className="text-xs text-muted mb-3">Contexto livre que ajuda a IA a entender suas preferências.</p>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Ex: Sou gestor de projetos na AdNet Monetize. Prefiro respostas diretas e executivas..."
                rows={6}
                className="w-full bg-surface-0 border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all resize-y leading-relaxed"
              />
            </div>

            <button
              onClick={handleSavePreferences}
              className="mt-4 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Salvar Preferências
            </button>
          </div>
        )}

        {activeTab === 'agents' && (
          <AgentsSection />
        )}

        {activeTab === 'permissions' && (
          <PermissionsSection />
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
                  <p className="text-xs text-muted">Versão 1.0.0</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-secondary">
                <p>Multi-provider AI (OpenAI GPT-5.5 via OAuth, Anthropic, Google, OpenRouter)</p>
                <p>MCP Protocol — conecte tools externas via stdio/SSE/HTTP</p>
                <p>Agent Engine com tool calling nativo (até 10 iterações)</p>
                <p>Browser automation integrado (janela independente)</p>
                <p>Skills, Workflows, Automações e Brain</p>
                <p>Persistência local (SQLite + safeStorage)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentsSection() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const p = await ados.providers.list();
    setProviders(p || []);
    const m = await ados.mcp.listServers();
    setMcpServers(m || []);
  };

  const connectedProviders = providers.filter(p => p.hasKey);
  const totalTools = mcpServers.reduce((sum, s) => sum + (s.toolCount || 0), 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold text-primary mb-1">Agentes & Conexões</h1>
      <p className="text-sm text-muted mb-6">Visão geral de providers, agentes MCP e ferramentas disponíveis.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{connectedProviders.length}</p>
          <p className="text-xs text-muted">Providers ativos</p>
        </div>
        <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{mcpServers.filter(s => s.status === 'connected').length}</p>
          <p className="text-xs text-muted">MCP conectados</p>
        </div>
        <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalTools}</p>
          <p className="text-xs text-muted">Tools disponíveis</p>
        </div>
      </div>

      <h2 className="text-sm font-medium text-secondary mb-3">Providers LLM</h2>
      <div className="space-y-2 mb-6">
        {providers.map(p => (
          <div key={p.id} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">{p.name}</span>
              <span className="text-[10px] text-muted">{p.models?.length || 0} modelos</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.hasKey ? 'bg-green-500/10 text-green-500' : 'bg-surface-3 text-muted'}`}>
              {p.hasKey ? 'Ativo' : 'Sem chave'}
            </span>
          </div>
        ))}
        {providers.length === 0 && <p className="text-sm text-muted">Nenhum provider configurado.</p>}
      </div>

      <h2 className="text-sm font-medium text-secondary mb-3">Servidores MCP</h2>
      <div className="space-y-2">
        {mcpServers.map(s => (
          <div key={s.name} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">{s.name}</span>
              <span className="text-[10px] text-muted">{s.toolCount} tools</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              s.status === 'connected' ? 'bg-green-500/10 text-green-500' :
              s.status === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-surface-3 text-muted'
            }`}>
              {s.status === 'connected' ? 'Conectado' : s.status === 'error' ? 'Erro' : 'Desconectado'}
            </span>
          </div>
        ))}
        {mcpServers.length === 0 && <p className="text-sm text-muted">Nenhum servidor MCP configurado.</p>}
      </div>
    </div>
  );
}

function PermissionsSection() {
  const [permissions, setPermissions] = useState<Array<{ id: string; pattern: string; type: string; access: string; comment: string }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ pattern: '', type: 'bash', access: 'ask', comment: '' });

  useEffect(() => { loadPerms(); }, []);

  const loadPerms = async () => {
    const rows = await ados.db.getPermissions();
    setPermissions(rows);
  };

  const handleAdd = async () => {
    const id = crypto.randomUUID();
    await ados.db.addPermission(id, form.pattern, form.type, form.access, form.comment);
    setForm({ pattern: '', type: 'bash', access: 'ask', comment: '' });
    setShowAdd(false);
    loadPerms();
  };

  const handleChangeAccess = async (id: string, access: string) => {
    await ados.db.updatePermission(id, access);
    loadPerms();
  };

  const handleDelete = async (id: string) => {
    await ados.db.deletePermission(id);
    loadPerms();
  };

  const accessColors: Record<string, string> = {
    allow: 'bg-green-500/10 text-green-500',
    ask: 'bg-yellow-500/10 text-yellow-600',
    block: 'bg-red-500/10 text-red-500',
  };

  const accessLabels: Record<string, string> = { allow: 'Permitido', ask: 'Perguntar', block: 'Bloqueado' };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-primary mb-1">Permissões</h1>
          <p className="text-sm text-muted">Controle o que a IA pode executar sem perguntar.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium">+ Regra</button>
      </div>

      {showAdd && (
        <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-5 mb-4 shadow-card">
          <div className="space-y-3">
            <div className="flex gap-3">
              <input placeholder="Pattern (regex)" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className="flex-1 bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary outline-none">
                <option value="bash">Bash</option>
                <option value="mcp">MCP</option>
                <option value="tool">Tool</option>
                <option value="file">File</option>
              </select>
              <select value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value })} className="bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary outline-none">
                <option value="allow">Permitido</option>
                <option value="ask">Perguntar</option>
                <option value="block">Bloqueado</option>
              </select>
            </div>
            <input placeholder="Comentário (opcional)" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className="w-full bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button onClick={handleAdd} disabled={!form.pattern} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {permissions.length === 0 && !showAdd && (
        <div className="bg-surface-1 border border-default rounded-2xl p-8 text-center">
          <p className="text-sm text-muted">Nenhuma regra de permissão configurada.</p>
          <p className="text-xs text-muted mt-1">Clique em "+ Regra" para definir o que a IA pode fazer automaticamente.</p>
        </div>
      )}

      <div className="space-y-2">
        {permissions.map((perm) => (
          <div key={perm.id} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-2 rounded text-muted uppercase">{perm.type}</span>
            <span className="text-sm font-mono text-primary flex-1 truncate">{perm.pattern}</span>
            {perm.comment && <span className="text-[10px] text-muted truncate max-w-32">{perm.comment}</span>}
            <select
              value={perm.access}
              onChange={(e) => handleChangeAccess(perm.id, e.target.value)}
              className={`text-[10px] font-medium px-2 py-1 rounded-lg outline-none ${accessColors[perm.access]}`}
            >
              <option value="allow">{accessLabels.allow}</option>
              <option value="ask">{accessLabels.ask}</option>
              <option value="block">{accessLabels.block}</option>
            </select>
            <button onClick={() => handleDelete(perm.id)} className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg">X</button>
          </div>
        ))}
      </div>
    </div>
  );
}
