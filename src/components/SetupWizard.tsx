import { useState } from 'react';

const ados = (window as any).ados;

interface Provider {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

const PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-5.5', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'o4-mini', name: 'O4 Mini' },
      { id: 'o3-mini', name: 'O3 Mini' },
      { id: 'codex-mini-latest', name: 'Codex Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-6-20250514', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (free tier disponível)',
    models: [
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
      { id: 'mistralai/mistral-small-3.2', name: 'Mistral Small 3.2' },
      { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash (via OR)' },
    ],
  },
];

type Step = 'provider' | 'key' | 'test' | 'done' | 'oauth-waiting';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('provider');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const [userCode, setUserCode] = useState('');

  const handleOAuthLogin = async () => {
    setOauthLoading(true);
    setOauthError('');
    setUserCode('');

    const startResult = await ados.openaiOAuth.start();
    if (!startResult.success) {
      setOauthError(startResult.error || 'Não foi possível iniciar o login.');
      setOauthLoading(false);
      return;
    }

    setUserCode(startResult.user_code);
    setStep('oauth-waiting');

    const pollResult = await ados.openaiOAuth.poll(
      startResult.device_auth_id,
      startResult.user_code,
      startResult.interval
    );

    if (pollResult.success) {
      await ados.providers.setDefaultModel('gpt-5.5');
      setSelectedModel('gpt-5.5');
      setStep('done');
    } else {
      setOauthError(pollResult.error || 'Login expirou. Tente novamente.');
      setStep('provider');
    }
    setOauthLoading(false);
  };

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider);
    setSelectedModel(provider.models[0].id);
    setStep('key');
  };

  const handleTest = async () => {
    if (!apiKey.trim() || !selectedProvider) return;
    setTesting(true);
    setTestResult(null);

    try {
      await ados.providers.saveKey(selectedProvider.id, apiKey.trim());
      const result = await ados.llm.testKey(selectedProvider.id, apiKey.trim());
      if (result.success || !result.error) {
        setTestResult({ success: true });
        await ados.providers.setDefaultModel(selectedModel);
        setStep('done');
      } else {
        setTestResult({ error: result.error });
      }
    } catch (err: any) {
      setTestResult({ error: err.message || 'Erro ao testar conexão' });
    }
    setTesting(false);
  };

  const handleSkipTest = async () => {
    if (!apiKey.trim() || !selectedProvider) return;
    await ados.providers.saveKey(selectedProvider.id, apiKey.trim());
    await ados.providers.setDefaultModel(selectedModel);
    setStep('done');
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-surface-0 p-8">
      <div className="w-full max-w-lg">
        {step === 'provider' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-5 shadow-glow">
                <span className="text-2xl font-bold text-white">A</span>
              </div>
              <h1 className="text-2xl font-bold text-primary">Configurar AdOS</h1>
              <p className="text-sm text-muted mt-2">Escolha seu provider de IA para começar</p>
            </div>

            <button
              onClick={handleOAuthLogin}
              disabled={oauthLoading}
              className="w-full flex items-center justify-between p-4 bg-[#10a37f]/10 border border-[#10a37f]/30 rounded-xl hover:border-[#10a37f] hover:shadow-card-hover transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#10a37f] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z"/></svg>
                </div>
                <div>
                  <p className="font-medium text-primary">Login com conta OpenAI</p>
                  <p className="text-xs text-muted mt-0.5">Sem API key — usa sua conta ChatGPT/OpenAI</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#10a37f]">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            {oauthError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                {oauthError}
              </div>
            )}

            <div className="relative flex items-center my-4">
              <div className="flex-1 border-t border-default"></div>
              <span className="px-3 text-xs text-muted">ou configure com API key</span>
              <div className="flex-1 border-t border-default"></div>
            </div>

            <div className="space-y-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p)}
                  className="w-full flex items-center justify-between p-4 bg-surface-1 border border-default rounded-xl hover:border-brand-500/50 hover:shadow-card-hover transition-all text-left"
                >
                  <div>
                    <p className="font-medium text-primary">{p.name}</p>
                    <p className="text-xs text-muted mt-0.5">{p.models.length} modelos</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>

            <p className="text-xs text-muted text-center mt-4">
              Não tem API key? <a href="https://openrouter.ai" target="_blank" rel="noopener" className="text-brand-400 hover:text-brand-300">OpenRouter</a> oferece modelos gratuitos.
            </p>
          </div>
        )}

        {step === 'key' && selectedProvider && (
          <div className="space-y-6">
            <button onClick={() => setStep('provider')} className="text-sm text-muted hover:text-primary flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Voltar
            </button>

            <div>
              <h2 className="text-xl font-bold text-primary">{selectedProvider.name}</h2>
              <p className="text-sm text-muted mt-1">Cole sua API key e escolha o modelo padrão</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Modelo</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50"
                >
                  {selectedProvider.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedProvider.id === 'openai' ? 'sk-...' : 'Cole sua key aqui'}
                    className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2.5 pr-10 text-sm text-primary outline-none focus:border-brand-500/50 font-mono"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                  >
                    {showKey ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              {testResult?.error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
                  {testResult.error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleTest}
                  disabled={!apiKey.trim() || testing}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
                >
                  {testing ? 'Testando...' : 'Testar e Salvar'}
                </button>
                <button
                  onClick={handleSkipTest}
                  disabled={!apiKey.trim()}
                  className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:text-muted rounded-lg text-sm text-secondary transition-all"
                >
                  Pular teste
                </button>
              </div>
            </div>

            {selectedProvider.id === 'openrouter' && (
              <p className="text-xs text-muted">
                Crie uma conta em <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" className="text-brand-400">openrouter.ai/keys</a> — modelos Llama e Mistral são gratuitos.
              </p>
            )}
            {selectedProvider.id === 'openai' && (
              <p className="text-xs text-muted">
                Gere sua key em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-brand-400">platform.openai.com/api-keys</a>
              </p>
            )}
            {selectedProvider.id === 'google' && (
              <p className="text-xs text-muted">
                Key gratuita em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-brand-400">aistudio.google.com</a> — Gemini Flash tem free tier generoso.
              </p>
            )}
          </div>
        )}

        {step === 'oauth-waiting' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#10a37f]/20 flex items-center justify-center mx-auto">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#10a37f"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">Digite o código no navegador</h2>
              <p className="text-sm text-muted mt-2">
                Cole este código na página da OpenAI que abriu:
              </p>
            </div>
            {userCode && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-xl px-6 py-4 inline-block">
                <span className="text-3xl font-mono font-bold text-primary tracking-widest">{userCode}</span>
              </div>
            )}
            <div className="flex gap-1.5 justify-center">
              <span className="w-2 h-2 bg-[#10a37f] rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-[#10a37f] rounded-full animate-pulse [animation-delay:0.2s]" />
              <span className="w-2 h-2 bg-[#10a37f] rounded-full animate-pulse [animation-delay:0.4s]" />
            </div>
            <p className="text-xs text-muted">Aguardando confirmação...</p>
            <button
              onClick={() => { setStep('provider'); setOauthLoading(false); }}
              className="text-xs text-muted hover:text-primary"
            >
              Cancelar
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">Tudo pronto!</h2>
              <p className="text-sm text-muted mt-2">
                Modelo: <span className="text-primary font-mono">{selectedModel}</span>
              </p>
            </div>
            <button
              onClick={onComplete}
              className="px-8 py-3 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm font-medium text-white transition-all shadow-glow"
            >
              Começar a usar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
