# 7. Labels

## Descrição
Sistema de etiquetas coloridas para organizar sessões com suporte a marcadores hierárquicos (pai/filho), auto-classificação via regex, reordenação por drag-and-drop e aplicação em batch a sessões existentes.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `labels` | `Label[]` | Lista completa de labels carregadas do banco, ordenadas por `sortOrder` |
| `name` | `string` | Valor do input de nome da nova label |
| `color` | `string` | Cor selecionada (hex) para a nova label |
| `autoPattern` | `string` | Valor do input de regex de auto-classificação |
| `editing` | `string \| null` | ID da label com edição inline ativa |
| `regexStatus` | `{ valid: boolean; error: string }` | Resultado da validação em tempo real do regex digitado |
| `nameError` | `string` | Mensagem de erro de duplicata no nome |
| `confirmDelete` | `string \| null` | ID da label aguardando confirmação de exclusão no modal |
| `labelUsage` | `Record<string, number>` | Mapa de `labelId → quantidade de sessões` que possuem aquela label |
| `patternMatches` | `string[]` | Títulos de até 5 sessões que matcham o pattern digitado (preview) |
| `allSessions` | `Array<{ id: string; title: string; labels?: string[] }>` | Cache de todas as sessões, usado para preview de match e batch apply |
| `showCustomColor` | `boolean` | Controla exibição do color picker nativo para cor personalizada |
| `customColor` | `string` | Valor do color picker nativo (hex) |
| `dragId` | `string \| null` | ID da label sendo arrastada no drag-and-drop |
| `batchApplying` | `string \| null` | ID da label com batch apply em andamento (exibe estado de loading) |
| `batchCount` | `number` | Quantidade de sessões afetadas no último batch apply (exibida por 3s) |
| `parentLabel` | `string \| null` | ID da label pai selecionada no formulário de criação |
| `expandedParents` | `Set<string>` | IDs das labels pai com filhos expandidos na lista |

## UI Layout

- **Cabeçalho da página**
  - Título "Labels" em destaque
  - Subtítulo descritivo: "Organize sessões com marcadores hierárquicos e regras automáticas."

- **Formulário "Nova Label"** (card `bg-surface-1`)
  - Input de texto "Nome da label" — com validação de duplicata inline (borda vermelha + mensagem abaixo)
  - Input de texto "Auto-apply pattern (regex)" — fonte monospace, com indicador ✓/✗ ao lado e mensagem de erro de regex abaixo
  - Preview de auto-match: lista de até 5 títulos de sessões que matcham o pattern digitado, exibida abaixo do input de regex
  - Select de "Label pai (hierarquia)" — opções: "Sem pai (raiz)" + todas as labels raiz existentes
  - Color picker com 10 cores pré-definidas (bolinhas clicáveis com ring de seleção)
  - Botão "+" para cor personalizada — abre `<input type="color">` nativo ao lado
  - Botão "Criar" — desabilitado se nome vazio, há erro de duplicata ou regex inválida

- **Banner de feedback de batch apply** — exibido por 3 segundos após conclusão: "Label aplicada a N sessão(ões) com sucesso."

- **Estado vazio** — texto centralizado "Nenhuma label criada." quando a lista está vazia

- **Lista de labels com hierarquia**
  - Labels raiz renderizadas como cards draggable (`cursor-grab`)
  - Indicador ▶/▼ para labels pai com filhos (clicável para expandir/colapsar)
  - Indicador ⠿ para labels sem filhos (não clicável)
  - Bolinha colorida com a cor da label
  - Nome da label (clicável via botão "Editar" para modo inline)
  - Inline edit: input auto-focus que salva ao `blur` ou `Enter`
  - Badge com o pattern regex (fonte monospace, arredondado)
  - Badge com contagem de sessões (ex: "3 sessões"), visível apenas se `> 0`
  - Botão "Batch" — visível apenas se label tem `autoPattern`; aplica a label a todas sessões que matcham
  - Botão "Editar" — ativa edição inline do nome
  - Botão "Excluir" — abre modal de confirmação
  - Sub-labels (filhos) renderizadas com indentação `ml-6`, indicador └ e os mesmos controles do pai

- **Modal de confirmação de exclusão** (overlay com `bg-black/50`, z-50)
  - Título "Excluir label?"
  - Mensagem contextual: informa quantas sessões serão afetadas se `labelUsage > 0`, ou "Esta ação é irreversível." se não houver uso
  - Botões "Cancelar" e "Excluir" (vermelho)

## Chamadas IPC

```
ados.db.getLabels()
  → Retorna Label[] com id, name, color, parentId, sortOrder, autoPattern

ados.db.getSessions()
  → Retorna sessões com id, title, labels[] — usado para contagem de uso e preview de match

ados.db.addLabel(id, name, color, parentId, autoPattern)
  → Cria nova label com UUID gerado no front-end via crypto.randomUUID()

ados.db.updateLabel(id, fields)
  → Atualiza campos parciais: name, sortOrder (drag-and-drop persiste a nova ordem para todas as labels do array)

ados.db.deleteLabel(id)
  → Remove a label pelo ID

ados.db.updateSession(id, { labels: string[] })
  → Usado pelo batch apply para adicionar a labelId ao array de labels de cada sessão que matcha o pattern
```

## Fluxo de Dados

1. No mount (`useEffect`), `load()` é chamado: busca todas as labels via `getLabels()` e todas as sessões via `getSessions()`
2. As labels são ordenadas por `sortOrder` antes de serem armazenadas no estado
3. A contagem de uso é calculada no front-end: para cada label, filtra `allSessions` por `s.labels?.includes(label.id)`
4. Ao digitar no input de nome, `handleNameChange()` valida duplicatas em tempo real contra o array `labels` (case-insensitive)
5. Ao digitar no input de regex, `handlePatternChange()` executa `validateRegex()` que testa a expressão, verifica performance (proteção contra ReDoS com threshold de 100ms) e atualiza `regexStatus`; se válido, filtra `allSessions` para gerar o preview de até 5 matches
6. Ao clicar "Criar", `handleAdd()` chama `addLabel()` com UUID gerado localmente, limpa o formulário e recarrega via `load()`
7. O drag-and-drop reordena o array `labels` no estado e persiste o novo `sortOrder` de cada item via `updateLabel()` em loop
8. O batch apply itera sobre `allSessions`, filtra as que matcham o `autoPattern` da label e que ainda não possuem aquela label, e chama `updateSession()` para cada uma; ao final, exibe o banner de feedback por 3 segundos
9. A hierarquia é separada em `rootLabels` (sem `parentId`) e `childLabels(parentId)` (filhos diretos); cada pai controla visibilidade dos filhos via `expandedParents` (Set de IDs)
10. Exclusão requer confirmação via modal; a chamada `deleteLabel()` só ocorre após confirmação explícita

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Validação de regex em tempo real com ícone ✓/✗ e mensagem de erro específica | ✅ |
| 2 | Preview de auto-match: exibe até 5 sessões que matcham o pattern ao vivo abaixo do input | ✅ |
| 3 | Cor customizada: botão "+" abre color picker nativo com input hex para cor personalizada | ✅ |
| 4 | Drag-and-drop para reordenar labels com persistência de `sortOrder` e indicador visual durante o arraste | ✅ |
| 5 | Modal de confirmação ao excluir com contagem de sessões afetadas | ✅ |
| 6 | Validação de duplicatas de nome inline com bloqueio do botão "Criar" | ✅ |
| 7 | Regex safety check contra ReDoS: testa execução com threshold de 100ms e rejeita patterns lentos | ✅ |
| 8 | Badge de contagem de uso por label (N sessões) carregado via `getSessions()` | ✅ |
| 9 | Batch apply: botão "Batch" aplica a label a todas as sessões que matcham o `autoPattern` com feedback visual | ✅ |
| 10 | Hierarquia de labels: select de label pai na criação, exibição em árvore com expand/collapse e sub-labels indentadas com indicador └ | ✅ |
| 11 | Merge de labels — unificar duas labels em uma, reatribuindo todas as sessões automaticamente | ✅ |
| 12 | Detecção de duplicatas avançada — alertar quando label com nome similar (case/espaço) já existe | ✅ |
| 13 | Label templates/presets — conjuntos pré-definidos ("Projetos", "Prioridades", "Status") ativáveis com um clique | ✅ |
| 14 | Bulk import/export — importar labels de JSON; exportar estrutura hierárquica completa | ✅ |
| 15 | Estatísticas por label — contador de sessões + tendência (crescendo/diminuindo) no card | ✅ |
| 16 | Undo de drag-and-drop — Ctrl+Z desfaz a última reordenação em até 10s | ✅ |
| 17 | Regras de auto-label com preview — antes de salvar regex, mostrar quantas sessões existentes seriam classificadas | ✅ |
| 18 | Labels temporárias — label com expiração (auto-remove após N dias) para triagem temporária | ✅ |
| 19 | Busca de sessões por label — clicar em uma label abre lista filtrada de todas as sessões associadas | ✅ |
| 20 | Label groups — agrupar labels por contexto (ex: "Projeto X") com collapse/expand de grupo | ✅ |
| 21 | Ações automáticas por label — ao aplicar label, disparar ação (notificar, executar skill) | ✅ |
| 22 | Cores com acessibilidade — validar contraste WCAG das cores escolhidas contra o background | ✅ |
| 23 | Histórico de alterações — log das últimas 20 mudanças em labels (criação, edição, exclusão) | ✅ |
| 24 | Contagem de sessões em tempo real — atualizar badge de contagem ao vivo sem reload | ✅ |
| 25 | Favoritar labels — labels favoritas aparecem primeiro no autocomplete e filtros do chat | ✅ |
| 26 | Regras condicionais — auto-apply com múltiplas condições (regex E/OU data, autor, tamanho) | ✅ |
| 27 | Multi-label por sessão — aplicar múltiplas labels na mesma sessão | ✅ |
| 28 | Filtro combinado — filtrar sessões por combinação de labels (AND/OR) | ✅ |
| 29 | Labels automáticas por skill — auto-aplicar label quando skill específica é usada | ✅ |
| 30 | Cor por gradiente — opção de gradiente além de cor sólida | ✅ |
| 31 | Ícone por label — associar emoji/ícone além da cor | ✅ |
| 32 | Estatísticas temporais — gráfico de uso de labels ao longo do tempo | ✅ |
| 33 | Sugestão de label — IA sugere label baseado no conteúdo da sessão | ✅ |
| 34 | Arquivar label — esconder labels antigas sem deletar (manter histórico) | ✅ |
| 35 | Merge de labels — combinar duas labels em uma (migra todas as sessões) | ✅ |
| 36 | Template de labels — importar set de labels pré-definido por role | ✅ |
| 37 | Atalho de teclado — shortcut para aplicar label rápido (ex: Ctrl+L) | ✅ |
| 38 | Auto-archive — mover sessões com label X para arquivo após N dias | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Paleta de cores categorizada | Done |
| 2 | Drag visual feedback | Done |
| 3 | Rich preview cards | Done |
| 4 | Sparkline de uso | Done |
| 5 | Bulk rename/delete | Done |
| 6 | Tree-view hierarquico | Done |
| 7 | Sugestoes com confianca | Done |
| 8 | Template editor | Done |
| 9 | Command palette Ctrl+K | Done |
| 10 | Undo/Redo global | Done |
