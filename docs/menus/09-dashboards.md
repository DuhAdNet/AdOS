# 9. Dashboards

## Descrição

Painéis customizáveis com widgets de métricas, gráficos, listas e texto para visão consolidada do sistema. Cada dashboard armazena seu layout em JSON e suporta múltiplos painéis simultâneos com alternância por abas. Widgets atualizam seus valores automaticamente a cada 60 segundos e podem ter fontes de dados abstratas configuradas individualmente.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `dashboards` | `Dashboard[]` | Lista de todos os dashboards cadastrados |
| `active` | `Dashboard \| null` | Dashboard atualmente selecionado e em exibição |
| `widgets` | `Widget[]` | Widgets do dashboard ativo, parseados do campo `layout` |
| `showCreate` | `boolean` | Controla visibilidade do formulário de criação de dashboard |
| `newName` | `string` | Valor do input de nome para novo dashboard |
| `lastRefresh` | `Date` | Timestamp do último refresh de valores dos widgets |
| `fullscreen` | `boolean` | Ativa modo fullscreen (`fixed inset-0 z-40`) sobre a NavRail |
| `confirmDeleteDash` | `string \| null` | ID do dashboard pendente de confirmação de exclusão |
| `confirmDeleteWidget` | `string \| null` | ID do widget pendente de confirmação de exclusão |
| `draggedWidget` | `string \| null` | ID do widget sendo arrastado no drag-and-drop |
| `dragOverWidget` | `string \| null` | ID do widget que está recebendo o item arrastado |
| `showMetricPicker` | `string \| null` | ID do widget com o seletor de métrica aberto |
| `showDataSourceEditor` | `string \| null` | ID do widget com o editor de data source aberto |
| `dsForm` | `WidgetDataSource` | Formulário temporário de configuração de data source em edição |
| `refreshTimer` | `Ref<ReturnType<setInterval> \| null>` | Referência ao intervalo de auto-refresh (60s), limpo no unmount |

## UI Layout

- **Cabeçalho:** Título "Dashboards", subtítulo descritivo e botão "+ Novo Dashboard" alinhado à direita
- **Abas de navegação:** Renderizadas apenas quando existem 2 ou mais dashboards; destaca o dashboard ativo com estilo `bg-brand-600/10 text-brand-500`
- **Formulário de criação:** Painel inline (`bg-surface-1`) com input de nome e botões "Criar" / "Cancelar"; o botão "Criar" é desabilitado enquanto o nome está vazio
- **Estado vazio (sem dashboard):** Mensagem central orientando o usuário a criar o primeiro dashboard
- **Toolbar do dashboard ativo:** Nome do dashboard, indicador de horário do último refresh, botões de adição de widget por tipo (metric, chart, list, text) com ícones SVG, botão "Refresh" manual, botão "Fullscreen" / "Sair", e botão "Excluir" em vermelho
- **Estado vazio (dashboard sem widgets):** Container com borda tracejada (`border-dashed`) e instrução para adicionar widgets
- **Grid de widgets:** Layout em 2 colunas (`grid-cols-2`), cada card com `bg-surface-1 border rounded-2xl p-5`
- **Card de widget:** Badge de tipo (uppercase), badge de data source (quando configurado), título clicável para o metric picker, área de valor ou gráfico; botões "×" (excluir) e "src" (data source) aparecem no hover (`opacity-0 group-hover:opacity-100`)
- **Drag-and-drop visual:** Card arrastado recebe `opacity-50`; card alvo recebe `border-brand-500 ring-2 ring-brand-500/20`
- **Metric Picker:** Dropdown flutuante (`absolute z-20`) exibido abaixo do título do widget com lista de todas as métricas built-in disponíveis
- **Editor de Data Source:** Modal centralizado (`fixed inset-0 bg-black/50`) com selects de Fonte e Agregação, input de Campo, e botões "Cancelar" / "Salvar"
- **Modal de confirmação — excluir dashboard:** Alerta com texto "Todos os widgets serão removidos permanentemente." e botões "Cancelar" / "Excluir" (vermelho)
- **Modal de confirmação — excluir widget:** Alerta com texto "Esta ação é irreversível." e botões "Cancelar" / "Excluir" (vermelho)

## Tipos de Widget

| Tipo | Ícone SVG (path) | Renderização |
|------|-----------------|--------------|
| `metric` | `M3 3v18h18` (barra de gráfico) | Valor numérico grande (`text-2xl font-bold`) com fallback "—" e aviso "Métrica não reconhecida" |
| `chart` | `M18 20V10M12 20V4M6 20v-6` (barras verticais) | Barras CSS proporcionais (`flex items-end gap-1 h-16`), altura calculada em % relativa ao valor máximo do array `chartData` |
| `list` | `M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01` (lista) | Renderiza como metric (valor numérico) na ausência de renderizador específico |
| `text` | `M14 2H6a2 2 0 0 0-2 2v16...` (documento) | Renderiza como metric (valor numérico) na ausência de renderizador específico |

## Chamadas IPC

```
// Dashboards — CRUD
ados.db.getDashboards()
ados.db.createDashboard(id, name, layout)
ados.db.updateDashboard(id, layoutJson)
ados.db.deleteDashboard(id)

// Métricas built-in (resolução de valores)
ados.db.getSessions()        // Total de Sessões, Sessões Favoritas, dados de gráfico
ados.db.getLabels()          // Labels Criadas
ados.db.getMemories()        // Memórias Salvas
ados.db.getAutomations()     // Automações Ativas
ados.mcp.listServers()       // MCP Servers

// API interna exposta em window (atualizada a cada refresh)
window.__ados_dashboards_api.getDashboards()
window.__ados_dashboards_api.getActiveWidgets()
window.__ados_dashboards_api.getWidgetValue(id)
window.__ados_dashboards_api.getMetricNames()
```

> Todas as chamadas de CRUD usam optional chaining (`?.`). Chamadas de leitura de métricas são diretas.

## Fluxo de Dados

1. **Inicialização:** `useEffect` chama `load()`, que busca todos os dashboards via `ados.db.getDashboards()`
2. **Seleção automática:** Se existirem dashboards e nenhum estiver ativo, o primeiro da lista é selecionado e seus widgets são carregados
3. **Parse do layout:** `loadWidgets(dash)` faz `JSON.parse(dash.layout)` para extrair o array de widgets e dispara `refreshWidgetValues()`
4. **Resolução de valores:** Para cada widget, `refreshWidgetValues()` verifica: (a) se possui `dataSource` configurado → chama `resolveDataSource()` + `aggregateData()`; (b) se é `metric` com título reconhecido → executa a função de `BUILTIN_METRICS`; (c) se é `chart` → busca sessões e gera array `chartData` com 7 pontos proporcionais
5. **Persistência:** Qualquer alteração (adicionar widget, excluir, reordenar, trocar métrica, salvar data source) serializa o array de widgets como JSON e chama `ados.db.updateDashboard(id, json)`
6. **Auto-refresh:** `setInterval` de 60 segundos rechama `refreshWidgetValues(widgets)` e atualiza `lastRefresh`; o interval é limpo no unmount via cleanup do `useEffect`
7. **API exposta:** Após cada `refreshWidgetValues()`, `exposeDashboardAPI()` atualiza `window.__ados_dashboards_api` com o estado mais recente

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Widget de gráfico funcional — barras CSS proporcionais via `chartData[]`, gerado a partir do data source ou das sessões built-in | ✅ |
| 2 | Drag-and-drop de widgets — reordenação com HTML5 Drag & Drop API, persiste no layout JSON via `updateDashboard` | ✅ |
| 3 | Métricas customizáveis — clique no título do widget abre picker com todas as métricas built-in; seleção atualiza e persiste | ✅ |
| 4 | Auto-refresh — intervalo de 60s via `setInterval` com indicador de horário da última atualização e botão de refresh manual | ✅ |
| 5 | Modo fullscreen — botão "Fullscreen" aplica `fixed inset-0 z-40` sobre a NavRail; botão "Sair" restaura o layout normal | ✅ |
| 6 | API de dashboards exposta — `window.__ados_dashboards_api` com `getDashboards()`, `getActiveWidgets()`, `getWidgetValue(id)` e `getMetricNames()`, atualizada a cada refresh | ✅ |
| 7 | Abstração de data source — interface `WidgetDataSource` com `type / filter / aggregation / field`; botão "src" em cada widget abre editor modal; `resolveDataSource()` + `aggregateData()` abstraem fetch e cálculo | ✅ |
| 8 | Confirmação ao excluir dashboard — modal com aviso "Todos os widgets serão removidos permanentemente." antes de confirmar a exclusão | ✅ |
| 9 | Confirmação ao excluir widget — modal com aviso "Esta ação é irreversível." antes de remover o widget | ✅ |
| 10 | Seleção automática de métrica disponível — ao adicionar widget do tipo `metric`, seleciona automaticamente a próxima métrica ainda não utilizada no dashboard | ✅ |
| 11 | Templates de dashboard — galeria de layouts pré-montados (KPI board, pipeline, weekly) para clonar | ✅ |
| 12 | Alertas e thresholds — definir limites por widget; notificar quando métrica cruza o threshold | ✅ |
| 13 | Snapshot agendado — capturar screenshot do dashboard automaticamente (diário/semanal) e salvar em reports/ | ✅ |
| 14 | Compartilhar dashboard — gerar link público apenas para dashboards específicos com expiração | ✅ |
| 15 | Filtros globais — seletor de período/fonte no topo que afeta todos os widgets simultaneamente | ✅ |
| 16 | Comparação temporal — widget mostra valor atual vs. período anterior (WoW, MoM) com delta | ✅ |
| 17 | Resize livre de widgets — além de reordenar, permitir resize individual (small/medium/large) | ✅ |
| 18 | Widget de meta/goal — progresso visual de OKR/meta com percentual e deadline | ✅ |
| 19 | Import/Export de dashboard — JSON com configuração completa para backup e compartilhamento | ✅ |
| 20 | Drill-down — clicar em métrica abre detalhamento com tabela de dados subjacentes | ✅ |
| 21 | Widget de nota/anotação — texto livre markdown para documentar contexto no dashboard | ✅ |
| 22 | Duplicar dashboard — botão clonar para criar variação a partir de um existente | ✅ |
| 23 | Dashboard favorito — pin no sidebar para acesso rápido ao dashboard mais usado | ✅ |
| 24 | Histórico de valores — armazenar últimos 30 pontos de cada métrica para mini-sparkline | ✅ |
| 25 | Modo apresentação — fullscreen sem controles de edição, ideal para TV/monitor de equipe | ✅ |
| 26 | Cores por widget — personalizar cor de destaque individual por widget (brand, green, red, yellow) | ✅ |
| 27 | Widget de gráfico de linha — tendência temporal com N pontos | ✅ |
| 28 | Widget de tabela — dados tabulares com sort e filter | ✅ |
| 29 | Template de dashboard — criar a partir de template (CEO, Ops, Dev) | ✅ |
| 30 | Auto-refresh configurável — alterar intervalo (10s, 30s, 60s, 5min) | ✅ |
| 31 | Export PNG — capturar dashboard como imagem | ✅ |
| 32 | Compartilhar dashboard — gerar link público (como sharing de sessão) | ✅ |
| 33 | Widget de progresso — barra de progresso com meta e atual | ✅ |
| 34 | Alertas por widget — notificar quando métrica cruza threshold | ✅ |
| 35 | Layout responsivo — adaptar grid ao tamanho da janela | ✅ |
| 36 | Widget de markdown — bloco de texto rico editável | ✅ |
| 37 | Histórico de valores — tooltip com valor das últimas 7 atualizações | ✅ |
| 38 | Conditional formatting — cor do widget muda baseado no valor (verde/amarelo/vermelho) | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Widget templates por tipo | Done |
| 2 | Validacao de data source | Done |
| 3 | Threshold slider | Done |
| 4 | Goal milestone notifications | Done |
| 5 | Export widget como PNG | Done |
| 6 | Cross-dashboard linking | Done |
| 7 | Widget help tooltip | Done |
| 8 | Refresh lag indicator | Done |
| 9 | Sparkline tooltip values | Done |
| 10 | Metric comparison | Done |
