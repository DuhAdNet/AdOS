# AdOS — Changelog Completo (15/05/2026)

## Sessão de Desenvolvimento

**Data:** 15 de maio de 2026, 00:00–01:07 (GMT-3)
**Commits:** 5 commits pushados para `DuhAdNet/AdOS` (main)

---

## Commits Realizados

| Hash | Mensagem | Arquivos |
|------|----------|----------|
| `2938287` | feat: integração Telegram + desinstalar no Marketplace | electron/telegram.ts, preload.ts, src/pages/Telegram.tsx, Marketplace.tsx |
| `b8150f5` | feat: marketplace expandido — 50 skills/workflows por área corporativa | src/pages/Marketplace.tsx |
| `63eb60e` | fix: corrigir 2 erros TypeScript — Session interface e Marketplace tab filter | src/App.tsx, src/pages/Marketplace.tsx |
| `e6d22c3` | feat: implementar 15 features do G4 OS gap analysis | 16 arquivos, +1503 linhas |
| `4457584` | docs: documentação técnica + plano comercial SaaS | docs/README.md, docs/PLANO-COMERCIAL.md |
| `264d3f2` | docs: roadmap 5 meses — 30 sprints, 15+ cargos | docs/ROADMAP-5-MESES.md |

---

## Features Implementadas (código funcional)

### 1. Integração Telegram Completa
- **Arquivo:** `electron/telegram.ts` (novo)
- Long polling para receber mensagens em tempo real
- Envio de texto, foto e documento
- Webhook support (set/delete/info)
- getMe, getChats
- Eventos `telegram:message` e `telegram:error` para o renderer
- **Página:** `src/pages/Telegram.tsx` com tabs: Inbox, Enviar, Pairings, Configurar

### 2. Telegram Pairings (chat ↔ sessão)
- Tabela `telegram_pairings` com `chat_id`, `session_id`, `direction`
- Suporte bidirecional: `both`, `tg-to-session`, `session-to-tg`
- UI completa para criar/remover pairings

### 3. Voice Input (Web Speech API)
- **Arquivo:** `src/components/VoiceInput.tsx` (novo)
- Reconhecimento contínuo em pt-BR
- Exibição de resultados intermediários
- Integrado no Chat.tsx (botão ao lado do input)

### 4. Keyboard Shortcuts System
- **Arquivo:** `src/hooks/useKeyboardShortcuts.ts` (novo)
- Hook genérico que parseia bindings como `ctrl+n`, `ctrl+shift+d`
- Bindings padrão: new-session, search, settings, toggle-theme
- Integrado no App.tsx

### 5. Labels (Marcadores)
- **Arquivo:** `src/pages/Labels.tsx` (novo)
- CRUD completo com 10 cores
- Auto-apply regex pattern
- Edição inline
- Tabelas: `labels`, `session_labels`

### 6. Session Sharing
- **Arquivo:** `src/pages/Sharing.tsx` (novo)
- Publicar sessões com ID público único (12 chars)
- Copiar link, revogar acesso
- Tabela: `shared_sessions`

### 7. Preferences Page
- **Arquivo:** `src/pages/Preferences.tsx` (novo)
- Nome, cargo, timezone, idioma, notas para o assistente
- Tabela: `preferences`

### 8. Shortcuts Reference Page
- **Arquivo:** `src/pages/Shortcuts.tsx` (novo)
- Lista readonly de 10 atalhos com filtro
- Também integrado como tab em Settings

### 9. Health Check / Diagnóstico
- **Arquivo:** `src/pages/HealthCheck.tsx` (novo)
- Verifica: LLM Providers, MCP Servers, Database, Telegram, Modelo Padrão, Electron Runtime
- Status visual: ok (verde), warning (amarelo), error (vermelho)
- Resumo geral do sistema

### 10. Dashboards Customizáveis
- **Arquivo:** `src/pages/Dashboards.tsx` (novo)
- Criar múltiplos dashboards
- Widgets: metric, chart, list, text
- Layout persistido em JSON no banco
- Tabela: `dashboards`

### 11. Cloud Sync Foundation
- **Arquivo:** `src/pages/CloudSync.tsx` (novo)
- Configurar endpoint de sync
- Toggle auto-sync (5 min)
- Status: disconnected/syncing/synced/error
- Descrição do que será sincronizado

### 12. Marketplace Expandido (50 items)
- 12 categorias corporativas: Marketing, Vendas, Finanças, RH, Operações, Jurídico, Produto, Suporte, Projetos, Estratégia, Comunicação, Dados
- Filtro por categoria com contagem
- Instalar/desinstalar
- Fix do bug de tab filter (type mismatch)

### 13. NavRail Expandido
- Novas rotas: `labels`, `sharing`, `dashboards`, `health`, `cloud-sync`
- Ícones SVG únicos para cada página

### 14. Database Schema Expandido
- **Tabelas novas:** labels, session_labels, shortcuts, preferences, shared_sessions, telegram_pairings, dashboards
- **Handlers IPC novos:** ~25 novos handlers
- **Preload bridge:** todos os métodos expostos ao renderer

### 15. Settings: Tab Atalhos
- Seção `ShortcutsSection` inline no Settings
- Lista de 10 shortcuts com kbd tags

---

## Correções de Bugs

| Bug | Causa | Fix |
|-----|-------|-----|
| TS2719: Session interface | App.tsx `Session` não tinha `favorite` e `archived` | Adicionados os campos |
| TS2367: Marketplace tab | `item.type` ('skill') comparado com `tab` ('skills') | `const tabType = tab === 'skills' ? 'skill' : 'workflow'` |

---

## Documentação Criada

### docs/README.md
- Arquitetura completa (renderer ↔ IPC ↔ main process)
- Padrão IPC bridge
- Tabela de todos os módulos (core + integrações)
- Todas as pages e components
- Database schema (11 tabelas)
- Providers suportados (4)
- MCP protocol (3 transportes)
- Sistema multi-agente (4 tiers)
- Keyboard shortcuts
- Build & deploy instructions

### docs/PLANO-COMERCIAL.md
- Modelo "Managed AI Desktop" (estilo n8n Cloud)
- Arquitetura cloud (Token Vault, LLM Router, MCP Proxy, Sync Engine, Marketplace Hub, Usage Metering)
- 4 planos: Free (R$0), Starter (R$97), Pro (R$297), Enterprise (R$997)
- Unit economics (margem 49-69%)
- Comparativo com n8n
- Roadmap de comercialização em 4 fases
- Decisões de arquitetura backend

### docs/ROADMAP-5-MESES.md
- Ranking de IAs baratas com tool calling/MCP (10 modelos)
- Recomendação por tier (custo médio R$0,02/msg)
- 15+ cargos-alvo mapeados com dor e feature
- 30 sprints de 5 dias (150 dias)
- KPIs por mês
- Stack de implementação backend
- Priorização por TAM e ticket
- Diferencial vs concorrência (ChatGPT, n8n, Zapier, Cursor, Notion AI, Jasper)

---

## Estado Final do Repositório

```
AdOS/
├── docs/
│   ├── README.md              — Documentação técnica
│   ├── PLANO-COMERCIAL.md     — Plano de negócios SaaS
│   └── ROADMAP-5-MESES.md    — Sprint plan 150 dias
├── electron/
│   ├── main.ts               — Entry point Electron
│   ├── database.ts           — SQLite + 11 tabelas + ~50 handlers
│   ├── preload.ts            — Bridge IPC completa
│   ├── llm.ts                — Chat completions + tool loop
│   ├── providers.ts          — Multi-provider (OpenAI, Anthropic, Google, OpenRouter)
│   ├── mcp-manager.ts        — MCP servers (stdio/SSE/HTTP)
│   ├── agents.ts             — Multi-agente com roteamento
│   ├── browser.ts            — Browser automation
│   ├── telegram.ts           — Telegram Bot API
│   ├── tools.ts              — Tool calling
│   ├── integrations.ts       — Integrações genéricas
│   ├── oauth.ts              — OAuth flows
│   ├── openai-oauth.ts       — GPT-5.5 OAuth
│   └── chatgpt-auth.ts       — ChatGPT auth helper
├── src/
│   ├── App.tsx               — Router principal (12 pages)
│   ├── pages/
│   │   ├── Chat.tsx          — Interface de chat (streaming, tools, voice)
│   │   ├── Tools.tsx         — Gerenciamento de ferramentas
│   │   ├── Automations.tsx   — Automações com schedule
│   │   ├── Marketplace.tsx   — 50 skills/workflows (12 categorias)
│   │   ├── Brain.tsx         — Base de conhecimento
│   │   ├── Telegram.tsx      — Inbox + Enviar + Pairings + Config
│   │   ├── Labels.tsx        — CRUD labels + cores + regex
│   │   ├── Sharing.tsx       — Publicação de sessões
│   │   ├── Preferences.tsx   — Personalização do assistente
│   │   ├── Shortcuts.tsx     — Referência de atalhos
│   │   ├── Dashboards.tsx    — Painéis customizáveis
│   │   ├── HealthCheck.tsx   — Diagnóstico do sistema
│   │   ├── CloudSync.tsx     — Sync remoto (fundação)
│   │   └── Settings.tsx      — 11 tabs de configuração
│   ├── components/
│   │   ├── NavRail.tsx       — Navegação (12 rotas)
│   │   ├── SessionPanel.tsx  — Lista de sessões
│   │   ├── MessageBubble.tsx — Renderização de mensagens
│   │   ├── VoiceInput.tsx    — Input por voz
│   │   ├── BrowserPill.tsx   — Indicador browser
│   │   ├── AutocompletePopup.tsx
│   │   ├── SetupWizard.tsx
│   │   ├── TitleBar.tsx
│   │   ├── ToolSteps.tsx
│   │   └── Sidebar.tsx
│   └── hooks/
│       └── useKeyboardShortcuts.ts
└── package.json              — Electron 33 + React 19 + Vite 6
```

**Build status:** ✅ Zero erros TypeScript, Vite build OK, esbuild electron OK
**Git status:** Limpo, tudo commitado e pushado para `DuhAdNet/AdOS` (main)
