# AdOS — Documentação Técnica e Regras de Negócio

## 1. Visão Geral

**AdOS** é a plataforma de agente IA desktop da AdNet Monetize.

Um programa Windows que abre e fecha como qualquer aplicativo. Sem serviços em background, sem startup automático, sem daemon. Clicou no X = tudo morre.

O objetivo é ter um AI Operational System interno com:
- Chat com múltiplos modelos de IA (OpenAI Codex/GPT, Claude, Gemini)
- Browser automation visível e controlável pelo usuário
- Conexão com ferramentas internas (banco SQL, Notion, Slack, Meta Ads)
- Memória persistente entre sessões (Brain)
- Automações recorrentes (rotinas, agendamentos, vigias)
- Skills e Workflows reutilizáveis
- Dashboards nativos com refresh
- Marketplace para compartilhamento de skills
- Arquitetura local-first: dados ficam na máquina do usuário

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
| **RN-06** | Manter tela ativa durante operações longas (configurável) |
| **RN-07** | Auto-update: verifica atualizações ao abrir; atualizações obrigatórias bloqueiam uso até instalação |

### 2.2 Workspaces

Espaço central que organiza contexto, sessões, fontes, automações e configurações operacionais.

| Regra | Descrição |
|-------|-----------|
| **RN-10** | Cada workspace tem: nome, empresa, idioma, região, diretório de trabalho |
| **RN-11** | Criação com onboarding guiado: nome, perfil de trabalho, objetivos, conexões iniciais |
| **RN-12** | Perfis disponíveis: Manager, IC, Executive, Researcher, Freelancer, Customizado |
| **RN-13** | Objetivos iniciais: automatizar rotina, resolver problemas, organizar contexto, reuniões, escrita, pesquisa |
| **RN-14** | Múltiplos workspaces: cada um é um contexto operacional distinto |
| **RN-15** | Seletor de workspace na sidebar, abaixo da lista de sessões |
| **RN-16** | Workspace concentra: sessões, contexto acumulado, conexões, arquivos, automações |
| **RN-17** | Configurações específicas por workspace (não globais): fontes padrão, modo permissão, Company Context |
| **RN-18** | Diretório de trabalho configurável por workspace |
| **RN-19** | Pasta raiz de projetos gerenciável |

### 2.3 Sessões

Unidades de trabalho independentes com histórico, contexto e continuidade próprios.

| Regra | Descrição |
|-------|-----------|
| **RN-20** | Cada sessão tem: título, data, histórico de mensagens, tags |
| **RN-21** | Sessões listadas na sidebar por ordem de última interação |
| **RN-22** | Sessões são independentes — cada uma tem seu contexto |
| **RN-23** | Histórico persiste localmente (SQLite) |
| **RN-24** | Contexto acumula ao longo do trabalho (reduz retrabalho) |
| **RN-25** | Criar sessão separada para: novo projeto, área diferente, rotina recorrente |
| **RN-26** | Mensagens são persistidas localmente |
| **RN-27** | Labels hierárquicas com cores para organizar sessões |
| **RN-28** | Regras de autoaplicação de labels por padrão de mensagem |
| **RN-29** | O agente deve responder em streaming quando possível |

### 2.4 Chat e LLM

| Regra | Descrição |
|-------|-----------|
| **RN-30** | MVP usa OpenAI (Codex/GPT-4o) como LLM padrão |
| **RN-31** | O usuário escolhe o modelo por sessão (seletor no composer) |
| **RN-32** | Suporte multi-provider: OpenAI, Anthropic (Claude), Google (Gemini) |
| **RN-33** | Thinking (pensamento estendido) em modelos suportados |
| **RN-34** | Erros de API mostrados inline no chat, não em popups |
| **RN-35** | Modelo padrão configurável por workspace |
| **RN-36** | Override de política de IA por workspace |

### 2.5 API Keys e Credenciais

| Regra | Descrição |
|-------|-----------|
| **RN-40** | Keys armazenadas criptografadas via Windows Credential Manager (safeStorage) |
| **RN-41** | Keys NUNCA ficam em texto plano no disco |
| **RN-42** | Ao salvar key, sistema testa a conexão (valida se funciona) |
| **RN-43** | Múltiplos providers suportados: OpenAI, Anthropic, Google |
| **RN-44** | Credenciais descriptografadas apenas em memória durante uso |
| **RN-45** | Credenciais nunca saem da máquina local |

### 2.6 Navegador Integrado

O navegador é **embutido dentro da janela do app** (WebContentsView). O agente opera nele, e o usuário pode intervir a qualquer momento.

| Regra | Descrição |
|-------|-----------|
| **RN-50** | Browser é uma view embutida dentro do app (WebContentsView) |
| **RN-51** | Barra de URL, botões voltar/avançar/reload visíveis |
| **RN-52** | Usuário pode navegar manualmente (digitar URL, clicar links) |
| **RN-53** | Agente pode assumir controle (navegar, clicar, preencher) |
| **RN-54** | Usuário pode intervir/pausar automação e operar manualmente |
| **RN-55** | Screenshots da view para análise (envia para LLM) |
| **RN-56** | Agente pode ler DOM/snapshot da página atual |
| **RN-57** | Browser fecha junto com o app (RN-04) |
| **RN-58** | Browser alternável com chat (split view ou tabs) |
| **RN-59** | Usuário pode abrir browser manualmente (botão na UI) |

### 2.7 Agentes

Camadas operacionais de IA com contexto, instruções, ferramentas e limites definidos.

| Regra | Descrição |
|-------|-----------|
| **RN-60** | Agentes seguem instruções e regras de uso do workspace |
| **RN-61** | Acessam apenas fontes conectadas |
| **RN-62** | Precisam de: função clara, contexto certo, escopo bem definido |
| **RN-63** | Suportam múltiplos provedores (Google AI, AWS Nova, etc.) |
| **RN-64** | Agentes gerenciados: capacidades prontas (multimodalidade, análise, geração) |
| **RN-65** | System prompt customizável por workspace |
| **RN-66** | Agentes podem delegar entre si |

### 2.8 Conexões (Sources)

Trazem contexto, ferramentas e capacidade de execução para dentro do workspace.

| Regra | Descrição |
|-------|-----------|
| **RN-70** | Tipos: APIs diretas, MCPs (Model Context Protocol), pastas locais, conectores gerenciados, agentes gerenciados |
| **RN-71** | Credenciais armazenadas criptografadas localmente |
| **RN-72** | Chamadas saem direto da máquina do usuário (não via proxy) |
| **RN-73** | MCPs rodam como subprocess local (stdio) |
| **RN-74** | Status de conexão e autenticação visível na UI |
| **RN-75** | Diagnóstico: auth vs runtime vs config |
| **RN-76** | Token injection via env vars antes de execução |
| **RN-77** | Fontes padrão configuráveis por workspace (aplicadas a novas sessões) |

**Catálogo de conexões gerenciadas (target):**
- Google: Gmail, Calendar, Drive, Docs, Sheets, Chat, Tasks, Analytics
- Microsoft: Outlook, Teams, OneDrive, SharePoint, Planner
- Operação: Asana, GitHub, Jira, Notion, Slack, Linear, HubSpot, Salesforce, Trello
- Interno AdNet: banco SQL (PostgreSQL), Meta Ads API

### 2.9 Automações

Transforma rotinas recorrentes em operação assistida por IA. SÓ rodam com app aberto.

| Regra | Descrição |
|-------|-----------|
| **RN-80** | Automações SÓ rodam enquanto o app está aberto |
| **RN-81** | Ao abrir, verifica automações "atrasadas" e oferece executá-las |
| **RN-82** | Tipos: Rotina (cron), Agendamento (data/hora única), Vigia (monitoramento) |
| **RN-83** | Cada automação tem: nome, descrição, cron/intervalo, status, fontes habilitadas, skills habilitadas |
| **RN-84** | Criação via chat ("cria uma rotina que...") ou tela dedicada |
| **RN-85** | Automações podem usar browser, APIs, banco SQL |
| **RN-86** | Cada execução gera log com resultado (sucesso/erro/output) |
| **RN-87** | Histórico de execuções visível |
| **RN-88** | Vigias monitoram eventos e disparam follow-up automático |
| **RN-89** | Escolha entre: nova sessão ou ação em lote |

### 2.10 Skills

Instruções reutilizáveis que orientam comportamento do agente em tarefas específicas.

| Regra | Descrição |
|-------|-----------|
| **RN-90** | Skills são acionáveis por comando (ex: `/nome-da-skill`) |
| **RN-91** | Cada skill tem: nome, slug, descrição, instruções, arquivos de conhecimento |
| **RN-92** | Lista no workspace com busca por nome/slug/descrição |
| **RN-93** | Skills podem ser enviadas para outro workspace |
| **RN-94** | Automações podem usar skills para consistência |

### 2.11 Workflows

Processos reutilizáveis mais completos que skills — descrevem sequência, contexto e critério de execução.

| Regra | Descrição |
|-------|-----------|
| **RN-95** | Acionamento por `/` no input (abre sugestões) |
| **RN-96** | Mais completo que skill: diagnóstico, análise, criação, revisão, handoff |
| **RN-97** | Cada workflow tem: nome, slug, descrição, comando, instruções, arquivos conhecimento |
| **RN-98** | Versionados e publicáveis no Marketplace |
| **RN-99** | Automações podem usar workflows |

### 2.12 Dashboards

Painéis nativos salvos com fontes, layout, filtros e refresh reutilizáveis.

| Regra | Descrição |
|-------|-----------|
| **RN-100** | Preserva definição durável (não resposta solta em sessão) |
| **RN-101** | Elementos: fontes, parâmetros, transformações, layout (KPIs, tabelas, gráficos) |
| **RN-102** | Last run: status, horário, linhas processadas, erros |
| **RN-103** | Agente pode: criar, abrir salvo, atualizar dados, ajustar filtros |
| **RN-104** | Refresh usa definição salva (não redesenha painel) |
| **RN-105** | Casos: KPIs recorrentes, análises de performance, relatórios padronizados |

### 2.13 Brain (Memória em Grafo)

Sistema de memória persistente com visualização em grafo interativo e sync entre máquinas.

| Regra | Descrição |
|-------|-----------|
| **RN-110** | Brain é tela dedicada para visualizar e gerenciar memórias |
| **RN-111** | Memórias são nós em um grafo conectado |
| **RN-112** | Tipos: Preferência, Decisão, Observação, Resumo, Afirmação, Referência |
| **RN-113** | Visualização em grafo interativo (zoom, pan, fullscreen) + lista alternativa |
| **RN-114** | Filtros por tipo e status (Ativas, Arquivadas, Todas) |
| **RN-115** | Busca textual nas memórias |
| **RN-116** | Agente cria memórias automaticamente durante conversas |
| **RN-117** | Usuário pode confirmar, editar, arquivar ou deletar |
| **RN-118** | Memórias conectam-se entre si (grafo de conhecimento) |
| **RN-119** | Agente consulta memórias relevantes antes de responder |
| **RN-120** | Tudo armazenado localmente (SQLite) |
| **RN-121** | Sync criptografado entre máquinas (Shared Brain) |
| **RN-122** | Gestão de nós confiáveis para sync |
| **RN-123** | NÃO sincroniza: credenciais, tokens, chaves API, logs brutos |
| **RN-124** | Comportamento proativo mas não inconveniente: sugere antes de salvar |

### 2.14 Marketplace

Loja de skills/workflows compartilhados entre usuários do AdOS.

| Regra | Descrição |
|-------|-----------|
| **RN-130** | Marketplace é tela dedicada no app |
| **RN-131** | Publicar, editar e colaborar em skills e workflows |
| **RN-132** | Aba "Meus Itens" com filtros: Rascunho, Ativo, Despublicado, Oculto, Bloqueado |
| **RN-133** | Editor com abas: Geral, Conteúdo, Arquivos, Versões |
| **RN-134** | Autosave como rascunho local |
| **RN-135** | Visibilidade: Público, Mesmo domínio, Lista de domínios, Somente convite |
| **RN-136** | Colaboradores: co-edit sem poder gerenciar/despublicar/transferir |
| **RN-137** | Publicar nova versão envia ao marketplace; Salvar persiste rascunho |
| **RN-138** | Requer backend/API centralizado (não local-only) |

### 2.15 Permissões

Controla autonomia do agente para leitura, edição e execução.

| Regra | Descrição |
|-------|-----------|
| **RN-140** | 3 modos: Explorar (só leitura), Perguntar (leitura + aprovação), Executar (autônomo) |
| **RN-141** | Modo padrão configurável por workspace |
| **RN-142** | Overrides por contexto ou tarefa |
| **RN-143** | Começar restritivo, expandir com confiança |
| **RN-144** | Ações destrutivas sempre pedem confirmação |
| **RN-145** | Network Interceptor: injeta metadados nas requisições, captura erros |

### 2.16 Configurações do App

Controles globais do desktop.

| Regra | Descrição |
|-------|-----------|
| **RN-150** | Notificações do desktop quando agente termina tarefa |
| **RN-151** | Manter máquina acordada durante operações longas |
| **RN-152** | Canal de atualização (estável/beta) |
| **RN-153** | Idioma do app: PT-BR padrão |
| **RN-154** | Workspace padrão ao abrir o app |
| **RN-155** | Configurações persistem localmente (SQLite/electron-store) |

### 2.17 Aparência

| Regra | Descrição |
|-------|-----------|
| **RN-160** | Tema dark (padrão) e light — toggle na title bar |
| **RN-161** | Override de tema por workspace |
| **RN-162** | Controle de fonte (família, tamanho) |
| **RN-163** | Mapeamento de ícones de ferramentas |

### 2.18 Input

| Regra | Descrição |
|-------|-----------|
| **RN-165** | Tecla de envio configurável: Enter ou Ctrl+Enter |
| **RN-166** | Auto-capitalização de início de frases |
| **RN-167** | Corretor ortográfico (on/off) |
| **RN-168** | Shift+Enter para nova linha quando envio em Enter |

### 2.19 Preferências do Usuário

| Regra | Descrição |
|-------|-----------|
| **RN-170** | Campos: nome, timezone, idioma, cidade, país |
| **RN-171** | Seção "Notas": contexto livre que o agente usa para personalizar |
| **RN-172** | Atualização reflete em agendas e automações |
| **RN-173** | Agente consulta preferências antes de responder (tom, idioma) |

### 2.20 Uso e Créditos

| Regra | Descrição |
|-------|-----------|
| **RN-180** | Dashboard de consumo: diário e mensal |
| **RN-181** | Limites personalizáveis por workspace |
| **RN-182** | Comparação de ritmo: consumo atual vs mês anterior |
| **RN-183** | Breakdown por modelo (qual IA consumiu mais) |
| **RN-184** | Gráfico de consumo diário |
| **RN-185** | Bloqueio ao atingir limite mensal (novas chamadas bloqueadas até reset) |
| **RN-186** | Projeção de fechamento do mês visível |

### 2.21 Cloud Sync

Sincroniza workspace entre dispositivos.

| Regra | Descrição |
|-------|-----------|
| **RN-190** | Token conecta mesmo workspace entre dispositivos |
| **RN-191** | Push: envia estado local para nuvem (manual) |
| **RN-192** | Pull: traz estado remoto com prévia antes de confirmação |
| **RN-193** | Sincroniza: sessões, config fontes, skills, temas, permissões, arquivos textuais |
| **RN-194** | NÃO sincroniza: credenciais, anexos, downloads, arquivos > 10 MB |
| **RN-195** | Pull pode sobrescrever locais — prévia obrigatória |

### 2.22 Compartilhamento

| Regra | Descrição |
|-------|-----------|
| **RN-200** | Publicar sessão com link de leitura (fora do app) |
| **RN-201** | Sessão colaborativa: outro workspace participa com URL + token de edição |
| **RN-202** | Controle remoto: continuar sessão em outro dispositivo pareado |
| **RN-203** | Mensagens via Telegram: bot conectado ao workspace |

### 2.23 Telegram

| Regra | Descrição |
|-------|-----------|
| **RN-210** | Criar bot via @BotFather, receber token |
| **RN-211** | Config em Configurações > Workspace > Telegram |
| **RN-212** | Token em cofre criptografado |
| **RN-213** | Pareamento: código gerado, `/pair <código>` no Telegram |
| **RN-214** | Mensagens do chat vão direto na sessão; respostas voltam no Telegram |
| **RN-215** | Estados gateway: Online, Ativado mas desconectado, Desativado |

### 2.24 Company Context

| Regra | Descrição |
|-------|-----------|
| **RN-220** | Vínculo do workspace com empresa cadastrada |
| **RN-221** | Agentes acessam automaticamente contexto organizacional |
| **RN-222** | Documentos em markdown com slug, responsável, regras de leitura/edição |
| **RN-223** | Fluxo de PR para revisar mudanças antes de promover para oficial |
| **RN-224** | Abas: Docs, Estrutura, Pessoas, PRs |

### 2.25 Suporte (Help Center)

| Regra | Descrição |
|-------|-----------|
| **RN-230** | Tela dedicada de ajuda e documentação interna |
| **RN-231** | Busca por tópicos |
| **RN-232** | Cards de navegação: Visão geral, App, IA, Agentes, Fontes, Skills |
| **RN-233** | Botão "Enviar Feedback" |
| **RN-234** | Links diretos para rotas internas (deep links) |
| **RN-235** | Documentação offline (não depende de internet) |

### 2.26 Modo Reparo

| Regra | Descrição |
|-------|-----------|
| **RN-240** | Diagnósticos somente-leitura de saúde do app |
| **RN-241** | Reparo guiado de metadados com ação explícita |
| **RN-242** | Preserva: mensagens, arquivos, credenciais, conteúdo sessões |
| **RN-243** | 8 cartões de subsistema: Config, Workspaces, Sessões, Runtime, Artefatos, Plataforma, Credenciais, Base |
| **RN-244** | Log técnico para suporte (JSON seguro) |

### 2.27 Atalhos de Teclado

| Regra | Descrição |
|-------|-----------|
| **RN-250** | Atalhos dinâmicos por SO (Windows: Ctrl, Mac: ⌘) |
| **RN-251** | Referência completa organizada por categoria |
| **RN-252** | Gerados do registro de ações (refletem estado atual) |

### 2.28 Ferramentas (Hub)

| Regra | Descrição |
|-------|-----------|
| **RN-260** | Hub que reúne: Conexões, Skills, Workflows, Dashboards |
| **RN-261** | Abas principais com visão consolidada |
| **RN-262** | Revisar antes de abrir sessão ou criar automação |
| **RN-263** | Diagnóstico: ferramenta não encontrada → começar por Ferramentas |

### 2.29 Segurança e Privacidade

Arquitetura local-first: dados ficam na máquina do usuário.

| Regra | Descrição |
|-------|-----------|
| **RN-270** | Context Isolation: renderer não acessa Node.js diretamente |
| **RN-271** | No Node Integration: sem acesso ao filesystem pelo renderer |
| **RN-272** | Preload Bridge: API tipada via contextBridge |
| **RN-273** | CSP restritivo no HTML |
| **RN-274** | Keys nunca em logs, nunca no git |
| **RN-275** | Dados que NUNCA saem: conteúdo mensagens, nomes de arquivos, caminhos locais, IDs raw, credenciais, dados de APIs |
| **RN-276** | Telemetria: apenas comportamental (tipo evento, modelo, resultado, versão) — tudo hasheado |
| **RN-277** | Chamadas para APIs externas saem direto da máquina (não via proxy) |

### 2.30 Design & Slides (Workflow)

| Regra | Descrição |
|-------|-----------|
| **RN-280** | Slides/deck em HTML 1920×1080 (exportáveis PDF, PPTX) |
| **RN-281** | Protótipos interativos com frames HTML nativos |
| **RN-282** | Infográficos com tipografia premium |
| **RN-283** | Variações de design lado a lado |
| **RN-284** | Casos: decks executivos, onboarding, protótipos, marketing |

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
│  │ LLM APIs  │                 │  Browser    │  │
│  │ (OpenAI,  │                 │  Engine     │  │
│  │  Claude,  │                 │  (Chromium  │  │
│  │  Gemini)  │                 │  embutido)  │  │
│  └───────────┘                 └─────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │         MCP SUBPROCESS (SOURCES)          │   │
│  │  - Notion, Slack, SQL, Meta Ads, etc.    │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Fluxo de dados:**
```
UI (React) → IPC Bridge → Main Process
→ Agent Engine → Network Interceptor → LLM APIs
→ Resposta → SessionManager → Persiste local (SQLite)
MCP subprocess → APIs Externas (SQL/Notion/Slack/Meta)
Main Process → Telemetria (hasheada, sem conteúdo)
```

### Camadas

| Camada | Tecnologia | Responsabilidade |
|--------|-----------|------------------|
| Desktop Shell | Electron 33+ | Janela, lifecycle, IPC |
| UI | React 19 + TailwindCSS | Interface de chat, settings, sidebar |
| Agent Engine | OpenClaw (fork) | Loop de agente, tools, MCP |
| Browser | WebContentsView (Chromium) | Automação web embutida |
| Storage | SQLite (sql.js/WASM) | Sessões, mensagens, memória, settings |
| Crypto | electron safeStorage | Criptografia de API keys |
| LLM | OpenAI SDK, Anthropic SDK, Google GenAI SDK | Comunicação com modelos |
| Sources | MCP subprocess | Conexões com APIs externas |

---

## 4. Stack Técnica

- **Runtime:** Node.js 22+ (Electron embeds Node)
- **Linguagem:** TypeScript (strict mode)
- **Frontend:** React 19 + Vite 6 + TailwindCSS 3
- **Backend (main process):** Electron IPC + módulos TypeScript
- **Package Manager:** npm
- **Build:** electron-builder (NSIS installer para Windows)
- **Linting:** ESLint 9
- **Database:** SQLite via sql.js (WASM, zero compilação nativa)
- **Temas:** Dark/Light mode via CSS variables + Tailwind darkMode: 'class'

---

## 5. Estrutura do Repositório

```
AdOS/
├── package.json           — dependências e scripts
├── index.html             — entry HTML (Vite)
├── vite.config.ts         — config Vite
├── tsconfig.json          — TypeScript (renderer)
├── tailwind.config.js     — TailwindCSS com tema brand
├── postcss.config.js      — PostCSS
├── DOCS.md                — este arquivo
│
├── electron/              — PROCESSO PRINCIPAL
│   ├── main.ts            — entry Electron, lifecycle, IPC
│   ├── preload.ts         — context bridge (API segura pro renderer)
│   ├── llm.ts             — handlers de LLM (OpenAI, Claude, Gemini)
│   ├── browser.ts         — WebContentsView automation
│   └── tsconfig.json      — TypeScript config (commonjs)
│
├── src/                   — RENDERER (React)
│   ├── main.tsx           — React entry
│   ├── App.tsx            — layout principal (dark/light mode)
│   ├── index.css          — Tailwind + CSS variables (temas)
│   ├── pages/
│   │   ├── Chat.tsx       — interface de conversa
│   │   └── Settings.tsx   — configurações com sidebar de abas
│   ├── components/
│   │   ├── TitleBar.tsx   — barra de título + theme toggle
│   │   ├── Sidebar.tsx    — lista de sessões + workspace
│   │   └── MessageBubble.tsx — bolha de mensagem com avatar
│   └── lib/
│       └── db/
│           └── schema.sql — schema SQLite
│
├── docs/                  — documentação de referência
│   └── g4os-docs-full.txt — docs completas do G4 OS (referência)
│
├── resources/             — ícones e assets
└── build/                 — config electron-builder
```

---

## 6. Decisões Técnicas

| Decisão | Justificativa |
|---------|---------------|
| Electron sobre Tauri | OpenClaw é Node.js. Manter tudo no mesmo runtime |
| WebContentsView sobre Playwright | Browser embutido dentro do app, não janela externa |
| SQLite (sql.js) sobre melhor-sqlite3 | Zero compilação nativa, WASM cross-platform |
| OpenClaw fork | Loop de agente, tools, MCP já resolvidos. MIT license |
| safeStorage | Windows Credential Manager nativo |
| CSS Variables para temas | Dark/Light mode sem duplicar classes |
| Local-first | Dados na máquina, sem proxy, privacidade por design |

---

## 7. Telas do App

| Tela | Descrição |
|------|-----------|
| **Chat** | Interface principal de conversa com LLM |
| **Browser** | Navegador embutido (split view ou fullscreen) |
| **Settings** | Configurações com sidebar (API Keys, Modelo, App, Aparência, Input, Workspace, Uso, Permissões, Tags, Cloud Sync, Preferências, Suporte) |
| **Automações** | Painel de rotinas, agendamentos e vigias |
| **Ferramentas** | Hub: Conexões, Skills, Workflows, Dashboards |
| **Brain** | Visualização e gestão de memórias em grafo |
| **Marketplace** | Loja de skills/workflows compartilhados |

---

## 8. Deep Links

O AdOS suporta deep links para navegação direta:

| Link | Destino |
|------|---------|
| `ados://workflows` | Lista de workflows |
| `ados://skills` | Lista de skills |
| `ados://dashboards` | Painéis salvos |
| `ados://settings/usage` | Consumo de créditos |
| `ados://settings/workspace` | Configuração workspace |
| `ados://settings/api-keys` | Cadastro de chaves |

---

## 9. Roadmap

### Fase 1 — MVP Chat (2-3 semanas) ✅
- Electron app funcional (abre/fecha corretamente)
- UI de chat com OpenAI GPT-4o
- Tela de settings para API keys
- Histórico de sessões (SQLite)
- Dark/Light mode
- Build/installer Windows (.exe)

### Fase 2 — Browser Automation (2-3 semanas)
- Browser embutido (WebContentsView)
- Modo split view (chat + browser)
- Pause/resume (usuário assume controle)
- Screenshots e DOM snapshot para agente
- Barra de URL com navegação manual

### Fase 3 — Agent Engine (3-4 semanas)
- Fork OpenClaw integrado
- Sistema de tools com MCP
- File system access (ler/escrever arquivos locais)
- Memória persistente (Brain)
- System prompt customizável
- Permissões (Explorar/Perguntar/Executar)

### Fase 4 — Multi-LLM + Skills (2-3 semanas)
- Suporte Anthropic, Google, modelos locais
- Painel multi-provider
- Seletor de modelo por sessão
- Skills e Workflows
- Atalhos de teclado

### Fase 5 — Integrações AdNet (2-3 semanas)
- Banco adnet_intelligence (PostgreSQL via MCP)
- Notion API
- Slack API
- Meta Ads API
- Dashboards nativos

### Fase 6 — Automações + Marketplace (3-4 semanas)
- Rotinas, agendamentos, vigias
- Tela de automações
- Marketplace (requer backend)
- Cloud Sync entre dispositivos
- Telegram integration
- Company Context

---

## 10. Convenções de Código

- TypeScript strict mode sempre
- Nomes de variáveis/funções em inglês (camelCase)
- Nomes de arquivos em PascalCase para componentes React
- Commits em inglês, conventional commits (`feat:`, `fix:`, `docs:`)
- Co-author: `Co-Authored-By: G4 OS <g4os@g4business.com>`

---

*Versão: 0.2.0*
*Criado: 2026-05-13*
*Atualizado: 2026-05-14*
*Repo: github.com/PM-ADNET/AdOS*
*Referência: docs completas do G4 OS (docsg4os.g4business.com)*
