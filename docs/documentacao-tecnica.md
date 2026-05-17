# JVOS & JvosSys — Documentação Técnica Completa

**Versão:** 1.0.0  
**Data:** 16/05/2026  
**Autor:** Lucas (CEO) + G4 OS  

---

## 1. Visão Geral

O sistema é composto por **dois programas Electron** que trabalham juntos:

| Programa | Função | Usuário |
|----------|--------|---------|
| **JVOS** | App de chat com IA, tools, automações | Empresário / colaborador |
| **JvosSys** | Painel admin para configurar bots, prompts, modelos | Administrador (Lucas) |

### Arquitetura de Comunicação

```
JvosSys (Admin)                    JVOS (App)
┌──────────────┐                ┌──────────────┐
│ Define bots  │                │ Chat + Tools │
│ Define rules │ ──────────────▶│ Streaming    │
│ Configura    │  jvossys-config  │ Automações   │
│ providers    │     .db        │ Agentes      │
│ Monitora uso │◀────────────── │ Log de uso   │
└──────────────┘                └──────────────┘
```

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Desktop Framework | Electron 33 |
| Frontend | React 19 + Vite 6 |
| Linguagem | TypeScript 5.7 |
| Estilização | Tailwind CSS 3.4 |
| Banco de Dados | SQLite via sql.js |
| LLM Providers | OpenAI, Anthropic, Google, OpenRouter |
| Protocolo de Tools | MCP (Model Context Protocol) |
| Build/Packaging | electron-builder (NSIS + AppImage) |
| Plataformas | Windows, Linux |

---

## 3. JVOS — Estrutura do Projeto

```
JVOS/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
├── electron/
│   ├── main.ts              — Lifecycle do app, janela, registro de handlers
│   ├── preload.ts           — Bridge IPC (window.ados)
│   ├── database.ts          — SQLite: 16 tabelas, 48 IPC handlers
│   ├── llm.ts              — Multi-provider streaming, tool loop, auto-memory
│   ├── agents.ts           — Routing de agentes, tiers, pipelines
│   ├── tools.ts            — Builtin tools + MCP execution
│   ├── mcp-manager.ts      — Lifecycle de servidores MCP (stdio/SSE/HTTP)
│   ├── providers.ts        — Gestão de API keys e modelos
│   ├── scheduler.ts        — Cron de automações (30s polling)
│   ├── browser.ts          — Automação de browser embutido
│   ├── notifications.ts    — Notificações desktop nativas (NEW)
│   ├── auto-memory.ts      — Extração automática de memórias (NEW)
│   ├── jvossys-bridge.ts     — Leitura do banco do JvosSys (NEW)
│   ├── openai-oauth.ts     — OAuth device flow (ChatGPT)
│   ├── chatgpt-auth.ts     — Session auth ChatGPT
│   ├── oauth.ts            — OAuth genérico
│   ├── integrations.ts     — Gmail, Drive, GitHub, Slack
│   └── telegram.ts         — Bot Telegram + long polling
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── pages/
│   │   ├── Chat.tsx         — Interface principal de conversação
│   │   ├── Brain.tsx        — Gestão de memórias
│   │   ├── Tools.tsx        — Lista de ferramentas
│   │   ├── Automations.tsx  — Agendamentos
│   │   ├── Marketplace.tsx  — Skills & workflows
│   │   ├── Telegram.tsx     — Config Telegram
│   │   ├── Labels.tsx       — Etiquetas de sessão
│   │   ├── Sharing.tsx      — Compartilhamento
│   │   ├── Dashboards.tsx   — Visualizações
│   │   ├── HealthCheck.tsx  — Diagnóstico do sistema
│   │   ├── CloudSync.tsx    — Sincronização
│   │   ├── Settings.tsx     — Configurações
│   │   ├── Preferences.tsx  — Preferências
│   │   └── Shortcuts.tsx    — Atalhos
│   ├── components/
│   │   ├── TitleBar.tsx
│   │   ├── NavRail.tsx      — Sidebar com ícone de cérebro (UPDATED)
│   │   ├── SessionPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── BrowserPanel.tsx
│   │   ├── VoiceInput.tsx   — Gravação + Whisper (FIXED)
│   │   ├── ToolSteps.tsx
│   │   └── SetupWizard.tsx
│   └── hooks/
│       └── useKeyboardShortcuts.ts
└── resources/
    └── icon.ico
```

---

## 4. JvosSys — Estrutura do Projeto

```
JvosSys/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
├── electron/
│   ├── main.ts          — Window 1200x800, frameless, dark
│   ├── preload.ts       — Bridge (window.jvossys) com namespaces
│   ├── database.ts      — 9 tabelas, seed completo, IPC handlers
│   └── tsconfig.json
├── src/
│   ├── App.tsx          — Router de 7 páginas
│   ├── main.tsx
│   ├── index.css        — Tema escuro (mesmo design system)
│   ├── pages/
│   │   ├── Dashboard.tsx    — KPIs + hierarquia visual
│   │   ├── Bots.tsx         — CRUD de bots + editor de prompt
│   │   ├── Prompts.tsx      — Editor dedicado com versionamento
│   │   ├── Delegation.tsx   — Regras visuais + teste de routing
│   │   ├── Providers.tsx    — API keys + modelos + fallbacks
│   │   ├── Usage.tsx        — Custos por bot/dia com gráficos
│   │   └── Config.tsx       — Global config + feature flags
│   └── components/
│       ├── TitleBar.tsx
│       └── NavRail.tsx
└── resources/
    └── icon.ico
```

---

## 5. Banco de Dados — JVOS (ados.db)

### Tabelas (16)

| Tabela | Função |
|--------|--------|
| sessions | Sessões de chat |
| messages | Mensagens por sessão |
| settings | Configurações key-value |
| session_settings | Settings por sessão (modelo, etc.) |
| preferences | Preferências do usuário |
| shortcuts | Atalhos de teclado |
| skills | Skills customizadas (slash commands) |
| workflows | Workflows multi-step |
| connections | Conexões MCP/API |
| permissions | Regras de permissão |
| memories | Memórias do Brain (manual + auto) |
| automations | Agendamentos/crons |
| labels | Etiquetas coloridas |
| session_labels | Relação sessão↔label |
| shared_sessions | Sessões publicadas |
| telegram_pairings | Pareamentos Telegram↔sessão |
| dashboards | Layouts de dashboard |

---

## 6. Banco de Dados — JvosSys (jvossys-config.db)

### Tabelas (9)

| Tabela | Função |
|--------|--------|
| bots | Definição de bots (nome, modelo, prompt, tier) |
| delegation_rules | Regras de roteamento (keyword, intent, regex) |
| prompt_versions | Histórico de alterações dos prompts |
| providers | Provedores de LLM (API keys) |
| models | Modelos disponíveis com custos |
| fallback_chains | Chains de fallback entre modelos |
| usage_log | Log de uso (tokens, custo, duração) |
| global_config | Configurações globais (idioma, limites) |
| feature_flags | Flags on/off para funcionalidades |

### Seed Padrão

**7 Bots:**
- Router (gpt-4.1-nano) → classifica e roteia
- Summarizer (gpt-4.1-nano) → resumos
- Writer (gpt-4.1-mini) → redação
- Coder (codex-mini-latest) → programação
- Researcher (gpt-4.1-mini) → pesquisa
- Analyst (gpt-4.1) → análise de dados
- Executor (gpt-4.1-mini) → execução de comandos

**6 Regras de delegação** (keyword-based)  
**4 Providers** (OpenAI, Anthropic, Google, OpenRouter)  
**11 Modelos** com custos por 1k tokens  
**8 Configs globais**  
**6 Feature flags**

---

## 7. Sistema de Agentes (Routing)

### Fluxo de Decisão

```
Mensagem do usuário
        │
        ▼
   ┌─────────┐
   │ Router  │ (gpt-4.1-nano, zero temperature)
   └────┬────┘
        │
        ├─── Precisa de tools? ──▶ "direct" (modelo da sessão + todas tools)
        │
        └─── Texto puro? ──▶ Especialista (Writer/Coder/Researcher/etc.)
```

### Tiers de Custo

| Tier | Multiplicador | Uso |
|------|--------------|-----|
| Router | 0.1x | Classificação rápida |
| Fast | 0.2x | Tarefas simples |
| Balanced | 1.0x | Maioria das tarefas |
| Power | 5.0x | Análise complexa |

---

## 8. Streaming Multi-Provider

### OpenAI (Responses API)
- Modelos: gpt-5.5, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, codex-mini, o3-mini, o4-mini
- Tool loop com maxIterations=10
- Suporte a OAuth (ChatGPT backend)

### Anthropic (Messages API)
- Modelos: claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5
- Streaming SSE nativo via fetch
- Tool use com content_block events
- Signal de abort integrado

### Google (Generative AI)
- Modelos: gemini-2.5-pro, gemini-2.5-flash
- Streaming SSE
- Function calling nativo
- API key via header (x-goog-api-key)

### OpenRouter
- Qualquer modelo via Chat Completions API
- Base URL: openrouter.ai/api/v1

---

## 9. Features Implementadas

### 9.1 Auto-Memory (Brain Automático)

**Arquivo:** `electron/auto-memory.ts`

Após cada conversa com ≥4 mensagens, uma chamada background para gpt-4.1-nano extrai insights duráveis e salva automaticamente no Brain.

**Regras:**
- Máximo 3 memórias por sessão
- Deduplicação >80% match por palavras-chave
- Categorias: user, project, feedback, reference
- Prefixo `[auto]` para distinguir de manuais
- Custo: ~$0.0001 por extração

### 9.2 Fallback de Modelos

**Arquivo:** `electron/jvossys-bridge.ts`

Se o modelo principal falhar (timeout, rate limit, 5xx), o sistema consulta `fallback_chains` no JvosSys e tenta o modelo alternativo automaticamente.

### 9.3 Notificações Desktop

**Arquivo:** `electron/notifications.ts`

Notificações nativas do Windows/Linux para:
- Automação concluída
- Sessão background finalizada
- Agente precisa de input
- Alerta de uso (80% do limite)

### 9.4 Stop Warning

Quando o agente atinge 10 tool calls consecutivas, emite warning visual: "⚠️ Limite de ações atingido (10). Envie outra mensagem para continuar."

### 9.5 Hierarquia de Bots (via JvosSys)

Interface admin para:
- Criar/editar/excluir bots com modelos customizados
- Definir regras de delegação (keyword, regex, intent)
- Testar routing antes de publicar
- Versionamento de prompts com rollback

---

## 10. Bug Fixes Aplicados

| # | Bug | Severidade | Arquivo | Fix |
|---|-----|-----------|---------|-----|
| 1 | AbortController não passa para Anthropic/Google | Alto | llm.ts | Signal como parâmetro + passado nas chamadas |
| 2 | `new File()` não existe em Node.js | Crítico | llm.ts | `toFile()` do OpenAI SDK |
| 3 | System prompt ausente sem OAuth | Alto | llm.ts | `params.instructions` sempre setado |
| 4 | `getFocusedWindow()` retorna null | Alto | llm.ts | Fallback `getAllWindows()[0]` |
| 5 | Tool loop sem aviso ao atingir limite | Médio | llm.ts | Warning no último iteration |
| 6 | Mensagem vazia não salva steps | Médio | Chat.tsx | Salva `[tool1 → tool2]` quando sem texto |
| 7 | Race condition ao remover listeners | Médio | Chat.tsx | `stop()` + delay antes de remover |
| 8 | Scheduler não usa campos novos | Baixo | scheduler.ts | Query + interface atualizados |
| 9 | VoiceInput stack overflow em áudio grande | Alto | VoiceInput.tsx | Base64 em chunks de 8192 |
| 10 | API key Google exposta na URL | Médio | llm.ts | Movida para header `x-goog-api-key` |

---

## 11. IPC Bridge (preload.ts)

### JVOS — Namespaces

```typescript
window.ados = {
  window: { minimize, maximize, close },
  llm: { stream, stop, chat, transcribe, hasKey, onStreamChunk, onStreamEnd, onStreamError, onToolCall, removeStreamListeners },
  mcp: { listServers, addServer, removeServer, listTools, callTool },
  providers: { list, get, set, delete, getModels },
  db: { createSession, getSessions, addMessage, getMessages, getSkills, addSkill, deleteSkill, getWorkflows, addWorkflow, deleteWorkflow, getConnections, getMemories, addMemory, deleteMemory, searchMemories, getAutomations, addAutomation, toggleAutomation, deleteAutomation, ... },
  browser: { navigate, click, type, getElements, screenshot },
  tools: { execute },
  agents: { list, route, execute, runPipeline, getHistory },
  oauth: { ... },
  integrations: { gmail, drive, github, slack },
  telegram: { ... },
}
```

### JvosSys — Namespaces

```typescript
window.jvossys = {
  window: { minimize, maximize, close },
  bots: { list, get, create, update, delete },
  rules: { list, create, update, delete },
  prompts: { getVersions, revert },
  providers: { list, create, update, delete },
  models: { list, create, update, delete },
  fallbacks: { list, create, delete },
  config: { getAll, get, set },
  flags: { list, set },
  usage: { summary, byBot, byDay },
}
```

---

## 12. Integração JVOS ↔ JvosSys

### Mecanismo

O JVOS importa `jvossys-bridge.ts` que abre o `jvossys-config.db` em modo readonly e expõe:

| Função | Uso |
|--------|-----|
| `getJvosSysBots()` | Carregar bots configurados |
| `getJvosSysRules()` | Carregar regras de delegação |
| `getJvosSysConfig(key)` | Ler configuração global |
| `getJvosSysFlag(key)` | Verificar feature flag |
| `getFallbackModel(model)` | Obter modelo fallback |
| `logUsage(...)` | Registrar uso no banco compartilhado |
| `hasConfigChanged()` | Detectar mudanças (polling 30s) |
| `reloadConfigDb()` | Forçar recarga do banco |

### Fluxo de Sync

1. Admin altera config no JvosSys → salva no `jvossys-config.db`
2. JvosSys atualiza `last_updated` no `global_config`
3. JVOS detecta mudança via `hasConfigChanged()` (polling 30s)
4. JVOS recarrega configs com `reloadConfigDb()`

---

## 13. Compilação e Deploy

### Windows

```bash
# JVOS
cd JVOS && npm install && npm run build && npm run package
# Output: dist/JVOS-Setup.exe

# JvosSys
cd JvosSys && npm install && npm run build && npm run package
# Output: dist/JvosSys-Setup.exe
```

### Linux

```bash
# JVOS
cd JVOS && npm install && npm run build && npm run package:linux
# Output: dist/JVOS.AppImage + dist/ados_1.0.0_amd64.deb

# JvosSys
cd JvosSys && npm install && npm run build && npm run package:linux
# Output: dist/JvosSys.AppImage + dist/jvossys_1.0.0_amd64.deb
```

### Requisitos

- Node.js 20+
- npm 10+
- Git (para git bash no Windows)
- ~500MB RAM por app rodando

---

## 14. Roadmap Futuro

### Sprint 2 (próxima semana)
- [ ] Permission Modes (Consulta/Assistido/Autônomo)
- [ ] Session Persistence (contexto resumido ao reabrir)
- [ ] Custo por mensagem (widget no footer do chat)

### Sprint 3
- [ ] Background Sessions (worker paralelo)
- [ ] Sub-Agents (delegação paralela com nano)
- [ ] Hooks (ações pré/pós automáticas)

### Sprint 4
- [ ] Usage Dashboard completo no JvosSys
- [ ] Skill Versioning
- [ ] Marketplace com versionamento

### VPS Linux
- [ ] Deploy JvosSys como web admin (domínio próprio)
- [ ] API REST para sync remoto com instâncias desktop
- [ ] Multi-tenant (vários workspaces)

---

## 15. Modelo de Negócio

```
Meta Ads → ManyChat/Direto → Site → Google (GAM/AdX) paga por anúncios
```

- **Entrada:** Gasto com tráfego (Meta Ads)
- **Saída:** Receita de anúncios (Google Ad Manager)
- **KPI central:** ROAS > 1.3
- **Alavanca:** Mais impressões em GEOs/idiomas com eCPM alto

### Squads (4 × 3 membros)
- Legacy, Nexus, Evo, Júnior
- Media Buyer + Designer + Gestora de Conteúdo

---

*Documento gerado em 16/05/2026 por G4 OS*
