import { useState, useEffect } from 'react';

interface ApiKeyConfig {
  provider: string;
  label: string;
  placeholder: string;
  icon: string;
}

const providers: ApiKeyConfig[] = [
  { provider: 'openai', label: 'OpenAI', placeholder: 'sk-...', icon: '⚡' },
  { provider: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', icon: '🧠' },
  { provider: 'google', label: 'Google (Gemini)', placeholder: 'AIza...', icon: '✦' },
];

type SettingsTab = 'api-keys' | 'model' | 'about';

const ados = (window as any).ados;

export default function Settings() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, 'idle' | 'saving' | 'testing' | 'saved' | 'error'>>({});
  const [hasKeys, setHasKeys] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<SettingsTab>('api-keys');

  useEffect(() => {
    checkExistingKeys();
  }, []);

  const checkExistingKeys = async () => {
    const result: Record<string, boolean> = {};
    for (const p of providers) {
      result[p.provider] = await ados.llm.hasKey(p.provider);
    }
    setHasKeys(result);
  };

  const handleSave = async (provider: string) => {
    const value = keys[provider];
    if (!value) return;

    setStatus({ ...status, [provider]: 'testing' });

    const testResult = await ados.llm.testKey(provider, value);
    if (testResult.error) {
      setStatus({ ...status, [provider]: 'error' });
      return;
    }

    setStatus({ ...status, [provider]: 'saving' });
    const saveResult = await ados.llm.saveKey(provider, value);

    if (saveResult.success) {
      setStatus({ ...status, [provider]: 'saved' });
      setHasKeys({ ...hasKeys, [provider]: true });
      setKeys({ ...keys, [provider]: '' });
      setTimeout(() => setStatus((s) => ({ ...s, [provider]: 'idle' })), 2000);
    } else {
      setStatus({ ...status, [provider]: 'error' });
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'api-keys',
      label: 'API Keys',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
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

  const getButtonLabel = (provider: string) => {
    const s = status[provider];
    if (s === 'testing') return 'Testando...';
    if (s === 'saving') return 'Salvando...';
    if (s === 'saved') return '✓ Salvo';
    if (s === 'error') return '✕ Falhou';
    return 'Salvar';
  };

  const getButtonClass = (provider: string) => {
    const s = status[provider];
    if (s === 'saved') return 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20';
    if (s === 'error') return 'bg-red-500/10 text-red-500 border border-red-500/20';
    if (s === 'testing' || s === 'saving') return 'bg-surface-3 text-muted cursor-wait';
    return 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-glow';
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <nav className="w-48 bg-surface-1 border-r border-default p-3 flex flex-col gap-1">
        <h2 className="text-[10px] uppercase text-muted font-semibold px-3 py-2 tracking-wider">
          Configurações
        </h2>
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
        {activeTab === 'api-keys' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">API Keys</h1>
            <p className="text-sm text-muted mb-6">
              Chaves criptografadas via Windows Credential Manager. A key é testada antes de salvar.
            </p>

            <div className="space-y-4">
              {providers.map((p) => (
                <div key={p.provider} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{p.icon}</span>
                    <label className="text-sm font-medium text-primary">{p.label}</label>
                    {hasKeys[p.provider] && (
                      <span className="ml-auto text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                        Configurada
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      placeholder={hasKeys[p.provider] ? '••••••••••••••••' : p.placeholder}
                      value={keys[p.provider] || ''}
                      onChange={(e) => setKeys({ ...keys, [p.provider]: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 focus:shadow-glow transition-all"
                    />
                    <button
                      onClick={() => handleSave(p.provider)}
                      disabled={!keys[p.provider] || status[p.provider] === 'testing' || status[p.provider] === 'saving'}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${getButtonClass(p.provider)}`}
                    >
                      {getButtonLabel(p.provider)}
                    </button>
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
              Escolha o modelo de IA que será usado nas novas sessões.
            </p>

            <div className="space-y-3">
              {[
                { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', desc: 'Rápido e versátil' },
                { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', desc: 'Excelente em código e análise' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', desc: 'Ultra-rápido, bom custo-benefício' },
              ].map((model) => (
                <label
                  key={model.id}
                  className="flex items-center gap-4 p-4 bg-surface-1 border border-default rounded-2xl cursor-pointer hover:shadow-card-hover hover:border-brand-500/30 transition-all"
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    defaultChecked={model.id === 'gpt-4o'}
                    className="w-4 h-4 text-brand-600 accent-brand-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-primary">{model.name}</p>
                    <p className="text-xs text-muted">{model.provider} — {model.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Sobre o AdOS</h1>
            <p className="text-sm text-muted mb-6">
              AI Operational System da AdNet Monetize.
            </p>

            <div className="bg-surface-1 border border-default rounded-2xl p-6 shadow-card">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow">
                  <span className="text-xl font-bold text-white">A</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">AdOS</h3>
                  <p className="text-xs text-muted">Versão 0.2.0</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-secondary">
                <p>Chat com múltiplos modelos de IA (streaming)</p>
                <p>Browser automation integrado (WebContentsView)</p>
                <p>Persistência local (SQLite criptografado)</p>
                <p>Automações, memória e marketplace (em desenvolvimento)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
