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

### 2.4 Navegador Integrado

O navegador é **embutido dentro da janela do app** (não uma janela externa). Funciona como uma aba/view interna — igual ao G4 OS. O agente opera nele, tira prints, navega, e o usuário pode intervir a qualquer momento na mesma view.

| Regra | Descrição |
|-------|-----------|
| **RN-30** | O browser é uma view embutida dentro do app (BrowserView/WebContentsView) |
| **RN-31** | O navegador tem barra de URL, botões voltar/avançar/reload visíveis |
| **RN-32** | O usuário pode navegar manualmente (digitar URL, clicar em links) |
| **RN-33** | O agente pode assumir controle do browser (navegar, clicar, preencher) |
| **RN-34** | O usuário pode intervir/pausar a automação e operar manualmente |
| **RN-35** | O agente tira screenshots da view para análise (envia para o LLM) |
| **RN-36** | O agente pode ler o DOM/snapshot da página atual |
| **RN-37** | Quando o app fecha, o browser fecha junto (RN-04) |
| **RN-38** | O browser deve ser alternável com o chat (split view ou tabs/abas) |
| **RN-39** | O usuário pode abrir o browser manualmente (botão na UI) sem precisar do agente |

**Implementação técnica:** Electron `WebContentsView` (substituto do deprecated BrowserView) renderiza uma página web real dentro do app. O agente controla via `webContents.executeJavaScript()`, `webContents.capturePage()` para screenshots, e DevTools Protocol para DOM inspection. Não usa Playwright — usa o Chromium do próprio Electron.

### 2.5 Automações

O AdOS permite criar tarefas recorrentes (rotinas) que o agente executa automaticamente em horários definidos — mas APENAS enquanto o app está aberto.

| Regra | Descrição |
|-------|-----------|
| **RN-50** | Automações SÓ rodam enquanto o app está aberto |
| **RN-51** | Quando o app abre, verifica automações "atrasadas" e oferece executá-las |
| **RN-52** | Cada automação tem: nome, descrição, cron/intervalo, status (ativo/desativado) |
| **RN-53** | O usuário pode criar automações via chat ("cria uma rotina que...") |
| **RN-54** | O usuário pode criar automações manualmente (tela de Automações) |
| **RN-55** | Automações podem usar o browser (navegar, preencher, extrair dados) |
| **RN-56** | Automações podem chamar APIs externas (Notion, Slack, banco SQL) |
| **RN-57** | Cada execução gera um log com resultado (sucesso/erro/output) |
| **RN-58** | O usuário pode ver histórico de execuções |
| **RN-59** | Tipos de automação: Rotina (cron), Agendamento (data/hora única), Vigia (monitoramento) |

**Tela de Automações:** Painel com lista de automações criadas, status, próxima execução, filtros por tipo (Rotina, Agendamento, Vigia), botão de criar nova.

### 2.6 Marketplace (Fase futura)

Loja de skills/workflows compartilhados entre usuários do AdOS. Segundo momento do produto — implica compartilhamento de dados entre instâncias.

| Regra | Descrição |
|-------|-----------|
| **RN-60** | Marketplace é uma tela dedicada no app |
| **RN-61** | Usuários podem publicar skills que criaram |
| **RN-62** | Usuários podem instalar skills de outros |
| **RN-63** | Skills têm categorias (Pesquisa, Texto, Código, Automação, Projetos, Dados, Design) |
| **RN-64** | Skills têm versionamento (v1, v2, etc.) |
| **RN-65** | Skills podem ser atualizadas pelo autor |
| **RN-66** | Busca por nome, categoria ou caso de uso |
| **RN-67** | Seção "Destaques" com curadoria |
| **RN-68** | Requer backend/API centralizado (não é local-only) |

**Dependência:** Exige um servidor central (API) para hospedar e distribuir skills. Entra no roadmap após o MVP local funcionar.

### 2.7 Brain (Memória em Grafo)

Sistema de memória persistente do agente com visualização em grafo interativo (estilo Obsidian). O agente aprende com o uso e conecta informações entre si.

| Regra | Descrição |
|-------|-----------|
| **RN-70** | Brain é uma tela dedicada para visualizar e gerenciar memórias |
| **RN-71** | Memórias são nós em um grafo conectado |
| **RN-72** | Tipos de memória: Preferência, Decisão, Observação, Resumo, Afirmação, Referência |
| **RN-73** | Visualização em grafo interativo (zoom, pan, fullscreen) |
| **RN-74** | Visualização alternativa em lista |
| **RN-75** | Filtros por tipo e status (Ativas, Arquivadas, Todas) |
| **RN-76** | Busca textual nas memórias |
| **RN-77** | O agente cria memórias automaticamente durante conversas |
| **RN-78** | O usuário pode confirmar, editar, arquivar ou deletar memórias |
| **RN-79** | Memórias conectam-se entre si (grafo de conhecimento) |
| **RN-80** | O agente consulta memórias relevantes antes de responder |
| **RN-81** | Tudo armazenado localmente (SQLite) |

**Visualização:** Canvas 2D com nós (círculos) representando tipos de memória e arestas mostrando conexões. Nós centrais (Shared Brain) conectam aos tipos. Cada nó filho é uma memória individual. Zoom, pan, seleção para ver detalhes.

### 2.8 Configurações

Tela de configurações completa com sidebar de categorias e painel de opções à direita.

**Categorias:**

| Categoria | Conteúdo |
|-----------|----------|
| **App** | Notificações, energia (manter tela ativa), atualizações automáticas, idioma |
| **Agentes** | Agentes de IA gerenciados, modelo padrão, system prompt |
| **Aparência** | Tema (dark/light), fontes, ícones de ferramentas |
| **Entrada** | Tecla de envio (Enter/Ctrl+Enter), corretor ortográfico |
| **Workspace** | Nome, ícone, diretório de trabalho |
| **Uso** | Limites de tokens, consumo de créditos por provider, histórico de uso |
| **Permissões** | Regras do agente (o que pode/não pode fazer sem perguntar) |
| **Tags** | Gerenciar tags de sessão |
| **API Keys** | Cadastro e teste de chaves por provider |
| **Preferências do usuário** | Nome, timezone, idioma, estilo de comunicação |

| Regra | Descrição |
|-------|-----------|
| **RN-90** | Configurações persistem localmente (SQLite/electron-store) |
| **RN-91** | Notificações do desktop quando o agente termina uma tarefa |
| **RN-92** | Opção "manter tela ativa" durante execução de sessão |
| **RN-93** | Auto-update: verifica atualizações ao abrir o app |
| **RN-94** | Idioma do app: PT-BR padrão |
| **RN-95** | Permissões configuráveis: o que o agente faz sem perguntar vs. pede confirmação |
| **RN-96** | Monitoramento de uso/custos por provider de LLM |

### 2.9 Sessões e Memória

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
