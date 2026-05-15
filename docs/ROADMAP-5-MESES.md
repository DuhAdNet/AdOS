# AdOS — Roadmap de 5 Meses (150 dias)

## Objetivo

Entregar funcionalidades a cada 5 dias que **encantem empresários** e substituam cargos operacionais com IA. Cada sprint de 5 dias entrega 1 feature completa e funcional.

---

## IAs Mais Baratas com Suporte a MCP (Tool Calling)

| # | Modelo | Provider | Input/1M tok | Output/1M tok | Tool Calling | Nota |
|---|--------|----------|-------------|---------------|--------------|------|
| 1 | DeepSeek V3 | DeepSeek / OpenRouter | $0.14 | $0.28 | ✅ | Melhor custo-benefício geral |
| 2 | DeepSeek R1 (distilled) | DeepSeek | $0.14 | $0.28 | ✅ | Reasoning barato |
| 3 | Qwen 2.5 72B | Together / OpenRouter | $0.30 | $0.30 | ✅ | Open-source, self-host possível |
| 4 | Gemini 2.5 Flash | Google | $0.15 | $0.60 | ✅ | Rápido, 1M context window |
| 5 | GPT-4o-mini | OpenAI | $0.15 | $0.60 | ✅ | Estável, ótimo para tool calling |
| 6 | Claude Haiku 4.5 | Anthropic | $0.80 | $4.00 | ✅ | Rápido mas mais caro |
| 7 | Mistral Small | Mistral | $0.20 | $0.60 | ✅ | Europeu, boa compliance |
| 8 | Llama 3.3 70B | Groq / Together | $0.20 | $0.20 | ✅ | Groq = latência ultra-baixa |
| 9 | Gemma 3 27B | Google / OpenRouter | $0.10 | $0.10 | ⚠️ Parcial | Baratíssimo mas tool calling limitado |
| 10 | Phi-4 | Microsoft / Fireworks | $0.07 | $0.07 | ⚠️ Parcial | Micro-modelo, bom para tasks simples |

### Recomendação para AdOS Cloud

| Tier | Modelo primário | Fallback | Custo médio/msg |
|------|----------------|----------|-----------------|
| Fast (80% das msgs) | DeepSeek V3 | GPT-4o-mini | ~R$ 0,01 |
| Balanced (15%) | Gemini 2.5 Flash | Qwen 72B | ~R$ 0,04 |
| Power (5%) | Claude Sonnet 4.6 | GPT-4o | ~R$ 0,15 |

**Custo médio ponderado por mensagem: ~R$ 0,02** → Margem de 79% no plano Starter (R$97/1000 msgs)

---

## Cargos-Alvo e Features por Cargo

### FINANCEIRO
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Analista Financeiro | Consolidar DRE, fluxo de caixa manual | Dashboard financeiro automático + alertas |
| Controller | Reconciliação bancária lenta | Importar OFX/CSV + classificação automática |
| CFO | Relatórios demoram dias | Report C-level gerado por IA em 30s |
| Tesoureiro | Controle de caixa em planilha | Projeção de caixa com cenários |

### ATENDIMENTO
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Atendente SAC | Respostas repetitivas | Bot de resposta automática multi-canal |
| Supervisor CS | Não sabe qualidade do atendimento | Análise de sentimento + score automático |
| Head de CX | NPS baixo, não sabe por quê | Dashboard de voz do cliente + insights |

### DESIGN & CRIATIVO
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Designer Gráfico | Briefings vagos, retrabalho | Geração de criativos via prompt (GPT Image) |
| Social Media Designer | Volume alto, pouca variação | Batch de criativos com variações automáticas |
| Brand Manager | Consistência visual | Style guide enforcer + review automático |

### REDES SOCIAIS & MARKETING
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Social Media Manager | Postar manualmente em 5 canais | Agendamento multi-plataforma (IG, FB, LinkedIn) |
| Community Manager | Responder DMs/comentários | Bot de engajamento com tom da marca |
| Gestor de Tráfego (Media Buyer) | Otimização manual de campanhas | Alerta de campanhas ruins + sugestão de ação |
| Growth Hacker | Testar hipóteses leva dias | A/B test automático de copies e criativos |

### DADOS & BI
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Analista de Dados | SQL manual, tempo em queries | NL-to-SQL + visualização automática |
| BI Analyst | Dashboards demoram para criar | Dashboard builder por linguagem natural |
| Data Engineer | ETL manual | Pipelines de dados via MCP + automação |
| CDO | Dados espalhados, sem single source | Conector universal (Sheets, Notion, DB, APIs) |

### C-LEVEL
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| CEO | Informação fragmentada, reuniões longas | Briefing diário automático + decision support |
| COO | Processos ineficientes, sem visibilidade | Process mining + alertas operacionais |
| CFO | Relatórios financeiros lentos | Financial copilot + projeções |
| CTO | Débito técnico invisível | Codebase health + sprint planning AI |
| CMO | ROI de marketing obscuro | Attribution dashboard + recomendações |

### MERCADO FINANCEIRO
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Trader | Muita informação, pouco tempo | News digest + sentiment analysis real-time |
| Gestor de Ações | Portfólio em planilha | Portfolio tracker + alertas de threshold |
| Analista Fundamentalista | Ler balanços leva horas | Extração automática de demonstrações + comparativo |
| Quant | Backtesting complexo | Python sandbox + data feeds via MCP |

### JURÍDICO
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Advogado | Revisão de contratos demorada | Contract review + highlight de cláusulas de risco |
| Paralegal | Pesquisa jurisprudencial manual | Search + resumo de decisões |

### RH & PEOPLE
| Cargo | Dor | Feature AdOS |
|-------|-----|-------------|
| Recrutador | Triagem de CVs manual | CV scoring + fit analysis automático |
| HRBP | Pesquisa de clima lenta | Análise de sentimento + sugestões |
| Head de People | Turnover sem explicação | Predictive analytics de retenção |

---

## Sprint Plan — 30 Sprints de 5 Dias

### MÊS 1: FUNDAÇÃO + FINANCEIRO + ATENDIMENTO (Sprints 1-6)

| Sprint | Dias | Feature | Cargo-alvo |
|--------|------|---------|-----------|
| 1 | D1-D5 | **Backend API Gateway** — Auth, token vault, LLM router básico | Infraestrutura |
| 2 | D6-D10 | **Billing + Onboarding** — Stripe, planos, flow de signup no desktop | Infraestrutura |
| 3 | D11-D15 | **Financial Dashboard Builder** — importar CSV/OFX, classificação automática, DRE | Analista Financeiro, Controller |
| 4 | D16-D20 | **Cash Flow Projector** — projeção de caixa com cenários otimista/pessimista/base | CFO, Tesoureiro |
| 5 | D21-D25 | **SAC Bot Builder** — criar bot de atendimento com base de conhecimento + multi-canal | Atendente, Supervisor CS |
| 6 | D26-D30 | **Customer Sentiment Dashboard** — análise de tickets/mensagens, NPS tracker, voz do cliente | Head CX |

### MÊS 2: MARKETING + REDES SOCIAIS (Sprints 7-12)

| Sprint | Dias | Feature | Cargo-alvo |
|--------|------|---------|-----------|
| 7 | D31-D35 | **Instagram Scheduler** — criar posts, agendar, preview de feed, hashtag suggestions | Social Media Manager |
| 8 | D36-D40 | **Facebook Page Manager** — gerenciar páginas, responder comentários, métricas | Community Manager |
| 9 | D41-D45 | **Creative Generator** — batch de criativos com variações (GPT Image + templates) | Designer, Social Media Designer |
| 10 | D46-D50 | **Campaign Health Monitor** — alertas de ROAS baixo, sugestão de ação, pause automático | Media Buyer, Gestor de Tráfego |
| 11 | D51-D55 | **Copy Generator + A/B** — gerar copies, testar variações, report de winner | Growth Hacker |
| 12 | D56-D60 | **Multi-Platform Publisher** — postar simultâneo IG + FB + LinkedIn + X | Social Media Manager |

### MÊS 3: DADOS + BI + C-LEVEL (Sprints 13-18)

| Sprint | Dias | Feature | Cargo-alvo |
|--------|------|---------|-----------|
| 13 | D61-D65 | **NL-to-SQL Engine** — pergunte em português, receba dados + gráfico | Analista de Dados |
| 14 | D66-D70 | **Dashboard Builder NL** — "crie um dashboard de vendas por região" → dashboard pronto | BI Analyst |
| 15 | D71-D75 | **Universal Data Connector** — MCP servers para Sheets, Notion, Postgres, MySQL, APIs REST | Data Engineer, CDO |
| 16 | D76-D80 | **CEO Daily Briefing** — resumo automático do dia anterior (vendas, tickets, campanhas, caixa) | CEO |
| 17 | D81-D85 | **COO Operations Radar** — process mining, gargalos, alertas de SLA, heatmap de eficiência | COO |
| 18 | D86-D90 | **CFO Financial Copilot** — projeções, scenario planning, report board-ready em 1 prompt | CFO |

### MÊS 4: MERCADO FINANCEIRO + JURÍDICO + RH (Sprints 19-24)

| Sprint | Dias | Feature | Cargo-alvo |
|--------|------|---------|-----------|
| 19 | D91-D95 | **Market News Digest** — curadoria de notícias + sentiment por ativo/setor | Trader |
| 20 | D96-D100 | **Portfolio Tracker** — importar carteira, tracking em tempo real, alertas de threshold | Gestor de Ações |
| 21 | D101-D105 | **Balance Sheet Extractor** — upload de PDF/DFP → dados estruturados + comparativo | Analista Fundamentalista |
| 22 | D106-D110 | **Contract Reviewer** — upload contrato → highlights de risco, sugestões, resumo | Advogado, Paralegal |
| 23 | D111-D115 | **CV Scorer + Fit Analysis** — upload de vagas + CVs → ranking com justificativa | Recrutador |
| 24 | D116-D120 | **People Analytics** — turnover prediction, clima organizacional, sugestões de retenção | HRBP, Head of People |

### MÊS 5: ENTERPRISE + POLISH + SCALE (Sprints 25-30)

| Sprint | Dias | Feature | Cargo-alvo |
|--------|------|---------|-----------|
| 25 | D121-D125 | **WhatsApp Business Gateway** — enviar/receber via WhatsApp, templates, automações | Atendimento, Vendas |
| 26 | D126-D130 | **Multi-Workspace + SSO** — enterprise onboarding, team management, permissões por cargo | Enterprise |
| 27 | D131-D135 | **Audit Trail + Compliance** — log de todas as ações, export, retenção configurável | Compliance, Jurídico |
| 28 | D136-D140 | **CTO Tech Radar** — health check de repos, debt score, sprint planning AI | CTO |
| 29 | D141-D145 | **CMO Attribution Dashboard** — multi-touch attribution, channel ROI, budget optimizer | CMO |
| 30 | D146-D150 | **Marketplace v2 + Revenue Share** — criadores publicam skills, monetizam, ecosystem flywheel | Todos |

---

## KPIs de Sucesso por Mês

| Mês | Meta | Métrica |
|-----|------|---------|
| 1 | Backend live + 10 beta testers | API respondendo, 2 features financeiras |
| 2 | 50 beta testers + marketing features | Instagram scheduler funcionando, 3 empresas piloto |
| 3 | 100 usuários + plano pago | 20 pagantes, NL-to-SQL funcional |
| 4 | 200 usuários + expansão de nicho | Mercado financeiro + jurídico ativos |
| 5 | 500 usuários + marketplace vivo | 10 skills publicadas por terceiros, MRR R$15k+ |

---

## Stack de Implementação

### Backend (novo repo)
```
ados-cloud/
├── src/
│   ├── api/          — Fastify routes
│   ├── auth/         — Clerk integration
│   ├── billing/      — Stripe subscriptions
│   ├── llm/          — Multi-provider router
│   ├── vault/        — Token encryption (KMS)
│   ├── sync/         — E2E encrypted sync
│   ├── mcp-proxy/    — Hosted MCP servers
│   └── marketplace/  — Skills hub
├── prisma/           — Database schema
├── Dockerfile
└── railway.json
```

### Infra
- **Runtime:** Node.js 22 + Fastify
- **DB:** Postgres (Neon) + Redis (Upstash)
- **Auth:** Clerk
- **Billing:** Stripe
- **Hosting:** Railway (auto-scale)
- **Secrets:** AWS KMS
- **CDN:** Cloudflare (assets + marketplace)
- **Monitoring:** Sentry + Grafana Cloud (free tier)

---

## Priorização de Cargos (por TAM e willingness-to-pay)

| Prioridade | Cargo | TAM Brasil | Ticket médio | Sprint |
|-----------|-------|-----------|-------------|--------|
| 🔴 Alta | Media Buyer / Gestor de Tráfego | 50k+ | R$297/mês | 10 |
| 🔴 Alta | Social Media Manager | 200k+ | R$97/mês | 7-8 |
| 🔴 Alta | CEO / Empresário | 500k+ | R$297-997/mês | 16 |
| 🟡 Média | Analista Financeiro | 100k+ | R$97/mês | 3-4 |
| 🟡 Média | Analista de Dados / BI | 80k+ | R$297/mês | 13-14 |
| 🟡 Média | Gestor de Ações / Trader | 30k+ | R$297/mês | 19-20 |
| 🟢 Baixa (alto ticket) | Enterprise (CxO suite) | 10k+ | R$997/mês | 25-27 |

---

## Diferencial vs Concorrência

| Concorrente | Fraqueza | AdOS resolve |
|-------------|----------|-------------|
| ChatGPT | Genérico, sem integração real | Tool calling + MCP + browser automation |
| n8n | Técnico demais para empresário | Interface de chat, zero-code |
| Zapier | Caro, sem IA nativa | IA como core, automação como extensão |
| Cursor/Windsurf | Só para devs | Para qualquer cargo, zero-code |
| Notion AI | Preso no Notion | Conecta qualquer fonte |
| Jasper | Só copywriting | Full-stack: dados, automação, execução |

---

## Conclusão

O AdOS se posiciona como o **"funcionário de IA all-in-one"** que substitui operações repetitivas em qualquer departamento. O modelo managed (tokens conosco) elimina a barreira técnica e cria receita recorrente previsível.

**Meta de 5 meses:** 500 usuários, MRR R$15k+, 30 features entregues, cobrindo 15+ cargos empresariais.
