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
  // === MARKETING & GROWTH ===
  { id: 'mkt-1', name: 'Marketing Strategy', slug: 'marketing-strategy', description: 'Cria estratégia de marketing completa: posicionamento, ICP, canais, budget allocation e KPIs.', instructions: 'Crie uma estratégia de marketing com: 1) Análise de mercado e concorrência 2) Definição de ICP e personas 3) Posicionamento e messaging 4) Mix de canais com budget % 5) KPIs e metas por canal 6) Cronograma de execução trimestral. Use dados fornecidos como input.', category: 'Marketing', type: 'skill' },
  { id: 'mkt-2', name: 'SEO Audit', slug: 'seo-audit', description: 'Auditoria SEO técnica e de conteúdo com priorização de fixes por impacto.', instructions: 'Execute auditoria SEO: 1) Análise técnica (Core Web Vitals, crawlability, indexação, sitemap, schema) 2) Análise on-page (títulos, metas, headings, internal linking) 3) Análise de conteúdo (gaps, canibalização, thin content) 4) Backlink profile 5) Priorize fixes por impacto × esforço. Output: relatório com action items ordenados.', category: 'Marketing', type: 'skill' },
  { id: 'mkt-3', name: 'Campaign Brief', slug: 'campaign-brief', description: 'Gera brief completo para campanhas paid media com targeting, criativos e métricas.', instructions: 'Gere o brief da campanha: 1) Objetivo (awareness/consideration/conversion) 2) Audiência e targeting (demographics, interests, lookalikes) 3) Direção criativa (formatos, hooks, CTAs) 4) Budget e distribuição por plataforma 5) KPIs esperados (CPM, CPC, CPA, ROAS) 6) Timeline e milestones. Adapte ao canal informado (Meta, Google, TikTok, LinkedIn).', category: 'Marketing', type: 'skill' },
  { id: 'mkt-4', name: 'Content Calendar', slug: 'content-calendar', description: 'Planeja calendário editorial mensal com temas, formatos e distribuição por canal.', instructions: 'Crie calendário editorial para o período: 1) Pilares de conteúdo alinhados à estratégia 2) Temas semanais com hook e ângulo 3) Distribuição por canal (blog, social, email, video) 4) Formato e tamanho por peça 5) Datas de produção e publicação 6) Métricas de sucesso por tipo. Considere sazonalidade e eventos do setor.', category: 'Marketing', type: 'workflow' },
  { id: 'mkt-5', name: 'CRO Analysis', slug: 'cro-analysis', description: 'Análise de conversão com hipóteses de teste A/B e priorização por ICE score.', instructions: 'Analise o funil de conversão: 1) Mapeie etapas e drop-offs 2) Identifique friction points 3) Gere hipóteses de melhoria 4) Score cada hipótese por ICE (Impact × Confidence × Ease) 5) Recomende top 5 testes A/B com variantes específicas 6) Defina métricas primárias e secundárias de cada teste.', category: 'Marketing', type: 'skill' },

  // === VENDAS & COMERCIAL ===
  { id: 'mkt-6', name: 'Sales Playbook', slug: 'sales-playbook', description: 'Monta playbook de vendas B2B: ICP, discovery, objeções, scripts e forecasting.', instructions: 'Construa o playbook de vendas: 1) ICP e qualificação (BANT/MEDDIC) 2) Script de discovery call com perguntas-chave 3) Mapa de objeções com respostas comprovadas 4) Cadência de follow-up (email + call + social) 5) Critérios de stage progression no pipeline 6) Template de forecast semanal com weighted pipeline.', category: 'Vendas', type: 'skill' },
  { id: 'mkt-7', name: 'Proposal Generator', slug: 'proposal-generator', description: 'Redige propostas comerciais profissionais com escopo, pricing e timeline.', instructions: 'Gere proposta comercial: 1) Executive summary (problema → solução → valor) 2) Escopo detalhado com deliverables 3) Timeline com milestones 4) Pricing com opções (básico/pro/enterprise) 5) Termos e condições 6) Próximos passos. Tom executivo, focado em ROI e outcomes para o cliente.', category: 'Vendas', type: 'skill' },
  { id: 'mkt-8', name: 'Pipeline Review', slug: 'pipeline-review', description: 'Analisa pipeline de vendas e identifica deals em risco, gaps e oportunidades de upsell.', instructions: 'Analise o pipeline: 1) Deals por stage com aging médio 2) Deals em risco (stalled >14 dias, sem next step, champion off) 3) Cobertura de pipeline vs meta (3x rule) 4) Win rate por segment/size/rep 5) Oportunidades de upsell/cross-sell em clientes ativos 6) Recomendações de ação imediata top 5.', category: 'Vendas', type: 'workflow' },
  { id: 'mkt-9', name: 'Cold Outreach', slug: 'cold-outreach', description: 'Cria sequências de cold email e LinkedIn com personalização por persona.', instructions: 'Crie sequência de outreach: 1) Email 1: pain-led hook personalizado (2-3 linhas) 2) Email 2: case study relevante (3 dias) 3) Email 3: breakup com valor (5 dias) 4) LinkedIn touch entre emails 5) Variantes A/B para subject lines 6) Merge tags para personalização em escala. Adapte ao ICP e vertical informados.', category: 'Vendas', type: 'skill' },
  { id: 'mkt-10', name: 'ROI Calculator', slug: 'roi-calculator', description: 'Calcula ROI de investimentos com payback period, NPV e análise de cenários.', instructions: 'Calcule ROI do investimento: 1) Investimento total (CAPEX + OPEX) 2) Benefícios quantificados (revenue uplift, cost savings, efficiency gains) 3) Payback period 4) ROI % em 12/24/36 meses 5) NPV com discount rate informada 6) Análise de sensibilidade (pessimista/base/otimista). Apresente em formato executivo com one-pager.', category: 'Vendas', type: 'skill' },

  // === FINANÇAS & CONTROLADORIA ===
  { id: 'mkt-11', name: 'Financial Report', slug: 'financial-report', description: 'Analisa demonstrações financeiras e gera relatório com indicadores-chave e tendências.', instructions: 'Analise os dados financeiros: 1) DRE — receita, custos, margem bruta, EBITDA, lucro líquido 2) Variação vs período anterior e vs budget 3) Indicadores: margem bruta %, EBITDA %, burn rate, runway 4) Tendências de 3-6 meses 5) Alertas (desvios >10% do budget) 6) Recomendações de ação. Formato: resumo executivo + detalhamento.', category: 'Finanças', type: 'skill' },
  { id: 'mkt-12', name: 'Budget Planner', slug: 'budget-planner', description: 'Cria orçamento anual por centro de custo com alocação e cenários.', instructions: 'Elabore o budget: 1) Revenue forecast por linha de receita (base/upside/downside) 2) COGS e margem bruta target 3) OPEX por departamento (headcount, tools, marketing, infra) 4) Investimentos (CAPEX) 5) P&L projetado mensal 6) Cenários: conservative (-15%), base, aggressive (+20%). Use histórico fornecido como baseline.', category: 'Finanças', type: 'workflow' },
  { id: 'mkt-13', name: 'Expense Audit', slug: 'expense-audit', description: 'Audita despesas e identifica anomalias, duplicatas e oportunidades de saving.', instructions: 'Audite as despesas: 1) Classifique por categoria e centro de custo 2) Identifique anomalias (valores fora do padrão, crescimento acelerado) 3) Detecte possíveis duplicatas 4) Compare com benchmarks do setor 5) Identifique top 5 oportunidades de economia 6) Recomende renegociações de contratos. Priorize por valor absoluto de saving.', category: 'Finanças', type: 'skill' },
  { id: 'mkt-14', name: 'Cash Flow Forecast', slug: 'cash-flow-forecast', description: 'Projeta fluxo de caixa semanal/mensal com alertas de liquidez.', instructions: 'Projete o fluxo de caixa: 1) Entradas previstas (recebíveis, contratos, vendas) com probabilidade 2) Saídas fixas (folha, aluguel, tools, impostos) 3) Saídas variáveis (marketing, comissões, fornecedores) 4) Saldo projetado dia a dia ou semana a semana 5) Alertas de liquidez (saldo <X dias de operação) 6) Recomendações: antecipar recebíveis, postergar pagamentos, linha de crédito.', category: 'Finanças', type: 'skill' },

  // === RECURSOS HUMANOS ===
  { id: 'mkt-15', name: 'Job Description', slug: 'job-description', description: 'Redige vagas otimizadas para atração com responsabilidades, requisitos e cultura.', instructions: 'Crie a job description: 1) Título otimizado para busca 2) Sobre a empresa (2-3 linhas, cultura e missão) 3) O que você vai fazer (5-7 responsabilidades concretas) 4) O que esperamos (requisitos obrigatórios vs desejáveis) 5) O que oferecemos (benefícios, salário quando aplicável) 6) Processo seletivo. Tom inclusivo, evite jargões e requisitos inflados.', category: 'RH', type: 'skill' },
  { id: 'mkt-16', name: 'Interview Guide', slug: 'interview-guide', description: 'Cria roteiro de entrevista estruturada com perguntas comportamentais e rubrica de avaliação.', instructions: 'Monte o guia de entrevista: 1) Competências a avaliar (técnicas + comportamentais) 2) 4-6 perguntas STAR por competência 3) Follow-ups para aprofundar 4) Red flags por pergunta 5) Rubrica de scoring (1-5) com exemplos por nível 6) Scorecard consolidado. Adapte ao nível (júnior/pleno/senior/liderança) e à vaga informada.', category: 'RH', type: 'skill' },
  { id: 'mkt-17', name: 'Onboarding Plan', slug: 'onboarding-plan', description: 'Estrutura onboarding de 30-60-90 dias com metas, reuniões e materiais.', instructions: 'Crie plano de onboarding: Semana 1: setup, apresentações, documentação essencial. Dias 1-30: metas de aprendizado, shadowing, primeiro deliverable. Dias 31-60: autonomia crescente, projetos próprios, feedback intermediário. Dias 61-90: ownership total, metas de performance, avaliação formal. Inclua: buddy, 1:1s com manager, training schedule.', category: 'RH', type: 'workflow' },
  { id: 'mkt-18', name: 'Performance Review', slug: 'performance-review', description: 'Estrutura ciclo de avaliação com goals, feedback 360 e plano de desenvolvimento.', instructions: 'Monte a avaliação: 1) Recap de goals do período com status (achieved/partial/missed) 2) Highlights e entregas acima do esperado 3) Áreas de desenvolvimento 4) Feedback de peers sintetizado 5) Rating recommendation (1-5) com justificativa 6) Plano de desenvolvimento para próximo ciclo com actions específicas. Tom construtivo e baseado em evidências.', category: 'RH', type: 'skill' },
  { id: 'mkt-19', name: 'Compensation Benchmark', slug: 'comp-benchmark', description: 'Pesquisa e compara faixas salariais por cargo, senioridade e região.', instructions: 'Elabore benchmark de compensação: 1) Cargo e nível (IC vs manager, junior/mid/senior/staff) 2) Faixa salarial por mercado (Brasil, LATAM, US, EU) 3) Breakdown: base + variável + equity + benefícios 4) Percentis P25/P50/P75 5) Comparação com a faixa atual da empresa 6) Recomendação de ajuste se fora de mercado. Use dados públicos e fontes citadas.', category: 'RH', type: 'skill' },

  // === OPERAÇÕES & PROCESSOS ===
  { id: 'mkt-20', name: 'SOP Generator', slug: 'sop-generator', description: 'Documenta procedimentos operacionais padrão com steps, owners e critérios de qualidade.', instructions: 'Crie o SOP: 1) Objetivo e escopo do processo 2) Pré-condições e triggers 3) Steps numerados com responsável, ação e output esperado 4) Decisões e branching (se X → faça Y) 5) Critérios de qualidade e checklist de validação 6) Exceções e escalação 7) Métricas do processo (tempo, erro, throughput). Formato: step-by-step com screenshots placeholders.', category: 'Operações', type: 'skill' },
  { id: 'mkt-21', name: 'Process Optimization', slug: 'process-optimization', description: 'Mapeia processos, identifica gargalos e propõe melhorias com estimativa de ganho.', instructions: 'Otimize o processo: 1) Mapeie as-is (steps, tempo, handoffs, ferramentas) 2) Identifique gargalos (tempo de espera, retrabalho, dependências) 3) Quantifique custo do desperdício 4) Proponha to-be com melhorias (automação, paralelização, eliminação) 5) Estime ganho (tempo, custo, qualidade) 6) Plano de implementação com quick wins vs mudanças estruturais.', category: 'Operações', type: 'workflow' },
  { id: 'mkt-22', name: 'Vendor Evaluation', slug: 'vendor-evaluation', description: 'Compara fornecedores com scorecard ponderado por critérios de negócio.', instructions: 'Avalie os fornecedores: 1) Defina critérios (preço, qualidade, SLA, suporte, escalabilidade, segurança, integração) 2) Atribua pesos por prioridade do negócio 3) Score cada vendor (1-5) por critério com justificativa 4) Matriz comparativa com total ponderado 5) Riscos por vendor 6) Recomendação final com rationale. Formato: tabela + resumo executivo.', category: 'Operações', type: 'skill' },
  { id: 'mkt-23', name: 'Incident Report', slug: 'incident-report', description: 'Documenta incidentes com timeline, impacto, root cause e action items.', instructions: 'Documente o incidente: 1) Summary (o que aconteceu, quando, duração) 2) Impacto (usuários afetados, receita perdida, SLA breach) 3) Timeline detalhada (detecção → resposta → mitigação → resolução) 4) Root cause analysis (5 Whys) 5) Contributing factors 6) Action items com owner e deadline (imediatos + preventivos). Tom factual, sem blame.', category: 'Operações', type: 'skill' },

  // === JURÍDICO & COMPLIANCE ===
  { id: 'mkt-24', name: 'Contract Review', slug: 'contract-review', description: 'Revisa contratos identificando cláusulas de risco, termos desfavoráveis e gaps.', instructions: 'Revise o contrato: 1) Identifique cláusulas de risco alto (indemnification ilimitada, non-compete abusivo, IP assignment ampla, termination unilateral) 2) Termos fora do padrão de mercado 3) Gaps (SLA ausente, penalidades vagas, jurisdição desfavorável) 4) Exposição financeira máxima 5) Recomendações de negociação por prioridade 6) Redline sugerido das cláusulas críticas.', category: 'Jurídico', type: 'skill' },
  { id: 'mkt-25', name: 'NDA Generator', slug: 'nda-generator', description: 'Gera NDAs bilaterais ou unilaterais customizados por contexto de negócio.', instructions: 'Gere o NDA: 1) Partes (nomes legais e jurisdição) 2) Tipo (unilateral ou mútuo) 3) Definição de informação confidencial (adapte ao contexto: tech, financeiro, comercial) 4) Exceções padrão 5) Prazo de confidencialidade 6) Obrigações de devolução/destruição 7) Penalidades 8) Foro. Linguagem jurídica profissional, adaptada à jurisdição informada.', category: 'Jurídico', type: 'skill' },
  { id: 'mkt-26', name: 'Compliance Check', slug: 'compliance-check', description: 'Verifica conformidade com LGPD, GDPR, SOX ou ISO e gera gap analysis.', instructions: 'Execute compliance check: 1) Framework aplicável (LGPD/GDPR/SOX/ISO 27001/SOC2) 2) Mapeie controles existentes vs requisitos 3) Gap analysis (compliant/partial/non-compliant por requisito) 4) Risco associado a cada gap (alto/médio/baixo) 5) Plano de remediação com prazo e responsável 6) Quick wins vs projetos de médio prazo. Output: matriz de conformidade + executive summary.', category: 'Jurídico', type: 'workflow' },
  { id: 'mkt-27', name: 'Policy Drafter', slug: 'policy-drafter', description: 'Redige políticas corporativas (privacidade, segurança, uso aceitável, remote work).', instructions: 'Redija a política: 1) Objetivo e escopo (quem se aplica) 2) Definições de termos-chave 3) Diretrizes e regras (o que é permitido/proibido) 4) Responsabilidades por role (funcionário, gestor, TI, compliance) 5) Consequências de violação 6) Processo de exceção 7) Revisão e atualização (periodicidade). Linguagem clara e acessível, equilibrando rigor jurídico e compreensão.', category: 'Jurídico', type: 'skill' },

  // === TECNOLOGIA & PRODUTO ===
  { id: 'mkt-28', name: 'PRD Writer', slug: 'prd-writer', description: 'Escreve Product Requirements Document com problema, solução, métricas e escopo.', instructions: 'Escreva o PRD: 1) Problem statement (quem, o quê, por quê, impacto) 2) Hipótese e métricas de sucesso 3) User stories com acceptance criteria 4) Escopo (in/out) 5) Requisitos técnicos e não-funcionais 6) Wireframes/mockups (descrição textual) 7) Milestones e dependências 8) Riscos e mitigações. Formato para handoff para engenharia.', category: 'Produto', type: 'skill' },
  { id: 'mkt-29', name: 'Technical Spec', slug: 'technical-spec', description: 'Redige especificação técnica com arquitetura, APIs, banco de dados e trade-offs.', instructions: 'Escreva a tech spec: 1) Context e objetivo 2) Proposta de arquitetura (diagrama textual) 3) API design (endpoints, request/response schemas) 4) Data model (tabelas, relações, indexes) 5) Trade-offs considerados (alternativas descartadas e por quê) 6) Plano de migração se aplicável 7) Observability (logs, métricas, alertas) 8) Rollout plan (feature flags, canary).', category: 'Produto', type: 'skill' },
  { id: 'mkt-30', name: 'Sprint Planning', slug: 'sprint-planning', description: 'Planeja sprint com estimativas, dependências e capacity allocation.', instructions: 'Planeje a sprint: 1) Goal da sprint (1-2 objectives alinhados ao roadmap) 2) Backlog priorizado com story points estimados 3) Capacity do time (dias disponíveis × velocity histórica) 4) Alocação por membro considerando especialidade 5) Dependências e riscos 6) Definição de done 7) Spillover assessment do sprint anterior. Output: sprint board com assignments.', category: 'Produto', type: 'workflow' },
  { id: 'mkt-31', name: 'Code Review', slug: 'code-review', description: 'Analisa código com foco em bugs, segurança, performance e boas práticas.', instructions: 'Analise o código: 1) Bugs potenciais (null refs, race conditions, edge cases) 2) Vulnerabilidades de segurança (injection, XSS, auth bypass) 3) Performance (N+1, memory leaks, unnecessary allocations) 4) Boas práticas (naming, SRP, DRY, error handling) 5) Testabilidade 6) Sugestões de refactor. Priorize por severidade (critical/high/medium/low).', category: 'Produto', type: 'skill' },
  { id: 'mkt-32', name: 'Architecture Review', slug: 'architecture-review', description: 'Avalia arquitetura de sistemas com foco em escalabilidade, resiliência e custo.', instructions: 'Revise a arquitetura: 1) Componentes e responsabilidades 2) Pontos de falha (SPOF) 3) Escalabilidade (horizontal/vertical, bottlenecks) 4) Resiliência (retry, circuit breaker, fallbacks) 5) Custos operacionais projetados 6) Observability e debugging 7) Security posture 8) Tech debt acumulado. Output: diagrama + lista priorizada de melhorias.', category: 'Produto', type: 'skill' },

  // === SUPORTE AO CLIENTE ===
  { id: 'mkt-33', name: 'Ticket Triage', slug: 'ticket-triage', description: 'Classifica tickets por urgência, categoria e rota para o time correto.', instructions: 'Classifique o ticket: 1) Categoria (bug/feature request/how-to/billing/account) 2) Urgência (P1 critical/P2 high/P3 medium/P4 low) 3) Sentimento do cliente (frustrado/neutro/positivo) 4) Time responsável (suporte L1/L2/eng/billing/success) 5) Resposta inicial sugerida (tom empático, acknowledge, next steps) 6) SLA aplicável e deadline.', category: 'Suporte', type: 'skill' },
  { id: 'mkt-34', name: 'Knowledge Base', slug: 'knowledge-base', description: 'Cria artigos de help center claros e pesquisáveis a partir de resoluções de tickets.', instructions: 'Crie o artigo: 1) Título claro e pesquisável (inclua como/por que/o que) 2) TL;DR (solução em 1-2 linhas) 3) Pré-requisitos 4) Steps com screenshots placeholders 5) Troubleshooting (se não funcionou, tente...) 6) FAQ relacionado. Linguagem simples, sem jargão técnico desnecessário. Otimize para self-service.', category: 'Suporte', type: 'skill' },
  { id: 'mkt-35', name: 'CSAT Analysis', slug: 'csat-analysis', description: 'Analisa feedback de clientes, identifica temas recorrentes e recomenda ações.', instructions: 'Analise o feedback: 1) Score geral (CSAT/NPS/CES) e trend 2) Temas positivos recorrentes (o que valorizam) 3) Temas negativos recorrentes (top 5 complaints) 4) Segmentação por produto/plano/canal 5) Correlação com churn risk 6) Top 5 ações recomendadas por impacto no score. Formato: insights → ações → owners.', category: 'Suporte', type: 'workflow' },

  // === GESTÃO DE PROJETOS ===
  { id: 'mkt-36', name: 'Project Charter', slug: 'project-charter', description: 'Cria charter de projeto com scope, stakeholders, riscos e governance.', instructions: 'Elabore o project charter: 1) Business case e justificativa 2) Objetivos SMART 3) Escopo (in/out boundaries) 4) Stakeholders e RACI 5) Timeline com milestones 6) Budget estimado 7) Riscos top 5 com mitigação 8) Critérios de sucesso 9) Governance (cadência de reports, escalação). Formato executivo para aprovação.', category: 'Projetos', type: 'skill' },
  { id: 'mkt-37', name: 'Risk Assessment', slug: 'risk-assessment', description: 'Mapeia riscos do projeto com probabilidade, impacto e plano de mitigação.', instructions: 'Avalie os riscos: 1) Identifique riscos por categoria (técnico, recurso, prazo, budget, dependência, mercado) 2) Classifique probabilidade (1-5) e impacto (1-5) 3) Calcule exposure (P×I) 4) Defina response strategy (mitigate/transfer/accept/avoid) 5) Owner por risco 6) Trigger events e plano de contingência 7) Heatmap visual (descrição). Atualize semanalmente.', category: 'Projetos', type: 'skill' },
  { id: 'mkt-38', name: 'Status Report', slug: 'status-report', description: 'Gera relatório de status semanal com RAG, progresso, blockers e decisões pendentes.', instructions: 'Gere o status report: 1) Overall RAG (Red/Amber/Green) com justificativa 2) Progresso vs plano (% complete, milestones hit) 3) Entregas da semana 4) Blockers e dependencies 5) Riscos atualizados 6) Decisões necessárias (de quem, até quando) 7) Plano para próxima semana. Formato: max 1 página, bullet points, RAG visual. Tom: factual sem sugar-coating.', category: 'Projetos', type: 'workflow' },
  { id: 'mkt-39', name: 'Retrospective', slug: 'retrospective', description: 'Facilita retrospectiva com categorização de temas e action items concretos.', instructions: 'Estruture a retro: 1) Formato (Start/Stop/Continue ou 4Ls ou Mad/Sad/Glad) 2) Agrupe inputs por tema 3) Vote e priorize (top 3 temas) 4) Para cada tema: root cause, action item, owner, deadline 5) Review de actions da retro anterior (done/not done) 6) Takeaways em 1 parágrafo. Output: ata com actions trackáveis.', category: 'Projetos', type: 'workflow' },

  // === ESTRATÉGIA & LIDERANÇA ===
  { id: 'mkt-40', name: 'OKR Framework', slug: 'okr-framework', description: 'Define OKRs com objectives ambiciosos, key results mensuráveis e iniciativas.', instructions: 'Monte os OKRs: 1) Objective: aspiracional, qualitativo, inspirador (3-5 por trimestre) 2) Key Results: mensuráveis, com baseline → target, não binários (3-4 por objective) 3) Iniciativas: projetos/ações que movem os KRs 4) Alinhamento: como cada OKR conecta aos OKRs do nível acima 5) Health check: scoring guide (0.0-1.0) 6) Cadência de review. Evite: KRs que são tasks, objectives vagos.', category: 'Estratégia', type: 'skill' },
  { id: 'mkt-41', name: 'Competitive Analysis', slug: 'competitive-analysis', description: 'Mapeia concorrentes com positioning, features, pricing e vulnerabilidades.', instructions: 'Analise os concorrentes: 1) Overview (funding, team size, revenue estimate, growth) 2) Positioning e messaging 3) Feature comparison matrix 4) Pricing model e tiers 5) Go-to-market strategy 6) Pontos fortes (moats) 7) Vulnerabilidades exploráveis 8) Movimentos recentes (launches, pivots, acquisitions) 9) Recomendações de diferenciação.', category: 'Estratégia', type: 'skill' },
  { id: 'mkt-42', name: 'Board Deck', slug: 'board-deck', description: 'Prepara deck para board meeting com financials, métricas, roadmap e asks.', instructions: 'Monte o board deck: 1) Highlights do período (3-5 bullets) 2) Financials: revenue, burn, runway, vs forecast 3) KPIs: growth rate, retention, NPS, pipeline 4) Product: shipped, roadmap next quarter 5) Team: headcount, key hires, attrition 6) Risks e challenges 7) Asks: approvals, budget, strategic decisions. Formato: 12-15 slides, data-heavy, conciso. Um slide = um message.', category: 'Estratégia', type: 'workflow' },
  { id: 'mkt-43', name: 'Market Research', slug: 'market-research', description: 'Pesquisa de mercado com TAM/SAM/SOM, trends e oportunidades de entrada.', instructions: 'Pesquise o mercado: 1) TAM/SAM/SOM com fontes e metodologia 2) Growth rate e CAGR 3) Segmentação (geography, vertical, company size) 4) Key players e market share 5) Trends e disruptors 6) Regulatory landscape 7) Buyer journey e decision criteria 8) Barriers to entry 9) Oportunidades de timing (why now). Cite fontes e datas dos dados.', category: 'Estratégia', type: 'skill' },

  // === COMUNICAÇÃO & ESCRITA ===
  { id: 'mkt-44', name: 'Email Drafter', slug: 'email-drafter', description: 'Redige emails profissionais com tom adequado ao contexto e objetivo claro.', instructions: 'Redija o email: 1) Subject line compelling (max 50 chars) 2) Abertura contextual (1 linha) 3) Corpo com propósito claro (problema/pedido/informação) 4) CTA específico (o que você precisa, até quando) 5) Fechamento profissional. Adapte tom: interno=direto, cliente=empático, C-level=conciso, parceiro=colaborativo. Max 150 palavras exceto se complexo.', category: 'Comunicação', type: 'skill' },
  { id: 'mkt-45', name: 'Presentation Writer', slug: 'presentation-writer', description: 'Cria estrutura de apresentação com storytelling, dados e recomendações.', instructions: 'Estruture a apresentação: 1) Narrative arc (situation → complication → resolution) 2) Outline de slides com título + key message cada 3) Data points e visualizações sugeridas por slide 4) Speaker notes com talking points 5) Appendix de backup slides. Regras: 1 ideia por slide, títulos assertivos (não descritivos), pyramid principle para argumentação.', category: 'Comunicação', type: 'skill' },
  { id: 'mkt-46', name: 'Meeting Facilitator', slug: 'meeting-facilitator', description: 'Estrutura agendas, facilita decisões e documenta outputs de reuniões.', instructions: 'Facilite a reunião: 1) Agenda com tempo por tópico e owner 2) Objetivo claro (informar/discutir/decidir) por item 3) Pre-read: contexto mínimo para decisão informada 4) Durante: capture decisões, action items (quem/o quê/quando), parking lot 5) Output: ata em max 10 bullets com decisions + actions + next steps. Formato que permite async review.', category: 'Comunicação', type: 'workflow' },
  { id: 'mkt-47', name: 'Crisis Communication', slug: 'crisis-communication', description: 'Redige comunicações de crise para stakeholders internos e externos.', instructions: 'Redija a comunicação de crise: 1) Para quem (clientes/funcionários/imprensa/investidores) 2) O que aconteceu (fatos, sem especulação) 3) Impacto no stakeholder 4) O que estamos fazendo 5) Timeline de resolução 6) Como acompanhar updates 7) Pedido de desculpas se aplicável. Tom: transparente, accountability, empático. Evite: minimizar, culpar terceiros, linguagem legal defensiva.', category: 'Comunicação', type: 'skill' },

  // === DADOS & ANALYTICS ===
  { id: 'mkt-48', name: 'Dashboard Design', slug: 'dashboard-design', description: 'Projeta dashboards com hierarquia de métricas, layout e regras de alerta.', instructions: 'Projete o dashboard: 1) Audiência e perguntas que precisa responder 2) Hierarquia de métricas (North Star → supporting → diagnostic) 3) Layout: KPIs no topo, trends no meio, detalhamento embaixo 4) Filtros necessários (período, segmento, produto) 5) Regras de cor e alertas (verde/amarelo/vermelho) 6) Refresh rate e data source 7) Mobile-friendly considerations.', category: 'Dados', type: 'skill' },
  { id: 'mkt-49', name: 'Data Quality Audit', slug: 'data-quality-audit', description: 'Audita qualidade dos dados: completude, consistência, freshness e duplicatas.', instructions: 'Audite a qualidade dos dados: 1) Completude (% de nulls por campo crítico) 2) Consistência (formatos, ranges válidos, referential integrity) 3) Unicidade (duplicatas, near-duplicates) 4) Freshness (lag entre evento e disponibilidade) 5) Accuracy (amostragem vs fonte de verdade) 6) Score geral por tabela/dataset 7) Top 10 issues com impacto no negócio 8) Plano de correção prioritizado.', category: 'Dados', type: 'workflow' },
  { id: 'mkt-50', name: 'KPI Definition', slug: 'kpi-definition', description: 'Define KPIs com fórmula, fonte, owner, meta e cadência de review.', instructions: 'Defina os KPIs: Para cada métrica: 1) Nome e definição unambígua 2) Fórmula exata (numerador/denominador, inclusões/exclusões) 3) Fonte de dados e tabela 4) Granularidade (daily/weekly/monthly) 5) Owner e stakeholders 6) Target e thresholds (verde/amarelo/vermelho) 7) Ações prescritas por threshold 8) Cadência de review. Evite: vanity metrics, KPIs sem ação associada.', category: 'Dados', type: 'skill' },
];

export default function Marketplace() {
  const [tab, setTab] = useState<MktTab>('skills');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const categories = ['Marketing', 'Vendas', 'Finanças', 'RH', 'Operações', 'Jurídico', 'Produto', 'Suporte', 'Projetos', 'Estratégia', 'Comunicação', 'Dados'];

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

  const handleUninstall = async (item: MarketplaceItem) => {
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
              {c} ({catalog.filter(i => i.category === c).length})
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
                  <button
                    onClick={() => handleUninstall(item)}
                    className="px-3 py-1 bg-surface-2 hover:bg-red-500/10 hover:text-red-500 border border-default rounded-lg text-xs text-secondary font-medium transition-colors"
                  >
                    Desinstalar
                  </button>
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
