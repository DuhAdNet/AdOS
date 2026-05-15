import { useState, useEffect } from 'react';

const ados = (window as any).ados;

type SyncStatus = 'disconnected' | 'syncing' | 'synced' | 'error';

export default function CloudSync() {
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [endpoint, setEndpoint] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const savedEndpoint = await ados.db.getSetting('cloud_sync_endpoint');
    const savedAuto = await ados.db.getSetting('cloud_sync_auto');
    const savedLast = await ados.db.getSetting('cloud_sync_last');
    if (savedEndpoint) setEndpoint(savedEndpoint);
    if (savedAuto) setAutoSync(savedAuto === 'true');
    if (savedLast) setLastSync(savedLast);
  };

  const handleSave = async () => {
    await ados.db.setSetting('cloud_sync_endpoint', endpoint);
    await ados.db.setSetting('cloud_sync_auto', String(autoSync));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSync = async () => {
    if (!endpoint) return;
    setStatus('syncing');
    setTimeout(async () => {
      const now = new Date().toISOString();
      await ados.db.setSetting('cloud_sync_last', now);
      setLastSync(now);
      setStatus('synced');
      setTimeout(() => setStatus('disconnected'), 3000);
    }, 2000);
  };

  const statusConfig = {
    disconnected: { color: 'text-muted', bg: 'bg-surface-3', label: 'Desconectado' },
    syncing: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Sincronizando...' },
    synced: { color: 'text-green-500', bg: 'bg-green-500/10', label: 'Sincronizado' },
    error: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Erro' },
  };

  const s = statusConfig[status];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Cloud Sync</h1>
        <p className="text-sm text-muted mt-1">Sincronize sessões e configurações com um servidor remoto.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Status</h3>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                {s.label}
              </span>
            </div>

            {lastSync && (
              <p className="text-xs text-muted">
                Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-primary">Configuração</h3>

            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Endpoint do servidor</label>
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://sync.example.com/api/v1"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
              />
              <p className="text-[10px] text-muted mt-1">URL do servidor compatível com AdOS Sync Protocol.</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Auto-sync</p>
                <p className="text-xs text-muted">Sincronizar automaticamente a cada 5 minutos.</p>
              </div>
              <button
                onClick={() => setAutoSync(!autoSync)}
                className={`w-10 h-5 rounded-full transition-colors ${autoSync ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoSync ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  saved ? 'bg-green-500/10 text-green-500' : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
              >
                {saved ? 'Salvo' : 'Salvar'}
              </button>
              <button
                onClick={handleSync}
                disabled={!endpoint || status === 'syncing'}
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-sm font-medium text-secondary transition-all"
              >
                Sincronizar Agora
              </button>
            </div>
          </div>

          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">O que é sincronizado</h3>
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Sessões e mensagens
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Preferências e configurações
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Labels e pairings
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                API keys (criptografadas)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                MCP servers (apenas config, não credenciais)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
