# JVOS — Documentação de Menus

## Índice

| # | Menu | Arquivo | Descrição |
|---|------|---------|-----------|
| 1 | [Sessões (Chat)](01-sessoes-chat.md) | Chat principal com LLM streaming, multi-agent, fila, compactação, browser | 
| 2 | [Ferramentas](02-ferramentas.md) | Conexões API, Skills, Workflows, Dashboards nativos |
| 3 | [Automações](03-automacoes.md) | Agendamentos, rotinas, hooks e recomendações |
| 4 | [Marketplace](04-marketplace.md) | Catálogo de skills/workflows por categoria |
| 5 | [Brain](05-brain.md) | Memória persistente com tags, categorias e sync |
| 6 | [Telegram](06-telegram.md) | Integração bot Telegram com inbox, pairings e envio |
| 7 | [Labels](07-labels.md) | Etiquetas com auto-pattern regex, hierarquia e drag-drop |
| 8 | [Compartilhar](08-compartilhar.md) | Publicação de sessões com senha, expiração e redact |
| 9 | [Dashboards](09-dashboards.md) | Widgets customizáveis com data sources e auto-refresh |
| 10 | [Health Check](10-health-check.md) | Diagnóstico do sistema com agendamento e deep check |
| 11 | [Cloud Sync](11-cloud-sync.md) | Sincronização remota com delta, encryption e retry |
| 12 | [Settings](12-settings.md) | Configurações (App, Workspace, Sistema) |

---

## Arquitetura Geral

```
App.tsx (Router + Theme + Sessions + Browser State)
├── NavRail.tsx (12 itens + collapse)
├── SessionPanel (lista + busca + labels + favoritos)
├── Chat.tsx (LLM + Tools + Streaming + Queue + Compaction + Browser)
├── Tools.tsx (4 abas: connections, skills, workflows, dashboards)
├── Automations.tsx (3 abas: mine, recommended, hooks)
├── Marketplace.tsx (catálogo 50+ itens, 12 categorias)
├── Brain.tsx (3 abas: overview, memory, sync)
├── Telegram.tsx (4 abas: inbox, send, pairings, config)
├── Labels.tsx (CRUD + regex + hierarquia + drag-drop)
├── Sharing.tsx (publicação com security scan)
├── Dashboards.tsx (widgets + data sources + fullscreen)
├── HealthCheck.tsx (diagnóstico + scheduling)
├── CloudSync.tsx (sync + delta + encryption)
├── Settings.tsx (12 sub-abas)
├── Shortcuts.tsx (referência de atalhos com filtro)
└── Preferences.tsx (nome, timezone, idioma, role, notas)
```

## Navegação (NavRail)

| Posição | ID | Label | Ícone |
|---------|-----|-------|-------|
| 1 | sessions | Sessões | Chat bubble |
| 2 | tools | Ferramentas | Wrench |
| 3 | automations | Automações | Sun/rays |
| 4 | marketplace | Marketplace | House |
| 5 | brain | Brain | Brain shape |
| 6 | telegram | Telegram | Paper plane |
| 7 | labels | Labels | Tag |
| 8 | sharing | Compartilhar | Upload |
| 9 | dashboards | Dashboards | Grid 2x2 |
| 10 | health | Health Check | Pulse line |
| 11 | cloud-sync | Cloud Sync | Cloud |
| 12 | settings | Configurações | *(na bottom section)* |

## Tech Stack

- **Runtime:** Electron 33
- **Frontend:** React 19 + TypeScript 5.7 + Tailwind CSS 3.4 + Vite 6.4
- **LLM:** Multi-provider streaming (OpenAI Responses, Chat Completions, Anthropic Messages, Google Generative, Groq)
- **DB:** SQLite via better-sqlite3 (electron-side)
- **IPC:** contextBridge + ipcRenderer/ipcMain handlers
- **Build:** Vite (frontend) + TSC (electron main process)

## Stats

- **14 componentes de página**
- **12 itens na NavRail**
- **~50+ superfícies de interação**
- **~80+ chamadas IPC distintas**
- **12 categorias de marketplace**
- **50+ skills/workflows no catálogo**
- **10 atalhos de teclado base + custom**
- **6 métricas built-in de dashboard**
- **6 providers LLM suportados (OpenAI, Anthropic, Google, Groq, OpenRouter, custom)**
