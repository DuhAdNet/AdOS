# JVOS — Skills Nativas (Built-in)

## Filosofia: Plug-and-Play, Pay-to-Win

O usuário paga, abre o JVOS, e no minuto 1 já tem skills funcionais que resolvem dor real.
Não precisa configurar, criar prompts, ou entender IA. **Funcionou? Usa. Quer mais? Upgrade.**

---

## Público-alvo Primário

**Empresários (donos/CEOs de PMEs)** que querem:
- Automatizar cadeiras operacionais (assistente, analista, secretária)
- Ter visão consolidada do negócio
- Delegar tarefas repetitivas à IA
- Parar de depender de "quem sabe mexer no ChatGPT"

**Público secundário:** Colaboradores que otimizam suas próprias tarefas dentro da empresa.

---

## Categorias de Skills Nativas

### 1. OPERAÇÕES DO DIA A DIA (Chief of Staff)

| Skill | O que faz | Gatilho sugerido |
|-------|-----------|------------------|
| **daily-briefing** | Resumo matinal: agenda, e-mails prioritários, métricas-chave, pendências de ontem | Automático às 8h ou ao abrir |
| **inbox-triage** | Classifica e-mails/mensagens em: Urgente, Ação, Informação, Lixo | Manual ou automático |
| **meeting-prep** | Puxa contexto de pessoas + últimas interações + agenda → gera briefing pré-reunião | 30min antes de cada meeting |
| **meeting-notes** | Transcreve reunião (áudio/vídeo) → extrai decisões, action items, responsáveis | Pós-reunião |
| **task-distributor** | Distribui tarefas entre equipe considerando carga, prioridade e dependências | Manual + semanal automático |
| **follow-up-tracker** | Monitora pendências delegadas e cobra automaticamente via canal configurado | Diário |

### 2. COMUNICAÇÃO (Voice of the Boss)

| Skill | O que faz | Gatilho |
|-------|-----------|---------|
| **email-composer** | Escreve e-mails no tom do usuário (aprende estilo com o tempo) | Manual |
| **message-responder** | Sugere respostas para Slack/WhatsApp/Telegram com contexto | Ao receber mensagem |
| **announcement-writer** | Cria comunicados internos (novidades, decisões, mudanças) | Manual |
| **feedback-writer** | Gera feedback estruturado para colaboradores baseado em inputs do gestor | Manual |
| **proposal-builder** | Monta propostas comerciais a partir de briefing rápido | Manual |

### 3. ANÁLISE E RELATÓRIOS (Data Brain)

| Skill | O que faz | Gatilho |
|-------|-----------|---------|
| **metrics-dashboard** | Puxa KPIs de fontes conectadas e monta visão consolidada | Automático semanal + manual |
| **report-generator** | Gera relatórios formatados (PDF/HTML) a partir de dados | Manual |
| **trend-analyzer** | Identifica tendências em séries temporais (vendas, leads, custos) | Semanal automático |
| **budget-tracker** | Monitora gastos vs. orçamento, alerta desvios | Automático |
| **team-performance** | Analisa produtividade da equipe com base em entregas e prazos | Semanal |

### 4. AUTOMAÇÃO DE PROCESSOS (Process Engine)

| Skill | O que faz | Gatilho |
|-------|-----------|---------|
| **recurring-tasks** | Cria e gerencia tarefas recorrentes com agendamento flexível | Configurável |
| **approval-flow** | Fluxo de aprovação: algo precisa de OK do chefe → notifica → aprova/rejeita | Evento |
| **onboarding-helper** | Gera checklist e materiais para onboarding de novo colaborador | Ao adicionar pessoa |
| **sop-creator** | Documenta processos (POP) a partir de descrição falada ou escrita | Manual |
| **invoice-processor** | Lê faturas/notas fiscais, extrai dados, categoriza, alerta vencimentos | Ao receber documento |

### 5. PESQUISA E INTELIGÊNCIA (Research Hub)

| Skill | O que faz | Gatilho |
|-------|-----------|---------|
| **competitor-watch** | Monitora concorrentes (preços, features, movimentos) | Semanal |
| **market-research** | Pesquisa temas de mercado com fontes e síntese | Manual |
| **tool-finder** | Recomenda ferramentas/serviços para necessidades específicas | Manual |
| **regulation-check** | Verifica implicações regulatórias de decisões (tributário, trabalhista) | Manual |
| **hiring-screener** | Analisa CVs e perfis vs. requisitos da vaga, gera ranking de fit | Ao receber CVs |

### 6. CONTEÚDO E MARKETING (Content Machine)

| Skill | O que faz | Gatilho |
|-------|-----------|---------|
| **social-writer** | Cria posts para redes sociais no tom da marca | Manual + calendário |
| **blog-writer** | Escreve artigos SEO-friendly a partir de briefing | Manual |
| **ad-copywriter** | Gera copies para anúncios (Meta, Google) com variações A/B | Manual |
| **content-calendar** | Planeja calendário editorial para o mês | Mensal |
| **brand-voice** | Define e mantém guia de tom de voz da marca (aprende com exemplos) | Setup + evolução |

---

## Modelo de Entrega

### Tier FREE (Prova de Valor)
- 5 skills básicas funcionais (daily-briefing, email-composer, meeting-notes, report-generator, task-distributor)
- Limite de 50 execuções/mês
- 1 integração (Gmail OR Slack OR Calendar)

### Tier PRO (R$197/mês)
- Todas as 30 skills nativas
- Execuções ilimitadas
- Integrações ilimitadas
- Automações agendadas
- Marketplace (instalar skills da comunidade)

### Tier BUSINESS (R$497/mês)
- Tudo do PRO
- Multi-usuário (até 10 seats)
- Skills customizadas com assistência IA
- Prioridade no processamento
- White-label parcial (logo próprio)

### Tier ENTERPRISE (custom)
- Seats ilimitados
- Deploy on-premise
- Skills exclusivas desenvolvidas sob demanda
- SLA garantido
- API de integração dedicada

---

## Diferencial Competitivo vs ChatGPT/Claude

| Aspecto | ChatGPT/Claude | JVOS |
|---------|---------------|------|
| Setup | Prompt manual toda vez | Configurado 1x, funciona sempre |
| Contexto | Perde a cada conversa | Memória persistente + workspace state |
| Automação | Zero | Agendamentos + triggers |
| Integrações | Limitado (plugins) | Gmail, Slack, Sheets, Calendar, Meta, etc. |
| Multi-agente | Único modelo | Router inteligente → agente especializado |
| Entrega | Texto na tela | Arquivos, relatórios, e-mails enviados, tarefas criadas |
| Para empresário | "Ferramenta de IA" | "Funcionário IA que já sabe o que fazer" |
| Personalização | Prompt toda vez | Aprende tom, preferências, rotina |
| Colaboração | Individual | Multi-seat com contexto compartilhado |

---

## Arquitetura de Skills Nativas

```
skill-nativa/
├── metadata.json          # nome, slug, descrição, categoria, tier
├── instructions.md        # prompt principal da skill
├── triggers.json          # quando executar (manual, schedule, event)
├── integrations.json      # quais sources precisa (gmail, calendar, etc.)
├── templates/             # templates de output (relatório, email, etc.)
│   ├── output-default.md
│   └── output-pdf.html
└── examples/              # exemplos de uso para onboarding
    ├── example-1.json
    └── example-2.json
```

### Execução de Skill

```
Trigger (manual/schedule/event)
    ↓
[Verificar integrações conectadas]
    ↓
[Carregar contexto: prefs + memories + workspace state]
    ↓
[Montar prompt: instructions.md + contexto + input do usuário]
    ↓
[Executar via agent adequado (router decide)]
    ↓
[Output → formato configurado (chat, arquivo, email, notificação)]
    ↓
[Salvar em memória se relevante]
```

---

## Onboarding Plug-and-Play (Primeiros 5 Minutos)

```
1. Instala JVOS (1 click)
2. Cria conta (email + senha)
3. Wizard rápido (3 telas):
   - "Qual seu cargo?" → CEO / Gestor / Operacional / Outro
   - "O que mais toma seu tempo?" → checkboxes (emails, reuniões, relatórios, tarefas, etc.)
   - "Conecte 1 ferramenta" → Gmail / Slack / Calendar
4. JVOS ativa as skills relevantes automaticamente
5. Primeira skill roda: Daily Briefing com dados reais
6. Usuário vê valor no minuto 1
```

---

## Skills Prioritárias para MVP (Top 10)

Ordem de implementação baseada em:
- Impacto percebido pelo empresário
- Complexidade técnica
- Dependência de integrações

| # | Skill | Impacto | Complexidade | Integração |
|---|-------|---------|-------------|------------|
| 1 | **daily-briefing** | Alto | Média | Calendar + Email |
| 2 | **email-composer** | Alto | Baixa | Gmail |
| 3 | **meeting-notes** | Alto | Média | Audio/transcrição |
| 4 | **inbox-triage** | Alto | Média | Gmail |
| 5 | **report-generator** | Alto | Baixa | Nenhuma (dados no chat) |
| 6 | **task-distributor** | Médio | Média | Notion/Sheets |
| 7 | **follow-up-tracker** | Médio | Alta | Multi-canal |
| 8 | **sop-creator** | Médio | Baixa | Nenhuma |
| 9 | **metrics-dashboard** | Alto | Alta | Multi-fonte |
| 10 | **social-writer** | Médio | Baixa | Nenhuma |

---

## Implementação Técnica no JVOS Atual

### O que já existe:
- Sistema de skills (create_skill, DB, slug, instructions)
- Automações agendadas (cron, daily, weekly)
- Multi-agent routing (Router → Coder, Writer, Analyst, etc.)
- Memória persistente (workspace memories)
- Context enrichment (buildEnrichedPrompt com state vivo)
- MCP integrations (Gmail, Slack, Sheets, Calendar)
- Marketplace (instalar/publicar skills)

### O que precisa ser construído:
1. **Skill templates pré-instalados** — vir com o app, não precisar instalar
2. **Onboarding wizard** — 3 telas que configuram tudo
3. **Trigger engine** — skills disparadas por eventos (novo email, horário, etc.)
4. **Output routing** — skill decide onde entregar (chat, email, arquivo, notificação)
5. **Learning loop** — skill melhora com feedback do usuário (thumbs up/down)
6. **Usage metering** — contar execuções para tiers
7. **Skill discovery** — sugerir skills baseado no comportamento do usuário

---

## Mensagem de Venda

> **"Contrate um time de IA por menos que um estagiário."**
>
> O JVOS é seu assistente executivo que já chega treinado:
> organiza sua manhã, responde seus e-mails, prepara suas reuniões,
> cobra sua equipe, e gera seus relatórios.
>
> Sem prompts. Sem configuração. Sem "como eu peço isso pra IA?"
>
> Abriu, funcionou.
