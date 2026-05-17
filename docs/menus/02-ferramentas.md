# 2. Ferramentas (Tools)

## Descrição
Central de integrações e extensibilidade do JVOS. Permite gerenciar conexões com serviços externos (APIs, OAuth, MCP), criar e organizar skills (comandos acionados com `/` no chat), criar workflows (acionados com `@` no chat) e visualizar dashboards HTML gerados pela IA. Todos os dados são persistidos no banco local via IPC (`ados.db`).

## Estrutura de Estado

| Estado | Tipo | Função |
|---|---|---|
| `tab` | `'connections' \| 'skills' \| 'workflows' \| 'dashboards'` | Controla qual aba está ativa |
| `connections` | `Connection[]` | Lista de conexões externas cadastradas |
| `skills` | `Skill[]` | Lista de skills instaladas |
| `workflows` | `Workflow[]` | Lista de workflows instalados |
| `dashboards` | `Dashboard[]` | Lista de dashboards salvos |
| `viewingDashboard` | `Dashboard \| null` | Dashboard sendo visualizado em tela cheia (iframe) |
| `showAdd` | `boolean` | Controla visibilidade do formulário de criação |
| `connForm` | `{ name: string; type: string; apiKey: string; baseUrl: string }` | Estado do formulário de nova conexão |
| `skillForm` | `{ name: string; slug: string; description: string; instructions: string }` | Estado do formulário de nova skill |
| `workflowForm` | `{ name: string; slug: string; description: string; instructions: string }` | Estado do formulário de novo workflow |
| `confirmDelete` | `{ type: string; id: string; name: string } \| null` | Dado do item pendente de exclusão (alimenta o modal de confirmação) |
| `testingConn` | `string \| null` | ID da conexão sendo testada no momento (desabilita o botão) |
| `connTestResult` | `Record<string, 'ok' \| 'error' \| string>` | Cache de resultados de teste por ID de conexão |
| `urlError` | `string` | Mensagem de erro de validação da URL no formulário de conexão |
| `slugError` | `string` | Mensagem de erro de slug duplicado nos formulários de skill e workflow |
| `editingSkill` | `string \| null` | ID da skill com editor de instruções aberto inline |
| `editInstructions` | `string` | Conteúdo em edição no editor de instruções inline |
| `dragSkill` | `number \| null` | Índice da skill sendo arrastada no drag-and-drop |
| `dashLoaded` | `boolean` | Flag de controle para lazy load da aba de dashboards |
| `connTestCache` (ref) | `Record<string, { result: string; ts: number }>` | Cache de resultados de teste com timestamp (30s de validade), não dispara re-render |

## UI Layout

- **Cabeçalho fixo** com título "Ferramentas" (h1) e botão `+ Adicionar` (oculto na aba Dashboards)
- **Subtítulo informativo** exibindo contagem dinâmica: `X conexões, Y skills, Z workflows, W dashboards`
- **Seletor de abas** — pill horizontal com 4 abas, cada uma exibindo o label e a contagem do respectivo array
- **Área de conteúdo** com scroll vertical independente, exibindo o conteúdo da aba ativa
- **Grid 2 colunas** para listagem de cards em todas as abas (exceto visualização de dashboard)
- **Cards individuais** com nome, badge/slug, descrição e botões de ação
- **Estado vazio** — cada aba exibe um ícone SVG + mensagem descritiva quando não há itens
- **Formulários de criação** — painel inline com borda `brand-500/30`, exibido acima da lista ao clicar em `+ Adicionar`
- **Modal de confirmação de exclusão** — overlay escuro (`bg-black/50`) com caixa centralizada, aparece antes de qualquer exclusão

## Abas

| Aba | ID | Conteúdo |
|---|---|---|
| Conexões | `connections` | Cards de APIs/OAuth/MCP com badge de status (Conectado/Desconectado), tipo, botões Testar e Remover. Formulário de criação com campos: nome, tipo (select: API Key / OAuth / MCP), API Key (type=password, visível se tipo=api_key) ou URL (visível se tipo=mcp ou oauth, com validação). |
| Skills | `skills` | Cards com nome, slug em `/slug`, descrição (truncada em 2 linhas), botões Editar e Remover. Edição inline das instruções abre textarea monospace com spellCheck desativado. Cards são draggable para reordenação. Botões Exportar e Importar via clipboard aparecem quando há skills cadastradas. Formulário de criação com: nome, slug (auto-gerado com preview em tempo real), descrição, instruções (textarea 4 linhas). |
| Workflows | `workflows` | Cards com nome, slug em `@slug`, descrição (truncada em 2 linhas), botão Remover. Formulário de criação com: nome, slug (auto-gerado), descrição, instruções (textarea 4 linhas). |
| Dashboards | `dashboards` | Grid de cards clicáveis com nome, data de atualização e slug. Ao clicar, entra em modo de visualização: iframe com `srcDoc` do HTML salvo, sandbox `allow-scripts`, botões Voltar e Remover no topo. Não exibe botão `+ Adicionar` (dashboards são criados pela IA). Carregamento lazy (apenas na primeira vez que a aba é selecionada). |

## Chamadas IPC

```ts
// Carregamento inicial (loadAll — paralelo via Promise.all)
ados.db.getConnections()
ados.db.getSkills()
ados.db.getWorkflows()
ados.db.getDashboards()

// Conexões
ados.db.addConnection(id, name, type, config)   // config = JSON.stringify({ apiKey, baseUrl })
ados.db.deleteConnection(id)
ados.db.updateConnection(id, { status: 'connected' | 'error' })

// Skills
ados.db.addSkill(id, name, slug, description, instructions)
ados.db.deleteSkill(id)
ados.db.updateSkill(id, { instructions })         // chamada opcional (?.))
ados.db.reorderSkills(idArray)                    // chamada opcional (?.), persiste nova ordem

// Workflows
ados.db.addWorkflow(id, name, slug, description, instructions)
ados.db.deleteWorkflow(id)

// Dashboards
ados.db.getDashboards()                           // também chamado no lazy load da aba
ados.db.deleteDashboard(id)

// Teste de conexão (fetch nativo, fora do IPC)
fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
```

## Fluxo de Dados

1. **Montagem do componente** — `useEffect` executa `loadAll()`, que dispara `Promise.all` com as 4 queries do banco; cada resultado popula seu respectivo estado.
2. **Navegação entre abas** — ao mudar de aba, `setShowAdd(false)` fecha qualquer formulário aberto. Se a aba selecionada for `dashboards` e `dashLoaded` for false, um segundo `useEffect` carrega os dashboards de forma lazy e marca `dashLoaded = true`.
3. **Criação de itens** — o usuário preenche o formulário inline e clica em Adicionar/Criar. O handler valida os dados (URL format, slug duplicado), gera um `crypto.randomUUID()` como ID, persiste via IPC, limpa o formulário, fecha o painel e chama `loadAll()` para atualizar a lista.
4. **Teste de conexão** — ao clicar em Testar, verifica cache (`connTestCache.current[id]`); se o resultado tiver menos de 30s, exibe instantaneamente. Caso contrário, marca `testingConn = id` (desabilita o botão e exibe `...`), executa `fetch HEAD` com timeout de 5s, interpreta o resultado (HTTP 2xx/405/401 = ok, outros status = erro, timeout = "Timeout (5s)", falha de rede = "Conexão recusada"), atualiza `status` no banco via `updateConnection`, grava no cache e exibe feedback colorido ao lado do botão.
5. **Edição de instruções (skills)** — clicar em Editar seta `editingSkill = skill.id` e `editInstructions = skill.instructions`, revelando o textarea inline. Ao salvar, chama `ados.db.updateSkill` e reseta `editingSkill = null` + `loadAll()`.
6. **Reordenação de skills** — drag-and-drop HTML5: `dragStart` grava o índice de origem em `dragSkill`; `drop` no alvo recalcula o array via `splice`, atualiza o estado imediatamente (UX otimista) e persiste a nova ordem via `ados.db.reorderSkills`.
7. **Exportar/Importar skills** — Exportar serializa `[{name, slug, description, instructions}]` (sem IDs) e grava no clipboard. Importar lê o clipboard, parseia o JSON, filtra slugs já existentes e insere apenas os novos via `ados.db.addSkill`, depois chama `loadAll()`.
8. **Exclusão** — qualquer botão Remover seta `confirmDelete` com `{ type, id, name }`, exibindo o modal. Ao confirmar, o handler correto (`handleDeleteConnection`, `handleDeleteSkill`, `handleDeleteWorkflow` ou `handleDeleteDashboard`) é chamado, o modal é fechado e `loadAll()` atualiza a lista.
9. **Visualização de dashboard** — clicar em um card seta `viewingDashboard`. O layout troca para tela cheia com iframe `srcDoc`. Ao clicar em Voltar, `viewingDashboard = null` restaura a lista.

## Melhorias Implementadas

| # | Melhoria | Status |
|---|---|---|
| 1 | Teste de conexão com feedback visual — spinner no botão, mensagens específicas: "Timeout (5s)", "HTTP 4xx", "Conexão recusada", "✓ OK" | ✅ |
| 2 | Preview em tempo real do slug auto-gerado abaixo do campo nome no formulário de skill | ✅ |
| 3 | Editor de instruções inline com textarea monospace e `spellCheck=false` por skill | ✅ |
| 4 | Drag-and-drop para reordenar skills com persistência via `reorderSkills()` | ✅ |
| 5 | Modal de confirmação antes de excluir qualquer item (conexão, skill, workflow, dashboard) | ✅ |
| 6 | Validação de URL com `new URL()` antes de salvar conexão MCP ou OAuth, com erro inline | ✅ |
| 7 | Deduplicação de slugs — verifica existência antes de criar skill ou workflow | ✅ |
| 8 | Cache de resultado de teste de conexão por 30s via `useRef` sem re-render desnecessário | ✅ |
| 9 | Lazy load de dashboards — carregados apenas na primeira navegação para a aba | ✅ |
| 10 | Exportar e Importar skills via clipboard em formato JSON sem IDs, com deduplicação por slug no import | ✅ |
| 11 | Health check periódico — teste automático de todas as conexões a cada 5 min em background; badge de status atualizado sem clique | ✅ |
| 12 | Versionamento de instruções de skills — histórico de edições com diff visual e rollback por versão | ✅ |
| 13 | Busca global unificada — campo de busca no topo que filtra conexões, skills, workflows e dashboards simultaneamente | ✅ |
| 14 | Favoritos/Pin — marcar skills e workflows como favoritos; aparecem no topo da lista e no autocomplete do chat | ✅ |
| 15 | Teste de conexão com detalhes — exibir latência (ms), HTTP status code e headers relevantes no resultado | ✅ |
| 16 | Dependências entre skills — mapa visual de skills que referenciam outras; alerta ao remover skill usada como dependência | ✅ |
| 17 | Templates de conexão — presets para serviços populares (Notion, Slack, GitHub) com URL e headers pré-preenchidos | ✅ |
| 18 | Tags em skills — categorização por tags customizáveis com filtro por tag na listagem | ✅ |
| 19 | Duplicar skill/workflow — botão clonar com sufixo "(cópia)" para iterações rápidas | ✅ |
| 20 | Ordenação de conexões — sort por nome, tipo ou status com botões no header da aba | ✅ |
| 21 | Webhook de eventos — notificar URL externa quando skill é executada ou conexão falha | ✅ |
| 22 | Uso por skill — badge "Última vez: Xd atrás" com data do último uso em cada card | ✅ |
| 23 | Conexão OAuth com refresh automático — renovar token expirado em background sem intervenção | ✅ |
| 24 | Multi-select e bulk delete — checkbox nos cards para excluir múltiplos itens de uma vez | ✅ |
| 25 | Preview de instrução no hover — tooltip com primeiras 3 linhas da instrução ao passar mouse no card | ✅ |
| 26 | Indicador de saúde por conexão — ícone colorido baseado no histórico de testes (verde se 100% ok nos últimos 5 testes) | ✅ |
| 27 | Teste de skill no modal — executar skill de teste com prompt sample direto no editor | ✅ |
| 28 | Versionamento de instrução — histórico de versões da instrução com rollback | ✅ |
| 29 | Importar skill de URL — colar link de gist/raw para importar instruções | ✅ |
| 30 | Template de skill — wizard com templates (Resumo, Análise, Tradução, etc.) | ✅ |
| 31 | Dependência entre skills — skill pode referenciar outra como pré-requisito | ✅ |
| 32 | Métricas de latência por MCP — gráfico de tempo de resposta médio do server | ✅ |
| 33 | Auto-reconnect MCP — reconectar MCP server automaticamente se perder conexão | ✅ |
| 34 | Favoritar skills — star para fixar as mais usadas no topo | ✅ |
| 35 | Tagging de workflows — agrupar workflows por tag/projeto | ✅ |
| 36 | Log de execução por skill — histórico de chamadas com input/output/duração | ✅ |
| 37 | Compartilhar skill — gerar link para instalar skill em outro workspace | ✅ |
| 38 | Validador de instrução — análise automática da qualidade da instrução (tamanho, clareza) | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Descrição | Status |
|---|----------|-----------|--------|
| 1 | Drag-and-drop para conexões | Arrastar para reordenar conexões com feedback visual | ✅ |
| 2 | Bulk operations | Multi-select com checkboxes + toolbar flutuante (Excluir/Exportar) | ✅ |
| 3 | Badge last-tested | "Testado há Xm" com timestamp persistido em localStorage | ✅ |
| 4 | Health grade (A-F) | Nota colorida baseada em latência (<200ms=A, >2000ms=F) | ✅ |
| 5 | Workflow visualizer | Modal com flowchart div-based dos steps do workflow | ✅ |
| 6 | Empty states aprimorados | Cards com ícone + descrição + CTAs (template, importar) | ✅ |
| 7 | Shortcut overlay (?) | Modal com atalhos: Del, E, T, D para ações rápidas | ✅ |
| 8 | Tooltip de instrução | "?" ao lado do textarea com dica de boa instrução | ✅ |
| 9 | Performance por skill | Badge trending ↑/→ baseado em frequência de uso | ✅ |
| 10 | Edição inline de workflow | Botão Editar expande textarea inline com Save/Cancel | ✅ |
