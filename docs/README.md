# AdOS — AI Desktop Operating System

## Visão Geral

AdOS é um sistema operacional de IA para desktop, construído em Electron. Funciona como um agente de IA local com browser automation, multi-provider, MCP protocol e integrações nativas (Telegram, marketplace de skills).

**Stack:** Electron 33 + React 19 + TypeScript + Vite + Tailwind CSS + sql.js (SQLite local)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    RENDERER (React)                   │
│  Pages: Chat, Tools, Automations, Marketplace,       │
│         Brain, Telegram, Labels, Sharing,             │
│         Dashboards, HealthCheck, CloudSync, Settings  │
│  Components: NavRail, SessionPanel, MessageBubble,   │
│         VoiceInput, BrowserPill, AutocompletePopup   │
└──────────────────────┬──────────────────────────────┘
                       │ IPC (preload.ts)
┌──────────────────────┴──────────────────────────────┐
│                    MAIN PROCESS (Electron)            │
│  Modules: main.ts, database.ts, llm.ts, providers.ts │
│           mcp-manager.ts, browser.ts, telegram.ts,   │
│           agents.ts, tools.ts, integrations.ts,      │
│           oauth.ts, openai-oauth.ts, chatgpt-auth.ts │
└─────────────────────────────────────────────────────┘
```

### Padrão IPC Bridge

```
electron/*.ts → ipcMain.handle('channel', handler)
electron/preload.ts → contextBridge.exposeInMainWorld('ados', {...})
src/**/*.tsx → (window as any).ados.namespace.method()
```

---

## Módulos

### Core

| Módulo | Arquivo | Função |
|--------|---------|--------|
| Database | `electron/database.ts` | SQLite local (sql.js), todas as tabelas e CRUD |
| LLM | `electron/llm.ts` | Chat completions com tool calling (loop até 10 iterações) |
| Providers | `electron/providers.ts` | Multi-provider: OpenAI, Anthropic, Google, OpenRouter |
| MCP Manager | `electron/mcp-manager.ts` | Gerencia servidores MCP (stdio/SSE/HTTP) |
| Agents | `electron/agents.ts` | Sistema multi-agente com roteamento por complexidade |
| Browser | `electron/browser.ts` | Browser automation (janela independente) |
| Tools | `electron/tools.ts` | Tool calling nativo |
| OAuth | `electron/oauth.ts` | Fluxos OAuth genéricos |
| OpenAI OAuth | `electron/openai-oauth.ts` | OAuth específico para GPT-5.5 |

### Integrações

| Módulo | Arquivo | Função |
|--------|---------|--------|
| Telegram | `electron/telegram.ts` | Bot API: polling, send, webhooks, pairings |
| Integrations | `electron/integrations.ts` | Integrações genéricas |

### Pages (Frontend)

| Página | Função |
|--------|--------|
| Chat | Interface principal de conversação com streaming, tool steps, voice input |
| Tools | Gerenciamento de ferramentas disponíveis |
| Automations | Automações com schedule e sources |
| Marketplace | 50 skills/workflows segmentados por área corporativa |
| Brain | Base de conhecimento / memória persistente |
| Telegram | Inbox real-time, envio, pairings chat↔sessão |
| Labels | CRUD de labels com cores e auto-apply regex |
| Sharing | Publicação de sessões com link público |
| Dashboards | Painéis customizáveis com widgets (metric, chart, list, text) |
| HealthCheck | Diagnóstico do sistema (providers, MCP, DB, integrations) |
| CloudSync | Fundação para sincronização remota |
| Settings | App, Aparência, Entrada, Workspace, Providers, MCP, Modelo, Agentes, Permissões, Preferências, Atalhos, Sobre |

### Components

| Componente | Função |
|------------|--------|
| NavRail | Navegação lateral com ícones SVG |
| SessionPanel | Lista de sessões com favoritos, arquivados, busca |
| MessageBubble | Renderização de mensagens (markdown, code blocks, tool calls) |
| VoiceInput | Input por voz via Web Speech API |
| BrowserPill | Indicador de browser automation ativo |
| AutocompletePopup | Autocomplete de comandos/skills |
| SetupWizard | Onboarding (primeiro uso) |
| TitleBar | Barra de título customizada (frameless) |
| ToolSteps | Visualização de tool calling em andamento |

---

## Database Schema

### Tabelas

| Tabela | PK | Função |
|--------|-----|--------|
| sessions | id | Sessões de chat |
| messages | id | Mensagens de cada sessão |
| settings | key | Key-value store (config, preferências) |
| labels | id | Labels com cor e auto-pattern |
| session_labels | session_id + label_id | N:N sessões ↔ labels |
| shortcuts | action | Bindings de teclado |
| preferences | key | Preferências do usuário para LLM |
| shared_sessions | session_id | Sessões publicadas com publicId |
| telegram_pairings | chat_id + session_id | Vinculação Telegram ↔ sessão |
| dashboards | id | Dashboards com layout JSON |
| automations | id | Automações com schedule e sources |

---

## Providers Suportados

| Provider | Auth | Modelos |
|----------|------|---------|
| OpenAI | API Key / OAuth | GPT-4o, GPT-4o-mini, GPT-5.5, o3, o4-mini |
| Anthropic | API Key | Claude Sonnet 4.6, Claude Opus 4.6 |
| Google | API Key | Gemini 2.5 Pro, Gemini 2.5 Flash |
| OpenRouter | API Key | Qualquer modelo via proxy |

---

## MCP Protocol

Suporta 3 transportes:
- **stdio** — servidores locais via subprocess
- **SSE** — servidores remotos via Server-Sent Events
- **streamable-http** — servidores remotos via HTTP

Gerencia conexão/desconexão, lista tools por servidor, e injeta tools disponíveis no contexto do agente.

---

## Sistema Multi-Agente

Hierarquia de 4 tiers com roteamento automático por complexidade:

| Tier | Uso | Custo relativo |
|------|-----|----------------|
| Router | Classifica complexidade da mensagem | 1x |
| Fast | Perguntas simples, lookups | 1x |
| Balanced | Tarefas médias, análise | 3x |
| Power | Tarefas complexas, multi-step | 10x |

---

## Keyboard Shortcuts

| Ação | Binding |
|------|---------|
| Nova Sessão | Ctrl+N |
| Buscar | Ctrl+K |
| Configurações | Ctrl+, |
| Alternar Tema | Ctrl+Shift+D |
| Voice Input | Ctrl+Shift+V |

---

## Build & Deploy

```bash
# Desenvolvimento
npm run dev

# Build produção
npm run build

# Package (Windows .exe)
npm run package
```

Gera instalador NSIS (.exe) para Windows. AppId: `com.adnetmonetize.ados`
