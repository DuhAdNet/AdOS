# JVOS — Documentacao Tecnica Completa de Features

> Versao: 1.0.0 | Atualizado: 2026-05-17 | Autor: Documentacao gerada para CEO

---

## 1. Visao Geral

### O que e o JVOS

JVOS (Juviall AI Desktop) e um **sistema operacional de IA desktop** construido como aplicacao nativa. Ele funciona como um "Chief of Staff" digital — um agente de IA com acesso total ao sistema operacional, navegador, APIs externas e automacoes.

### Para quem

- **CEOs e gestores** que precisam de um assistente executivo inteligente
- **Operadores de campanhas** (media buyers, social media managers)
- **Analistas** (dados, financeiro, BI)
- **Qualquer profissional** que quer automatizar operacoes repetitivas sem saber programar

### Proposta de Valor

| Problema | Solucao JVOS |
|----------|-------------|
| ChatGPT e generico, sem acao real | JVOS executa (cria arquivos, navega web, envia emails, monitora sites) |
| n8n/Zapier sao tecnicos demais | Interface de chat natural, zero-code |
| Ferramentas fragmentadas | Um unico ponto de controle para tudo |
| IA consome tokens ate para monitorar | Actions Engine e Listeners operam com ZERO tokens |
| Dados sensiveis na cloud | Desktop-first: tudo local no SQLite |

---

## 2. Arquitetura Tecnica

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Desktop Framework | Electron 33 |
| Frontend | React 19 + Vite + Tailwind CSS |
| Banco de Dados | SQLite (sql.js) — arquivo local `ados.db` |
| LLM Providers | OpenAI, Anthropic, Google, Groq, OpenRouter |
| Protocolo de Tools | MCP (Model Context Protocol) |
| Browser Automation | BrowserWindow nativo do Electron |
| Notifications | Electron Notification API nativa |
| Marketplace | Skills + Workflows com versionamento |

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JVOS Desktop App                             │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    RENDERER (React + Vite)                     │  │
│  │                                                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │   Chat   │ │  NavRail │ │  Sessions  │ │  Dashboards   │  │  │
│  │  │  (main)  │ │ (12 pgs) │ │   Panel    │ │  (widgets)    │  │  │
│  │  └──────────┘ └──────────┘ └────────────┘ └───────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │ Browser  │ │   Tools  │ │ Marketplace│ │  Automations  │  │  │
│  │  │  Panel   │ │  Steps   │ │   (UI)     │ │    (UI)       │  │  │
│  │  └──────────┘ └──────────┘ └────────────┘ └───────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │ IPC (preload)                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    MAIN PROCESS (Electron)                     │  │
│  │                                                                │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │  LLM     │ │  Tools   │ │  Actions   │ │  Listeners    │  │  │
│  │  │ (multi)  │ │ (20+)    │ │  Engine    │ │  (5 tipos)    │  │  │
│  │  └──────────┘ └──────────┘ └────────────┘ └───────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │ Database │ │  Browser │ │  Telegram  │ │  Scheduler    │  │  │
│  │  │ (SQLite) │ │  (auto)  │ │   (bot)    │ │  (cron)       │  │  │
│  │  └──────────┘ └──────────┘ └────────────┘ └───────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐  │  │
│  │  │  MCP     │ │  Agents  │ │  OAuth     │ │  Auto-Memory  │  │  │
│  │  │ Manager  │ │ (router) │ │  (Google)  │ │  (extract)    │  │  │
│  │  └──────────┘ └──────────┘ └────────────┘ └───────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                    │                     │
         ▼                    ▼                     ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────┐
│  LLM APIs   │    │ Google Workspace│    │   Telegram   │
│ OpenAI      │    │ Gmail, Calendar │    │   Bot API    │
│ Anthropic   │    │ Sheets, OAuth   │    │              │
│ Google      │    │                 │    │              │
│ Groq        │    │                 │    │              │
│ OpenRouter  │    │                 │    │              │
└─────────────┘    └─────────────────┘    └──────────────┘
```

### Estrutura de Arquivos do Projeto

```
AdOS/
├── electron/                   # Main process (backend)
│   ├── main.ts                 # Bootstrapper — registra todos os handlers
│   ├── llm.ts                  # Multi-provider LLM com streaming + tool loop
│   ├── tools.ts                # 20+ ferramentas built-in (filesystem, browser, admin)
│   ├── actions-engine.ts       # Motor de execucao zero-tokens (18 action types)
│   ├── listeners.ts            # Monitoramento externo (Gmail, Calendar, Sheets, Uptime, Slack)
│   ├── telegram.ts             # Bot Telegram com auto-reply via LLM
│   ├── database.ts             # SQLite schema + CRUD completo (17 tabelas)
│   ├── browser.ts              # Browser automation (janela separada por sessao)
│   ├── scheduler.ts            # Cron engine para automacoes recorrentes
│   ├── agents.ts               # Multi-agent system com router + 7 agentes especializados
│   ├── mcp-manager.ts          # Gerenciador de MCP servers (stdio/SSE/HTTP)
│   ├── auto-memory.ts          # Extracao automatica de memorias das conversas
│   ├── oauth.ts                # Google OAuth2 (Gmail, Calendar, Sheets)
│   ├── providers.ts            # Gerenciamento de API keys (encrypted)
│   ├── notifications.ts        # Notificacoes nativas do OS
│   ├── integrations.ts         # Integracoes extras
│   ├── jvossys-bridge.ts       # Bridge para sistema JVOS Cloud
│   └── preload.ts              # Bridge segura IPC (contextIsolation)
├── src/                        # Renderer (frontend)
│   ├── pages/                  # 15 paginas de UI
│   │   ├── Chat.tsx            # Chat principal com multi-modelo
│   │   ├── Actions.tsx         # Gerenciador de Action Flows
│   │   ├── Automations.tsx     # Automacoes agendadas
│   │   ├── Brain.tsx           # Memoria persistente
│   │   ├── Dashboards.tsx      # Sistema de widgets/dashboards
│   │   ├── Marketplace.tsx     # Skills e workflows compartilhados
│   │   ├── Telegram.tsx        # Configuracao do bot Telegram
│   │   ├── Tools.tsx           # MCP servers e ferramentas
│   │   ├── Labels.tsx          # Sistema de labels para sessoes
│   │   ├── Sharing.tsx         # Compartilhamento publico de sessoes
│   │   ├── Settings.tsx        # Configuracoes gerais
│   │   ├── Preferences.tsx     # Preferencias do usuario
│   │   ├── Shortcuts.tsx       # Atalhos de teclado customizaveis
│   │   ├── HealthCheck.tsx     # Diagnostico do sistema
│   │   └── CloudSync.tsx       # Sincronizacao cloud
│   └── components/             # Componentes reutilizaveis
│       ├── NavRail.tsx         # Barra de navegacao lateral (12 destinos)
│       ├── SessionPanel.tsx    # Painel de sessoes (historico)
│       ├── MessageBubble.tsx   # Bolha de mensagem com Markdown
│       ├── BrowserPanel.tsx    # Controles do browser integrado
│       ├── BrowserPill.tsx     # Indicador de browser ativo
│       ├── ToolSteps.tsx       # Visualizacao de tool calls em tempo real
│       ├── AutocompletePopup.tsx # Autocomplete para /skills e @workflows
│       ├── VoiceInput.tsx      # Input de voz (Whisper/Gemini)
│       ├── ErrorBoundary.tsx   # Captura de erros graceful
│       ├── Toast.tsx           # Notificacoes in-app
│       ├── Skeleton.tsx        # Loading states
│       ├── SetupWizard.tsx     # Onboarding primeiro uso
│       ├── TitleBar.tsx        # Barra de titulo customizada (frameless)
│       └── Sidebar.tsx         # Layout responsivo
└── docs/                       # Documentacao
```

### Banco de Dados — 17 Tabelas

| Tabela | Funcao |
|--------|--------|
| `sessions` | Sessoes de chat (id, titulo, favorito, arquivada) |
| `messages` | Mensagens (role, content, session_id) |
| `settings` | Configuracoes globais (key-value) |
| `connections` | MCP servers e conexoes externas |
| `skills` | Skills invocaveis via /slug |
| `workflows` | Workflows invocaveis via @slug |
| `memories` | Memoria persistente (brain) |
| `permissions` | Regras de acesso para ferramentas |
| `labels` | Labels com cores e auto-pattern (regex) |
| `session_labels` | Relacao N:N sessao-label |
| `shortcuts` | Atalhos de teclado customizaveis |
| `preferences` | Perfil do usuario (nome, timezone, tom) |
| `shared_sessions` | Sessoes publicadas com link publico |
| `telegram_pairings` | Vinculos Telegram chat <-> sessao JVOS |
| `dashboards` | Dashboards com layout de widgets |
| `automations` | Agendamentos recorrentes |
| `session_settings` | Config por sessao (modelo, prompt) |
| `action_flows` | Flows do Actions Engine |
| `action_logs` | Logs de execucao dos flows |
| `listeners` | Listeners ativos (monitoramento) |
| `listener_events` | Eventos detectados pelos listeners |

---

## 3. Funcionalidades Core

### 3.1 Chat Multi-Modelo

O chat suporta **6 providers** e dezenas de modelos com roteamento automatico:

| Provider | Modelos Suportados | API Usada |
|----------|-------------------|-----------|
| OpenAI | gpt-5.5, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3, o4-mini, codex-mini | Responses API + Chat Completions |
| Anthropic | claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5 | Messages API (nativa) |
| Google | gemini-2.5-pro, gemini-2.5-flash | Generative AI API (nativa) |
| Groq | llama, mixtral, whisper-large-v3 | OpenAI-compatible |
| OpenRouter | qualquer modelo com / no nome | OpenAI-compatible |
| OpenAI OAuth | via ChatGPT login (Codex endpoint) | Responses API |

**Funcionalidades do Chat:**

- **Streaming em tempo real** — resposta aparece token a token
- **Tool calling em loop** — ate 30 iteracoes por mensagem (LLM usa ferramentas, recebe resultado, continua)
- **Multimodal** — suporte a imagens (base64) em todos os providers
- **Transcricao de voz** — Whisper (Groq/OpenAI) ou Gemini como fallback
- **Modos de esforco** — Fast (nano), Balanced (mini), Smart (4.1)
- **Reasoning levels** — Sem raciocinio / o4-mini / o3
- **Stop/Cancel** — AbortController para interromper a qualquer momento
- **Fallback automatico** — se um modelo falha, tenta modelo alternativo
- **Autocomplete** — `/` lista skills, `@` lista workflows
- **Sugestoes contextuais** — cards de acao rapida no chat vazio

### 3.2 Sistema de Sessoes

- Sessoes ilimitadas com titulo auto-gerado ou manual
- **Favoritos** — pin de sessoes importantes
- **Arquivo** — sessoes antigas ocultadas sem deletar
- **Labels** — organizacao por categorias com cores customizaveis
- **Auto-labels** — regex patterns que classificam automaticamente
- **Compartilhamento** — gerar link publico de uma sessao
- **Config por sessao** — modelo e prompt diferentes por sessao
- **Telegram pairing** — vincular sessao a um chat do Telegram

### 3.3 Sistema de Memoria (Brain)

O Brain e a memoria persistente de longo prazo do JVOS:

- **Memorias manuais** — usuario salva via tool `save_memory` ou UI
- **Memorias automaticas** — `auto-memory.ts` extrai insights de conversas (usando gpt-4.1-nano)
- **Categorias** — general, user, project, feedback, reference, decision, preference, contact
- **Deduplicacao** — verifica similaridade (80%+ de palavras) antes de salvar
- **Enriquecimento do prompt** — memorias sao injetadas no system prompt de toda conversa
- **Busca** — pesquisa por texto em memorias salvas

### 3.4 Ferramentas Built-in (Tools)

O JVOS vem com **20+ ferramentas nativas** que a IA pode chamar:

| Ferramenta | Funcao |
|-----------|--------|
| `read_file` | Ler conteudo de arquivo |
| `write_file` | Criar/escrever arquivo (HTML, reports, codigo) |
| `list_directory` | Listar diretorio |
| `create_directory` | Criar pasta |
| `run_command` | Executar comando shell (30s timeout) |
| `open_browser` | Abrir URL no browser integrado |
| `search_web` | Buscar na web via DuckDuckGo |
| `browser_click` | Clicar em elemento (por texto ou CSS selector) |
| `browser_type` | Digitar em input no browser |
| `browser_get_elements` | Listar elementos interativos da pagina |
| `create_skill` | Criar nova skill |
| `create_workflow` | Criar novo workflow |
| `create_automation` | Criar automacao agendada |
| `add_mcp_server` | Registrar servidor MCP |
| `save_memory` | Salvar na memoria persistente |
| `list_skills` | Listar skills cadastradas |
| `list_workflows` | Listar workflows |
| `list_automations` | Listar automacoes |
| `create_action_flow` | Criar flow do Actions Engine |
| `execute_action_flow` | Executar flow existente |
| `list_action_flows` | Listar flows |
| `create_listener` | Criar listener de monitoramento |
| `list_listeners` | Listar listeners ativos |

**Diretorio de documentos:** `~/Documents/JVOS/` com subpastas automaticas:
- `dashboards/` — HTMLs gerados
- `reports/` — PDFs, CSVs, XLSXs
- `skills/` — scripts (py, js, ts, sh)
- `projects/` — projetos
- `downloads/` — downloads

### 3.5 Multi-Agent System

O JVOS possui um **sistema de agentes hierarquico** com roteamento inteligente:

```
┌─────────────────────────────────────────────────┐
│                   USER MESSAGE                    │
└─────────────────────────┬───────────────────────┘
                          ▼
┌─────────────────────────────────────────────────┐
│              ROUTER (gpt-4.1-nano)               │
│   Classifica: precisa de tools? E puro texto?    │
│   Custo: 0.1x                                    │
└──────┬──────────┬──────────┬──────────┬─────────┘
       ▼          ▼          ▼          ▼
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ direct   ││summarizer││  writer  ││  coder   │
│(tool use)││(nano,0.2x)││(mini,1x) ││(codex,5x)│
└──────────┘└──────────┘└──────────┘└──────────┘
       ▼
┌──────────┐┌──────────┐┌──────────┐
│researcher││ analyst  ││ executor │
│(mini,1x) ││(4.1, 5x) ││(mini,1x) │
└──────────┘└──────────┘└──────────┘
```

| Agente | Modelo | Tier | Ferramentas | Max Iteracoes |
|--------|--------|------|-------------|---------------|
| Router | gpt-4.1-nano | Fast (0.2x) | nenhuma | 1 |
| Summarizer | gpt-4.1-nano | Fast (0.2x) | nenhuma | 1 |
| Writer | gpt-4.1-mini | Balanced (1x) | write_file | 3 |
| Coder | codex-mini-latest | Power (5x) | todas | 10 |
| Researcher | gpt-4.1-mini | Balanced (1x) | search_web, open_browser | 5 |
| Analyst | gpt-4.1 | Power (5x) | read_file, run_command | 5 |
| Executor | gpt-4.1-mini | Balanced (1x) | todas | 8 |

---

## 4. Actions Engine — Motor de Execucao Zero-Tokens

O Actions Engine e um **motor de workflows que executa SEM consumir tokens de IA**. Cada flow e composto por nodes conectados que executam acoes deterministicas.

### 18 Tipos de Action (Nodes)

| Tipo | Categoria | Descricao |
|------|-----------|-----------|
| `http_request` | Network | Chamada HTTP/API (GET/POST/PUT/DELETE) |
| `send_email` | Communication | Enviar email via Gmail API |
| `send_slack` | Communication | Postar mensagem em canal Slack |
| `read_sheet` | Data | Ler dados de Google Sheets |
| `update_sheet` | Data | Escrever dados em Google Sheets |
| `calendar_read` | Productivity | Listar eventos do Google Calendar |
| `calendar_create` | Productivity | Criar evento no Calendar |
| `create_file` | Filesystem | Criar/escrever arquivo no disco |
| `read_file` | Filesystem | Ler arquivo do disco |
| `run_command` | System | Executar comando shell |
| `ping_url` | Monitoring | Verificar se URL responde + tempo |
| `condition` | Logic | If/else com operadores (equals, contains, >, <, empty) |
| `loop` | Logic | Iterar sobre array de items |
| `delay` | Logic | Esperar N milissegundos |
| `set_variable` | Logic | Armazenar valor para uso posterior |
| `transform_data` | Data | Filtrar, mapear, ordenar, contar, somar dados |
| `notify` | System | Enviar notificacao no JVOS |
| `save_memory` | System | Persistir informacao na memoria |

### Anatomia de um Flow

```json
{
  "id": "flow_1715000000_abc123",
  "name": "Alerta de site fora do ar",
  "trigger": { "type": "listener", "config": { "listenerId": "lst_xyz" } },
  "nodes": [
    { "id": "n1", "type": "ping_url", "config": { "url": "https://meusite.com" }, "next": "n2" },
    { "id": "n2", "type": "condition", "config": { "left": "{{_lastOutput.ok}}", "right": "false", "operator": "equals" }, "next": "n3", "onError": null },
    { "id": "n3", "type": "send_slack", "config": { "channel": "#alerts", "text": "Site {{_lastOutput.url}} esta DOWN!" } }
  ],
  "variables": {},
  "enabled": true
}
```

### Triggers Suportados

| Tipo | Descricao |
|------|-----------|
| `manual` | Execucao sob demanda |
| `schedule` | Agendamento recorrente (via scheduler) |
| `listener` | Disparado por evento de um listener |
| `webhook` | Disparado por chamada HTTP externa |
| `event` | Disparado por evento interno do sistema |

### Interpolacao de Variaveis

Os nodes suportam templates com `{{variavel}}`:
- `{{_trigger}}` — dados do trigger
- `{{_lastOutput}}` — output do node anterior
- `{{_node_ID}}` — output de um node especifico
- `{{_loopItem}}` — item atual no loop
- `{{_loopIndex}}` — indice atual no loop
- Variaveis customizadas via `set_variable`

### Execucao e Logging

- Cada execucao gera um log (tabela `action_logs`)
- Metricas: nodes executados, tempo total, tokens usados (sempre 0), status, erros
- Notificacao em tempo real no frontend via IPC events
- Branching: `condition` pode desviar para `onError` path

---

## 5. Sistema de Listeners

Listeners monitoram fontes externas **continuamente** sem consumir tokens de IA. So notificam quando algo muda.

### 5 Tipos de Listener

| Tipo | Intervalo Padrao | O que monitora |
|------|-----------------|---------------|
| `gmail` | 60s | Novos emails (filtro customizavel) |
| `calendar` | 5min | Eventos proximos (lookAhead configuravel) |
| `sheets` | 2min | Mudancas em dados (compara estados) |
| `uptime` | 5min | Disponibilidade de URLs + response time |
| `slack` | 30s | Novas mensagens em canais especificos |

### Fluxo de Funcionamento

```
┌──────────┐    intervalo    ┌───────────┐    diff?    ┌──────────────┐
│  Timer   │ ─────────────► │  Check    │ ─────────► │  Emit Event  │
│ (30s-5m) │                │  Source   │    SIM     │  to UI       │
└──────────┘                └───────────┘            └──────┬───────┘
                                  │                          │
                                  │ NAO (sem mudanca)        ▼
                                  │                   ┌──────────────┐
                                  └──── (silencio) ───│ Trigger Flow │
                                                      │ (se conectado)│
                                                      └──────────────┘
```

### Detalhes por Tipo

**Gmail Listener:**
- Usa query do Gmail (ex: `is:unread from:@empresa.com`)
- Compara IDs de mensagens com ultimo estado
- Retorna: from, subject, date, snippet
- Busca detalhes de ate 5 novos emails por check

**Calendar Listener:**
- Monitora eventos nos proximos N minutos
- Detecta novos eventos que nao foram notificados
- Retorna: summary, start, end, attendees, minutesUntil, location

**Sheets Listener:**
- Compara JSON dos dados atuais vs. anterior
- Detecta: novas linhas, celulas alteradas
- Retorna: spreadsheetId, range, newRows, changedCells, lastRow

**Uptime Listener:**
- HEAD request com timeout de 10s
- Detecta: site_down, site_recovered, site_slow
- Threshold de lentidao configuravel (padrao 5000ms)
- Historico de status por URL

**Slack Listener:**
- Conversations.history API
- Filtra system messages (subtype)
- Retorna: channel, user, text, timestamp

### Conexao com Action Flows

Listeners podem **disparar Action Flows automaticamente**:
- Flow com `trigger.type = 'listener'` e `trigger.config.listenerId = ID`
- Filtro opcional por tipo de evento (`eventFilter`)
- Dados do evento sao passados como `_trigger` para o flow

---

## 6. Telegram Integration

### Arquitetura

```
┌──────────────┐         ┌───────────────────────┐
│  Telegram    │ ◄─────► │  JVOS (Long Polling)  │
│  Bot API     │         │                       │
│              │         │  ┌─────────────────┐  │
│  Usuarios    │ ──msg─► │  │  handleBotCmd() │  │
│  enviam      │         │  │  handleAutoReply│  │
│  mensagens   │         │  └─────────────────┘  │
└──────────────┘         │         │              │
                         │         ▼              │
                         │  ┌─────────────────┐  │
                         │  │  generateReply() │  │
                         │  │  (multi-provider)│  │
                         │  └─────────────────┘  │
                         └───────────────────────┘
```

### Funcionalidades

| Feature | Descricao |
|---------|-----------|
| Bot Token | Configuravel via UI ou `/set-token` |
| Long Polling | Auto-start no boot se token existe |
| Comandos | `/start`, `/help`, `/sessions`, `/select_N`, `/status`, `/unpair`, `/pair CODE` |
| Pareamento | Codigo de 6 digitos com TTL de 5 minutos |
| Auto-Reply | Mensagens processadas pela sessao pareada (via LLM) |
| Multi-Provider | Tenta OpenAI > Anthropic > Google > OAuth (fallback chain) |
| Bidirecional | Mensagens do Telegram salvam na sessao e vice-versa |
| Direcoes | `both` (bidirecional), `tg-to-session`, `session-to-tg` |
| Envio de midia | send_photo, send_document |
| Chat tracking | Memoriza todos os chats que interagem com o bot |

### Fluxo de Pareamento

1. No JVOS: usuario clica "Gerar Codigo" → recebe `123456`
2. No Telegram: usuario envia `/pair 123456` para o bot
3. Sistema cria vinculo `chat_id <-> session_id` no banco
4. A partir dai, toda mensagem no Telegram e processada pela sessao vinculada

---

## 7. Automacoes (Scheduler)

### Como funciona

O scheduler roda a cada **30 segundos**, verificando todas as automacoes ativas:

```typescript
// Verifica: dia da semana correto? Horario exato (HH:MM)? Ja rodou neste minuto?
shouldRunNow(schedule, lastRun) → boolean
```

### Tipos de Schedule

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| `schedule` | Horario fixo + dias da semana | "08:00 dias uteis" |
| `cron` | Expressao cron | "0 9 * * 1-5" |
| `interval` | A cada N minutos/horas | "a cada 30min" |
| `once` | Execucao unica futura | "2026-05-20 14:00" |

### Tipos de Acao

| Acao | O que faz |
|------|-----------|
| `new_session` | Cria nova sessao e executa prompt |
| `send_message` | Envia prompt para sessao ativa |
| `run_skill` | Executa skill por slug |

### Configuracao de Automacao

- **Nome e descricao**
- **Tipo de schedule** + horario + dias da semana
- **Tipo de acao** + skill slug ou prompt
- **Skills selecionadas** (para acao run_skill)
- **Working directory** (para contexto de execucao)
- **Toggle on/off** sem deletar

---

## 8. Marketplace

### Conceito

O Marketplace e o repositorio de **Skills** e **Workflows** reutilizaveis:

- **Skills** (`/slug`) — prompts reutilizaveis invocados com barra
- **Workflows** (`@slug`) — processos multi-step invocados com arroba

### Features do Marketplace

| Feature | Descricao |
|---------|-----------|
| Grid/List view | Visualizacao em cards ou lista compacta |
| Busca + filtros | Por nome, categoria, publisher |
| Categorias | Marketing, Finance, Engineering, Legal, Data, etc |
| Versionamento | Changelog por skill, release notes |
| Publishers | Perfis verificados (AdNet Core, Comunidade, Parceiros) |
| Beta channel | Skills em preview/beta antes de stable |
| Collections | Agrupamento por tema |
| Instalacao | 1-click para adicionar ao workspace |
| Ordenacao | Por nome, data, downloads, rating, atualizado |

### Modelo de Revenue Share (planejado)

- 70% para o criador
- 30% para a plataforma
- Via Stripe Connect

---

## 9. Browser Automation

### Arquitetura

Cada sessao pode ter seu **proprio browser** (BrowserWindow separada do Electron):

```
┌──────────────────┐         ┌──────────────────┐
│  JVOS Main       │ ◄─IPC─► │  Browser Window   │
│  (chat + tools)  │         │  (pagina web)     │
│                  │         │                   │
│  "clique no btn" │ ──────► │  executeJavaScript│
│  "digite email"  │ ──────► │  (DOM injection)  │
│  "screenshot"    │ ◄────── │  capturePage()    │
└──────────────────┘         └──────────────────┘
```

### Capacidades

| Funcao | Descricao |
|--------|-----------|
| `open_browser` | Abre URL e extrai titulo + texto |
| `search_web` | DuckDuckGo HTML scraping (8 resultados) |
| `browser_click` | Clique por texto ("text:Label") ou CSS selector |
| `browser_type` | Digitar em inputs (por selector ou focused) |
| `browser_get_elements` | Listar ate 50 elementos interativos da pagina |
| `browser:screenshot` | Captura de tela como PNG base64 |
| `browser:screenshot-to-chat` | Screenshot inserido diretamente no chat |
| `browser:get-selection` | Texto selecionado na pagina |
| `browser:pip` | Picture-in-Picture (always-on-top mini window) |
| `browser:execute-js` | Executar JavaScript arbitrario |
| `browser:back/forward/reload` | Navegacao padrao |
| `browser:history` | Historico de URLs por sessao (50 ultimas) |
| `browser:resize` | Redimensionar janela programaticamente |
| `browser:hide/show` | Ocultar/mostrar sem fechar |

### Sessoes Independentes

- Cada sessao JVOS pode ter seu proprio browser
- Cookies persistem (session partition padrao)
- URL tracking por sessao
- Estado comunicado ao frontend via `browser:state-changed`

---

## 10. UI/UX

### NavRail — Navegacao Principal

A NavRail e a barra lateral com **12 destinos** + Configuracoes:

| Icone | Pagina | Funcao |
|-------|--------|--------|
| Chat | Sessions | Chat principal + historico |
| Wrench | Tools | MCP servers + ferramentas |
| Zap | Automations | Automacoes agendadas |
| Lightning | Actions | Action Flows (zero-token) |
| Home | Marketplace | Skills e workflows |
| Brain | Brain | Memoria persistente |
| Send | Telegram | Configuracao do bot |
| Tag | Labels | Organizacao por categorias |
| Upload | Sharing | Sessoes compartilhadas |
| Grid | Dashboards | Widgets e metricas |
| Heart | Health Check | Diagnostico do sistema |
| Cloud | Cloud Sync | Sincronizacao |
| Gear | Settings | Configuracoes gerais |

- **Colapsavel** — modo icone-only ou icone + label
- **Animacoes** — scale 1.03 no item ativo, hover com scale 1.02
- **Dark theme** — fundo `bg-surface-1`, borders `border-default`

### Session Panel

- Lista de sessoes ordenada por `updated_at DESC`
- Indicadores visuais: favorito (estrela), labels (badges coloridos)
- Busca em tempo real por titulo
- Context menu: renomear, favoritar, arquivar, deletar
- Collapse/expand independente do NavRail

### Sistema de Temas

- **Dark mode** (padrao) — fundo escuro `#0b0f1a`
- **Light mode** — suportado via Tailwind
- Cores brand: `brand-500/600` (indigo)
- Accent colors para widgets: brand, green, red, yellow
- Transicoes CSS `transition-all duration-150/200`

### Componentes de Feedback

| Componente | Funcao |
|-----------|--------|
| `Toast` | Notificacoes temporarias (success, error, info) |
| `ErrorBoundary` | Captura erros React sem crashar o app |
| `Skeleton` | Loading states com shimmer |
| `ToolSteps` | Visualizacao step-by-step das tool calls |
| `SetupWizard` | Onboarding guiado no primeiro uso |

### Input de Voz

- Gravacao via MediaRecorder API
- Transcricao: Groq (Whisper) > OpenAI (Whisper) > Google (Gemini)
- Idioma padrao: portugues brasileiro
- UI: botao de microfone na caixa de input

### Atalhos de Teclado

- Customizaveis via pagina Shortcuts
- Armazenados no banco (`shortcuts` table)
- Toggle on/off por atalho

---

## 11. Sistema de Widgets/Dashboard

### Status Atual (Implementado)

A pagina Dashboards ja possui:

| Feature | Status |
|---------|--------|
| CRUD de dashboards | Implementado |
| Widgets de metricas | Implementado |
| Widgets de grafico (chart) | Implementado |
| Widgets de lista | Implementado |
| Widgets de texto/nota | Implementado |
| Widgets de goal (meta com progresso) | Implementado |
| DataSources (sessions, labels, memories, automations) | Implementado |
| Tamanhos S/M/L | Implementado |
| Templates pre-definidos | Implementado |
| Accent colors por widget | Implementado |
| Snapshot scheduling (daily/weekly) | Implementado |
| Compartilhamento de dashboard | Implementado |

### Tipos de Widget

| Tipo | Descricao | Tamanhos |
|------|-----------|----------|
| `metric` | KPI card com numero destaque | S, M |
| `chart` | Grafico de linha/barra | M, L |
| `list` | Lista de items (top N) | S, M, L |
| `text` | Bloco de texto livre | S, M |
| `goal` | Meta com barra de progresso + deadline | M |
| `note` | Nota adesiva editavel | S, M |

### DataSource de Widget

```typescript
interface WidgetDataSource {
  type: 'sessions' | 'labels' | 'memories' | 'mcpServers' | 'automations' | 'custom' | 'chat_metrics' | 'brain_stats';
  filter?: Record<string, any>;
  aggregation: 'count' | 'sum' | 'avg' | 'last';
  field?: string;
}
```

### Arquitetura Proposta (Evolucao)

A evolucao planejada inclui:

- **Widgets estilo Android** com refresh automatico por `refreshInterval`
- **Layout grid arrastavel** (drag-and-drop como home screen)
- **IA sugere proativamente** "salvar como widget" quando detecta analises recorrentes
- **Tipos expandidos**: Status (uptime/health), Clima, Calendario
- **Config avancada por widget**: dataSource (API/query/listener), refreshInterval, size (1x1, 2x1, 2x2)
- **Dashboard como destino automatico** de analises repetitivas

---

## 12. Integracoes Planejadas

### n8n Embedded

| Aspecto | Plano |
|---------|-------|
| Conceito | n8n rodando como servico dentro do JVOS |
| Integracao | Workflows n8n triggerados por listeners/actions |
| UI | Iframe ou panel dedicado |
| Status | Planejado (doc `INTEGRACAO-N8N.md` existe) |

### WhatsApp Listener (Evolution API)

| Aspecto | Plano |
|---------|-------|
| Conceito | Monitorar e responder WhatsApp via Evolution API |
| Similar a | Telegram integration (mesma logica) |
| Gateway | Self-hosted Evolution API ou servico cloud |
| Status | Planejado para Sprint 25 |

### Voice Interface

| Aspecto | Status |
|---------|--------|
| Input de voz (STT) | Implementado (Whisper/Gemini) |
| Output de voz (TTS) | Planejado |
| Modo hands-free | Planejado |
| Wake word | Planejado |

### MCP Servers Hospedados

| Aspecto | Plano |
|---------|-------|
| Conceito | MCP servers rodando no cloud do JVOS |
| Isolamento | Container por workspace |
| Vantagem | Usuario nao precisa instalar nada localmente |
| Status | Planejado para JVOS Cloud |

---

## 13. Modelo de Negocio

### Posicionamento

**"Seu departamento de IA por R$97/mes — sem precisar de developer"**

### Tiers de Assinatura

| Plano | Preco | Mensagens | Modelos | Sync | MCP | Marketplace |
|-------|-------|-----------|---------|------|-----|------------|
| **Free** | R$ 0 | Ilimitado (traga sua key) | Todos | Nao | Local only | Basico |
| **Starter** | R$ 97/mes | 1.000/mes | Mix gerenciado | 2 devices | - | 5 premium |
| **Pro** | R$ 297/mes | 5.000/mes | Todos (GPT-5.5, Opus, Pro) | Ilimitado | 5 hosted | Completo |
| **Enterprise** | R$ 997/mes | Ilimitado (fair use) | Dedicados | Ilimitado | Ilimitado | Completo + SSO |

### Unit Economics

| Metrica | Valor |
|---------|-------|
| Custo medio por mensagem (mix) | ~R$ 0,02 |
| Margem bruta Starter | ~79% |
| Margem bruta Pro | ~49% |
| Break-even | ~100 assinantes Pro |

### Diferencial: Self-Hosted vs Cloud

- **Self-hosted (Free):** app completo, traz sua key, zero lock-in
- **Cloud (pago):** tokens gerenciados, nao precisa entender providers, sync entre dispositivos
- Modelo identico ao n8n (open-source + managed cloud)

---

## 14. Roadmap — Implementado vs. Planejado

### Implementado (HOJE)

| Area | Status | Detalhe |
|------|--------|---------|
| Chat multi-modelo | COMPLETO | 6 providers, streaming, tool loop |
| Sessoes + historico | COMPLETO | CRUD, favoritos, arquivo, labels |
| Brain (memoria) | COMPLETO | Manual + auto-extract |
| Tools (20+) | COMPLETO | Filesystem, browser, admin, actions |
| Actions Engine | COMPLETO | 18 tipos de node, flows, triggers |
| Listeners (5 tipos) | COMPLETO | Gmail, Calendar, Sheets, Uptime, Slack |
| Telegram Bot | COMPLETO | Pareamento, auto-reply, multi-provider |
| Browser Automation | COMPLETO | Click, type, screenshot, PiP, multi-sessao |
| Scheduler | COMPLETO | Cron, dias da semana, actions |
| Multi-Agent | COMPLETO | Router + 7 agentes, tiers |
| MCP Manager | COMPLETO | Stdio, SSE, HTTP, connect-all |
| Marketplace | COMPLETO | Skills, workflows, publishers, beta channel |
| Dashboards | COMPLETO | Widgets, data sources, templates |
| Voice Input | COMPLETO | Whisper + Gemini fallback |
| Notificacoes | COMPLETO | OS native + in-app |
| Atalhos | COMPLETO | Customizaveis, toggle on/off |
| Sharing | COMPLETO | Link publico de sessoes |
| Health Check | COMPLETO | Diagnostico do sistema |
| Auto-labels | COMPLETO | Regex pattern matching |
| Session config | COMPLETO | Modelo/prompt por sessao |
| OAuth Google | COMPLETO | Gmail, Calendar, Sheets scope |
| OpenAI OAuth | COMPLETO | Login ChatGPT -> Codex endpoint |
| Error Boundary | COMPLETO | Graceful error handling |
| Setup Wizard | COMPLETO | Onboarding primeiro uso |

### Planejado (Roadmap 5 Meses)

| Feature | Sprint | Cargo-alvo |
|---------|--------|-----------|
| Backend API Gateway (JVOS Cloud) | 1 | Infra |
| Billing (Stripe) | 2 | Infra |
| Financial Dashboard Builder | 3 | Analista Financeiro |
| Cash Flow Projector | 4 | CFO |
| SAC Bot Builder | 5 | Atendimento |
| Customer Sentiment Dashboard | 6 | Head CX |
| Instagram Scheduler | 7 | Social Media |
| Facebook Page Manager | 8 | Community Manager |
| Creative Generator (GPT Image) | 9 | Designer |
| Campaign Health Monitor | 10 | Media Buyer |
| Copy Generator + A/B | 11 | Growth Hacker |
| Multi-Platform Publisher | 12 | Social Media |
| NL-to-SQL Engine | 13 | Analista de Dados |
| Dashboard Builder NL | 14 | BI Analyst |
| Universal Data Connector | 15 | Data Engineer |
| CEO Daily Briefing | 16 | CEO |
| COO Operations Radar | 17 | COO |
| CFO Financial Copilot | 18 | CFO |
| Market News Digest | 19 | Trader |
| Portfolio Tracker | 20 | Gestor de Acoes |
| Balance Sheet Extractor | 21 | Analista Fundamentalista |
| Contract Reviewer | 22 | Advogado |
| CV Scorer + Fit Analysis | 23 | Recrutador |
| People Analytics | 24 | HRBP |
| WhatsApp Business Gateway | 25 | Atendimento |
| Multi-Workspace + SSO | 26 | Enterprise |
| Audit Trail + Compliance | 27 | Compliance |
| CTO Tech Radar | 28 | CTO |
| CMO Attribution Dashboard | 29 | CMO |
| Marketplace v2 + Revenue Share | 30 | Todos |

### Meta de 5 Meses

- **500 usuarios**
- **MRR R$ 15k+**
- **30 features entregues**
- **15+ cargos empresariais atendidos**

---

## Apendice: System Prompt Padrao

O JVOS se apresenta como "Chief of Staff" digital. O prompt e enriquecido automaticamente com:

1. **User Profile** — preferencias salvas (nome, timezone, tom, empresa)
2. **Workspace Memories** — ate 15 memorias recentes, injetadas por categoria
3. **Workspace State** — skills disponiveis, automacoes ativas, sessoes recentes, labels
4. **Current Context** — data/hora atual no timezone do usuario

Isso garante que toda conversa tem contexto completo sem o usuario precisar repetir informacoes.

---

## Apendice: Seguranca

| Aspecto | Implementacao |
|---------|--------------|
| API Keys | Encrypted via `safeStorage` do Electron (OS keychain) |
| Credenciais | Arquivo `credentials.json` com AES via OS |
| Contexto | `contextIsolation: true`, `nodeIntegration: false` |
| Permissoes | Tabela `permissions` com patterns e access levels |
| Dados | Tudo local no SQLite (`ados.db` na pasta do usuario) |
| Browser | Janela separada sem node access |
| Sync (futuro) | End-to-end encryption planejado |

---

> Documento gerado em 2026-05-17 para referencia executiva do CEO.
> Codebase: `C:\Users\Eduardo AdNet\AdOS\`
