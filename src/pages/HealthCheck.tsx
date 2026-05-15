import { useState } from 'react';

const ados = (window as any).ados;

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  message: string;
}

export default function HealthCheck() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    setResults([]);
    const checks: CheckResult[] = [];

    try {
      const providers = await ados.providers.list();
      const hasKey = providers.some((p: any) => p.hasKey);
      checks.push({
        name: 'LLM Provider',
        status: hasKey ? 'ok' : 'error',
        message: hasKey ? `${providers.filter((p: any) => p.hasKey).length} provider(s) configurados` : 'Nenhum provider com API key',
      });
    } catch {
      checks.push({ name: 'LLM Provider', status: 'error', message: 'Erro ao verificar providers' });
    }

    try {
      const mcpServers = await ados.mcp.listServers();
      const connected = mcpServers.filter((s: any) => s.status === 'connected').length;
      const total = mcpServers.length;
      checks.push({
        name: 'MCP Servers',
        status: total === 0 ? 'warning' : connected === total ? 'ok' : 'warning',
        message: total === 0 ? 'Nenhum servidor configurado' : `${connected}/${total} conectados`,
      });
    } catch {
      checks.push({ name: 'MCP Servers', status: 'error', message: 'Erro ao verificar MCP' });
    }

    try {
      const sessions = await ados.db.getSessions();
      checks.push({
        name: 'Database',
        status: 'ok',
        message: `${sessions.length} sessão(ões) no banco`,
      });
    } catch {
      checks.push({ name: 'Database', status: 'error', message: 'Falha ao acessar o banco de dados' });
    }

    try {
      const result = await ados.telegram.getToken();
      checks.push({
        name: 'Telegram Bot',
        status: result.hasToken ? 'ok' : 'warning',
        message: result.hasToken ? 'Token configurado' : 'Token não configurado',
      });
    } catch {
      checks.push({ name: 'Telegram Bot', status: 'warning', message: 'Módulo indisponível' });
    }

    try {
      const dm = await ados.providers.getDefaultModel();
      checks.push({
        name: 'Modelo Padrão',
        status: dm ? 'ok' : 'warning',
        message: dm || 'Nenhum modelo selecionado',
      });
    } catch {
      checks.push({ name: 'Modelo Padrão', status: 'warning', message: 'Erro ao verificar' });
    }

    checks.push({
      name: 'Electron Runtime',
      status: 'ok',
      message: `Plataforma: ${navigator.platform}`,
    });

    setResults(checks);
    setRunning(false);
  };

  const statusIcon = (status: string) => {
    if (status === 'ok') return <span className="w-3 h-3 rounded-full bg-green-500" />;
    if (status === 'warning') return <span className="w-3 h-3 rounded-full bg-yellow-500" />;
    if (status === 'error') return <span className="w-3 h-3 rounded-full bg-red-500" />;
    return <span className="w-3 h-3 rounded-full bg-surface-3 animate-pulse" />;
  };

  const overallStatus = results.length === 0
    ? null
    : results.some(r => r.status === 'error')
      ? 'error'
      : results.some(r => r.status === 'warning')
        ? 'warning'
        : 'ok';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Health Check</h1>
        <p className="text-sm text-muted mt-1">Diagnóstico do sistema — verifica providers, banco, MCP e integrações.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-6">
          <button
            onClick={runChecks}
            disabled={running}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
          >
            {running ? 'Verificando...' : 'Executar Diagnóstico'}
          </button>

          {overallStatus && (
            <div className={`border rounded-2xl p-5 ${
              overallStatus === 'ok' ? 'bg-green-500/5 border-green-500/20' :
              overallStatus === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
              'bg-red-500/5 border-red-500/20'
            }`}>
              <p className={`text-sm font-medium ${
                overallStatus === 'ok' ? 'text-green-500' :
                overallStatus === 'warning' ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {overallStatus === 'ok' ? 'Sistema saudável' :
                 overallStatus === 'warning' ? 'Atenção necessária' :
                 'Problemas detectados'}
              </p>
              <p className="text-xs text-muted mt-1">
                {results.filter(r => r.status === 'ok').length}/{results.length} checks passaram
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map(r => (
                <div key={r.name} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center gap-3">
                  {statusIcon(r.status)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary">{r.name}</p>
                    <p className="text-xs text-muted">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
