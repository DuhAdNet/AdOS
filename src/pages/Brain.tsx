import { useState } from 'react';

type BrainTab = 'overview' | 'memory' | 'sync';

export default function Brain() {
  const [tab, setTab] = useState<BrainTab>('overview');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="bg-surface-1 border border-default rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-primary flex items-center gap-2">
                🧠 Shared Brain
                <span className="text-[10px] px-2 py-0.5 bg-brand-600/20 text-brand-400 rounded-full font-medium">Beta</span>
              </h1>
              <p className="text-sm text-muted mt-1">
                Gerencie a camada de memória compartilhada deste workspace: o que o agente pode lembrar,
                quais computadores podem sincronizar e como workspaces conectados ficam delimitados.
              </p>
            </div>
            <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
              {(['overview', 'memory', 'sync'] as BrainTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tab === t ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                  }`}
                >
                  {t === 'overview' ? '👁 Visão geral' : t === 'memory' ? '🧠 Memória' : '🔗 Sync e nós'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {tab === 'overview' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Saúde</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Estado</p>
                <p className="text-sm font-medium text-primary">Apenas local</p>
                <p className="text-xs text-muted">Schema v1</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Modo</p>
                <p className="text-sm font-medium text-primary">Apenas local</p>
                <p className="text-xs text-muted">Ativado para memória local</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Dados canônicos</p>
                <p className="text-sm font-medium text-primary">0 registros</p>
                <p className="text-xs text-muted">0 KB</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Última atualização</p>
                <p className="text-sm font-medium text-primary">—</p>
                <p className="text-xs text-muted">0 raízes</p>
              </div>
            </div>
          </div>
        )}
        {tab === 'memory' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Memória</h2>
              <div className="flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input placeholder="Buscar memória" className="bg-transparent text-xs text-primary placeholder-muted outline-none w-40" />
              </div>
            </div>
            <p className="text-sm text-muted">Nenhum registro de memória ainda.</p>
          </div>
        )}
        {tab === 'sync' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Sync e nós</h2>
            <p className="text-sm text-muted">Configuração de sincronização não ativada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
