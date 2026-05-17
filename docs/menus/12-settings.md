# 12. Settings (Configurações)

## Descrição

Central de configuração do JVOS com 12 abas organizadas em três seções (APP, WORKSPACE, SISTEMA). O componente `Settings.tsx` renderiza a página principal com navegação lateral e um painel de conteúdo dinâmico. **Atalhos** (`Shortcuts.tsx`) e **Preferências** (`Preferences.tsx`) são páginas standalone independentes, acessadas diretamente pelo nav principal do app — mas suas funcionalidades também aparecem como abas embutidas dentro de Settings (como `ShortcutsSection` e a aba `preferences`).

---

## Estrutura de Estado

### Settings.tsx — estado principal

| Estado | Tipo | Função |
|--------|------|--------|
| `activeTab` | `SettingsTab` | Aba ativa: `'app' \| 'appearance' \| 'input' \| 'workspace' \| 'providers' \| 'mcp' \| 'model' \| 'agents' \| 'permissions' \| 'preferences' \| 'shortcuts' \| 'about'` |
| `themeMode` | `'system' \| 'light' \| 'dark'` | Modo de tema padrão do sistema |
| `font` | `'manrope' \| 'system'` | Fonte da interface |
| `sendKey` | `'enter' \| 'ctrl-enter'` | Tecla de envio de mensagens |
| `autoCapitalize` | `boolean` | Auto-capitalização ao digitar |
| `spellCheck` | `boolean` | Corretor ortográfico |
| `settingsSearch` | `string` | Texto de busca no nav de abas |
| `confirmRemoveMcp` | `string \| null` | Nome do servidor MCP pendente de remoção (modal) |
| `mcpFormError` | `string` | Mensagem de erro no formulário MCP |
| `userName` | `string` | Nome do usuário (preferências) |
| `userTimezone` | `string` | Fuso horário do usuário (padrão: `America/Sao_Paulo`) |
| `userLanguage` | `string` | Idioma do usuário (padrão: `pt-BR`) |
| `userNotes` | `string` | Notas livres do usuário para o assistente |
| `providers` | `Provider[]` | Lista de providers de IA cadastrados |
| `mcpServers` | `McpServer[]` | Lista de servidores MCP configurados |
| `models` | `Model[]` | Modelos de IA disponíveis por provider |
| `defaultModel` | `string` | ID do modelo padrão (padrão: `codex-mini-latest`) |
| `keyInputs` | `Record<string, string>` | Inputs de API key por provider ID |
| `keyStatus` | `Record<string, string>` | Status de teste/save por provider ID (`testing \| saving \| saved \| error \| cooldown`) |
| `showAddMcp` | `boolean` | Exibe formulário de adicionar servidor MCP |
| `mcpForm` | `{ name, command, args, url, transport }` | Dados do formulário de novo servidor MCP |
| `documentsPath` | `string` | Caminho da pasta de documentos do JVOS |
| `pathSaved` | `boolean` | Feedback visual "Salvo" para documents path |
| `systemPrompt` | `string` | System prompt global enviado em todas as mensagens |
| `promptSaved` | `boolean` | Feedback visual "Salvo" para system prompt |
| `workspaceName` | `string` | Nome do workspace (padrão: `JVOS`) |
| `editingWorkspaceName` | `boolean` | Modo de edição inline do nome do workspace |
| `permissionMode` | `string` | Modo de permissão padrão (`execute \| ask \| explore`) |
| `mcpLocalEnabled` | `boolean` | Habilita servidores MCP locais (stdio) |
| `keyTestCooldown` | `Record<string, number>` | Timestamp do último teste de key por provider (cooldown 5s) |
| `mcpTestStatus` | `'idle' \| 'testing' \| 'success' \| 'error'` | Status do teste de conexão MCP antes de salvar |
| `mcpTestMessage` | `string` | Mensagem de resultado do teste MCP |
| `customThemeMode` | `'dark' \| 'light' \| 'midnight'` | Tema customizado selecionado |
| `accentColor` | `string` | Cor de destaque da interface (hex, padrão: `#6366f1`) |
| `showThemeEditor` | `boolean` | Exibe painel de personalização de tema |
| `sessionStats` | `{ count: number; estimatedMB: number } \| null` | Estatísticas de sessões armazenadas |
| `showPurgeConfirm` | `'old' \| 'all' \| null` | Estado do modal de confirmação de purge |
| `purgeResult` | `string \| null` | Mensagem de resultado após purge |
| `purgeConfirmText` | `string` | Texto digitado para confirmar purge total (deve ser `EXCLUIR`) |
| `purgeOldCount` | `number` | Número de sessões antigas identificadas para purge |

### AgentsSection — subcomponente

| Estado | Tipo | Função |
|--------|------|--------|
| `agents` | `any[]` | Lista de agentes configurados |
| `routing` | `boolean` | Roteamento automático entre agentes habilitado |
| `tiers` | `any` | Estrutura de tiers e modelos recomendados |
| `editingAgent` | `string \| null` | ID do agente em edição de modelo |
| `editModel` | `string` | Novo valor de modelo sendo editado |

### PermissionsSection — subcomponente

| Estado | Tipo | Função |
|--------|------|--------|
| `permissions` | `Array<{ id, pattern, type, access, comment }>` | Regras de permissão cadastradas |
| `showAdd` | `boolean` | Exibe formulário de nova regra |
| `form` | `{ pattern, type, access, comment }` | Dados do formulário de nova regra |
| `regexError` | `string` | Erro de validação do regex em tempo real |
| `auditLog` | `AuditLogEntry[]` | Histórico de ações (add/change/delete) nas permissões |
| `showAuditLog` | `boolean` | Exibe seção expansível do audit log |

### ShortcutsSection — subcomponente (embutido na aba Atalhos)

| Estado | Tipo | Função |
|--------|------|--------|
| `shortcuts` | `Array<{ action, label, keys }>` | Lista de atalhos (padrão ou customizados) |
| `editingAction` | `string \| null` | ID da ação sendo editada |
| `capturedKeys` | `string` | Combinação de teclas capturada no momento |
| `conflict` | `string` | Mensagem de conflito com outro atalho |

---

## Abas

### Seção APP

**App**
- Card "Pasta de Documentos": input de texto com caminho + botão Salvar (feedback visual "✓ Salvo" por 2s)
- Card "Importar / Exportar": botão "Exportar Config (Clipboard)" (exporta sem API keys) e "Importar (do Clipboard)"
- Card "System Prompt (Instruções Admin)": textarea redimensionável para contexto macro + botão Salvar
- Card "Gerenciar Sessoes": exibe total de sessões e estimativa de MB; botões "Limpar sessoes antigas" (>30 dias, requer confirmação) e "Limpar tudo" (requer digitar `EXCLUIR`)

**Aparência**
- Card "Tema padrão": seletor segmentado de modo (`Sistema / Claro / Escuro`) e fonte (`Manrope / Sistema`)
- Card "Temas": presets visuais (`Escuro`, `Claro`, `Midnight Blue`) com preview de cor de fundo; botão "Personalizar" exibe painel com color picker para cor de destaque e preview em 3 tonalidades

**Entrada**
- Card "Digitação": toggles para Auto-capitalização e Corretor ortográfico
- Card "Envio": select para tecla de envio (`Enter` ou `Ctrl+Enter`)

### Seção WORKSPACE

**Workspace**
- Card "Informacoes": nome do workspace com edição inline (salva em `ados.db.setSetting`), exibe diretório de trabalho atual
- Card "Permissoes": select de modo padrão (`Executar / Perguntar antes de editar / Explorar`)
- Card "Avancado": toggle "Servidores MCP Locais" para habilitar/desabilitar subprocessos stdio

**Providers**
- Lista de providers com número de modelos e badge "Configurada" se key existe
- Por provider: input de senha para API key + botão "Salvar" com estados dinâmicos (`⟳ Testando... / Salvando... / ✓ Salvo / ✕ Falhou / ⏱ Aguarde 5s`)

**MCP Servers**
- Botão "Adicionar" abre formulário: nome, select de transport (`Stdio / SSE / HTTP`), comando + args (stdio) ou URL (remoto)
- Validação inline antes de salvar + teste de conexão com timeout de 10s
- Lista de servidores com badge de status (`Conectado / Desconectado / Erro / Conectando`), contagem de tools, botões Conectar/Desconectar e Remover
- Modal de confirmação ao remover

**Modelo**
- Lista de modelos como radio buttons com nome, provider, tipo de API e descrição
- Modelos sem API key ficam desabilitados com aviso "Sem API key"

### Seção SISTEMA

**Agentes**
- Card "Roteamento Automático": toggle liga/desliga roteamento inteligente entre agentes + grid de tiers (`Router / Fast / Balanced / Power`) com custo relativo
- Lista de agentes configurados com toggle de ativo/inativo, badge de tier, modelo atual e botão "editar" para alterar o modelo inline
- Card "Modelos Recomendados por Tier": mapeamento de tier para lista de modelos sugeridos

**Permissões**
- Botão "+ Regra" abre formulário: pattern regex (validação em tempo real com borda vermelha), type (`Bash / MCP / Tool / File`), access (`Permitido / Perguntar / Bloqueado`), comentário opcional
- Lista de regras com badges coloridos por tipo e access; select inline para alterar access; botão de exclusão
- Seção expansível "Audit Log (N entradas)" com entradas coloridas por ação (`add` verde / `change` amarelo / `delete` vermelho), pattern, detalhe e timestamp

**Preferências** (aba embutida em Settings)
- Formulário com campos: Nome, Fuso horário (input livre), Idioma (input livre), Notas (textarea)
- Botão "Salvar Preferências"

**Atalhos** (aba embutida em Settings via `ShortcutsSection`)
- Lista de 10 atalhos com label e tecla
- Clique na tecla abre modo de captura (input readOnly + onKeyDown); detecta conflitos em tempo real
- Botão "Restaurar padrões" reinicia para os DEFAULT_SHORTCUTS
- Persistência via `ados.db.setSetting('custom_shortcuts', ...)`

**Sobre**
- Logo "A" + nome JVOS + versão 1.0.0
- Lista de features: multi-provider AI, MCP Protocol, Agent Engine, Browser automation, Skills/Workflows/Automações/Brain, persistência local (SQLite + safeStorage)

---

## Sub-páginas Independentes

### Atalhos (Shortcuts)

Arquivo: `Shortcuts.tsx` — página standalone acessada via nav principal do app (não é a mesma coisa que a `ShortcutsSection` embutida em Settings, que permite edição).

**Estado**

| Estado | Tipo | Função |
|--------|------|--------|
| `filter` | `string` | Texto de filtro para busca na lista de atalhos |

**UI**
- Título "Atalhos de Teclado" + subtítulo
- Input de busca com ícone de lupa (filtra por label ou keys em tempo real)
- Lista de 10 atalhos somente leitura: label à esquerda, tecla renderizada como `<kbd>` à direita

**Lista completa de atalhos (constante `SHORTCUTS`)**

| Ação | Label | Tecla padrão |
|------|-------|--------------|
| `new-session` | Nova Sessão | `Ctrl+N` |
| `search` | Buscar | `Ctrl+K` |
| `settings` | Configurações | `Ctrl+,` |
| `toggle-theme` | Alternar Tema | `Ctrl+Shift+D` |
| `send-message` | Enviar Mensagem | `Enter` |
| `new-line` | Nova Linha | `Shift+Enter` |
| `voice-input` | Input por Voz | `Ctrl+Shift+V` |
| `close-session` | Fechar Sessão | `Ctrl+W` |
| `next-session` | Próxima Sessão | `Ctrl+Tab` |
| `prev-session` | Sessão Anterior | `Ctrl+Shift+Tab` |

> Nota: esta página é somente leitura. A edição de atalhos é feita na aba "Atalhos" dentro de Settings (componente `ShortcutsSection`).

---

### Preferências (Preferences)

Arquivo: `Preferences.tsx` — página standalone acessada via nav principal do app.

**Estado**

| Estado | Tipo | Função |
|--------|------|--------|
| `name` | `string` | Nome do usuário |
| `timezone` | `string` | Fuso horário selecionado (padrão: `America/Sao_Paulo`) |
| `language` | `string` | Idioma selecionado (padrão: `pt-BR`) |
| `role` | `string` | Cargo ou função do usuário |
| `notes` | `string` | Notas livres para personalizar o assistente |
| `saved` | `boolean` | Feedback visual "Salvo" por 2s após salvar |

**UI**
- Título "Preferências" + subtítulo descritivo
- Card único com:
  - Input "Nome"
  - Input "Cargo / Função" (placeholder: `CEO, Gestor de Projetos, Dev Senior`)
  - Grid 2 colunas: select "Fuso horário" (12 opções) + select "Idioma" (5 opções)
  - Textarea "Notas para o assistente" (3 linhas, não redimensionável)
  - Botão "Salvar Preferências" (mostra "Salvo" por 2s após sucesso)

**Fusos horários disponíveis**
`America/Sao_Paulo`, `America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, `Europe/London`, `Europe/Berlin`, `Europe/Lisbon`, `Asia/Tokyo`, `Asia/Shanghai`, `Australia/Sydney`, `UTC`

**Idiomas disponíveis**
`pt-BR` (Português Brasil), `en-US` (English US), `es-ES` (Español), `fr-FR` (Français), `de-DE` (Deutsch)

**Chamadas IPC específicas**
```
ados.db.getPreferences()                   — carrega todos os campos ao montar
ados.db.setPreference('name', value)       — salva nome
ados.db.setPreference('timezone', value)   — salva fuso
ados.db.setPreference('language', value)   — salva idioma
ados.db.setPreference('role', value)       — salva cargo
ados.db.setPreference('notes', value)      — salva notas
```
> Todas as chamadas são disparadas em paralelo via `Promise.all` no `handleSave`.

---

## Chamadas IPC

```
// Banco de dados — configurações
ados.db.getSetting(key)
ados.db.setSetting(key, value)

// Banco de dados — preferências (usado pela página standalone Preferences.tsx)
ados.db.getPreferences()
ados.db.setPreference(key, value)

// Banco de dados — sessões
ados.db.getSessions()
ados.db.deleteSession(id)

// Banco de dados — permissões
ados.db.getPermissions()
ados.db.addPermission(id, pattern, type, access, comment)
ados.db.updatePermission(id, access)
ados.db.deletePermission(id)

// Providers de IA
ados.providers.list()
ados.providers.listModels()
ados.providers.getDefaultModel()
ados.providers.setDefaultModel(modelId)
ados.providers.saveKey(providerId, key)

// LLM — teste de key
ados.llm.testKey(providerId, key)

// MCP Servers
ados.mcp.listServers()
ados.mcp.addServer(config)
ados.mcp.testServer?(config)            — opcional, usado antes de salvar
ados.mcp.connectServer(name)
ados.mcp.disconnectServer(name)
ados.mcp.removeServer(name)

// Agentes
ados.agents.list()
ados.agents.getRouting()
ados.agents.setRouting(enabled)
ados.agents.getTiers()
ados.agents.update(id, { enabled?, model? })

// Ferramentas utilitárias
ados.tools?.getDocumentsPath()           — opcional, fallback para documents path

// Clipboard (Web API nativa)
navigator.clipboard.writeText(json)     — exportar config
navigator.clipboard.readText()          — importar config

// localStorage (Web API nativa)
localStorage.setItem('ados-theme', json)
localStorage.getItem('ados-theme')
```

---

## Fluxo de Dados

1. Ao montar, `useEffect` dispara 9 loaders em paralelo: `loadProviders`, `loadMcpServers`, `loadModels`, `loadDocumentsPath`, `loadSystemPrompt`, `loadAppearanceSettings`, `loadInputSettings`, `loadPreferences`, `loadWorkspaceSettings`, `loadSessionStats`
2. Cada loader lê configurações via `ados.db.getSetting` e atualiza o estado local correspondente
3. `loadAppearanceSettings` também lê `localStorage` para aplicar tema customizado (modo + accentColor) via `applyCustomTheme`, que manipula CSS variables no `document.documentElement`
4. Alterações de aparência (tema, fonte) são aplicadas imediatamente no DOM via `handleSaveAppearance` e persistidas em `ados.db`
5. Alterações de tema customizado são salvas em `localStorage` via `handleSaveCustomTheme` e aplicadas via `applyCustomTheme`
6. Teste de API key: `Promise.race` entre `ados.llm.testKey` e timeout de 3s; cooldown de 5s por provider via `keyTestCooldown`; se OK, chama `ados.providers.saveKey` e recarrega providers e modelos
7. Adição de servidor MCP: valida formulário → teste de conexão via `ados.mcp.testServer` com timeout de 10s → se OK, chama `ados.mcp.addServer` → recarrega lista
8. Remoção de servidor MCP: clique em "Remover" define `confirmRemoveMcp` → modal de confirmação → `ados.mcp.removeServer` → recarrega lista
9. Purge de sessões: busca todas as sessões via `ados.db.getSessions` → filtra por data (>30 dias) ou all → loop `ados.db.deleteSession` por ID → atualiza `sessionStats`
10. Audit log de permissões: cada add/change/delete chama `addAuditEntry` que prepend a entrada no array (máx. 50) e persiste via `ados.db.setSetting('permissions_audit_log', json)`
11. Atalhos editáveis: captura via `onKeyDown` monta combo string → verifica conflitos → salva via `ados.db.setSetting('custom_shortcuts', json)`
12. Import/Export de config: exporta objeto com preferences, labels, permissions e settings gerais para clipboard (sem API keys); importar lê clipboard, parseia JSON e aplica cada campo

---

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Busca em tempo real no nav lateral de abas (filtra por label) | ✅ |
| 2 | Status visual de teste de API key com spinner, timeout 3s e estados `Testando / Salvando / Salvo / Falhou` | ✅ |
| 3 | Validação de regex em tempo real no formulário de permissões (borda vermelha + mensagem de erro, botão desabilitado) | ✅ |
| 4 | Atalhos de teclado editáveis via captura `onKeyDown`, detecção de conflitos em tempo real, persistência e "Restaurar padrões" | ✅ |
| 5 | Import/Export de configuração via clipboard (sem API keys por segurança) | ✅ |
| 6 | Validação de formulário MCP antes de salvar: stdio requer command, SSE/HTTP valida URL com `new URL()` | ✅ |
| 7 | Teste de conexão MCP antes de salvar com timeout de 10s e feedback inline (testing / success / error) | ✅ |
| 8 | Rate limit de 5s entre testes de API key por provider com feedback "⏱ Aguarde 5s" | ✅ |
| 9 | Audit log de permissões: registra add/change/delete com timestamp, pattern e detalhe; seção expansível com badges coloridos por ação | ✅ |
| 10 | Modal de confirmação ao remover servidor MCP com mensagem descritiva | ✅ |
| 11 | Gerenciamento de sessões: estatísticas de count e estimativa de MB, purge de sessões antigas (>30 dias) e purge total com confirmação digitada (`EXCLUIR`) | ✅ |
| 12 | Busca dentro de Settings — campo de busca que filtra e destaca a seção/campo relevante em qualquer aba | ✅ |
| 13 | Rotação de API keys — alerta quando key está próxima de expirar; botão de rotação com zero-downtime | ✅ |
| 14 | Perfis de configuração — salvar/carregar conjuntos de settings (ex: "Modo Trabalho" vs. "Modo Pessoal") | ✅ |
| 15 | Import/Export completo — exportar TODAS as configurações (keys, MCP, shortcuts, permissions, tema) em bundle criptografado | ✅ |
| 16 | Audit log paginado — paginação + filtro por tipo/data no log de permissões; export CSV | ✅ |
| 17 | MCP error logs — ao falhar conexão com MCP server, exibir log detalhado com stack trace e sugestão de fix | ✅ |
| 18 | Reset por seção — botão "Restaurar padrões" por aba/seção em vez de apenas reset global | ✅ |
| 19 | Shortcuts conflict detector — ao definir atalho, alertar se já está em uso por outra ação | ✅ |
| 20 | Validação de acessibilidade do tema — verificar contraste WCAG dos pares de cores; alertar se insuficiente | ✅ |
| 21 | Sync de settings cross-device — sincronizar preferências via CloudSync com resolução de conflito | ✅ |
| 22 | Categorização de permissions — agrupar regras por contexto (file ops, network, system) com bulk toggle | ✅ |
| 23 | Changelog de settings — log de todas as alterações com timestamp e valor anterior/novo | ✅ |
| 24 | Teste de provider com prompt customizado — input para testar API key com prompt real ao invés de ping | ✅ |
| 25 | Lock de settings sensíveis — proteger alterações em API keys e MCP com confirmação de senha | ✅ |
| 26 | Wizard de configuração inicial — guia passo-a-passo para novos usuários configurarem o essencial | ✅ |
| 27 | Tema escuro OLED — variante com preto puro (#000) para telas AMOLED | ✅ |
| 28 | Fix test prompt args — `ados.llm.chat(messages, model)` com modelo correto por provider (era invertido) | ✅ |
| 29 | Groq adicionado como provider — Llama 3.3 70B, Whisper gratuito para transcrição | ✅ |
| 30 | Backup automático de settings — snapshot diário das configs para restore | ✅ |
| 31 | Provider health badge — indicador de status ao lado de cada provider (online/offline/slow) | ✅ |
| 32 | API key expiry alert — countdown visual quando key está próxima de expirar | ✅ |
| 33 | Bulk key import — colar JSON com múltiplas keys de uma vez | ✅ |
| 34 | MCP marketplace — descobrir e instalar MCP servers populares | ✅ |
| 35 | Settings diff — mostrar o que mudou desde o último export/backup | ✅ |
| 36 | Per-session model override — configurar modelo default diferente por sessão | ✅ |
| 37 | Notification center — centralizar todas as notificações e alertas do sistema | ✅ |
| 38 | Usage dashboard — gráfico de gastos por provider/modelo nos últimos 30 dias | ✅ |
| 39 | Hotkey recorder visual — gravar atalho com preview visual do combo de teclas | ✅ |
| 40 | Theme marketplace — importar temas da comunidade | ✅ |
| 41 | Permission templates — conjuntos pré-definidos de permissões por role | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Breadcrumb navigation | Done |
| 2 | Badge alteracoes nao salvas | Done |
| 3 | Undo/Redo | Done |
| 4 | WCAG Contrast badge | Done |
| 5 | Command Palette Ctrl+K | Done |
| 6 | Info tooltips | Done |
| 7 | Sync timeline | Done |
| 8 | Templates de configuracao | Done |
| 9 | Dependency warnings | Done |
| 10 | Busca agrupada | Done |
