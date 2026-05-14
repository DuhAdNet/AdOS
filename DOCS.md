# AdOS — Documentação Técnica e Regras de Negócio

## 1. Visão Geral

**AdOS** é a plataforma de agente IA desktop da AdNet Monetize.

Um programa Windows que abre e fecha como qualquer aplicativo. Sem serviços em background, sem startup automático, sem daemon. Clicou no X = tudo morre.

O objetivo é ter um assistente IA interno com:
- Chat com múltiplos modelos de IA (OpenAI Codex/GPT, Claude, Gemini)
- Browser automation visível e controlável pelo usuário
- Conexão com ferramentas internas (banco SQL, Notion, Slack, Meta Ads)
- Memória persistente entre sessões

---

## 2. Regras de Negócio

### 2.1 Ciclo de Vida do Aplicativo

| Regra | Descrição |
|-------|-----------|
| **RN-01** | O app NÃO deve inicializar com o sistema operacional |
| **RN-02** | O app NÃO deve ter tray icon ou rodar minimizado |
| **RN-03** | Fechar a janela (X) DEVE encerrar todos os processos (app, browser, agente) |
| **RN-04** | Nenhum processo filho pode sobreviver ao fechamento do app |
| **RN-05** | O app deve abrir em menos de 3 segundos |

### 2.2 Chat e LLM

| Regra | Descrição |
|-------|-----------|
| **RN-10** | O MVP usa OpenAI (Codex/GPT-4o) como LLM padrão |
| **RN-11** | O usuário escolhe o modelo por sessão |
| **RN-12** | Mensagens são persistidas localmente (SQLite) |
| **RN-13** | Sessões são independentes — cada uma tem seu histórico |
| **RN-14** | O agente deve responder em streaming quando possível |
| **RN-15** | Erros de API devem ser mostrados inline no chat, não em popups |

### 2.3 API Keys

| Regra | Descrição |
|-------|-----------|
| **RN-20** | Keys são armazenadas criptografadas via Windows Credential Manager |
| **RN-21** | Keys NUNCA ficam em texto plano no disco |
| **RN-22** | Ao salvar uma key, o sistema testa a conexão (valida se funciona) |
| **RN-23** | O usuário pode cadastrar keys de múltiplos providers |
| **RN-24** | Providers suportados: OpenAI, Anthropic, Google |

### 2.4 Browser Automation

| Regra | Descrição |
|-------|-----------|
| **RN-30** | O browser abre em modo headed (visível) |
| **RN-31** | O usuário pode assistir o agente operando em tempo real |
| **RN-32** | O usuário pode pausar a automação e assumir o controle |
| **RN-33** | O usuário pode devolver o controle ao agente |
| **RN-34** | Quando o app fecha, o browser fecha junto (RN-04) |
| **RN-35** | O agente pode tirar screenshots e analisar DOM |

### 2.5 Sessões e Memória

| Regra | Descrição |
|-------|-----------|
| **RN-40** | Cada sessão tem título, data de criação e histórico de mensagens |
| **RN-41** | Sessões são listadas na sidebar por ordem de última interação |
| **RN-42** | O agente pode ter memória persistente entre sessões (contexto global) |
| **RN-43** | A memória é armazenada localmente (SQLite) |

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────────┐
│                 ELECTRON APP                     │
│  (processo principal - morre no X)              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
│  │  UI/Chat  │  │  Settings │  │  Browser   │  │
│  │  (React)  │  │  (Keys)   │  │  Viewer    │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬──────┘  │
│        │               │              │         │
│  ┌─────┴───────────────┴──────────────┴──────┐  │
│  │            AGENT ENGINE (OpenClaw)         │  │
│  │  - Loop de agente                         │  │
│  │  - Sistema de tools/MCP                   │  │
│  │  - Memória persistente (SQLite local)     │  │
│  │  - Roteamento multi-LLM                   │  │
│  └─────┬──────────────────────────────┬──────┘  │
│        │                              │         │
│  ┌─────┴─────┐                 ┌──────┴──────┐  │
│  │ LLM APIs  │                 │ Playwright  │  │
│  │ (OpenAI,  │                 │ (browser    │  │
│  │  Claude,  │                 │  embutido)  │  │
│  │  Gemini)  │                 │             │  │
│  └───────────┘                 └─────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Camadas

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|------------------|
| Desktop Shell | Electron 33+ | Janela, lifecycle, IPC |
| UI | React 19 + TailwindCSS | Interface de chat, settings, sidebar |
| Agent Engine | OpenClaw (fork) | Loop de agente, tools, MCP |
| Browser | Playwright | Automação web headed |
| Storage | SQLite (better-sqlite3) | Sessões, mensagens, memória, settings |
| Crypto | electron safeStorage | Criptografia de API keys |
| LLM | OpenAI SDK, Anthropic SDK, Google GenAI SDK | Comunicação com modelos |

---

## 4. Stack Técnica

- **Runtime:** Node.js 22+ (Electron embeds Node)
- **Linguagem:** TypeScript (strict mode)
- **Frontend:** React 19 + Vite 6 + TailwindCSS 3
- **Backend (main process):** Electron IPC + módulos TypeScript
- **Package Manager:** npm
- **Build:** electron-builder (NSIS installer para Windows)
- **Linting:** ESLint 9
- **Database:** SQLite via better-sqlite3

---

## 5. Estrutura do Repositório

```
AdOS/
├── package.json           — dependências e scripts
├── index.html             — entry HTML (Vite)
├── vite.config.ts         — config Vite
├── tsconfig.json          — TypeScript (renderer)
├── tailwind.config.js     — TailwindCSS
├── postcss.config.js      — PostCSS
├── .gitignore
├── DOCS.md                — este arquivo
│
├── electron/              — PROCESSO PRINCIPAL
│   ├── main.ts            — entry Electron, lifecycle, IPC
│   ├── preload.ts         — context bridge (API segura pro renderer)
│   ├── llm.ts             — handlers de LLM (OpenAI, Claude, Gemini)
│   ├── browser.ts         — Playwright automation
│   └── tsconfig.json      — TypeScript config (commonjs)
│
├── src/                   — RENDERER (React)
│   ├── main.tsx           — React entry
│   ├── App.tsx            — layout principal
│   ├── index.css          — Tailwind + estilos globais
│   ├── pages/
│   │   ├── Chat.tsx       — interface de conversa
│   │   └── Settings.tsx   — cadastro de API keys
│   ├── components/
│   │   ├── TitleBar.tsx   — barra de título customizada
│   │   ├── Sidebar.tsx    — lista de sessões
│   │   └── MessageBubble.tsx — bolha de mensagem
│   └── lib/
│       └── db/
│           └── schema.sql — schema SQLite
│
├── resources/             — ícones e assets
└── build/                 — config electron-builder
```

---

## 6. Decisões Técnicas

### Electron sobre Tauri
OpenClaw é Node.js, Playwright é Node.js. Electron mantém tudo no mesmo runtime. Tauri (Rust) complicaria a integração sem ganho relevante para este caso.

### Playwright sobre Puppeteer
Melhor suporte a modo headed, mais estável para automação observável, suporte nativo a múltiplos browsers (Chromium, Firefox, WebKit).

### SQLite sobre arquivos JSON
Performance, queries estruturadas, ACID. Ideal para histórico de sessões e memória do agente. Escala para centenas de milhares de mensagens sem problemas.

### Fork do OpenClaw vs. construir do zero
OpenClaw já resolve o loop de agente, sistema de tools, e MCP. Forkar e adaptar é 10x mais rápido que reescrever. MIT license permite uso comercial.

### safeStorage para API keys
Usa o Windows Credential Manager. Keys criptografadas em nível de OS. Descriptografa apenas em memória durante uso.

---

## 7. Segurança

- **Context Isolation:** `contextIsolation: true` — renderer não acessa Node.js diretamente
- **No Node Integration:** `nodeIntegration: false` — sem acesso direto ao filesystem do renderer
- **Preload Bridge:** API exposta via `contextBridge` com interface tipada
- **CSP:** Content Security Policy restritivo no index.html
- **Keys:** Nunca em texto plano, nunca em logs, nunca no git
- **No Remote:** Sem módulo remote do Electron (deprecated e inseguro)

---

## 8. Roadmap

### Fase 1 — MVP Chat (2-3 semanas)
- Electron app funcional (abre/fecha corretamente)
- UI de chat com OpenAI Codex/GPT-4o
- Tela de settings para API key
- Histórico de sessões (SQLite)
- Build/installer Windows (.exe)

### Fase 2 — Browser Automation (2-3 semanas)
- Playwright embutido no app
- Comando "abrir navegador" via chat
- Modo observável (usuário vê o browser)
- Pause/resume (usuário assume controle)
- Screenshots e DOM snapshot para o agente

### Fase 3 — Agent Engine (3-4 semanas)
- Fork OpenClaw integrado
- Sistema de tools com MCP
- File system access (ler/escrever arquivos locais)
- Memória persistente entre sessões
- System prompt customizável

### Fase 4 — Multi-LLM + Skills (2-3 semanas)
- Suporte a Anthropic (Claude), Google (Gemini), modelos locais (Ollama)
- Painel de keys multi-provider
- Seletor de modelo por sessão
- Sistema de skills/plugins

### Fase 5 — Integrações AdNet (2-3 semanas)
- Conectar ao banco adnet_intelligence (PostgreSQL)
- Integração Notion API
- Integração Slack API
- Integração Meta Ads API
- Renders ricos (tabelas, gráficos)

---

## 9. Como Rodar

### Desenvolvimento
```bash
npm install
npm run dev
```

### Build para Windows
```bash
npm run package
```
Gera installer `.exe` em `dist/`.

### Push para GitHub
```bash
git remote add origin https://github.com/PM-ADNET/AdOS.git
git push -u origin main
```

---

## 10. Convenções de Código

- TypeScript strict mode sempre
- Nomes de variáveis/funções em inglês (camelCase)
- Nomes de arquivos em PascalCase para componentes React
- Commits em inglês, estilo conventional commits (`feat:`, `fix:`, `docs:`)
- Co-author em todos os commits: `Co-Authored-By: G4 OS <g4os@g4business.com>`

---

*Versão: 0.1.0*
*Criado: 2026-05-13*
*Repo: github.com/PM-ADNET/AdOS*
