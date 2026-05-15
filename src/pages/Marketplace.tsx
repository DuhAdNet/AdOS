import { useState, useEffect } from 'react';

type MktTab = 'skills' | 'workflows';

interface MarketplaceItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
  category: string;
  type: 'skill' | 'workflow';
}

const ados = (window as any).ados;

const catalog: MarketplaceItem[] = [
  { id: 'mkt-1', name: 'Web Research', slug: 'web-research', description: 'Pesquisa profunda na web com resumo estruturado e fontes.', instructions: 'Pesquise na web sobre o tema solicitado. Retorne um resumo estruturado com bullet points, fontes citadas e data da pesquisa.', category: 'Pesquisa', type: 'skill' },
  { id: 'mkt-2', name: 'Resumo de Texto', slug: 'resumo-texto', description: 'Resume textos longos mantendo pontos-chave e conclusões.', instructions: 'Resuma o texto fornecido em no máximo 3 parágrafos, mantendo os pontos-chave, dados relevantes e conclusões principais.', category: 'Texto', type: 'skill' },
  { id: 'mkt-3', name: 'Code Review', slug: 'code-review', description: 'Analisa código com foco em bugs, performance e boas práticas.', instructions: 'Analise o código fornecido. Identifique: 1) Bugs potenciais 2) Problemas de performance 3) Violações de boas práticas 4) Sugestões de melhoria. Priorize por severidade.', category: 'Código', type: 'skill' },
  { id: 'mkt-4', name: 'Email Drafter', slug: 'email-drafter', description: 'Redige emails profissionais com tom e estrutura adequados.', instructions: 'Redija um email profissional com base no contexto fornecido. Use tom adequado ao destinatário, estrutura clara (saudação, corpo, CTA, despedida) e mantenha conciso.', category: 'Texto', type: 'skill' },
  { id: 'mkt-5', name: 'Meeting Notes', slug: 'meeting-notes', description: 'Estrutura notas de reunião com decisões, ações e responsáveis.', instructions: 'Estruture as notas da reunião no formato: 1) Participantes 2) Pauta 3) Decisões tomadas 4) Action items (com responsável e prazo) 5) Próximos passos.', category: 'Reuniões', type: 'skill' },
  { id: 'mkt-6', name: 'Data Analysis', slug: 'data-analysis', description: 'Analisa dados, identifica tendências e gera insights acionáveis.', instructions: 'Analise os dados fornecidos. Identifique: 1) Tendências principais 2) Anomalias 3) Correlações 4) Insights acionáveis. Apresente com números e percentuais.', category: 'Dados', type: 'skill' },
  { id: 'mkt-7', name: 'Morning Brief', slug: 'morning-brief', description: 'Workflow matinal que consolida agenda, prioridades e mensagens.', instructions: 'Gere o briefing matinal consolidando: 1) Compromissos do dia 2) Top 3 prioridades 3) Mensagens pendentes 4) Contexto relevante para decisões do dia.', category: 'Automação', type: 'workflow' },
  { id: 'mkt-8', name: 'Sprint Review', slug: 'sprint-review', description: 'Gera relatório de sprint com progresso, bloqueios e métricas.', instructions: 'Gere o relatório de sprint review com: 1) Entregas concluídas 2) Items não concluídos (motivo) 3) Métricas (velocity, burndown) 4) Bloqueios 5) Plano para próxima sprint.', category: 'Projetos', type: 'workflow' },
  { id: 'mkt-9', name: 'Content Pipeline', slug: 'content-pipeline', description: 'Workflow de criação de conteúdo: ideia → outline → draft → review.', instructions: 'Execute o pipeline de conteúdo: 1) Valide a ideia (audiência, objetivo, formato) 2) Crie outline 3) Escreva draft 4) Revise gramática e tom 5) Sugira título e meta description.', category: 'Texto', type: 'workflow' },
  { id: 'mkt-10', name: 'Competitor Watch', slug: 'competitor-watch', description: 'Monitora concorrentes e gera relatório comparativo.', instructions: 'Analise os concorrentes indicados. Compare: 1) Posicionamento 2) Features/Preços 3) Movimentos recentes 4) Pontos fortes/fracos 5) Oportunidades para nós.', category: 'Pesquisa', type: 'workflow' },
];

export default function Marketplace() {
  const [tab, setTab] = useState<MktTab>('skills');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const categories = ['Pesquisa', 'Texto', 'Código', 'Automação', 'Projetos', 'Reuniões', 'Dados'];

  useEffect(() => { checkInstalled(); }, []);

  const checkInstalled = async () => {
    const [skills, workflows] = await Promise.all([
      ados.db.getSkills(),
      ados.db.getWorkflows(),
    ]);
    const slugs = new Set<string>([
      ...skills.map((s: any) => s.slug),
      ...workflows.map((w: any) => w.slug),
    ]);
    setInstalled(slugs);
  };

  const handleInstall = async (item: MarketplaceItem) => {
    const id = crypto.randomUUID();
    if (item.type === 'skill') {
      await ados.db.addSkill(id, item.name, item.slug, item.description, item.instructions);
    } else {
      await ados.db.addWorkflow(id, item.name, item.slug, item.description, item.instructions);
    }
    setInstalled(new Set([...installed, item.slug]));
  };

  const filtered = catalog.filter(item => {
    if (item.type !== tab) return false;
    if (activeCategory && item.category !== activeCategory) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-3 bg-surface-1 rounded-xl p-1">
            <button
              onClick={() => setTab('skills')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'skills' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
              }`}
            >
              Skills
            </button>
            <button
              onClick={() => setTab('workflows')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'workflows' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
              }`}
            >
              Workflows
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-primary">Marketplace AdOS</h1>
          <p className="text-sm text-muted mt-1">Descubra e instale skills e workflows prontos para usar.</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              placeholder="Buscar por nome ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${!activeCategory ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
          >
            Todos
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setActiveCategory(activeCategory === c ? null : c)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${activeCategory === c ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted">Nenhum item encontrado para os filtros selecionados.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mt-4">
          {filtered.map((item) => (
            <div key={item.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-primary">{item.name}</span>
                  <span className="ml-2 text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{item.category}</span>
                </div>
                {installed.has(item.slug) ? (
                  <span className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full font-medium">Instalado</span>
                ) : (
                  <button
                    onClick={() => handleInstall(item)}
                    className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                  >
                    Instalar
                  </button>
                )}
              </div>
              <p className="text-xs text-muted line-clamp-2">{item.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                  {item.type === 'skill' ? '/' : '@'}{item.slug}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
