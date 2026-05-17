# 4. Marketplace

## Descrição
Catálogo de skills e workflows prontos para instalação — 37 skills + 13 workflows (50 itens no total) organizados em 12 categorias de negócio. Permite busca, filtragem por categoria, preview de instruções, gerenciamento de instalados e rollback de instalação.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `tab` | `'skills' \| 'workflows'` | Aba ativa no seletor de tipo |
| `search` | `string` | Texto digitado na barra de busca |
| `activeCategory` | `string \| null` | Categoria selecionada como filtro (null = todas) |
| `installed` | `Set<string>` | Conjunto de slugs dos itens já instalados |
| `previewItem` | `MarketplaceItem \| null` | Item cujo modal de preview está aberto |
| `confirmUninstall` | `MarketplaceItem \| null` | Item aguardando confirmação de desinstalação |
| `usageCount` | `Record<string, number>` | Contagem de uso por slug |
| `page` | `number` | Página atual para paginação dos itens disponíveis |
| `rollbackData` | `Record<string, { instructions: string; ts: number }>` | Dados de versão anterior por slug, para rollback |
| `depWarning` | `{ item: MarketplaceItem; missing: string[] } \| null` | Item com dependências ausentes pendente de confirmação |

## UI Layout

- **Seletor de aba**: Toggle entre "Skills (N)" e "Workflows (N)" com destaque da aba ativa em `bg-brand-600`
- **Cabeçalho**: Título "Marketplace" + subtítulo com contagem total de itens
- **Barra de busca**: Campo com ícone de lupa, placeholder "Buscar por nome ou descricao...", realiza busca fuzzy em nome e descrição
- **Pills de categoria**: Botão "Todos" + uma pill por categoria com ícone geométrico (Marketing→◈, Vendas→◇, Finanças→▣, RH→◉, Operações→⬡, Jurídico→◫, Produto→△, Suporte→○, Projetos→□, Estratégia→◎, Comunicação→▷, Dados→▥) e contagem de itens; pill ativa destacada em `bg-brand-600`
- **Seção "Instalados"**: Grid 2 colunas com cards com borda colorida (`border-brand-600/30`); exibe slug, contagem de uso, botão "Rollback" (quando disponível) e botão "Desinstalar"
- **Seção "Disponíveis"**: Grid 2 colunas com cards com borda padrão; exibe slug, contagem de uso e botão "Instalar"
- **Botão "Carregar mais"**: Aparece quando há mais itens além da página atual; exibe quantos restam
- **Empty state**: Mensagem "Nenhum item encontrado para os filtros selecionados." centralizada quando nenhum item corresponde aos filtros
- **Modal de Preview**: Abre ao clicar no nome ou descrição de qualquer card; exibe nome, categoria, slug, descrição, instruções completas e botão de instalar/desinstalar
- **Modal de Aviso de Dependências**: Aparece ao tentar instalar um item com dependências mapeadas; lista as conexões necessárias com opção de cancelar ou "Instalar mesmo assim"
- **Modal de Confirmação de Desinstalação**: Confirmação explícita antes de remover um item instalado, com botões "Cancelar" e "Desinstalar" (vermelho)

## Catálogo

O catálogo é hardcoded com 50 itens (`MarketplaceItem[]`) estruturados como `{ id, name, slug, description, instructions, category, type }`. Cada item é do tipo `'skill'` (invocado com `/slug`) ou `'workflow'` (invocado com `@slug`). A paginação exibe 20 itens por vez (`PAGE_SIZE = 20`).

### Marketing (5 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Marketing Strategy | `marketing-strategy` | skill | Estratégia completa: posicionamento, ICP, canais, budget e KPIs |
| SEO Audit | `seo-audit` | skill | Auditoria SEO técnica e de conteúdo com priorização de fixes |
| Campaign Brief | `campaign-brief` | skill | Brief para paid media com targeting, criativos e métricas |
| Content Calendar | `content-calendar` | workflow | Calendário editorial mensal com temas, formatos e canais |
| CRO Analysis | `cro-analysis` | skill | Análise de conversão com hipóteses A/B e ICE score |

### Vendas (5 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Sales Playbook | `sales-playbook` | skill | Playbook B2B: ICP, discovery, objeções, scripts e forecasting |
| Proposal Generator | `proposal-generator` | skill | Propostas comerciais com escopo, pricing e timeline |
| Pipeline Review | `pipeline-review` | workflow | Análise de pipeline: riscos, gaps e oportunidades de upsell |
| Cold Outreach | `cold-outreach` | skill | Sequências de cold email e LinkedIn com personalização |
| ROI Calculator | `roi-calculator` | skill | Cálculo de ROI com payback, NPV e análise de cenários |

### Finanças (4 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Financial Report | `financial-report` | skill | Análise de demonstrações financeiras com KPIs e tendências |
| Budget Planner | `budget-planner` | workflow | Orçamento anual por centro de custo com cenários |
| Expense Audit | `expense-audit` | skill | Auditoria de despesas com anomalias e oportunidades de saving |
| Cash Flow Forecast | `cash-flow-forecast` | skill | Projeção de fluxo de caixa com alertas de liquidez |

### RH (5 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Job Description | `job-description` | skill | Vagas otimizadas com responsabilidades, requisitos e cultura |
| Interview Guide | `interview-guide` | skill | Roteiro estruturado com perguntas STAR e rubrica de avaliação |
| Onboarding Plan | `onboarding-plan` | workflow | Plano 30-60-90 dias com metas, reuniões e materiais |
| Performance Review | `performance-review` | skill | Ciclo de avaliação com goals, feedback 360 e PDI |
| Compensation Benchmark | `comp-benchmark` | skill | Benchmark salarial por cargo, senioridade e região |

### Operações (4 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| SOP Generator | `sop-generator` | skill | Procedimentos operacionais padrão com steps e owners |
| Process Optimization | `process-optimization` | workflow | Mapeamento as-is/to-be com gargalos e estimativa de ganho |
| Vendor Evaluation | `vendor-evaluation` | skill | Scorecard ponderado para comparação de fornecedores |
| Incident Report | `incident-report` | skill | Documentação de incidentes com timeline e root cause |

### Jurídico (4 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Contract Review | `contract-review` | skill | Revisão de contratos com riscos, gaps e redline sugerido |
| NDA Generator | `nda-generator` | skill | Geração de NDAs bilaterais ou unilaterais |
| Compliance Check | `compliance-check` | workflow | Verificação de conformidade LGPD/GDPR/SOX/ISO com gap analysis |
| Policy Drafter | `policy-drafter` | skill | Redação de políticas corporativas (privacidade, segurança, etc.) |

### Produto (5 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| PRD Writer | `prd-writer` | skill | Product Requirements Document com problema, solução e métricas |
| Technical Spec | `technical-spec` | skill | Especificação técnica com arquitetura, APIs e trade-offs |
| Sprint Planning | `sprint-planning` | workflow | Planejamento de sprint com estimativas e capacity allocation |
| Code Review | `code-review` | skill | Análise de código: bugs, segurança, performance e boas práticas |
| Architecture Review | `architecture-review` | skill | Revisão de arquitetura: escalabilidade, resiliência e custo |

### Suporte (3 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Ticket Triage | `ticket-triage` | skill | Classificação de tickets por urgência, categoria e rota |
| Knowledge Base | `knowledge-base` | skill | Artigos de help center para self-service |
| CSAT Analysis | `csat-analysis` | workflow | Análise de feedback de clientes com ações recomendadas |

### Projetos (4 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Project Charter | `project-charter` | skill | Charter com scope, stakeholders, riscos e governance |
| Risk Assessment | `risk-assessment` | skill | Mapeamento de riscos com probabilidade, impacto e mitigação |
| Status Report | `status-report` | workflow | Relatório semanal RAG com progresso, blockers e decisões |
| Retrospective | `retrospective` | workflow | Facilitação de retro com temas e action items concretos |

### Estratégia (4 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| OKR Framework | `okr-framework` | skill | OKRs com objectives, key results mensuráveis e iniciativas |
| Competitive Analysis | `competitive-analysis` | skill | Mapeamento de concorrentes com positioning e vulnerabilidades |
| Board Deck | `board-deck` | workflow | Deck para board meeting com financials, métricas e asks |
| Market Research | `market-research` | skill | Pesquisa de mercado com TAM/SAM/SOM, trends e oportunidades |

### Comunicação (4 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Email Drafter | `email-drafter` | skill | Emails profissionais com tom adequado e CTA claro |
| Presentation Writer | `presentation-writer` | skill | Estrutura de apresentação com storytelling e dados |
| Meeting Facilitator | `meeting-facilitator` | workflow | Agendas, facilitação de decisões e ata de reunião |
| Crisis Communication | `crisis-communication` | skill | Comunicações de crise para stakeholders internos e externos |

### Dados (3 itens)
| Nome | Slug | Tipo | Descrição |
|------|------|------|-----------|
| Dashboard Design | `dashboard-design` | skill | Projeto de dashboards com hierarquia de métricas e alertas |
| Data Quality Audit | `data-quality-audit` | workflow | Auditoria de qualidade: completude, consistência e freshness |
| KPI Definition | `kpi-definition` | skill | Definição de KPIs com fórmula, fonte, owner e metas |

## Chamadas IPC

```
// Verificar itens instalados (executado no mount)
ados.db.getSkills()           → Promise<Skill[]>
ados.db.getWorkflows()        → Promise<Workflow[]>

// Carregar contagem de uso (executado no mount)
ados.db.getSkillUsageCounts() → Promise<Record<string, number>>

// Instalar item
ados.db.addSkill(id, name, slug, description, instructions)    → Promise<void>
ados.db.addWorkflow(id, name, slug, description, instructions) → Promise<void>

// Desinstalar item
ados.db.deleteSkill(id)    → Promise<void>
ados.db.deleteWorkflow(id) → Promise<void>
```

## Fluxo de Dados

1. No mount, `checkInstalled()` chama `getSkills()` e `getWorkflows()` em paralelo e popula o estado `installed` com os slugs encontrados
2. No mount, `loadUsage()` chama `getSkillUsageCounts()` e popula `usageCount`; erros são silenciados
3. O usuário filtra o catálogo via aba (`tab`), campo de busca (`search`) e/ou pill de categoria (`activeCategory`)
4. A função `fuzzyMatch()` é aplicada a nome e descrição para cada item; suporta substring exata e correspondência sequencial de caracteres
5. Os itens filtrados são divididos em `installedItems` (slugs em `installed`) e `allAvailable` (slugs fora de `installed`)
6. `availableItems` é a fatia paginada de `allAvailable` — `page × PAGE_SIZE` itens; o botão "Carregar mais" incrementa `page`
7. Ao clicar em "Instalar", `handleInstallWithCheck()` consulta `SKILL_DEPENDENCIES`; se houver dependências mapeadas, abre o modal `depWarning`; caso contrário, chama `handleInstall()` diretamente
8. `handleInstall()` gera um UUID, chama `addSkill()` ou `addWorkflow()`, adiciona o slug a `installed` e salva as instruções e timestamp em `rollbackData`
9. Ao clicar em "Desinstalar" (card ou modal de preview), abre o modal `confirmUninstall`; confirmado, `handleUninstall()` busca o item pelo slug no banco e chama `deleteSkill()` ou `deleteWorkflow()`
10. `handleRollback()` chama `handleUninstall()` e remove o slug de `rollbackData`, revertendo o estado de instalação

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Preview de instruções antes de instalar — modal com instruções completas, slug, categoria e ação | ✅ |
| 2 | Contagem de uso por item — badge "N× usado" baseado em `getSkillUsageCounts()` | ✅ |
| 3 | Ícones por categoria — símbolos geométricos (◈◇▣◉⬡◫△○□◎▷▥) nas pills de filtro e nos badges dos cards | ✅ |
| 4 | Busca fuzzy — correspondência sequencial de caracteres em nome e descrição | ✅ |
| 5 | Seção "Instalados" separada — cards com borda brand no topo, fora da fila de disponíveis | ✅ |
| 6 | Rollback de instalação — dados da versão anterior salvos em estado; botão "Rollback" nos instalados recentes | ✅ |
| 7 | Paginação lazy load — 20 itens por vez com botão "Carregar mais (N restantes)" | ✅ |
| 8 | Verificação de dependências — mapa `SKILL_DEPENDENCIES` com modal de aviso antes de instalar | ✅ |
| 9 | Confirmação de desinstalação — modal explícito com botão vermelho antes de remover item | ✅ |
| 10 | Instalar mesmo assim — opção de prosseguir a instalação mesmo com dependências não configuradas | ✅ |
| 11 | Contagem dinâmica nas abas — tabs exibem total real de skills e workflows no catálogo | ✅ |
| 12 | Contagem por categoria nas pills — cada filtro exibe quantos itens existem na categoria | ✅ |
| 13 | Rating e reviews — usuários podem avaliar skills instaladas (1-5 estrelas) + comentário; média exibida no card | ✅ |
| 14 | Atualização automática — detectar quando skill no catálogo tem versão mais nova que a instalada; badge "Update" | ✅ |
| 15 | Histórico de versões — changelog por item mostrando o que mudou entre versões | ✅ |
| 16 | Recomendações baseadas em uso — seção "Sugerido para você" baseada nas skills mais usadas e categoria | ✅ |
| 17 | Bundle/Pack de skills — instalar conjuntos temáticos em um clique (ex: "Pack Financeiro" = 4 skills) | ✅ |
| 18 | Preview de execução — simular a skill com input de exemplo antes de instalar | ✅ |
| 19 | Comparação lado a lado — selecionar 2 skills similares e ver diff de instruções e funcionalidades | ✅ |
| 20 | Filtro por compatibilidade — mostrar apenas skills compatíveis com as conexões/fontes configuradas | ✅ |
| 21 | Skill collections temáticas — curadoria "Mais populares", "Novidades", "Para seu perfil" na home | ✅ |
| 22 | Badge de popularidade — indicador "Top 10" ou "Trending" baseado em instalações recentes | ✅ |
| 23 | Notas de release ao atualizar — modal com mudanças antes de confirmar update | ✅ |
| 24 | Desinstalação com limpeza — perguntar se deve limpar dados/configurações associadas | ✅ |
| 25 | Skill favorita no marketplace — marcar skills para acompanhar updates futuras | ✅ |
| 26 | Modo compacto/lista — toggle entre grid de cards e lista densa para quem tem muitos itens | ✅ |
| 27 | Ordenação customizável — sort por nome, data de instalação, uso, rating | ✅ |
| 28 | Relatório de uso mensal — resumo de quais skills foram mais/menos usadas no mês | ✅ |
| 29 | Reviews com estrelas — sistema de rating 1-5 por item instalado | ✅ |
| 30 | Changelog por item — exibir notas de atualização quando há nova versão | ✅ |
| 31 | Screenshot/preview — thumbnail mostrando output esperado da skill | ✅ |
| 32 | Dependências visuais — mostrar quais MCPs ou skills são pré-requisito | ✅ |
| 33 | Sugestões personalizadas — recomendar skills baseado no uso recente | ✅ |
| 34 | One-click setup — instalar skill + configurar MCP necessário em um passo | ✅ |
| 35 | Comparação lado-a-lado — comparar duas skills similares antes de instalar | ✅ |
| 36 | Trial/preview — testar skill com prompt exemplo antes de instalar | ✅ |
| 37 | Collections temáticas — grupos curados (ex: "Stack de CEO", "Growth Hacking") | ✅ |
| 38 | Sort por popularidade — ordenar por uso global (quando sync ativo) | ✅ |
| 39 | Badges de qualidade — verificado, staff pick, top 10 | ✅ |
| 40 | Auto-update silencioso — atualizar instrução de skills instaladas quando há versão nova | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Multi-select bulk install | Done |
| 2 | Filtros salvos | Done |
| 3 | Transicoes animadas | Done |
| 4 | Highlight de busca | Done |
| 5 | Histograma de ratings | Done |
| 6 | Floating action bar | Done |
| 7 | Version diff inline | Done |
| 8 | Resolucao de dependencias | Done |
| 9 | Publisher mini-profile | Done |
| 10 | Instalados recentemente | Done |
