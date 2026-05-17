# 3. Automações

## Descrição
Sistema de agendamento e automação — cria tarefas automáticas que executam skills, enviam mensagens ou abrem novas sessões em horários, intervalos ou expressões cron configurados. Suporta hooks de ciclo de vida (pre/post mensagem e tool), rotinas recomendadas com ativação em um clique, dry run, histórico de execuções e kill switch global.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `tab` | `'mine' \| 'recommended' \| 'hooks'` | Aba ativa na visualização de lista |
| `automations` | `Automation[]` | Lista de automações salvas no banco |
| `showForm` | `boolean` | Controla exibição do formulário de criação/edição |
| `editingId` | `string \| null` | ID da automação sendo editada (null = criação nova) |
| `form` | `AutoForm` | Dados do formulário de criação/edição (16 campos) |
| `availableSources` | `Array<{ slug, name, type }>` | MCP servers disponíveis para seleção |
| `availableSkills` | `Array<{ slug, name, description }>` | Skills disponíveis para seleção |
| `sourceSearch` | `string` | Filtro de busca na lista de fontes |
| `skillSearch` | `string` | Filtro de busca na lista de skills |
| `confirmDelete` | `{ id: string; name: string } \| null` | Dados do modal de confirmação de exclusão |
| `cronError` | `string` | Mensagem de erro de validação da expressão cron |
| `cronPreview` | `string` | Valor atual do input de expressão cron |
| `dirError` | `string` | Mensagem de erro de validação do diretório |
| `history` | `Array<{ id, autoName, status, ts, duration? }>` | Últimas 20 execuções registradas |
| `showHistory` | `boolean` | Controla exibição do modal de histórico |
| `dryRunResult` | `{ name: string; preview: string } \| null` | Resultado do dry run para exibição em modal |
| `conflictWarning` | `string` | Aviso de conflito de horário com automação existente |
| `globalPaused` | `boolean` | Estado do kill switch global de automações |
| `hooks` | `Hook[]` | Lista de hooks configurados (persistida em localStorage) |
| `showHookForm` | `boolean` | Controla exibição do formulário inline de criação de hook |
| `hookForm` | `{ name, trigger, action }` | Dados do formulário de criação de hook |

### Interfaces de Dados

**`Automation`**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | UUID único |
| `name` | `string` | Nome da automação |
| `description` | `string` | Descrição opcional |
| `schedule` | `string` | String legível do agendamento |
| `sources` | `string[]` | Slugs das fontes/MCPs ativados |
| `enabled` | `boolean` | Se a automação está ativa |
| `lastRun` | `string \| null` | Timestamp da última execução |
| `createdAt` | `string` | Timestamp de criação |
| `actionType` | `ActionType` | Tipo de ação a executar |
| `skillSlug` | `string` | Slug da skill vinculada |
| `prompt` | `string` | Prompt de instrução |
| `workingDir` | `string` | Diretório de trabalho |
| `scheduleType` | `ScheduleType` | Tipo de agendamento |
| `scheduleDays` | `string[]` | Dias da semana selecionados |
| `scheduleTime` | `string` | Horário no formato HH:MM |
| `selectedSkills` | `string[]` | Slugs das skills ativadas na sessão |

**`AutoForm`** (campos do formulário de criação)
| Campo | Tipo | Padrão |
|-------|------|--------|
| `name` | `string` | `''` |
| `scheduleType` | `ScheduleType` | `'schedule'` |
| `scheduleDays` | `string[]` | `['seg','ter','qua','qui','sex']` |
| `scheduleTime` | `string` | `'08:00'` |
| `actionType` | `ActionType` | `'new_session'` |
| `skillSlug` | `string` | `''` |
| `prompt` | `string` | `''` |
| `sources` | `string[]` | `[]` |
| `workingDir` | `string` | `''` |
| `selectedSkills` | `string[]` | `[]` |
| `intervalValue` | `number` | `2` |
| `intervalUnit` | `'hours' \| 'minutes'` | `'hours'` |
| `permissionMode` | `'execute' \| 'ask' \| 'explore'` | `'execute'` |
| `osMode` | `boolean` | `false` |
| `runIfMissed` | `boolean` | `true` |
| `notifyOnComplete` | `boolean` | `true` |

**`Hook`**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | UUID único |
| `name` | `string` | Nome do hook |
| `trigger` | `'pre_message' \| 'post_message' \| 'pre_tool' \| 'post_tool'` | Momento de disparo |
| `action` | `string` | Código JS ou comando a executar |
| `enabled` | `boolean` | Se o hook está ativo |

## UI Layout

### Visualização de Lista (modo padrão)

- **Header**: título "Automações" + contador total e ativas
- **Botões de ação no header**:
  - "Pausar Todas / Pausado" — kill switch global com estado visual vermelho quando ativo
  - "Histórico" — abre modal de histórico de execuções
  - "+ Nova Automação" — abre o formulário de criação
- **Barra de abas**: Minhas Automações (com contador) / Rotinas Recomendadas (com contador) / Hooks (com badge numérico)
- **Estado vazio (aba "mine")**: ícone + texto orientativo + botão "+ Nova Automação"

### Cards de Automação (aba "Minhas Automações")

- Nome + badge de status (Ativa / Pausada)
- Toggle on/off à direita
- Botões de ação: "Editar", "Executar", "Dry Run", "Duplicar", "Clonar", "Remover"
- Tags inline: schedule, "Próxima: Hoje HH:MM / Amanhã HH:MM", skill slug, fontes
- Descrição ou prompt como subtítulo

### Cards de Rotinas Recomendadas (aba "Rotinas Recomendadas")

- Badge "ROTINA" + nome + descrição
- Tags: agendamento, fontes, skill slug
- Botão "Ativar" que cria a automação diretamente e redireciona para a aba "mine"
- 5 rotinas pré-definidas: Briefing da manhã, Checkpoint Diário, Resumo do Slack, Resumo de Emails, Health Check Semanal

### Aba Hooks

- Botão "+ Novo Hook" no topo
- Formulário inline colapsável com: input de nome, select de trigger, textarea de ação (monospace)
- Cards de hooks: toggle on/off, nome, badge de trigger (monospace), preview da action truncada, botão "Remover"
- Estado vazio com texto explicativo

### Formulário de Criação (modo form — substitui a lista)

- **Header**: botão "Voltar", título "Nova Automação" / "Editar Automação" (dinâmico), botão "Criar" / "Salvar" (desabilitado sem nome)
- **Footer**: botões "Cancelar" e "Criar" / "Salvar" (dinâmico conforme `editingId`)
- **7 seções**:
  1. **Detalhes**: input de nome
  2. **Agenda**: seletor de tipo com 4 modos (Uma vez / Agenda / Intervalo / Avançado)
     - *Uma vez*: time picker + nota "Executa uma vez e desativa."
     - *Agenda*: time picker + botões de dias da semana (Dom–Sáb) + presets (Todos os dias / Dias úteis / Fins de semana) + resumo legível + aviso de conflito de horário
     - *Intervalo*: input numérico + toggle Horas/Minutos + resumo legível
     - *Avançado (cron)*: input monospace + validação em tempo real (erro vermelho / sucesso verde) + hint de formato
  3. **Ação**: select de tipo de ação + input de skill slug (monospace) + textarea de prompt
  4. **Fontes**: input de busca + lista com checkboxes + contador de selecionados
  5. **Diretório de trabalho**: input monospace com validação de path absoluto + erro inline
  6. **Skills**: input de busca + lista com checkboxes + descrição truncada + contador de selecionados
  7. **Opções**: 4 controles em lista dividida
     - Modo de permissão: select (Executar / Perguntar / Explorar)
     - Modo OS: toggle boolean
     - Executar ao abrir se perdeu o horário: toggle boolean
     - Notificar ao concluir: toggle boolean

### Modais

- **Histórico de Execuções**: lista das últimas 20 execuções com indicador de status colorido (verde/amarelo/vermelho), nome, duração em segundos, timestamp formatado em pt-BR
- **Dry Run**: preview em monospace de skill, prompt, sources e modo — sem ação real
- **Confirmar exclusão**: mensagem de confirmação com nome da automação + botões "Cancelar" e "Excluir"

## Abas

| Aba | Chave | Conteúdo |
|-----|-------|----------|
| Minhas Automações | `'mine'` | Lista de automações criadas pelo usuário com controles de ativação, dry run, duplicação e exclusão |
| Rotinas Recomendadas | `'recommended'` | 5 templates pré-configurados ativáveis com um clique |
| Hooks | `'hooks'` | Hooks de ciclo de vida persistidos em localStorage; disparam código antes/depois de mensagens e tools |

## Chamadas IPC

```ts
// Carregamento inicial
ados.db.getAutomations()                        // lista todas as automações
ados.mcp.listServers()                          // lista MCP servers disponíveis como fontes
ados.db.getSkills()                             // lista skills disponíveis
ados.db.getAutomationHistory?.()                // últimas 20 execuções (opcional)
ados.db.getSetting?.('automations_global_pause') // lê estado do kill switch global

// Criação, edição e gerenciamento de automações
ados.db.addAutomation(id, name, description, schedule, sourcesJSON, extraFields)
ados.db.updateAutomation(id, name, description, schedule, sourcesJSON, extraFields) // atualiza automação existente
ados.db.toggleAutomation(id, enabled)           // ativa ou pausa automação individual
ados.db.deleteAutomation(id)                    // remove automação permanentemente

// Kill switch global
ados.db.setSetting?.('automations_global_pause', 'true' | 'false')
// quando ativado, chama toggleAutomation(id, false) para cada automação ativa

// Hooks (sem IPC — persistência via localStorage)
localStorage.getItem('ados-hooks')              // lê hooks salvos
localStorage.setItem('ados-hooks', JSON)        // salva hooks atualizados
```

## Fluxo de Dados

1. Na montagem do componente, `useEffect` dispara `loadAutomations()`, `loadMeta()`, `loadHistory()`, `loadGlobalPause()` e `loadHooks()` em paralelo.
2. `loadMeta()` chama `ados.mcp.listServers()` e `ados.db.getSkills()` separadamente em blocos try/catch — falhas silenciosas, arrays vazios como fallback.
3. `loadHooks()` lê exclusivamente do `localStorage` (sem IPC) e faz parse do JSON salvo.
4. O usuário cria uma automação via formulário: validações de nome, path absoluto e cron são feitas no frontend antes de qualquer chamada IPC.
5. Ao confirmar, `handleCreate()` verifica `editingId`: se presente, chama `ados.db.updateAutomation()` para salvar alterações; caso contrário, gera um UUID com `crypto.randomUUID()`, constrói a string de agendamento legível via `buildScheduleString()` e chama `ados.db.addAutomation()` com os campos extras serializados em JSON.
6. Rotinas recomendadas ativam `handleActivateRecommended()` que chama `addAutomation()` seguido imediatamente de `toggleAutomation(id, true)` e redireciona para a aba `'mine'`.
7. Dry Run é inteiramente local — não faz chamada IPC, apenas compõe um preview textual do estado atual da automação.
8. Kill switch global: `handleGlobalPauseToggle()` persiste o novo estado via `setSetting`, depois itera sobre todas as automações ativas chamando `toggleAutomation(id, false)` individualmente.
9. Conflict detection é calculado localmente em `checkConflicts()` comparando `scheduleTime` e `scheduleDays` com todas as automações existentes no estado.
10. Hooks são adicionados, ativados/desativados e removidos exclusivamente via `saveHooks()`, que atualiza o estado React e persiste no `localStorage` de forma síncrona.

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Validação em tempo real de expressão cron com feedback visual (verde/vermelho) e hint de formato | ✅ |
| 2 | Preview de próxima execução com lógica de dia da semana ("Hoje HH:MM", "Amanhã HH:MM", "Seg HH:MM") | ✅ |
| 3 | Histórico de execuções — modal com últimas 20 entradas, status colorido, duração e timestamp pt-BR | ✅ |
| 4 | Duplicar automação — pré-preenche o formulário com dados existentes e sufixo " (cópia)" | ✅ |
| 5 | Dry Run — modal de preview sem execução real mostrando skill, prompt, sources e modo | ✅ |
| 6 | Validação de diretório de trabalho — verifica path absoluto antes de salvar, erro inline | ✅ |
| 7 | Conflict detection — aviso amarelo ao selecionar horário que conflita com automação existente | ✅ |
| 8 | Kill switch global — botão "Pausar Todas" desativa todas as automações + badge "Pausado" vermelho | ✅ |
| 9 | Confirmação de exclusão — modal de confirmação com nome da automação antes de remover | ✅ |
| 10 | Presets de dias da semana — botões "Todos os dias", "Dias úteis" e "Fins de semana" | ✅ |
| 11 | Aba Hooks — criação, ativação/desativação e remoção de hooks pre/post mensagem e tool | ✅ |
| 12 | Tipo de agendamento "Intervalo" — execução recorrente por N horas ou minutos | ✅ |
| 13 | Tipo de agendamento "Uma vez" — executa uma única vez e desativa automaticamente | ✅ |
| 14 | Resumo legível do agendamento no formulário — linha dinâmica "Dias úteis às 08:00" | ✅ |
| 15 | Opções avançadas por automação — modo de permissão, Modo OS, run-if-missed, notificar ao concluir | ✅ |
| 16 | Busca de fontes e skills no formulário — filtro por nome/slug com contador de selecionados | ✅ |
| 17 | Rotinas recomendadas com ativação em um clique (5 templates pré-definidos) | ✅ |
| 18 | Estado vazio com call-to-action direto para criar ou ativar rotina recomendada | ✅ |
| 19 | Condições de execução — executar automação apenas se condição for verdadeira (ex: "só se a fonte X estiver conectada") | ✅ |
| 20 | Encadeamento de automações — automação A dispara automação B ao concluir; pipeline visual com arrows | ✅ |
| 21 | Retry com backoff — se a execução falhar, retentar com backoff exponencial (configurável: 1x, 2x, 3x) | ✅ |
| 22 | Notificações granulares — escolher canal de notificação: in-app, Telegram, email, Slack por automação | ✅ |
| 23 | Metrics dashboard inline — mini gráfico de execuções dos últimos 7 dias no card (sucesso/falha/skip) | ✅ |
| 24 | Importar/Exportar automações — JSON com todas as configurações para backup ou compartilhamento entre workspaces | ✅ |
| 25 | Variáveis de ambiente — definir variáveis reutilizáveis (`{{hoje}}`, `{{workspace}}`) no prompt das automações | ✅ |
| 26 | Execução manual com override — botão "Executar agora" que permite editar prompt/skill antes de disparar | ✅ |
| 27 | Tags/categorias em automações — categorizar por projeto ou área com filtro na listagem | ✅ |
| 28 | Logs expandidos — histórico com output completo da execução (mensagens, tokens, duração por step) | ✅ |
| 29 | Prioridade de execução — quando múltiplas automações disparam no mesmo minuto, respeitar ordem | ✅ |
| 30 | Pause por tag — pausar todas as automações com determinada tag em vez de kill switch total | ✅ |
| 31 | Janela de execução — definir horário de início e fim por automação (só executar entre 8h-18h) | ✅ |
| 32 | Estatísticas por automação — taxa de sucesso %, tempo médio, último erro no card | ✅ |
| 33 | Notificação de falha com detalhes — ao falhar, mostrar banner persistente com nome e motivo | ✅ |
| 34 | Clone para outro workspace — exportar automação como template reutilizável em outro workspace | ✅ |
| 35 | Edição de automações — botão "Editar" no card abre formulário preenchido; salva via `updateAutomation` sem criar nova | ✅ |
| 36 | Execução condicional com MCP — verificar se fonte X retorna sucesso antes de executar | ✅ |
| 37 | Template de automação — criar automação a partir de template configurável | ✅ |
| 38 | Agendamento por evento — disparar quando uma skill específica for executada | ✅ |
| 39 | Relatório semanal — email/in-app com resumo de todas execuções da semana | ✅ |
| 40 | Debug mode — step-by-step visual mostrando cada etapa da execução | ✅ |
| 41 | Webhook trigger — disparar automação via URL externa (HTTP POST) | ✅ |
| 42 | Variáveis dinâmicas — injetar data atual, nome do workspace, resultado de API | ✅ |
| 43 | Dependência entre automações — A só executa se B tiver sido bem-sucedida | ✅ |
| 44 | Throttle global — limitar N execuções simultâneas para não sobrecarregar APIs | ✅ |
| 45 | Auto-pause por falhas — pausar automação após N falhas consecutivas | ✅ |
| 46 | Notificação prévia — avisar 5min antes da execução agendada | ✅ |
| 47 | Bulk edit — selecionar múltiplas automações e alterar horário/fonte em lote | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Descrição | Status |
|---|----------|-----------|--------|
| 1 | Execution timeline | SVG bar chart ultimas 7 execucoes (verde=ok, vermelho=falha) | Done |
| 2 | Drag to reorder | Arrastar por prioridade com drag handles | Done |
| 3 | Sugestao de horario | Horario disponivel ao detectar conflito | Done |
| 4 | Cron builder visual | Grid de checkboxes dias/horas ao inves de texto raw | Done |
| 5 | Bulk toggle por tag | Selecionar tag e ativar/desativar todas as matching | Done |
| 6 | Duration badges | Tempo medio de execucao por automacao | Done |
| 7 | Variable preview | Tooltip com variaveis expandidas antes de executar | Done |
| 8 | Alerta falhas consecutivas | Badge vermelho N falhas seguidas no card | Done |
| 9 | Carrossel de recomendados | Cards visuais com icones em scroll horizontal | Done |
| 10 | Filtro de historico | Date range + status dropdown no log de execucoes | Done |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Execution timeline SVG | Done |
| 2 | Drag to reorder | Done |
| 3 | Sugestao de horario | Done |
| 4 | Cron builder visual | Done |
| 5 | Bulk toggle por tag | Done |
| 6 | Duration badges | Done |
| 7 | Variable preview | Done |
| 8 | Alerta falhas consecutivas | Done |
| 9 | Carrossel de recomendados | Done |
| 10 | Filtro de historico | Done |
