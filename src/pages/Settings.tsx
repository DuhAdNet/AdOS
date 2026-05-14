import { useState } from 'react';

interface ApiKeyConfig {
  provider: string;
  label: string;
  placeholder: string;
}

const providers: ApiKeyConfig[] = [
  { provider: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { provider: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...' },
  { provider: 'google', label: 'Google (Gemini)', placeholder: 'AIza...' },
];

export default function Settings() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const handleSave = async (provider: string) => {
    const value = keys[provider];
    if (!value) return;

    try {
      await (window as any).ados.settings.set(`apiKey:${provider}`, value);
      setSaved(provider);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      // handle error
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          API Keys
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          As chaves são criptografadas e armazenadas localmente no Windows Credential Manager.
        </p>

        <div className="space-y-4">
          {providers.map((p) => (
            <div key={p.provider} className="bg-[#1a2235] rounded-xl p-4">
              <label className="block text-sm font-medium mb-2">{p.label}</label>
              <div className="flex gap-3">
                <input
                  type="password"
                  placeholder={p.placeholder}
                  value={keys[p.provider] || ''}
                  onChange={(e) => setKeys({ ...keys, [p.provider]: e.target.value })}
                  className="flex-1 bg-[#0d1220] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleSave(p.provider)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {saved === p.provider ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Modelo Padrão
        </h2>
        <select className="bg-[#1a2235] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500">
          <option value="gpt-4o">GPT-4o (OpenAI)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Anthropic)</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash (Google)</option>
        </select>
      </section>
    </div>
  );
}
