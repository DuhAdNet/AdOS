import { useState, useEffect } from 'react';

type AutoTab = 'mine' | 'recommended';

interface Automation {
  id: string;
  name: string;
  description: string;
  schedule: string;
  sources: string[];
  enabled: boolean;
  lastRun: string | null;
  createdAt: string;
}

const ados = (window as any).ados;

const recommended = [
  { name: 'Morning Brief', description: 'Comece o dia com agenda, prioridades, mensagens importantes e contexto.', schedule: 'Dias úteis às 08:00', sources: ['Calendar', 'Slack'] },
  { name: 'Daily Checkpoint', description: 'Feche o dia com progresso, bloqueios, decisões pendentes e prioridades de amanhã.', schedule: 'Dias úteis às 18:00', sources: ['Slack', 'Calendar'] },
  { name: 'Slack Channel Check', description: 'Escolha canais do Slack e receba um resumo dos últimos 1 ou N dias de mensagens.', schedule: 'Todos os dias às 09:00', sources: ['Slack'] },
  { name: 'News Check', description: 'Acompanhe fontes de notícias, temas e sinais de mercado em uma cadência definida.', schedule: 'Todos os dias às 07:30', sources: ['Web search'] },
  { name: 'Email Summarization', description: 'Resuma e-mails recentes do Gmail por janela de tempo, remetentes ou pastas.', schedule: 'Dias úteis às 08:30 e 16:30', sources: ['Gmail'] },
];

export default function Automations() {
  const [tab, setTab] = useState<AutoTab>('mine');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', schedule: '', sources: '' });

  useEffect(() => { loadAutomations(); }, []);

  const loadAutomations = async () => {
    const rows = await ados.db.getAutomations();
    setAutomations(rows);
  };

  const handleAdd = async () => {
    const id = crypto.randomUUID();
    const sources = form.sources.split(',').map((s: string) => s.trim()).filter(Boolean);
    await ados.db.addAutomation(id, form.name, form.description, form.schedule, JSON.stringify(sources));
    setForm({ name: '', description: '', schedule: '', sources: '' });
    setShowAdd(false);
    loadAutomations();
  };

  const handleActivateRecommended = async (rec: typeof recommended[0]) => {
    const id = crypto.randomUUID();
    await ados.db.addAutomation(id, rec.name, rec.description, rec.schedule, JSON.stringify(rec.sources));
    await ados.db.toggleAutomation(id, true);
    loadAutomations();
    setTab('mine');
  };

  const handleToggle = async (auto: Automation) => {
    await ados.db.toggleAutomation(auto.id, !auto.enabled);
    loadAutomations();
  };

  const handleDelete = async (id: string) => {
    await ados.db.deleteAutomation(id);
    loadAutomations();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Automações</h1>
            <p className="text-sm text-muted">{automations.length} automações · {automations.filter(a => a.enabled).length} ativas</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setTab('mine'); }}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
          >
            + Nova Automação
          </button>
        </div>

        <div className="flex gap-1 bg-surface-1 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'mine' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            Minhas Automações <span className="text-xs opacity-60">{automations.length}</span>
          </button>
          <button
            onClick={() => setTab('recommended')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'recommended' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            Rotinas Recomendadas <span className="text-xs opacity-60">{recommended.length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {tab === 'mine' && (
          <>
            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Nova Automação</h3>
                <div className="space-y-3">
                  <input
                    placeholder="Nome da automação"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                  />
                  <input
                    placeholder="Descrição"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                  />
                  <div className="flex gap-3">
                    <input
                      placeholder="Agendamento (ex: Dias úteis às 09:00)"
                      value={form.schedule}
                      onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <input
                      placeholder="Sources (Gmail, Slack...)"
                      value={form.sources}
                      onChange={(e) => setForm({ ...form, sources: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAdd}
                      disabled={!form.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Criar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {automations.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">Nenhuma automação configurada</p>
                <p className="text-xs text-muted">Crie uma nova ou ative uma rotina recomendada.</p>
              </div>
            )}

            <div className="space-y-3">
              {automations.map((auto) => (
                <div key={auto.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-primary">{auto.name}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        auto.enabled ? 'bg-green-500/10 text-green-500' : 'bg-surface-3 text-muted'
                      }`}>
                        {auto.enabled ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(auto)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${auto.enabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${auto.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <button onClick={() => handleDelete(auto.id)} className="px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">
                        Remover
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted mb-2">{auto.description}</p>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{auto.schedule}</span>
                    {auto.sources.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'recommended' && (
          <div className="space-y-3 mt-4">
            <p className="text-xs text-muted uppercase font-semibold tracking-wider">Ative com um clique</p>
            {recommended.map((r) => (
              <div key={r.name} className="bg-surface-1 border border-default rounded-2xl p-5 flex items-center justify-between shadow-card">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-primary">{r.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-brand-600/10 rounded text-brand-500 uppercase font-medium">Rotina</span>
                  </div>
                  <p className="text-xs text-muted mb-2">{r.description}</p>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{r.schedule}</span>
                    {r.sources.map(s => (
                      <span key={s} className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{s}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleActivateRecommended(r)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-xl text-xs text-white font-medium transition-colors shrink-0"
                >
                  Ativar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
