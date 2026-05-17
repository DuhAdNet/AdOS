# 5. Brain (Memória)

## Descrição
Camada de memória persistente do workspace. Armazena registros de contexto categorizados localmente via banco de dados interno, com suporte a tags, busca, edição in-place, paginação, rastreamento de sync incremental e backup automático em localStorage. Exibido como "Shared Brain (Beta)" na interface.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `tab` | `'overview' \| 'memory' \| 'sync'` | Aba ativa no momento |
| `memories` | `Memory[]` | Lista completa de memórias carregadas do banco |
| `search` | `string` | Termo de busca ativo no filtro |
| `showAdd` | `boolean` | Controla visibilidade do formulário de nova memória |
| `form` | `{ content: string, category: string }` | Dados do formulário de criação de memória |
| `confirmDelete` | `string \| null` | ID da memória aguardando confirmação de exclusão |
| `editingId` | `string \| null` | ID da memória em modo de edição in-place |
| `editContent` | `string` | Conteúdo editado da memória em edição |
| `formError` | `string` | Mensagem de erro de validação do formulário de criação |
| `duplicateWarning` | `string` | Aviso de memória similar já existente |
| `memoryTags` | `Record<string, string[]>` | Mapa de tags por ID de memória (persistido em localStorage) |
| `tagInput` | `Record<string, string>` | Valor do input de tag por ID de memória |
| `memoryUsage` | `Record<string, string[]>` | Mapa de sessões que referenciam cada memória |
| `currentPage` | `number` | Página atual na paginação (20 registros por página) |
| `syncChanges` | `Array<{ id: string, action: string, timestamp: string }>` | Fila de alterações pendentes de sync |
| `lastSyncAt` | `string \| null` | Timestamp ISO do último sync marcado |
| `backupIntervalRef` | `RefObject<ReturnType<setInterval>>` | Referência ao intervalo de backup automático |
| `lastBackupAt` | `string \| null` | Timestamp ISO do último backup realizado |

## UI Layout

- **Header fixo** com título "Shared Brain" + badge "Beta", subtítulo com contagem de registros e seletor de abas
- **Seletor de abas** com três opções: "Visao geral", "Memoria", "Sync e nos"
- **Aba Visão Geral:**
  - Título "Saude"
  - Grid 4 colunas com cards KPI:
    - Estado: "Apenas local" / "Schema v1"
    - Modo: "Ativo" / "Memoria local habilitada"
    - Registros: contagem total / número de categorias com ao menos 1 item
    - Última atualização: data da memória mais recente em `pt-BR`
  - Título "Por categoria"
  - Grid 5 colunas com cards de contagem por categoria: `general`, `user`, `project`, `feedback`, `reference`
- **Aba Memória:**
  - Cabeçalho com título "Memoria", campo de busca com ícone de lupa e botão "+ Adicionar"
  - Formulário de criação (condicional `showAdd`): textarea com contador de caracteres (máx 2000), aviso de duplicata amarelo, select de categoria, botões Cancelar/Salvar
  - Empty state: mensagem contextual com opção de criar memória a partir do termo buscado
  - Lista paginada de cards de memória com: texto do conteúdo, badge de categoria colorida, data de criação, badge de uso em sessões, tags com botão de remoção, input inline para nova tag, botões Editar e Remover
  - Modo de edição in-place: substitui o texto por textarea com botões Salvar/Cancelar
  - Paginação com botões "Anterior" / "Próxima" e indicador "Página X de Y" (exibido apenas quando `totalPages > 1`)
  - Modal de confirmação de exclusão: overlay com mensagem "Excluir memória? Esta ação é irreversível." e botões Cancelar/Excluir
- **Aba Sync e Nós:**
  - Card de status de sincronização com ícone e mensagem "Sincronizacao nao configurada"
  - Painel de nós conectados: exibe "Este computador" com badge "Online"
  - Card "Sync Incremental": último sync, contagem de alterações pendentes, log das últimas 10 alterações com action badge colorido (verde=add, vermelho=delete, amarelo=edit), botão "Marcar como sincronizado"
  - Card "Backup Automático": intervalo (5 min), timestamp do último backup, armazenamento (localStorage), botão "Backup agora"

## Abas

| Aba | Rótulo na UI | Conteúdo |
|-----|--------------|----------|
| `overview` | Visao geral | Painel de saúde com KPIs e distribuição por categoria |
| `memory` | Memoria | CRUD completo de memórias com busca, tags e paginação |
| `sync` | Sync e nos | Status de nós conectados, log de sync incremental e backup automático |

## Chamadas IPC

```
ados.db.getMemories()
  → Carrega todos os registros de memória do banco local

ados.db.searchMemories(query: string)
  → Busca memórias pelo termo informado

ados.db.addMemory(id: string, content: string, category: string)
  → Cria uma nova memória com UUID gerado no cliente

ados.db.deleteMemory(id: string)
  → Remove uma memória pelo ID (usado tanto para exclusão quanto para edição — delete + re-add)

ados.db.getSessions()
  → Carrega sessões para calcular visualização de uso das memórias
```

## Fluxo de Dados

1. `useEffect` inicial dispara `loadMemories()` ao montar o componente
2. `loadMemories()` chama `ados.db.getMemories()`, normaliza o campo `tags` e atualiza `memories`
3. Tags salvas são lidas do `localStorage` (`ados-brain-tags`) e carregadas em `memoryTags`
4. `ados.db.getSessions()` é chamado para cruzar sessões com memórias e popular `memoryUsage`
5. `currentPage` é resetado para 1 após cada carregamento
6. Busca: `handleSearch` chama `ados.db.searchMemories(query)` em tempo real; string vazia recarrega tudo via `loadMemories()`
7. Criação: `handleAdd` valida conteúdo, gera UUID, chama `ados.db.addMemory`, registra alteração via `trackChange` e recarrega lista
8. Edição: `handleEditSave` chama `ados.db.deleteMemory` + `ados.db.addMemory` com mesmo ID para simular update
9. Exclusão: `handleDelete` chama `ados.db.deleteMemory` após confirmação no modal
10. Tags: adição e remoção operam sobre `memoryTags` e persistem imediatamente no `localStorage`
11. Sync incremental: cada mutação (add/edit/delete) acumula entrada em `syncChanges` e em `localStorage` (`ados-brain-sync-changes`); `handleMarkSynced` limpa a fila e registra timestamp
12. Backup automático: `setInterval` de 5 minutos serializa `memories` em JSON e salva em `localStorage` (`ados-brain-backup`); botão "Backup agora" executa o mesmo fluxo manualmente

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Confirmação antes de excluir — modal "Esta ação é irreversível" com botões Cancelar/Excluir | ✅ |
| 2 | Edição in-place — botão "Editar" transforma o card em textarea com Salvar/Cancelar | ✅ |
| 3 | Tagging múltiplo — input inline por memória, adição via Enter, remoção via clique, persistência em localStorage | ✅ |
| 4 | Visualização de uso — badge "Usada em N sessão(ões)" com tooltip das sessões que referenciam a memória | ✅ |
| 5 | Empty state na busca — mensagem contextual + atalho para criar memória com o termo buscado | ✅ |
| 6 | Paginação — 20 registros por página com controles Anterior/Próxima e indicador de página | ✅ |
| 7 | Validação de conteúdo — mínimo 10 e máximo 2000 caracteres, contador visual, erro inline, botão Salvar desabilitado | ✅ |
| 8 | Deduplicação automática — detecção de conteúdo similar durante digitação com aviso amarelo | ✅ |
| 9 | Sync incremental — rastreamento de alterações (add/edit/delete) com log visual e botão "Marcar como sincronizado" | ✅ |
| 10 | Backup automático — auto-save a cada 5 minutos em localStorage com botão "Backup agora" e indicador de último backup | ✅ |
| 11 | Versionamento de memórias — histórico de edições por registro com diff e rollback | ✅ |
| 12 | Resolução de conflitos — quando edições simultâneas acontecem no sync, exibir diff e permitir merge manual | ✅ |
| 13 | Exportar memórias — download como JSON ou Markdown com filtros (por tag, data, tipo) | ✅ |
| 14 | Importar memórias — upload de JSON externo com deduplicação por conteúdo/título | ✅ |
| 15 | Memórias vinculadas — criar links entre memórias relacionadas; grafo visual de conexões | ✅ |
| 16 | Decaimento de relevância — memórias não acessadas há 90 dias ganham badge "Revisar"; sugestão de arquivar | ✅ |
| 17 | Memórias fixadas (pinned) — pin nos itens mais importantes; sempre aparecem no topo | ✅ |
| 18 | Bulk actions — selecionar múltiplas memórias para excluir, tagar ou exportar em lote | ✅ |
| 19 | Busca semântica — além de text match, buscar por significado usando similaridade de conteúdo | ✅ |
| 20 | Templates de memória — tipos pré-definidos (Decisão, Contexto, Preferência) com campos estruturados | ✅ |
| 21 | Quota visual — barra de progresso mostrando uso vs. limite de memórias; alerta ao atingir 80% | ✅ |
| 22 | Snapshot periódico — backup automático semanal do estado completo do brain; restaurável | ✅ |
| 23 | Ordenação de memórias — sort por data, categoria, uso, relevância com botões no header | ✅ |
| 24 | Markdown no conteúdo — renderizar formatação markdown nas memórias (bold, listas, code) | ✅ |
| 25 | Categorias customizáveis — permitir criar novas categorias além das 5 padrão | ✅ |
| 26 | Métricas do Brain — card com: total de memórias, média de tamanho, categoria mais usada, crescimento mensal | ✅ |
| 27 | Busca semântica — encontrar memórias por significado, não só texto exato | ✅ |
| 28 | Conexões entre memórias — linkar memórias relacionadas em grafo visual | ✅ |
| 29 | Auto-memória — IA sugere automaticamente o que salvar após conversas | ✅ |
| 30 | Expiração automática — TTL configurável por memória (30d, 90d, nunca) | ✅ |
| 31 | Importar de arquivo — arrastar .md/.txt para criar memórias em batch | ✅ |
| 32 | Memória por sessão — ver quais memórias foram usadas em cada conversa | ✅ |
| 33 | Prioridade/peso — ranquear memórias por importância (alta/média/baixa) | ✅ |
| 34 | Templates de memória — formatos pré-definidos (decisão, pessoa, processo) | ✅ |
| 35 | Merge de duplicatas — detectar e combinar memórias similares | ✅ |
| 36 | Histórico de edições — ver versões anteriores de uma memória editada | ✅ |
| 37 | Export para markdown — exportar toda a brain como arquivo .md organizado | ✅ |
| 38 | Bulk actions — selecionar múltiplas memórias para deletar/categorizar/exportar | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Hover preview | Done |
| 2 | Grafo de relacionamento | Done |
| 3 | Bulk toolbar estendido | Done |
| 4 | Score de importancia 1-5 | Done |
| 5 | Auto-categorizacao | Done |
| 6 | Deteccao de duplicatas | Done |
| 7 | Timeline view | Done |
| 8 | Export markdown | Done |
| 9 | Painel de deduplicacao | Done |
| 10 | Health dashboard | Done |
