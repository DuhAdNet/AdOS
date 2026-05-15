import { useState } from 'react';

type AutoTab = 'mine' | 'recommended';

export default function Automations() {
  const [tab, setTab] = useState<AutoTab>('mine');

  const recommended = [
    { name: 'Morning Brief', desc: 'Comece o dia com agenda, prioridades, mensagens importantes e contexto.', schedule: 'Dias úteis às 08:00', sources: ['Calendar', 'Slack'] },
    { name: 'Daily Checkpoint', desc: 'Feche o dia com progresso, bloqueios, decisões pendentes e prioridades de amanhã.', schedule: 'Dias úteis às 18:00', sources: ['Slack', 'Calendar'] },
    { name: 'Slack Channel Check', desc: 'Escolha canais do Slack e receba um resumo dos últimos 1 ou N dias de mensagens.', schedule: 'Todos os dias às 09:00', sources: ['Slack'] },
    { name: 'News Check', desc: 'Acompanhe fontes de notícias, temas e sinais de mercado em uma cadência definida.', schedule: 'Todos os dias às 07:30', sources: ['Web search'] },
    { name: 'Email Summarization', desc: 'Resuma e-mails recentes do Gmail por janela de tempo, remetentes ou pastas.', schedule: 'Dias úteis às 08:30 e 16:30', sources: ['Gmail'] },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Automações</h1>
            <p className="text-sm text-muted">Gerencie suas automações e ative sugestões úteis.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors border border-default">
              ✨ Criar com agente
            </button>
            <button className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors border border-default">
              + Nova Automação
            </button>
          </div>
        </div>

        <div className="flex gap-1 bg-surface-1 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'mine' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            🔄 Minhas Automações <span className="text-xs opacity-60">0</span>
          </button>
          <button
            onClick={() => setTab('recommended')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'recommended' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            ✨ Rotinas Recomendadas <span className="text-xs opacity-60">{recommended.length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {tab === 'mine' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted">Nenhuma automação configurada.</p>
            <p className="text-xs text-muted mt-1">Crie uma nova ou ative uma rotina recomendada.</p>
          </div>
        )}
        {tab === 'recommended' && (
          <div className="space-y-3 mt-4">
            <p className="text-xs text-muted uppercase font-semibold tracking-wider">Rotinas Recomendadas</p>
            {recommended.map((r) => (
              <div key={r.name} className="bg-surface-1 border border-default rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-primary">{r.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-3 rounded text-muted uppercase">Rotina</span>
                  </div>
                  <p className="text-xs text-muted mb-2">{r.desc}</p>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{r.schedule}</span>
                    {r.sources.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{s}</span>
                    ))}
                  </div>
                </div>
                <button className="text-xs text-brand-500 hover:text-brand-400 font-medium">Ver detalhes</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
