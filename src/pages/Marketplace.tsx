import { useState, useEffect, useCallback, ReactElement } from 'react';

type MktTab = 'skills' | 'workflows';

type SortOption = 'name' | 'date' | 'downloads' | 'rating' | 'updated';
type ViewMode = 'grid' | 'list';

interface MarketplaceItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
  category: string;
  type: 'skill' | 'workflow';
  version: string;
  downloads?: number;
  collection?: string;
  releaseNotes?: Record<string, string>;
  changelog?: { version: string; date: string; changes: string }[];
}

interface UsageStats {
  itemsInstalled: number;
  updatesApplied: number;
  spaceUsedKB: number;
  month: string;
}

interface PublisherProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  slugs: string[];
  verified: boolean;
}

// Feature 34: Publisher profiles
const publishers: PublisherProfile[] = [
  { id: 'pub-adnet', name: 'AdNet Core', description: 'Skills oficiais desenvolvidas pelo time interno da AdNet Monetize.', icon: 'A', slugs: ['marketing-strategy', 'seo-audit', 'campaign-brief', 'financial-report', 'budget-planner', 'prd-writer', 'code-review', 'okr-framework', 'board-deck'], verified: true },
  { id: 'pub-community', name: 'Comunidade', description: 'Skills contribuídas pela comunidade de usuários.', icon: 'C', slugs: ['cold-outreach', 'roi-calculator', 'vendor-evaluation', 'data-quality-audit', 'kpi-definition'], verified: false },
  { id: 'pub-partners', name: 'Parceiros', description: 'Skills de parceiros certificados e integradores.', icon: 'P', slugs: ['compliance-check', 'contract-review', 'nda-generator', 'architecture-review', 'incident-report'], verified: true },
];

// Feature 35: Beta/preview channel items
const betaChannelItems: Record<string, { channel: 'stable' | 'beta' | 'preview'; betaVersion?: string }> = {
  'marketing-strategy': { channel: 'stable' },
  'seo-audit': { channel: 'beta', betaVersion: '2.0-beta.1' },
  'prd-writer': { channel: 'beta', betaVersion: '2.0-beta.2' },
  'financial-report': { channel: 'preview', betaVersion: '2.0-preview' },
  'code-review': { channel: 'preview', betaVersion: '1.5-preview' },
};

interface Bundle {
  id: string;
  name: string;
  description: string;
  slugs: string[];
  icon: string;
}

const ados = (window as any).ados;

const categoryIcons: Record<string, string> = {
  Marketing: '◈', Vendas: '◇', Finanças: '▣', RH: '◉',
  Operações: '⬡', Jurídico: '◫', Produto: '△', Suporte: '○',
  Projetos: '□', Estratégia: '◎', Comunicação: '▷', Dados: '▥',
};

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

const bundles: Bundle[] = [
  { id: 'pack-marketing', name: 'Pack Marketing', description: 'Skills essenciais para marketing: estratégia, SEO e campanhas.', slugs: ['marketing-strategy', 'seo-audit', 'campaign-brief'], icon: '◈' },
  { id: 'pack-financeiro', name: 'Pack Financeiro', description: 'Controle financeiro completo: relatórios, budget, fluxo de caixa e auditoria.', slugs: ['financial-report', 'budget-planner', 'cash-flow-forecast', 'expense-audit'], icon: '▣' },
  { id: 'pack-produto', name: 'Pack Produto', description: 'Skills de produto e engenharia: PRD, spec técnica e code review.', slugs: ['prd-writer', 'technical-spec', 'code-review'], icon: '△' },
];

// Feature: Thematic Collections
const collections: { id: string; name: string; icon: string; slugs: string[] }[] = [
  { id: 'col-produtividade', name: 'Produtividade', icon: '◆', slugs: ['sop-generator', 'process-optimization', 'sprint-planning', 'status-report', 'meeting-facilitator'] },
  { id: 'col-devops', name: 'DevOps', icon: '⬡', slugs: ['code-review', 'architecture-review', 'technical-spec', 'incident-report'] },
  { id: 'col-growth', name: 'Growth', icon: '▲', slugs: ['marketing-strategy', 'cro-analysis', 'content-calendar', 'campaign-brief', 'cold-outreach'] },
  { id: 'col-lideranca', name: 'Lideranca', icon: '◎', slugs: ['okr-framework', 'board-deck', 'competitive-analysis', 'market-research', 'performance-review'] },
  { id: 'col-financeiro', name: 'Financeiro', icon: '◇', slugs: ['financial-report', 'budget-planner', 'cash-flow-forecast', 'expense-audit', 'roi-calculator'] },
];

// Simulated download counts for popularity badge
const downloadCounts: Record<string, number> = {
  'marketing-strategy': 245, 'seo-audit': 189, 'campaign-brief': 132, 'financial-report': 210,
  'prd-writer': 178, 'code-review': 156, 'sales-playbook': 112, 'okr-framework': 143,
  'cold-outreach': 98, 'sprint-planning': 105, 'job-description': 88, 'contract-review': 74,
  'budget-planner': 120, 'technical-spec': 109, 'proposal-generator': 95,
};

// Release notes per item per version
const releaseNotesData: Record<string, Record<string, string>> = {
  'marketing-strategy': { '1.1': 'Novo cronograma trimestral e budget allocation por canal. Melhorada analise de ICP.', '1.0': 'Lancamento inicial com analise de mercado completa.' },
  'seo-audit': { '1.1': 'Core Web Vitals e analise de backlinks adicionados. Melhoria na priorizacao.', '1.0': 'Auditoria tecnica basica com on-page e conteudo.' },
  'financial-report': { '1.1': 'Burn rate, runway e alertas automaticos. Dashboard executivo.', '1.0': 'DRE basico com margem e EBITDA.' },
  'prd-writer': { '1.1': 'Formato de user stories e acceptance criteria melhorado.', '1.0': 'Versao inicial com problem statement e escopo.' },
  'proposal-generator': { '1.1': 'Pricing tiers e termos de condicao adicionados.', '1.0': 'Versao inicial com escopo e timeline.' },
};

const catalog: MarketplaceItem[] = [
  // === MARKETING & GROWTH ===
  { id: 'mkt-1', name: 'Marketing Strategy', slug: 'marketing-strategy', description: 'Cria estratégia de marketing completa: posicionamento, ICP, canais, budget allocation e KPIs.', instructions: 'Crie uma estratégia de marketing com: 1) Análise de mercado e concorrência 2) Definição de ICP e personas 3) Posicionamento e messaging 4) Mix de canais com budget % 5) KPIs e metas por canal 6) Cronograma de execução trimestral. Use dados fornecidos como input.', category: 'Marketing', type: 'skill', version: '1.1', changelog: [{ version: '1.0', date: '2025-01-15', changes: 'Versão inicial com análise de mercado e ICP.' }, { version: '1.1', date: '2025-03-10', changes: 'Adicionado cronograma trimestral e budget allocation por canal.' }] },
  { id: 'mkt-2', name: 'SEO Audit', slug: 'seo-audit', description: 'Auditoria SEO técnica e de conteúdo com priorização de fixes por impacto.', instructions: 'Execute auditoria SEO: 1) Análise técnica (Core Web Vitals, crawlability, indexação, sitemap, schema) 2) Análise on-page (títulos, metas, headings, internal linking) 3) Análise de conteúdo (gaps, canibalização, thin content) 4) Backlink profile 5) Priorize fixes por impacto × esforço. Output: relatório com action items ordenados.', category: 'Marketing', type: 'skill', version: '1.1', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial com auditoria técnica básica.' }, { version: '1.1', date: '2025-04-01', changes: 'Adicionado Core Web Vitals e análise de backlinks.' }] },
  { id: 'mkt-3', name: 'Campaign Brief', slug: 'campaign-brief', description: 'Gera brief completo para campanhas paid media com targeting, criativos e métricas.', instructions: 'Gere o brief da campanha: 1) Objetivo (awareness/consideration/conversion) 2) Audiência e targeting (demographics, interests, lookalikes) 3) Direção criativa (formatos, hooks, CTAs) 4) Budget e distribuição por plataforma 5) KPIs esperados (CPM, CPC, CPA, ROAS) 6) Timeline e milestones. Adapte ao canal informado (Meta, Google, TikTok, LinkedIn).', category: 'Marketing', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial com suporte a Meta, Google, TikTok e LinkedIn.' }] },
  { id: 'mkt-4', name: 'Content Calendar', slug: 'content-calendar', description: 'Planeja calendário editorial mensal com temas, formatos e distribuição por canal.', instructions: 'Crie calendário editorial para o período: 1) Pilares de conteúdo alinhados à estratégia 2) Temas semanais com hook e ângulo 3) Distribuição por canal (blog, social, email, video) 4) Formato e tamanho por peça 5) Datas de produção e publicação 6) Métricas de sucesso por tipo. Considere sazonalidade e eventos do setor.', category: 'Marketing', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-10', changes: 'Versão inicial.' }] },
  { id: 'mkt-5', name: 'CRO Analysis', slug: 'cro-analysis', description: 'Análise de conversão com hipóteses de teste A/B e priorização por ICE score.', instructions: 'Analise o funil de conversão: 1) Mapeie etapas e drop-offs 2) Identifique friction points 3) Gere hipóteses de melhoria 4) Score cada hipótese por ICE (Impact × Confidence × Ease) 5) Recomende top 5 testes A/B com variantes específicas 6) Defina métricas primárias e secundárias de cada teste.', category: 'Marketing', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-15', changes: 'Versão inicial com framework ICE.' }] },

  // === VENDAS & COMERCIAL ===
  { id: 'mkt-6', name: 'Sales Playbook', slug: 'sales-playbook', description: 'Monta playbook de vendas B2B: ICP, discovery, objeções, scripts e forecasting.', instructions: 'Construa o playbook de vendas: 1) ICP e qualificação (BANT/MEDDIC) 2) Script de discovery call com perguntas-chave 3) Mapa de objeções com respostas comprovadas 4) Cadência de follow-up (email + call + social) 5) Critérios de stage progression no pipeline 6) Template de forecast semanal com weighted pipeline.', category: 'Vendas', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-7', name: 'Proposal Generator', slug: 'proposal-generator', description: 'Redige propostas comerciais profissionais com escopo, pricing e timeline.', instructions: 'Gere proposta comercial: 1) Executive summary (problema → solução → valor) 2) Escopo detalhado com deliverables 3) Timeline com milestones 4) Pricing com opções (básico/pro/enterprise) 5) Termos e condições 6) Próximos passos. Tom executivo, focado em ROI e outcomes para o cliente.', category: 'Vendas', type: 'skill', version: '1.1', changelog: [{ version: '1.0', date: '2025-01-30', changes: 'Versão inicial.' }, { version: '1.1', date: '2025-03-20', changes: 'Adicionado pricing tiers e termos de condição.' }] },
  { id: 'mkt-8', name: 'Pipeline Review', slug: 'pipeline-review', description: 'Analisa pipeline de vendas e identifica deals em risco, gaps e oportunidades de upsell.', instructions: 'Analise o pipeline: 1) Deals por stage com aging médio 2) Deals em risco (stalled >14 dias, sem next step, champion off) 3) Cobertura de pipeline vs meta (3x rule) 4) Win rate por segment/size/rep 5) Oportunidades de upsell/cross-sell em clientes ativos 6) Recomendações de ação imediata top 5.', category: 'Vendas', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-05', changes: 'Versão inicial.' }] },
  { id: 'mkt-9', name: 'Cold Outreach', slug: 'cold-outreach', description: 'Cria sequências de cold email e LinkedIn com personalização por persona.', instructions: 'Crie sequência de outreach: 1) Email 1: pain-led hook personalizado (2-3 linhas) 2) Email 2: case study relevante (3 dias) 3) Email 3: breakup com valor (5 dias) 4) LinkedIn touch entre emails 5) Variantes A/B para subject lines 6) Merge tags para personalização em escala. Adapte ao ICP e vertical informados.', category: 'Vendas', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-10', changes: 'Versão inicial.' }] },
  { id: 'mkt-10', name: 'ROI Calculator', slug: 'roi-calculator', description: 'Calcula ROI de investimentos com payback period, NPV e análise de cenários.', instructions: 'Calcule ROI do investimento: 1) Investimento total (CAPEX + OPEX) 2) Benefícios quantificados (revenue uplift, cost savings, efficiency gains) 3) Payback period 4) ROI % em 12/24/36 meses 5) NPV com discount rate informada 6) Análise de sensibilidade (pessimista/base/otimista). Apresente em formato executivo com one-pager.', category: 'Vendas', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-15', changes: 'Versão inicial.' }] },

  // === FINANÇAS & CONTROLADORIA ===
  { id: 'mkt-11', name: 'Financial Report', slug: 'financial-report', description: 'Analisa demonstrações financeiras e gera relatório com indicadores-chave e tendências.', instructions: 'Analise os dados financeiros: 1) DRE — receita, custos, margem bruta, EBITDA, lucro líquido 2) Variação vs período anterior e vs budget 3) Indicadores: margem bruta %, EBITDA %, burn rate, runway 4) Tendências de 3-6 meses 5) Alertas (desvios >10% do budget) 6) Recomendações de ação. Formato: resumo executivo + detalhamento.', category: 'Finanças', type: 'skill', version: '1.1', changelog: [{ version: '1.0', date: '2025-01-10', changes: 'Versão inicial com DRE básico.' }, { version: '1.1', date: '2025-03-15', changes: 'Adicionado burn rate, runway e alertas automáticos.' }] },
  { id: 'mkt-12', name: 'Budget Planner', slug: 'budget-planner', description: 'Cria orçamento anual por centro de custo com alocação e cenários.', instructions: 'Elabore o budget: 1) Revenue forecast por linha de receita (base/upside/downside) 2) COGS e margem bruta target 3) OPEX por departamento (headcount, tools, marketing, infra) 4) Investimentos (CAPEX) 5) P&L projetado mensal 6) Cenários: conservative (-15%), base, aggressive (+20%). Use histórico fornecido como baseline.', category: 'Finanças', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-13', name: 'Expense Audit', slug: 'expense-audit', description: 'Audita despesas e identifica anomalias, duplicatas e oportunidades de saving.', instructions: 'Audite as despesas: 1) Classifique por categoria e centro de custo 2) Identifique anomalias (valores fora do padrão, crescimento acelerado) 3) Detecte possíveis duplicatas 4) Compare com benchmarks do setor 5) Identifique top 5 oportunidades de economia 6) Recomende renegociações de contratos. Priorize por valor absoluto de saving.', category: 'Finanças', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-14', name: 'Cash Flow Forecast', slug: 'cash-flow-forecast', description: 'Projeta fluxo de caixa semanal/mensal com alertas de liquidez.', instructions: 'Projete o fluxo de caixa: 1) Entradas previstas (recebíveis, contratos, vendas) com probabilidade 2) Saídas fixas (folha, aluguel, tools, impostos) 3) Saídas variáveis (marketing, comissões, fornecedores) 4) Saldo projetado dia a dia ou semana a semana 5) Alertas de liquidez (saldo <X dias de operação) 6) Recomendações: antecipar recebíveis, postergar pagamentos, linha de crédito.', category: 'Finanças', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-25', changes: 'Versão inicial.' }] },

  // === RECURSOS HUMANOS ===
  { id: 'mkt-15', name: 'Job Description', slug: 'job-description', description: 'Redige vagas otimizadas para atração com responsabilidades, requisitos e cultura.', instructions: 'Crie a job description: 1) Título otimizado para busca 2) Sobre a empresa (2-3 linhas, cultura e missão) 3) O que você vai fazer (5-7 responsabilidades concretas) 4) O que esperamos (requisitos obrigatórios vs desejáveis) 5) O que oferecemos (benefícios, salário quando aplicável) 6) Processo seletivo. Tom inclusivo, evite jargões e requisitos inflados.', category: 'RH', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-16', name: 'Interview Guide', slug: 'interview-guide', description: 'Cria roteiro de entrevista estruturada com perguntas comportamentais e rubrica de avaliação.', instructions: 'Monte o guia de entrevista: 1) Competências a avaliar (técnicas + comportamentais) 2) 4-6 perguntas STAR por competência 3) Follow-ups para aprofundar 4) Red flags por pergunta 5) Rubrica de scoring (1-5) com exemplos por nível 6) Scorecard consolidado. Adapte ao nível (júnior/pleno/senior/liderança) e à vaga informada.', category: 'RH', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-17', name: 'Onboarding Plan', slug: 'onboarding-plan', description: 'Estrutura onboarding de 30-60-90 dias com metas, reuniões e materiais.', instructions: 'Crie plano de onboarding: Semana 1: setup, apresentações, documentação essencial. Dias 1-30: metas de aprendizado, shadowing, primeiro deliverable. Dias 31-60: autonomia crescente, projetos próprios, feedback intermediário. Dias 61-90: ownership total, metas de performance, avaliação formal. Inclua: buddy, 1:1s com manager, training schedule.', category: 'RH', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-18', name: 'Performance Review', slug: 'performance-review', description: 'Estrutura ciclo de avaliação com goals, feedback 360 e plano de desenvolvimento.', instructions: 'Monte a avaliação: 1) Recap de goals do período com status (achieved/partial/missed) 2) Highlights e entregas acima do esperado 3) Áreas de desenvolvimento 4) Feedback de peers sintetizado 5) Rating recommendation (1-5) com justificativa 6) Plano de desenvolvimento para próximo ciclo com actions específicas. Tom construtivo e baseado em evidências.', category: 'RH', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-10', changes: 'Versão inicial.' }] },
  { id: 'mkt-19', name: 'Compensation Benchmark', slug: 'comp-benchmark', description: 'Pesquisa e compara faixas salariais por cargo, senioridade e região.', instructions: 'Elabore benchmark de compensação: 1) Cargo e nível (IC vs manager, junior/mid/senior/staff) 2) Faixa salarial por mercado (Brasil, LATAM, US, EU) 3) Breakdown: base + variável + equity + benefícios 4) Percentis P25/P50/P75 5) Comparação com a faixa atual da empresa 6) Recomendação de ajuste se fora de mercado. Use dados públicos e fontes citadas.', category: 'RH', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-15', changes: 'Versão inicial.' }] },

  // === OPERAÇÕES & PROCESSOS ===
  { id: 'mkt-20', name: 'SOP Generator', slug: 'sop-generator', description: 'Documenta procedimentos operacionais padrão com steps, owners e critérios de qualidade.', instructions: 'Crie o SOP: 1) Objetivo e escopo do processo 2) Pré-condições e triggers 3) Steps numerados com responsável, ação e output esperado 4) Decisões e branching (se X → faça Y) 5) Critérios de qualidade e checklist de validação 6) Exceções e escalação 7) Métricas do processo (tempo, erro, throughput). Formato: step-by-step com screenshots placeholders.', category: 'Operações', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-30', changes: 'Versão inicial.' }] },
  { id: 'mkt-21', name: 'Process Optimization', slug: 'process-optimization', description: 'Mapeia processos, identifica gargalos e propõe melhorias com estimativa de ganho.', instructions: 'Otimize o processo: 1) Mapeie as-is (steps, tempo, handoffs, ferramentas) 2) Identifique gargalos (tempo de espera, retrabalho, dependências) 3) Quantifique custo do desperdício 4) Proponha to-be com melhorias (automação, paralelização, eliminação) 5) Estime ganho (tempo, custo, qualidade) 6) Plano de implementação com quick wins vs mudanças estruturais.', category: 'Operações', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-05', changes: 'Versão inicial.' }] },
  { id: 'mkt-22', name: 'Vendor Evaluation', slug: 'vendor-evaluation', description: 'Compara fornecedores com scorecard ponderado por critérios de negócio.', instructions: 'Avalie os fornecedores: 1) Defina critérios (preço, qualidade, SLA, suporte, escalabilidade, segurança, integração) 2) Atribua pesos por prioridade do negócio 3) Score cada vendor (1-5) por critério com justificativa 4) Matriz comparativa com total ponderado 5) Riscos por vendor 6) Recomendação final com rationale. Formato: tabela + resumo executivo.', category: 'Operações', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-10', changes: 'Versão inicial.' }] },
  { id: 'mkt-23', name: 'Incident Report', slug: 'incident-report', description: 'Documenta incidentes com timeline, impacto, root cause e action items.', instructions: 'Documente o incidente: 1) Summary (o que aconteceu, quando, duração) 2) Impacto (usuários afetados, receita perdida, SLA breach) 3) Timeline detalhada (detecção → resposta → mitigação → resolução) 4) Root cause analysis (5 Whys) 5) Contributing factors 6) Action items com owner e deadline (imediatos + preventivos). Tom factual, sem blame.', category: 'Operações', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-15', changes: 'Versão inicial.' }] },

  // === JURÍDICO & COMPLIANCE ===
  { id: 'mkt-24', name: 'Contract Review', slug: 'contract-review', description: 'Revisa contratos identificando cláusulas de risco, termos desfavoráveis e gaps.', instructions: 'Revise o contrato: 1) Identifique cláusulas de risco alto (indemnification ilimitada, non-compete abusivo, IP assignment ampla, termination unilateral) 2) Termos fora do padrão de mercado 3) Gaps (SLA ausente, penalidades vagas, jurisdição desfavorável) 4) Exposição financeira máxima 5) Recomendações de negociação por prioridade 6) Redline sugerido das cláusulas críticas.', category: 'Jurídico', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-25', name: 'NDA Generator', slug: 'nda-generator', description: 'Gera NDAs bilaterais ou unilaterais customizados por contexto de negócio.', instructions: 'Gere o NDA: 1) Partes (nomes legais e jurisdição) 2) Tipo (unilateral ou mútuo) 3) Definição de informação confidencial (adapte ao contexto: tech, financeiro, comercial) 4) Exceções padrão 5) Prazo de confidencialidade 6) Obrigações de devolução/destruição 7) Penalidades 8) Foro. Linguagem jurídica profissional, adaptada à jurisdição informada.', category: 'Jurídico', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-26', name: 'Compliance Check', slug: 'compliance-check', description: 'Verifica conformidade com LGPD, GDPR, SOX ou ISO e gera gap analysis.', instructions: 'Execute compliance check: 1) Framework aplicável (LGPD/GDPR/SOX/ISO 27001/SOC2) 2) Mapeie controles existentes vs requisitos 3) Gap analysis (compliant/partial/non-compliant por requisito) 4) Risco associado a cada gap (alto/médio/baixo) 5) Plano de remediação com prazo e responsável 6) Quick wins vs projetos de médio prazo. Output: matriz de conformidade + executive summary.', category: 'Jurídico', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-27', name: 'Policy Drafter', slug: 'policy-drafter', description: 'Redige políticas corporativas (privacidade, segurança, uso aceitável, remote work).', instructions: 'Redija a política: 1) Objetivo e escopo (quem se aplica) 2) Definições de termos-chave 3) Diretrizes e regras (o que é permitido/proibido) 4) Responsabilidades por role (funcionário, gestor, TI, compliance) 5) Consequências de violação 6) Processo de exceção 7) Revisão e atualização (periodicidade). Linguagem clara e acessível, equilibrando rigor jurídico e compreensão.', category: 'Jurídico', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-05', changes: 'Versão inicial.' }] },

  // === TECNOLOGIA & PRODUTO ===
  { id: 'mkt-28', name: 'PRD Writer', slug: 'prd-writer', description: 'Escreve Product Requirements Document com problema, solução, métricas e escopo.', instructions: 'Escreva o PRD: 1) Problem statement (quem, o quê, por quê, impacto) 2) Hipótese e métricas de sucesso 3) User stories com acceptance criteria 4) Escopo (in/out) 5) Requisitos técnicos e não-funcionais 6) Wireframes/mockups (descrição textual) 7) Milestones e dependências 8) Riscos e mitigações. Formato para handoff para engenharia.', category: 'Produto', type: 'skill', version: '1.1', changelog: [{ version: '1.0', date: '2025-01-15', changes: 'Versão inicial.' }, { version: '1.1', date: '2025-04-05', changes: 'Melhorado formato de user stories e acceptance criteria.' }] },
  { id: 'mkt-29', name: 'Technical Spec', slug: 'technical-spec', description: 'Redige especificação técnica com arquitetura, APIs, banco de dados e trade-offs.', instructions: 'Escreva a tech spec: 1) Context e objetivo 2) Proposta de arquitetura (diagrama textual) 3) API design (endpoints, request/response schemas) 4) Data model (tabelas, relações, indexes) 5) Trade-offs considerados (alternativas descartadas e por quê) 6) Plano de migração se aplicável 7) Observability (logs, métricas, alertas) 8) Rollout plan (feature flags, canary).', category: 'Produto', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-30', name: 'Sprint Planning', slug: 'sprint-planning', description: 'Planeja sprint com estimativas, dependências e capacity allocation.', instructions: 'Planeje a sprint: 1) Goal da sprint (1-2 objectives alinhados ao roadmap) 2) Backlog priorizado com story points estimados 3) Capacity do time (dias disponíveis × velocity histórica) 4) Alocação por membro considerando especialidade 5) Dependências e riscos 6) Definição de done 7) Spillover assessment do sprint anterior. Output: sprint board com assignments.', category: 'Produto', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-10', changes: 'Versão inicial.' }] },
  { id: 'mkt-31', name: 'Code Review', slug: 'code-review', description: 'Analisa código com foco em bugs, segurança, performance e boas práticas.', instructions: 'Analise o código: 1) Bugs potenciais (null refs, race conditions, edge cases) 2) Vulnerabilidades de segurança (injection, XSS, auth bypass) 3) Performance (N+1, memory leaks, unnecessary allocations) 4) Boas práticas (naming, SRP, DRY, error handling) 5) Testabilidade 6) Sugestões de refactor. Priorize por severidade (critical/high/medium/low).', category: 'Produto', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-15', changes: 'Versão inicial.' }] },
  { id: 'mkt-32', name: 'Architecture Review', slug: 'architecture-review', description: 'Avalia arquitetura de sistemas com foco em escalabilidade, resiliência e custo.', instructions: 'Revise a arquitetura: 1) Componentes e responsabilidades 2) Pontos de falha (SPOF) 3) Escalabilidade (horizontal/vertical, bottlenecks) 4) Resiliência (retry, circuit breaker, fallbacks) 5) Custos operacionais projetados 6) Observability e debugging 7) Security posture 8) Tech debt acumulado. Output: diagrama + lista priorizada de melhorias.', category: 'Produto', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-20', changes: 'Versão inicial.' }] },

  // === SUPORTE AO CLIENTE ===
  { id: 'mkt-33', name: 'Ticket Triage', slug: 'ticket-triage', description: 'Classifica tickets por urgência, categoria e rota para o time correto.', instructions: 'Classifique o ticket: 1) Categoria (bug/feature request/how-to/billing/account) 2) Urgência (P1 critical/P2 high/P3 medium/P4 low) 3) Sentimento do cliente (frustrado/neutro/positivo) 4) Time responsável (suporte L1/L2/eng/billing/success) 5) Resposta inicial sugerida (tom empático, acknowledge, next steps) 6) SLA aplicável e deadline.', category: 'Suporte', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-34', name: 'Knowledge Base', slug: 'knowledge-base', description: 'Cria artigos de help center claros e pesquisáveis a partir de resoluções de tickets.', instructions: 'Crie o artigo: 1) Título claro e pesquisável (inclua como/por que/o que) 2) TL;DR (solução em 1-2 linhas) 3) Pré-requisitos 4) Steps com screenshots placeholders 5) Troubleshooting (se não funcionou, tente...) 6) FAQ relacionado. Linguagem simples, sem jargão técnico desnecessário. Otimize para self-service.', category: 'Suporte', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-35', name: 'CSAT Analysis', slug: 'csat-analysis', description: 'Analisa feedback de clientes, identifica temas recorrentes e recomenda ações.', instructions: 'Analise o feedback: 1) Score geral (CSAT/NPS/CES) e trend 2) Temas positivos recorrentes (o que valorizam) 3) Temas negativos recorrentes (top 5 complaints) 4) Segmentação por produto/plano/canal 5) Correlação com churn risk 6) Top 5 ações recomendadas por impacto no score. Formato: insights → ações → owners.', category: 'Suporte', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },

  // === GESTÃO DE PROJETOS ===
  { id: 'mkt-36', name: 'Project Charter', slug: 'project-charter', description: 'Cria charter de projeto com scope, stakeholders, riscos e governance.', instructions: 'Elabore o project charter: 1) Business case e justificativa 2) Objetivos SMART 3) Escopo (in/out boundaries) 4) Stakeholders e RACI 5) Timeline com milestones 6) Budget estimado 7) Riscos top 5 com mitigação 8) Critérios de sucesso 9) Governance (cadência de reports, escalação). Formato executivo para aprovação.', category: 'Projetos', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-37', name: 'Risk Assessment', slug: 'risk-assessment', description: 'Mapeia riscos do projeto com probabilidade, impacto e plano de mitigação.', instructions: 'Avalie os riscos: 1) Identifique riscos por categoria (técnico, recurso, prazo, budget, dependência, mercado) 2) Classifique probabilidade (1-5) e impacto (1-5) 3) Calcule exposure (P×I) 4) Defina response strategy (mitigate/transfer/accept/avoid) 5) Owner por risco 6) Trigger events e plano de contingência 7) Heatmap visual (descrição). Atualize semanalmente.', category: 'Projetos', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-38', name: 'Status Report', slug: 'status-report', description: 'Gera relatório de status semanal com RAG, progresso, blockers e decisões pendentes.', instructions: 'Gere o status report: 1) Overall RAG (Red/Amber/Green) com justificativa 2) Progresso vs plano (% complete, milestones hit) 3) Entregas da semana 4) Blockers e dependencies 5) Riscos atualizados 6) Decisões necessárias (de quem, até quando) 7) Plano para próxima semana. Formato: max 1 página, bullet points, RAG visual. Tom: factual sem sugar-coating.', category: 'Projetos', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-39', name: 'Retrospective', slug: 'retrospective', description: 'Facilita retrospectiva com categorização de temas e action items concretos.', instructions: 'Estruture a retro: 1) Formato (Start/Stop/Continue ou 4Ls ou Mad/Sad/Glad) 2) Agrupe inputs por tema 3) Vote e priorize (top 3 temas) 4) Para cada tema: root cause, action item, owner, deadline 5) Review de actions da retro anterior (done/not done) 6) Takeaways em 1 parágrafo. Output: ata com actions trackáveis.', category: 'Projetos', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-05', changes: 'Versão inicial.' }] },

  // === ESTRATÉGIA & LIDERANÇA ===
  { id: 'mkt-40', name: 'OKR Framework', slug: 'okr-framework', description: 'Define OKRs com objectives ambiciosos, key results mensuráveis e iniciativas.', instructions: 'Monte os OKRs: 1) Objective: aspiracional, qualitativo, inspirador (3-5 por trimestre) 2) Key Results: mensuráveis, com baseline → target, não binários (3-4 por objective) 3) Iniciativas: projetos/ações que movem os KRs 4) Alinhamento: como cada OKR conecta aos OKRs do nível acima 5) Health check: scoring guide (0.0-1.0) 6) Cadência de review. Evite: KRs que são tasks, objectives vagos.', category: 'Estratégia', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-15', changes: 'Versão inicial.' }] },
  { id: 'mkt-41', name: 'Competitive Analysis', slug: 'competitive-analysis', description: 'Mapeia concorrentes com positioning, features, pricing e vulnerabilidades.', instructions: 'Analise os concorrentes: 1) Overview (funding, team size, revenue estimate, growth) 2) Positioning e messaging 3) Feature comparison matrix 4) Pricing model e tiers 5) Go-to-market strategy 6) Pontos fortes (moats) 7) Vulnerabilidades exploráveis 8) Movimentos recentes (launches, pivots, acquisitions) 9) Recomendações de diferenciação.', category: 'Estratégia', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-42', name: 'Board Deck', slug: 'board-deck', description: 'Prepara deck para board meeting com financials, métricas, roadmap e asks.', instructions: 'Monte o board deck: 1) Highlights do período (3-5 bullets) 2) Financials: revenue, burn, runway, vs forecast 3) KPIs: growth rate, retention, NPS, pipeline 4) Product: shipped, roadmap next quarter 5) Team: headcount, key hires, attrition 6) Risks e challenges 7) Asks: approvals, budget, strategic decisions. Formato: 12-15 slides, data-heavy, conciso. Um slide = um message.', category: 'Estratégia', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-43', name: 'Market Research', slug: 'market-research', description: 'Pesquisa de mercado com TAM/SAM/SOM, trends e oportunidades de entrada.', instructions: 'Pesquise o mercado: 1) TAM/SAM/SOM com fontes e metodologia 2) Growth rate e CAGR 3) Segmentação (geography, vertical, company size) 4) Key players e market share 5) Trends e disruptors 6) Regulatory landscape 7) Buyer journey e decision criteria 8) Barriers to entry 9) Oportunidades de timing (why now). Cite fontes e datas dos dados.', category: 'Estratégia', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-30', changes: 'Versão inicial.' }] },

  // === COMUNICAÇÃO & ESCRITA ===
  { id: 'mkt-44', name: 'Email Drafter', slug: 'email-drafter', description: 'Redige emails profissionais com tom adequado ao contexto e objetivo claro.', instructions: 'Redija o email: 1) Subject line compelling (max 50 chars) 2) Abertura contextual (1 linha) 3) Corpo com propósito claro (problema/pedido/informação) 4) CTA específico (o que você precisa, até quando) 5) Fechamento profissional. Adapte tom: interno=direto, cliente=empático, C-level=conciso, parceiro=colaborativo. Max 150 palavras exceto se complexo.', category: 'Comunicação', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-20', changes: 'Versão inicial.' }] },
  { id: 'mkt-45', name: 'Presentation Writer', slug: 'presentation-writer', description: 'Cria estrutura de apresentação com storytelling, dados e recomendações.', instructions: 'Estruture a apresentação: 1) Narrative arc (situation → complication → resolution) 2) Outline de slides com título + key message cada 3) Data points e visualizações sugeridas por slide 4) Speaker notes com talking points 5) Appendix de backup slides. Regras: 1 ideia por slide, títulos assertivos (não descritivos), pyramid principle para argumentação.', category: 'Comunicação', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-25', changes: 'Versão inicial.' }] },
  { id: 'mkt-46', name: 'Meeting Facilitator', slug: 'meeting-facilitator', description: 'Estrutura agendas, facilita decisões e documenta outputs de reuniões.', instructions: 'Facilite a reunião: 1) Agenda com tempo por tópico e owner 2) Objetivo claro (informar/discutir/decidir) por item 3) Pre-read: contexto mínimo para decisão informada 4) Durante: capture decisões, action items (quem/o quê/quando), parking lot 5) Output: ata em max 10 bullets com decisions + actions + next steps. Formato que permite async review.', category: 'Comunicação', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-47', name: 'Crisis Communication', slug: 'crisis-communication', description: 'Redige comunicações de crise para stakeholders internos e externos.', instructions: 'Redija a comunicação de crise: 1) Para quem (clientes/funcionários/imprensa/investidores) 2) O que aconteceu (fatos, sem especulação) 3) Impacto no stakeholder 4) O que estamos fazendo 5) Timeline de resolução 6) Como acompanhar updates 7) Pedido de desculpas se aplicável. Tom: transparente, accountability, empático. Evite: minimizar, culpar terceiros, linguagem legal defensiva.', category: 'Comunicação', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-05', changes: 'Versão inicial.' }] },

  // === DADOS & ANALYTICS ===
  { id: 'mkt-48', name: 'Dashboard Design', slug: 'dashboard-design', description: 'Projeta dashboards com hierarquia de métricas, layout e regras de alerta.', instructions: 'Projete o dashboard: 1) Audiência e perguntas que precisa responder 2) Hierarquia de métricas (North Star → supporting → diagnostic) 3) Layout: KPIs no topo, trends no meio, detalhamento embaixo 4) Filtros necessários (período, segmento, produto) 5) Regras de cor e alertas (verde/amarelo/vermelho) 6) Refresh rate e data source 7) Mobile-friendly considerations.', category: 'Dados', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-01-30', changes: 'Versão inicial.' }] },
  { id: 'mkt-49', name: 'Data Quality Audit', slug: 'data-quality-audit', description: 'Audita qualidade dos dados: completude, consistência, freshness e duplicatas.', instructions: 'Audite a qualidade dos dados: 1) Completude (% de nulls por campo crítico) 2) Consistência (formatos, ranges válidos, referential integrity) 3) Unicidade (duplicatas, near-duplicates) 4) Freshness (lag entre evento e disponibilidade) 5) Accuracy (amostragem vs fonte de verdade) 6) Score geral por tabela/dataset 7) Top 10 issues com impacto no negócio 8) Plano de correção prioritizado.', category: 'Dados', type: 'workflow', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-01', changes: 'Versão inicial.' }] },
  { id: 'mkt-50', name: 'KPI Definition', slug: 'kpi-definition', description: 'Define KPIs com fórmula, fonte, owner, meta e cadência de review.', instructions: 'Defina os KPIs: Para cada métrica: 1) Nome e definição unambígua 2) Fórmula exata (numerador/denominador, inclusões/exclusões) 3) Fonte de dados e tabela 4) Granularidade (daily/weekly/monthly) 5) Owner e stakeholders 6) Target e thresholds (verde/amarelo/vermelho) 7) Ações prescritas por threshold 8) Cadência de review. Evite: vanity metrics, KPIs sem ação associada.', category: 'Dados', type: 'skill', version: '1.0', changelog: [{ version: '1.0', date: '2025-02-05', changes: 'Versão inicial.' }] },
];

const PAGE_SIZE = 20;

const SKILL_DEPENDENCIES: Record<string, string[]> = {
  'slack-daily-digest': ['Slack'],
  'pipeline-review': ['CRM', 'Google Sheets'],
  'financial-report': ['Google Sheets'],
  'csat-analysis': ['Intercom', 'Zendesk'],
};

// Star Rating Component
function StarRating({ rating, onRate, size = 'sm' }: { rating: number; onRate?: (r: number) => void; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'text-xs' : 'text-base';
  return (
    <span className={`inline-flex gap-0.5 ${sizeClass}`}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={(e) => { e.stopPropagation(); onRate?.(star); }}
          className={`${onRate ? 'cursor-pointer hover:scale-110' : ''} transition-transform ${star <= rating ? 'text-yellow-400' : 'text-gray-400/40'}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function Marketplace() {
  const [tab, setTab] = useState<MktTab>('skills');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<MarketplaceItem | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState<MarketplaceItem | null>(null);
  const [usageCount, setUsageCount] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [rollbackData, setRollbackData] = useState<Record<string, { instructions: string; ts: number }>>({});
  const [depWarning, setDepWarning] = useState<{ item: MarketplaceItem; missing: string[] } | null>(null);

  // Cross-menu integration: toast for install success
  const [installToast, setInstallToast] = useState<string | null>(null);

  // Feature 1: Ratings
  const [ratings, setRatings] = useState<Record<string, number[]>>({});

  // Feature 2: Auto-update versions
  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>({});

  // Feature 3: Changelog modal
  const [showChangelog, setShowChangelog] = useState(false);

  // Feature 5: Show packs
  const [showPacks, setShowPacks] = useState(false);

  // Feature 6: Simulation modal
  const [showSimulation, setShowSimulation] = useState(false);

  // Feature 7: Comparison
  const [compareItems, setCompareItems] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  // Feature 8: Compatibility filter
  const [onlyCompatible, setOnlyCompatible] = useState(false);
  const [connectedSources, setConnectedSources] = useState<string[]>([]);

  // NEW Feature 1: Collections filter
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  // NEW Feature 2: Popularity badge (>100 downloads) — uses downloadCounts

  // NEW Feature 3: Release notes expansion
  const [expandedReleaseNotes, setExpandedReleaseNotes] = useState<string | null>(null);

  // NEW Feature 4: Uninstall with cleanup
  const [cleanupOnUninstall, setCleanupOnUninstall] = useState(false);

  // NEW Feature 5: Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // NEW Feature 6: View mode (grid/list)
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // NEW Feature 7: Sort option
  const [sortOption, setSortOption] = useState<SortOption>('name');

  // NEW Feature 8: Monthly usage report
  const [usageStats, setUsageStats] = useState<UsageStats>({ itemsInstalled: 0, updatesApplied: 0, spaceUsedKB: 0, month: '' });
  const [showUsageReport, setShowUsageReport] = useState(false);

  // Feature 34: Publisher profiles
  const [showPublisher, setShowPublisher] = useState<PublisherProfile | null>(null);

  // NEW: Multi-select bulk install
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  // NEW: Saved filter views
  const [savedViews, setSavedViews] = useState<Array<{ name: string; category: string | null; collection: string | null; sort: SortOption; favOnly: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem('marketplace-saved-views') || '[]'); } catch { return []; }
  });
  const [showSaveView, setShowSaveView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // NEW: Animated transitions
  const [animatingItems, setAnimatingItems] = useState<Set<string>>(new Set());

  // NEW: Recently installed section
  const [recentInstalls, setRecentInstalls] = useState<Array<{ slug: string; timestamp: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('marketplace-recent-installs') || '[]'); } catch { return []; }
  });

  // NEW: Version diff expanded
  const [versionDiffExpanded, setVersionDiffExpanded] = useState<string | null>(null);

  // NEW: Publisher tooltip hover
  const [hoveredPublisher, setHoveredPublisher] = useState<string | null>(null);

  // Feature 35: Beta/preview channel
  const [betaOptIn, setBetaOptIn] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('marketplace-beta-optin');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [showBetaOnly, setShowBetaOnly] = useState(false);

  const categories = ['Marketing', 'Vendas', 'Finanças', 'RH', 'Operações', 'Jurídico', 'Produto', 'Suporte', 'Projetos', 'Estratégia', 'Comunicação', 'Dados'];

  useEffect(() => { checkInstalled(); loadUsage(); loadRatings(); loadVersions(); loadConnections(); loadFavorites(); loadUsageStats(); }, []);

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

  const loadUsage = async () => {
    try {
      const counts = await ados.db.getSkillUsageCounts?.() || {};
      setUsageCount(counts);
    } catch { /* no usage data */ }
  };

  const loadRatings = () => {
    try {
      const stored = localStorage.getItem('marketplace-ratings');
      if (stored) setRatings(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const loadVersions = () => {
    try {
      const stored = localStorage.getItem('marketplace-installed-versions');
      if (stored) setInstalledVersions(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const loadConnections = async () => {
    try {
      const sources = await ados.ipc?.getConnections?.() || [];
      const types = sources.map((s: any) => s.type || s.category || '').filter(Boolean);
      setConnectedSources(types);
    } catch { /* ignore */ }
  };

  // NEW: Load favorites from localStorage
  const loadFavorites = () => {
    try {
      const stored = localStorage.getItem('marketplace-favorites');
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch { /* ignore */ }
  };

  // NEW: Toggle favorite
  const toggleFavorite = useCallback((slug: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      localStorage.setItem('marketplace-favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // NEW: Load usage stats
  const loadUsageStats = () => {
    try {
      const stored = localStorage.getItem('marketplace-usage-stats');
      if (stored) {
        setUsageStats(JSON.parse(stored));
      } else {
        const now = new Date();
        const stats: UsageStats = { itemsInstalled: 0, updatesApplied: 0, spaceUsedKB: 0, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
        setUsageStats(stats);
      }
    } catch { /* ignore */ }
  };

  // NEW: Track usage stat
  const trackUsageStat = useCallback((key: 'itemsInstalled' | 'updatesApplied', increment: number = 1) => {
    setUsageStats(prev => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const base = prev.month === currentMonth ? prev : { itemsInstalled: 0, updatesApplied: 0, spaceUsedKB: 0, month: currentMonth };
      const updated = { ...base, [key]: base[key] + increment, spaceUsedKB: base.spaceUsedKB + Math.floor(Math.random() * 50 + 10) };
      localStorage.setItem('marketplace-usage-stats', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Feature 34: Get publisher for item
  const getPublisher = useCallback((slug: string): PublisherProfile | undefined => {
    return publishers.find(p => p.slugs.includes(slug));
  }, []);

  // Feature 35: Toggle beta opt-in
  const toggleBetaOptIn = useCallback((slug: string) => {
    setBetaOptIn(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      localStorage.setItem('marketplace-beta-optin', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // NEW: Bulk install handler
  const handleBulkInstall = useCallback(async () => {
    for (const slug of Array.from(bulkSelected)) {
      const item = catalog.find(i => i.slug === slug);
      if (item && !installed.has(slug)) {
        setAnimatingItems(prev => new Set([...prev, slug]));
        await handleInstall(item);
        // Track recent install
        const entry = { slug, timestamp: new Date().toISOString() };
        setRecentInstalls(prev => {
          const updated = [entry, ...prev.filter(r => r.slug !== slug)].slice(0, 5);
          localStorage.setItem('marketplace-recent-installs', JSON.stringify(updated));
          return updated;
        });
        setTimeout(() => setAnimatingItems(prev => { const n = new Set(prev); n.delete(slug); return n; }), 500);
      }
    }
    setBulkSelected(new Set());
    setBulkSelectMode(false);
  }, [bulkSelected, installed]);

  // NEW: Toggle bulk select
  const toggleBulkSelect = useCallback((slug: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }, []);

  // NEW: Save current filter view
  const handleSaveView = useCallback(() => {
    if (!newViewName.trim()) return;
    const view = { name: newViewName.trim(), category: activeCategory, collection: activeCollection, sort: sortOption, favOnly: showFavoritesOnly };
    const updated = [...savedViews, view];
    setSavedViews(updated);
    localStorage.setItem('marketplace-saved-views', JSON.stringify(updated));
    setNewViewName('');
    setShowSaveView(false);
  }, [newViewName, activeCategory, activeCollection, sortOption, showFavoritesOnly, savedViews]);

  // NEW: Restore a saved view
  const handleRestoreView = useCallback((view: typeof savedViews[0]) => {
    setActiveCategory(view.category);
    setActiveCollection(view.collection);
    setSortOption(view.sort);
    setShowFavoritesOnly(view.favOnly);
    setShowPacks(false);
  }, []);

  // NEW: Delete saved view
  const handleDeleteView = useCallback((idx: number) => {
    const updated = savedViews.filter((_, i) => i !== idx);
    setSavedViews(updated);
    localStorage.setItem('marketplace-saved-views', JSON.stringify(updated));
  }, [savedViews]);

  // NEW: Search term highlighting
  const highlightTerm = useCallback((text: string, term: string): ReactElement => {
    if (!term.trim()) return <>{text}</>;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return <>{parts.map((p, i) => regex.test(p) ? <strong key={i} className="text-brand-500 font-semibold">{p}</strong> : <span key={i}>{p}</span>)}</>;
  }, []);

  // NEW: Rating histogram
  const getRatingHistogram = useCallback((slug: string): number[] => {
    const r = ratings[slug];
    if (!r || r.length === 0) return [0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0];
    r.forEach(v => { if (v >= 1 && v <= 5) counts[v - 1]++; });
    return counts;
  }, [ratings]);

  // NEW: Get dependency suggestions for an item
  const getDependencySuggestions = useCallback((item: MarketplaceItem): MarketplaceItem[] => {
    // Suggest items from same category that are installed
    const sameCat = catalog.filter(i => i.category === item.category && i.slug !== item.slug && !installed.has(i.slug));
    return sameCat.slice(0, 2);
  }, [installed]);

  // NEW: Track install in recents
  const handleInstallWithRecent = useCallback(async (item: MarketplaceItem) => {
    setAnimatingItems(prev => new Set([...prev, item.slug]));
    await handleInstallWithCheck(item);
    const entry = { slug: item.slug, timestamp: new Date().toISOString() };
    setRecentInstalls(prev => {
      const updated = [entry, ...prev.filter(r => r.slug !== item.slug)].slice(0, 5);
      localStorage.setItem('marketplace-recent-installs', JSON.stringify(updated));
      return updated;
    });
    setTimeout(() => setAnimatingItems(prev => { const n = new Set(prev); n.delete(item.slug); return n; }), 500);
  }, []);

  // NEW: Sort items
  const sortItems = useCallback((items: MarketplaceItem[]): MarketplaceItem[] => {
    return [...items].sort((a, b) => {
      switch (sortOption) {
        case 'name': return a.name.localeCompare(b.name);
        case 'downloads': return (downloadCounts[b.slug] || 0) - (downloadCounts[a.slug] || 0);
        case 'rating': return getAverageRating(b.slug) - getAverageRating(a.slug);
        case 'date': return a.id.localeCompare(b.id);
        case 'updated': {
          const aLog = a.changelog?.[a.changelog.length - 1]?.date || '2025-01-01';
          const bLog = b.changelog?.[b.changelog.length - 1]?.date || '2025-01-01';
          return bLog.localeCompare(aLog);
        }
        default: return 0;
      }
    });
  }, [sortOption, ratings]);

  const saveRating = (slug: string, rating: number) => {
    const updated = { ...ratings };
    if (!updated[slug]) updated[slug] = [];
    updated[slug].push(rating);
    setRatings(updated);
    localStorage.setItem('marketplace-ratings', JSON.stringify(updated));
  };

  const getAverageRating = (slug: string): number => {
    const r = ratings[slug];
    if (!r || r.length === 0) return 0;
    return Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10;
  };

  const saveInstalledVersion = (slug: string, version: string) => {
    const updated = { ...installedVersions, [slug]: version };
    setInstalledVersions(updated);
    localStorage.setItem('marketplace-installed-versions', JSON.stringify(updated));
  };

  const hasUpdate = (item: MarketplaceItem): boolean => {
    if (!installed.has(item.slug)) return false;
    const iv = installedVersions[item.slug];
    if (!iv) return false;
    return iv !== item.version;
  };

  const handleUpdate = async (item: MarketplaceItem) => {
    // Reinstall with new version
    await handleUninstall(item);
    await handleInstall(item);
    saveInstalledVersion(item.slug, item.version);
    trackUsageStat('updatesApplied');
  };

  const checkDependencies = (item: MarketplaceItem): string[] => {
    const deps = SKILL_DEPENDENCIES[item.slug];
    if (!deps) return [];
    return deps;
  };

  const handleInstallWithCheck = async (item: MarketplaceItem) => {
    const missing = checkDependencies(item);
    if (missing.length > 0) {
      setDepWarning({ item, missing });
      return;
    }
    handleInstall(item);
  };

  const handleInstall = async (item: MarketplaceItem) => {
    const id = crypto.randomUUID();
    if (item.type === 'skill') {
      await ados.db.addSkill(id, item.name, item.slug, item.description, item.instructions);
    } else {
      await ados.db.addWorkflow(id, item.name, item.slug, item.description, item.instructions);
    }
    setInstalled(new Set([...installed, item.slug]));
    setRollbackData(prev => ({ ...prev, [item.slug]: { instructions: item.instructions, ts: Date.now() } }));
    saveInstalledVersion(item.slug, item.version);
    trackUsageStat('itemsInstalled');
    // Cross-menu integration: notify Tools page
    window.dispatchEvent(new CustomEvent('marketplace:installed', { detail: { type: item.type, name: item.name } }));
    setInstallToast(`Instalado! Disponível em Ferramentas`);
    setTimeout(() => setInstallToast(null), 3000);
  };

  const handleInstallBundle = async (bundle: Bundle) => {
    for (const slug of bundle.slugs) {
      if (!installed.has(slug)) {
        const item = catalog.find(i => i.slug === slug);
        if (item) await handleInstall(item);
      }
    }
  };

  const handleRollback = async (item: MarketplaceItem) => {
    await handleUninstall(item);
    setRollbackData(prev => {
      const next = { ...prev };
      delete next[item.slug];
      return next;
    });
  };

  const handleUninstall = async (item: MarketplaceItem, withCleanup: boolean = false) => {
    const [skills, workflows] = await Promise.all([
      ados.db.getSkills(),
      ados.db.getWorkflows(),
    ]);
    if (item.type === 'skill') {
      const match = skills.find((s: any) => s.slug === item.slug);
      if (match) await ados.db.deleteSkill(match.id);
    } else {
      const match = workflows.find((w: any) => w.slug === item.slug);
      if (match) await ados.db.deleteWorkflow(match.id);
    }
    const next = new Set(installed);
    next.delete(item.slug);
    setInstalled(next);
    // NEW Feature 4: Cleanup associated data
    if (withCleanup) {
      localStorage.removeItem(`skill-config-${item.slug}`);
      localStorage.removeItem(`skill-data-${item.slug}`);
      // Remove from ratings
      const updatedRatings = { ...ratings };
      delete updatedRatings[item.slug];
      setRatings(updatedRatings);
      localStorage.setItem('marketplace-ratings', JSON.stringify(updatedRatings));
      // Remove installed version
      const updatedVersions = { ...installedVersions };
      delete updatedVersions[item.slug];
      setInstalledVersions(updatedVersions);
      localStorage.setItem('marketplace-installed-versions', JSON.stringify(updatedVersions));
      // Remove from favorites
      if (favorites.has(item.slug)) {
        toggleFavorite(item.slug);
      }
    }
  };

  const toggleCompare = (slug: string) => {
    const next = new Set(compareItems);
    if (next.has(slug)) {
      next.delete(slug);
    } else if (next.size < 2) {
      next.add(slug);
    }
    setCompareItems(next);
  };

  // Feature 4: Recommendations
  const getRecommendations = (): MarketplaceItem[] => {
    const installedSlugs = Array.from(installed);
    if (installedSlugs.length === 0) return [];

    // Find most-used installed skill's category
    let topSlug = installedSlugs[0];
    let topCount = 0;
    for (const slug of installedSlugs) {
      const count = usageCount[slug] || 0;
      if (count > topCount) {
        topCount = count;
        topSlug = slug;
      }
    }

    const topItem = catalog.find(i => i.slug === topSlug);
    if (!topItem) return [];

    const tabType = tab === 'skills' ? 'skill' : 'workflow';
    return catalog
      .filter(i => i.category === topItem.category && !installed.has(i.slug) && i.type === tabType)
      .slice(0, 3);
  };

  // Feature 8: Compatibility filter logic
  const getCompatibleCategories = (): Set<string> => {
    const cats = new Set<string>();
    // From connected sources
    for (const src of connectedSources) {
      cats.add(src);
    }
    // From installed skill categories
    for (const slug of Array.from(installed)) {
      const item = catalog.find(i => i.slug === slug);
      if (item) cats.add(item.category);
    }
    return cats;
  };

  const filtered = catalog.filter(item => {
    const tabType = tab === 'skills' ? 'skill' : 'workflow';
    if (item.type !== tabType) return false;
    if (activeCategory === 'Packs') return false; // Packs handled separately
    if (activeCategory && activeCategory !== 'Packs' && item.category !== activeCategory) return false;
    if (search && !fuzzyMatch(item.name, search) && !fuzzyMatch(item.description, search)) return false;
    if (onlyCompatible) {
      const compatCats = getCompatibleCategories();
      if (compatCats.size > 0 && !compatCats.has(item.category)) return false;
    }
    // NEW Feature 1: Collection filter
    if (activeCollection) {
      const col = collections.find(c => c.id === activeCollection);
      if (col && !col.slugs.includes(item.slug)) return false;
    }
    // NEW Feature 5: Favorites filter
    if (showFavoritesOnly && !favorites.has(item.slug)) return false;
    // Feature 35: Beta channel filter
    if (showBetaOnly) {
      const ch = betaChannelItems[item.slug];
      if (!ch || ch.channel === 'stable') return false;
    }
    return true;
  });

  const installedItems = sortItems(filtered.filter(i => installed.has(i.slug)));
  const allAvailable = sortItems(filtered.filter(i => !installed.has(i.slug)));
  const totalPages = Math.ceil(allAvailable.length / PAGE_SIZE);
  const availableItems = allAvailable.slice(0, page * PAGE_SIZE);
  const recommendations = getRecommendations();

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
              Skills ({catalog.filter(i => i.type === 'skill').length})
            </button>
            <button
              onClick={() => setTab('workflows')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'workflows' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
              }`}
            >
              Workflows ({catalog.filter(i => i.type === 'workflow').length})
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-primary">Marketplace</h1>
          <p className="text-sm text-muted mt-1">50 skills e workflows para todas as áreas da empresa.</p>
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
          {/* Feature 8: Compatibility toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyCompatible}
              onChange={(e) => setOnlyCompatible(e.target.checked)}
              className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-600"
            />
            <span className="text-xs text-secondary whitespace-nowrap">So compativeis</span>
          </label>
          {/* NEW Feature 5: Favorites filter */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${showFavoritesOnly ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-surface-2 hover:bg-surface-3 text-secondary border border-default'}`}
          >
            ♥ Favoritos
          </button>
          {/* NEW Feature 7: Sort dropdown */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-3 py-1.5 rounded-lg text-xs bg-surface-1 border border-default text-secondary outline-none cursor-pointer"
          >
            <option value="name">Ordenar: Nome</option>
            <option value="date">Ordenar: Data</option>
            <option value="downloads">Ordenar: Downloads</option>
            <option value="rating">Ordenar: Rating</option>
            <option value="updated">Ordenar: Atualizacao</option>
          </select>
          {/* NEW Feature 6: View mode toggle */}
          <div className="flex bg-surface-1 border border-default rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-brand-600 text-white' : 'text-secondary hover:text-primary'}`}
              title="Grid"
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1.5 text-xs transition-colors ${viewMode === 'list' ? 'bg-brand-600 text-white' : 'text-secondary hover:text-primary'}`}
              title="Lista"
            >
              ☰
            </button>
          </div>
          {/* NEW Feature 8: Usage report toggle */}
          <button
            onClick={() => setShowUsageReport(!showUsageReport)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${showUsageReport ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary border border-default'}`}
          >
            Uso
          </button>
          {/* Feature 35: Beta channel filter */}
          <button
            onClick={() => setShowBetaOnly(!showBetaOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${showBetaOnly ? 'bg-purple-500/10 text-purple-500 border border-purple-500/30' : 'bg-surface-2 hover:bg-surface-3 text-secondary border border-default'}`}
          >
            Beta
          </button>
          {/* NEW: Bulk select mode toggle */}
          <button
            onClick={() => { setBulkSelectMode(!bulkSelectMode); setBulkSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${bulkSelectMode ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-surface-2 hover:bg-surface-3 text-secondary border border-default'}`}
          >
            Multi
          </button>
          {/* NEW: Save view */}
          <button
            onClick={() => setShowSaveView(!showSaveView)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap bg-surface-2 hover:bg-surface-3 text-secondary border border-default"
          >
            Salvar filtro
          </button>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          <button
            onClick={() => { setActiveCategory(null); setShowPacks(false); }}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${!activeCategory && !showPacks ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
          >
            Todos
          </button>
          {/* Feature 5: Packs pill */}
          <button
            onClick={() => { setShowPacks(true); setActiveCategory('Packs'); }}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${activeCategory === 'Packs' ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
          >
            ⬢ Packs ({bundles.length})
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => { setActiveCategory(activeCategory === c ? null : c); setShowPacks(false); setActiveCollection(null); }}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${activeCategory === c ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
            >
              {categoryIcons[c]} {c} ({catalog.filter(i => i.category === c).length})
            </button>
          ))}
        </div>
        {/* NEW Feature 1: Collections filter */}
        <div className="flex gap-2 mt-2 flex-wrap">
          <span className="text-[10px] text-muted uppercase font-semibold self-center mr-1">Colecoes:</span>
          {collections.map(col => (
            <button
              key={col.id}
              onClick={() => { setActiveCollection(activeCollection === col.id ? null : col.id); setActiveCategory(null); setShowPacks(false); }}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${activeCollection === col.id ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
            >
              {col.icon} {col.name}
            </button>
          ))}
        </div>
        {/* NEW: Saved filter views */}
        {savedViews.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <span className="text-[10px] text-muted uppercase font-semibold mr-1">Views:</span>
            {savedViews.map((view, idx) => (
              <div key={idx} className="flex items-center gap-0.5">
                <button
                  onClick={() => handleRestoreView(view)}
                  className="px-2.5 py-1 rounded-full text-xs bg-surface-2 hover:bg-surface-3 text-secondary transition-colors"
                >
                  {view.name}
                </button>
                <button onClick={() => handleDeleteView(idx)} className="text-[10px] text-red-500 hover:text-red-400 px-0.5">x</button>
              </div>
            ))}
          </div>
        )}
        {showSaveView && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="Nome da view..."
              className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-40"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); }}
            />
            <button onClick={handleSaveView} disabled={!newViewName.trim()} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium">Salvar</button>
            <button onClick={() => setShowSaveView(false)} className="text-xs text-muted hover:text-secondary">Cancelar</button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {/* Feature 5: Packs view */}
        {showPacks && activeCategory === 'Packs' && (
          <>
            <h2 className="text-sm font-semibold text-secondary mt-4 mb-2">Packs disponíveis</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {bundles.map(bundle => {
                const bundleItems = bundle.slugs.map(s => catalog.find(i => i.slug === s)).filter(Boolean) as MarketplaceItem[];
                const allInstalled = bundle.slugs.every(s => installed.has(s));
                const someInstalled = bundle.slugs.some(s => installed.has(s));
                return (
                  <div key={bundle.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-lg mr-2">{bundle.icon}</span>
                        <span className="text-sm font-medium text-primary">{bundle.name}</span>
                        <span className="ml-2 text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{bundle.slugs.length} items</span>
                      </div>
                      {allInstalled ? (
                        <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-lg text-xs font-medium">Instalado</span>
                      ) : (
                        <button
                          onClick={() => handleInstallBundle(bundle)}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                        >
                          {someInstalled ? 'Completar Pack' : 'Instalar Pack'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted mb-3">{bundle.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {bundleItems.map(item => (
                        <span key={item.slug} className={`text-[10px] px-2 py-0.5 rounded-full ${installed.has(item.slug) ? 'bg-green-500/10 text-green-500' : 'bg-surface-2 text-muted'}`}>
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!showPacks && (
          <>
            {/* NEW Feature 8: Monthly Usage Report card */}
            {showUsageReport && (
              <div className="bg-surface-1 border border-default rounded-2xl p-5 mt-4 mb-4">
                <h3 className="text-sm font-semibold text-primary mb-3">Relatorio de Uso Mensal — {usageStats.month || 'N/A'}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-surface-2 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-brand-600">{usageStats.itemsInstalled}</p>
                    <p className="text-[10px] text-muted mt-1">Items instalados</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-brand-600">{usageStats.updatesApplied}</p>
                    <p className="text-[10px] text-muted mt-1">Atualizacoes aplicadas</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-brand-600">{(usageStats.spaceUsedKB / 1024).toFixed(1)} MB</p>
                    <p className="text-[10px] text-muted mt-1">Espaco usado</p>
                  </div>
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-sm text-muted">Nenhum item encontrado para os filtros selecionados.</p>
              </div>
            )}

            {/* Feature 4: Recommendations */}
            {recommendations.length > 0 && !search && !activeCategory && (
              <>
                <h2 className="text-sm font-semibold text-secondary mt-4 mb-2">Sugerido para voce ({recommendations.length})</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {recommendations.map((item) => (
                    <div key={`rec-${item.id}`} className="bg-surface-1 border border-brand-600/20 rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow ring-1 ring-brand-600/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="cursor-pointer" onClick={() => setPreviewItem(item)}>
                          <span className="text-sm font-medium text-primary">{item.name}</span>
                          <span className="ml-2 text-[10px] px-2 py-0.5 bg-brand-600/10 text-brand-600 rounded-full">Sugerido</span>
                        </div>
                        <button
                          onClick={() => handleInstallWithCheck(item)}
                          className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                        >
                          Instalar
                        </button>
                      </div>
                      <p className="text-xs text-muted line-clamp-2">{item.description}</p>
                      {getAverageRating(item.slug) > 0 && (
                        <div className="mt-2">
                          <StarRating rating={Math.round(getAverageRating(item.slug))} />
                          <span className="text-[10px] text-muted ml-1">{getAverageRating(item.slug)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {installedItems.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-secondary mt-4 mb-2">Instalados ({installedItems.length})</h2>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-2'}>
                  {installedItems.map((item) => (
                    <div key={item.id} className={`bg-surface-1 border border-brand-600/30 shadow-card hover:shadow-card-hover transition-shadow ${viewMode === 'grid' ? 'rounded-2xl p-5' : 'rounded-xl p-3 flex items-center gap-4'}`}>
                      <div className={`flex items-start justify-between ${viewMode === 'grid' ? 'mb-2' : 'flex-1'}`}>
                        <div className="cursor-pointer flex items-center gap-1" onClick={() => setPreviewItem(item)}>
                          {/* NEW Feature 5: Favorite button */}
                          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.slug); }} className={`text-sm transition-colors ${favorites.has(item.slug) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>♥</button>
                          <span className="text-sm font-medium text-primary">{item.name}</span>
                          <span className="ml-2 text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{categoryIcons[item.category] || ''} {item.category}</span>
                          {/* NEW Feature 2: Popularity badge */}
                          {(downloadCounts[item.slug] || 0) > 100 && (
                            <span className="ml-1 text-[10px] px-2 py-0.5 bg-yellow-500/15 text-yellow-600 rounded-full font-medium">● Popular</span>
                          )}
                          {/* Feature 2: Update badge */}
                          {hasUpdate(item) && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 bg-orange-500/15 text-orange-500 rounded-full font-medium">Update v{item.version}</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {hasUpdate(item) && (
                            <button
                              onClick={() => handleUpdate(item)}
                              className="px-3 py-1 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs text-white font-medium transition-colors"
                            >
                              Atualizar
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmUninstall(item)}
                            className="px-3 py-1 bg-surface-2 hover:bg-red-500/10 hover:text-red-500 border border-default rounded-lg text-xs text-secondary font-medium transition-colors"
                          >
                            Desinstalar
                          </button>
                        </div>
                      </div>
                      {viewMode === 'grid' && (
                        <>
                          <p className="text-xs text-muted line-clamp-2 cursor-pointer" onClick={() => setPreviewItem(item)}>{item.description}</p>
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                              {item.type === 'skill' ? '/' : '@'}{item.slug}
                            </span>
                            <span className="text-[10px] text-muted">v{installedVersions[item.slug] || item.version}</span>
                            {usageCount[item.slug] && (
                              <span className="text-[10px] text-muted">{usageCount[item.slug]}x usado</span>
                            )}
                            {(downloadCounts[item.slug] || 0) > 0 && (
                              <span className="text-[10px] text-muted">{downloadCounts[item.slug]} downloads</span>
                            )}
                            {rollbackData[item.slug] && (
                              <button onClick={() => handleRollback(item)} className="text-[10px] text-yellow-500 hover:underline">Rollback</button>
                            )}
                          </div>
                          {/* Feature 1: Rating for installed items */}
                          <div className="mt-2 flex items-center gap-2">
                            <StarRating rating={Math.round(getAverageRating(item.slug))} onRate={(r) => saveRating(item.slug, r)} />
                            {getAverageRating(item.slug) > 0 && (
                              <span className="text-[10px] text-muted">{getAverageRating(item.slug)}</span>
                            )}
                          </div>
                          {/* NEW Feature 3: Release notes expandable */}
                          {releaseNotesData[item.slug] && (
                            <div className="mt-2">
                              <button
                                onClick={() => setExpandedReleaseNotes(expandedReleaseNotes === item.slug ? null : item.slug)}
                                className="text-[10px] text-brand-600 hover:underline"
                              >
                                {expandedReleaseNotes === item.slug ? 'Ocultar' : 'Ver'} notas de release
                              </button>
                              {expandedReleaseNotes === item.slug && (
                                <div className="mt-2 bg-surface-2 rounded-lg p-3 space-y-2">
                                  {Object.entries(releaseNotesData[item.slug]).map(([ver, note]) => (
                                    <div key={ver} className="border-l-2 border-brand-600/30 pl-2">
                                      <span className="text-[10px] font-semibold text-primary">v{ver}</span>
                                      <p className="text-[10px] text-muted">{note}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* NEW: Recently installed section */}
            {recentInstalls.length > 0 && !search && !activeCategory && (
              <>
                <h2 className="text-sm font-semibold text-secondary mt-4 mb-2">Instalados recentemente</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 mb-2">
                  {recentInstalls.map(ri => {
                    const item = catalog.find(i => i.slug === ri.slug);
                    if (!item) return null;
                    return (
                      <div key={ri.slug} className="bg-surface-1 border border-brand-600/20 rounded-xl p-3 min-w-[180px] shrink-0">
                        <p className="text-xs font-medium text-primary truncate">{item.name}</p>
                        <p className="text-[10px] text-muted mt-0.5">{new Date(ri.timestamp).toLocaleDateString('pt-BR')}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <h2 className="text-sm font-semibold text-secondary mt-4 mb-2">Disponíveis ({allAvailable.length})</h2>
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-2'}>
              {availableItems.map((item) => (
                <div key={item.id} className={`bg-surface-1 border border-default shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 animate-fade-in ${animatingItems.has(item.slug) ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} ${viewMode === 'grid' ? 'rounded-2xl p-5' : 'rounded-xl p-3 flex items-center gap-4'}`}>
                  <div className={`flex items-start justify-between ${viewMode === 'grid' ? 'mb-2' : 'flex-1'}`}>
                    <div className="cursor-pointer flex items-center gap-2" onClick={() => setPreviewItem(item)}>
                      {/* NEW: Bulk select checkbox */}
                      {bulkSelectMode && (
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(item.slug)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleBulkSelect(item.slug)}
                          className="w-3.5 h-3.5 rounded border-border text-green-600 focus:ring-green-600"
                          title="Selecionar para instalação em massa"
                        />
                      )}
                      {/* Feature 7: Compare checkbox */}
                      {!bulkSelectMode && (
                        <input
                          type="checkbox"
                          checked={compareItems.has(item.slug)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleCompare(item.slug)}
                          className="w-3.5 h-3.5 rounded border-border text-brand-600 focus:ring-brand-600"
                          title="Selecionar para comparar"
                        />
                      )}
                      {/* NEW Feature 5: Favorite button */}
                      <button onClick={(e) => { e.stopPropagation(); toggleFavorite(item.slug); }} className={`text-sm transition-colors ${favorites.has(item.slug) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>♥</button>
                      <div>
                        <span className="text-sm font-medium text-primary">{item.name}</span>
                        <span className="ml-2 text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{categoryIcons[item.category] || ''} {item.category}</span>
                        {/* NEW Feature 2: Popularity badge */}
                        {(downloadCounts[item.slug] || 0) > 100 && (
                          <span className="ml-1 text-[10px] px-2 py-0.5 bg-yellow-500/15 text-yellow-600 rounded-full font-medium">● Popular</span>
                        )}
                        {/* Feature 34: Publisher badge */}
                        {getPublisher(item.slug)?.verified && (
                          <span className="ml-1 text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-500 rounded-full font-medium cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowPublisher(getPublisher(item.slug) || null); }}>✓ {getPublisher(item.slug)?.name}</span>
                        )}
                        {/* Feature 35: Beta badge */}
                        {betaChannelItems[item.slug] && betaChannelItems[item.slug].channel !== 'stable' && (
                          <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${betaChannelItems[item.slug].channel === 'beta' ? 'bg-purple-500/15 text-purple-500' : 'bg-orange-500/15 text-orange-400'}`}>
                            {betaChannelItems[item.slug].channel === 'beta' ? 'Beta' : 'Preview'} {betaChannelItems[item.slug].betaVersion}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleInstallWithRecent(item)}
                      className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                    >
                      Instalar
                    </button>
                  </div>
                  {viewMode === 'grid' && (
                    <>
                      {/* NEW #4: Search term highlighting */}
                      <p className="text-xs text-muted line-clamp-2 cursor-pointer" onClick={() => setPreviewItem(item)}>{search ? highlightTerm(item.description, search) : item.description}</p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                          {item.type === 'skill' ? '/' : '@'}{item.slug}
                        </span>
                        {/* NEW #7: Version diff inline */}
                        <span
                          className="text-[10px] text-muted cursor-pointer hover:text-brand-500"
                          onMouseEnter={() => setVersionDiffExpanded(item.slug)}
                          onMouseLeave={() => setVersionDiffExpanded(null)}
                        >
                          v{item.version}
                        </span>
                        {versionDiffExpanded === item.slug && releaseNotesData[item.slug] && (
                          <span className="text-[10px] text-brand-500 bg-brand-600/5 px-2 py-0.5 rounded">
                            Novidades: {Object.values(releaseNotesData[item.slug])[0]?.slice(0, 60)}...
                          </span>
                        )}
                        {(downloadCounts[item.slug] || 0) > 0 && (
                          <span className="text-[10px] text-muted">{downloadCounts[item.slug]} downloads</span>
                        )}
                        {usageCount[item.slug] && (
                          <span className="text-[10px] text-muted">{usageCount[item.slug]}x usado</span>
                        )}
                        {getAverageRating(item.slug) > 0 && (
                          <>
                            <StarRating rating={Math.round(getAverageRating(item.slug))} />
                            <span className="text-[10px] text-muted">{getAverageRating(item.slug)}</span>
                          </>
                        )}
                      </div>
                      {/* NEW #5: Rating histogram */}
                      {ratings[item.slug] && ratings[item.slug].length > 2 && (
                        <div className="mt-2 flex items-end gap-0.5 h-4">
                          {getRatingHistogram(item.slug).map((count, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <div className="w-3 bg-yellow-400/60 rounded-sm" style={{ height: `${Math.max(2, (count / Math.max(1, ...getRatingHistogram(item.slug))) * 16)}px` }} />
                              <span className="text-[7px] text-muted">{idx + 1}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* NEW #8: Dependency resolution suggestions */}
                      {getDependencySuggestions(item).length > 0 && SKILL_DEPENDENCIES[item.slug] && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                          <span className="text-yellow-500">Deps:</span>
                          {SKILL_DEPENDENCIES[item.slug].map(dep => (
                            <span key={dep} className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-600 rounded">{dep}</span>
                          ))}
                        </div>
                      )}
                      {/* NEW #9: Publisher mini-profile tooltip */}
                      {getPublisher(item.slug) && (
                        <div
                          className="mt-1.5 relative inline-block"
                          onMouseEnter={() => setHoveredPublisher(item.slug)}
                          onMouseLeave={() => setHoveredPublisher(null)}
                        >
                          <span className="text-[10px] text-muted cursor-pointer hover:text-secondary">
                            Por: {getPublisher(item.slug)?.name} {getPublisher(item.slug)?.verified ? '✓' : ''}
                          </span>
                          {hoveredPublisher === item.slug && (
                            <div className="absolute z-30 bottom-full left-0 mb-1 bg-surface-0 border border-default rounded-lg p-2 shadow-lg w-48">
                              <p className="text-[10px] font-semibold text-primary">{getPublisher(item.slug)?.name}</p>
                              <p className="text-[9px] text-muted">{getPublisher(item.slug)?.slugs.length} items publicados</p>
                              {getPublisher(item.slug)?.verified && <span className="text-[9px] text-blue-500">Verificado</span>}
                            </div>
                          )}
                        </div>
                      )}
                      {/* NEW Feature 3: Release notes expandable */}
                      {releaseNotesData[item.slug] && (
                        <div className="mt-2">
                          <button
                            onClick={() => setExpandedReleaseNotes(expandedReleaseNotes === item.slug ? null : item.slug)}
                            className="text-[10px] text-brand-600 hover:underline"
                          >
                            {expandedReleaseNotes === item.slug ? 'Ocultar' : 'Ver'} notas de release
                          </button>
                          {expandedReleaseNotes === item.slug && (
                            <div className="mt-2 bg-surface-2 rounded-lg p-3 space-y-2">
                              {Object.entries(releaseNotesData[item.slug]).map(([ver, note]) => (
                                <div key={ver} className="border-l-2 border-brand-600/30 pl-2">
                                  <span className="text-[10px] font-semibold text-primary">v{ver}</span>
                                  <p className="text-[10px] text-muted">{note}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Feature 35: Beta opt-in */}
                      {betaChannelItems[item.slug] && betaChannelItems[item.slug].channel !== 'stable' && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => toggleBetaOptIn(item.slug)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors ${betaOptIn.has(item.slug) ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-surface-2 text-muted hover:text-secondary border border-default'}`}
                          >
                            {betaOptIn.has(item.slug) ? 'Inscrito no beta' : 'Entrar no beta'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            {page < totalPages && (
              <div className="flex justify-center mt-4">
                <button onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors">
                  Carregar mais ({allAvailable.length - availableItems.length} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* NEW #1: Floating bulk install button */}
      {bulkSelectMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-0 border border-default rounded-xl shadow-lg px-5 py-3">
          <span className="text-xs text-secondary font-medium">{bulkSelected.size} selecionados</span>
          <button
            onClick={handleBulkInstall}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            Instalar {bulkSelected.size} itens
          </button>
          <button
            onClick={() => { setBulkSelected(new Set()); setBulkSelectMode(false); }}
            className="px-3 py-2 bg-surface-2 hover:bg-surface-3 text-secondary rounded-lg text-xs"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* NEW #6: Floating action bar (when not in bulk mode and have items) */}
      {!bulkSelectMode && installedItems.length > 0 && (
        <div className="fixed bottom-4 right-4 z-30 bg-surface-0 border border-default rounded-xl shadow-lg px-4 py-2 flex items-center gap-3">
          <span className="text-[10px] text-muted">{installed.size} instalados</span>
          <span className="text-[10px] text-muted">|</span>
          <span className="text-[10px] text-muted">{allAvailable.length} disponiveis</span>
        </div>
      )}

      {/* Feature 7: Floating Compare button */}
      {compareItems.size === 2 && !bulkSelectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => setShowCompare(true)}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl shadow-lg transition-colors text-sm"
          >
            Comparar ({compareItems.size})
          </button>
        </div>
      )}

      {/* Feature 7: Compare Modal */}
      {showCompare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCompare(false)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">Comparacao lado a lado</h2>
              <button onClick={() => { setShowCompare(false); setCompareItems(new Set()); }} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {Array.from(compareItems).map(slug => {
                const item = catalog.find(i => i.slug === slug);
                if (!item) return null;
                return (
                  <div key={slug} className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-primary">{item.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{categoryIcons[item.category]} {item.category}</span>
                      <span className="ml-2 text-[10px] text-muted">v{item.version}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted uppercase mb-1">Descricao</p>
                      <p className="text-xs text-secondary">{item.description}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted uppercase mb-1">Instrucoes</p>
                      <p className="text-xs text-secondary whitespace-pre-wrap">{item.instructions}</p>
                    </div>
                    {getAverageRating(slug) > 0 && (
                      <div className="flex items-center gap-1">
                        <StarRating rating={Math.round(getAverageRating(slug))} />
                        <span className="text-[10px] text-muted">{getAverageRating(slug)}</span>
                      </div>
                    )}
                    <button
                      onClick={() => { handleInstallWithCheck(item); setShowCompare(false); setCompareItems(new Set()); }}
                      className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                    >
                      Instalar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview de Instrucoes */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setPreviewItem(null); setShowChangelog(false); setShowSimulation(false); }}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-primary">{previewItem.name}</h2>
                <span className="text-xs px-2 py-0.5 bg-surface-2 rounded-full text-muted">{categoryIcons[previewItem.category] || ''} {previewItem.category}</span>
                <span className="ml-2 text-xs font-mono text-muted">{previewItem.type === 'skill' ? '/' : '@'}{previewItem.slug}</span>
                <span className="ml-2 text-xs text-muted">v{previewItem.version}</span>
              </div>
              <button onClick={() => { setPreviewItem(null); setShowChangelog(false); setShowSimulation(false); }} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <p className="text-sm text-secondary mb-4">{previewItem.description}</p>

            {/* Rating display */}
            {getAverageRating(previewItem.slug) > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <StarRating rating={Math.round(getAverageRating(previewItem.slug))} size="md" />
                <span className="text-xs text-muted">{getAverageRating(previewItem.slug)} ({ratings[previewItem.slug]?.length || 0} avaliacoes)</span>
              </div>
            )}

            {!showChangelog && !showSimulation && (
              <div className="bg-surface-1 border border-default rounded-lg p-4">
                <h3 className="text-xs font-semibold text-muted uppercase mb-2">Instrucoes</h3>
                <p className="text-sm text-primary whitespace-pre-wrap">{previewItem.instructions}</p>
              </div>
            )}

            {/* Feature 3: Changelog */}
            {showChangelog && previewItem.changelog && (
              <div className="bg-surface-1 border border-default rounded-lg p-4">
                <h3 className="text-xs font-semibold text-muted uppercase mb-2">Historico de versoes</h3>
                <div className="space-y-3">
                  {previewItem.changelog.map((entry, i) => (
                    <div key={i} className="border-l-2 border-brand-600/30 pl-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary">v{entry.version}</span>
                        <span className="text-[10px] text-muted">{entry.date}</span>
                      </div>
                      <p className="text-xs text-secondary mt-0.5">{entry.changes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feature 6: Simulation */}
            {showSimulation && (
              <div className="bg-surface-1 border border-default rounded-lg p-4">
                <h3 className="text-xs font-semibold text-muted uppercase mb-2">Simulacao de execucao</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase mb-1">Input de exemplo</p>
                    <div className="bg-surface-2 rounded-lg p-3 text-xs text-secondary font-mono">
                      &quot;Analise o contexto atual da empresa e gere o output esperado.&quot;
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted uppercase mb-1">Formato de output esperado</p>
                    <div className="bg-surface-2 rounded-lg p-3 text-xs text-secondary font-mono whitespace-pre-wrap">
                      {previewItem.instructions.slice(0, 200)}{previewItem.instructions.length > 200 ? '...' : ''}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-2">
                {/* Feature 3: Changelog button */}
                <button
                  onClick={() => { setShowChangelog(!showChangelog); setShowSimulation(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showChangelog ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary border border-default'}`}
                >
                  Changelog
                </button>
                {/* Feature 6: Simular button */}
                <button
                  onClick={() => { setShowSimulation(!showSimulation); setShowChangelog(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showSimulation ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary border border-default'}`}
                >
                  Simular
                </button>
              </div>
              <div>
                {installed.has(previewItem.slug) ? (
                  <button
                    onClick={() => { setConfirmUninstall(previewItem); setPreviewItem(null); setShowChangelog(false); setShowSimulation(false); }}
                    className="px-4 py-2 bg-surface-2 hover:bg-red-500/10 hover:text-red-500 border border-default rounded-lg text-sm text-secondary font-medium transition-colors"
                  >
                    Desinstalar
                  </button>
                ) : (
                  <button
                    onClick={() => { handleInstallWithCheck(previewItem); setPreviewItem(null); setShowChangelog(false); setShowSimulation(false); }}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium transition-colors"
                  >
                    Instalar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Warning Modal */}
      {depWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDepWarning(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-primary mb-2">Dependencias</h3>
            <p className="text-sm text-muted mb-3">"{depWarning.item.name}" requer conexoes que podem nao estar configuradas:</p>
            <ul className="mb-4 space-y-1">
              {depWarning.missing.map(d => (
                <li key={d} className="text-xs text-yellow-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  {d}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDepWarning(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium transition-colors">Cancelar</button>
              <button onClick={() => { handleInstall(depWarning.item); setDepWarning(null); }} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium transition-colors">Instalar mesmo assim</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 34: Publisher Profile Modal */}
      {showPublisher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPublisher(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${showPublisher.verified ? 'bg-blue-500/10 text-blue-500' : 'bg-surface-2 text-muted'}`}>
                  {showPublisher.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    {showPublisher.name}
                    {showPublisher.verified && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full">Verificado</span>}
                  </h3>
                  <p className="text-xs text-muted">{showPublisher.slugs.length} items publicados</p>
                </div>
              </div>
              <button onClick={() => setShowPublisher(null)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <p className="text-xs text-secondary mb-4">{showPublisher.description}</p>
            <h4 className="text-[10px] font-semibold text-muted uppercase mb-2">Items deste publisher</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {showPublisher.slugs.map(slug => {
                const item = catalog.find(i => i.slug === slug);
                if (!item) return null;
                return (
                  <div key={slug} className="flex items-center justify-between bg-surface-1 rounded-lg px-3 py-2">
                    <span className="text-xs text-primary">{item.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${installed.has(slug) ? 'bg-green-500/10 text-green-500' : 'bg-surface-2 text-muted'}`}>
                      {installed.has(slug) ? 'Instalado' : 'Disponivel'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmacao de Desinstalacao */}
      {confirmUninstall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Desinstalar "{confirmUninstall.name}"?</h3>
            <p className="text-sm text-muted mb-3">Esta acao removera a {confirmUninstall.type === 'skill' ? 'skill' : 'workflow'} da sua instalacao.</p>
            {/* NEW Feature 4: Cleanup option */}
            <label className="flex items-center gap-2 cursor-pointer select-none mb-4 bg-surface-1 border border-default rounded-lg p-3">
              <input
                type="checkbox"
                checked={cleanupOnUninstall}
                onChange={(e) => setCleanupOnUninstall(e.target.checked)}
                className="w-4 h-4 rounded border-border text-red-600 focus:ring-red-600"
              />
              <div>
                <span className="text-xs text-secondary font-medium">Remover configs e dados associados</span>
                <p className="text-[10px] text-muted">Remove ratings, versao salva e configuracoes locais</p>
              </div>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setConfirmUninstall(null); setCleanupOnUninstall(false); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={() => { handleUninstall(confirmUninstall, cleanupOnUninstall); setConfirmUninstall(null); setCleanupOnUninstall(false); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium transition-colors">
                Desinstalar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cross-menu integration: Install success toast */}
      {installToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-in">
          {installToast}
        </div>
      )}
    </div>
  );
}
