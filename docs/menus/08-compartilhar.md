# 8. Compartilhar (Sharing)

## Descrição
Publica sessões de conversa para leitura externa. Gera um `publicId` único por sessão e disponibiliza o conteúdo via link (protocolo `ados://shared/` ou endpoint HTTP customizável). Inclui controles de expiração, proteção por senha, redact de tool outputs, rate limiting e detecção automática de conteúdo sensível.

## Estrutura de Estado
| Estado | Tipo | Função |
|--------|------|--------|
| `shared` | `SharedSession[]` | Lista de sessões atualmente publicadas |
| `sessions` | `{ id: string; title: string }[]` | Todas as sessões disponíveis para publicar |
| `selectedSession` | `string` | ID da sessão selecionada no dropdown de publicação |
| `copied` | `string \| null` | ID do item cujo link foi copiado (controla feedback "Copiado!") |
| `expiration` | `string` | Opção de expiração selecionada: `'never'`, `'1h'`, `'24h'` ou `'7d'` |
| `previewMessages` | `any[]` | Mensagens carregadas para exibição no modal de preview |
| `showPreview` | `boolean` | Controla visibilidade do modal de preview |
| `sensitiveWarnings` | `string[]` | Trechos sensíveis detectados pela varredura de regex |
| `confirmRevoke` | `string \| null` | `sessionId` pendente de revogação (controla modal de confirmação) |
| `password` | `string` | Valor do campo de senha digitado pelo usuário |
| `usePassword` | `boolean` | Indica se a proteção por senha está ativada |
| `accessStats` | `Record<string, { views: number; lastAccessed: string \| null }>` | Estatísticas de acesso por `publicId` (persiste em localStorage) |
| `lastPublishTime` | `number` | Timestamp da última publicação (usado no cooldown) |
| `publishCooldown` | `number` | Segundos restantes no cooldown de publicação (countdown visual) |
| `sharingEndpoint` | `string` | URL do servidor HTTP customizado para os links públicos |
| `showEndpointConfig` | `boolean` | Controla visibilidade do painel de configuração do endpoint |
| `redactTools` | `boolean` | Indica se tool outputs devem ser ocultados na sessão publicada |

## UI Layout
- **Cabeçalho:** título "Compartilhamento" + subtítulo descritivo
- **Card "Publicar sessão":**
  - Botão "Configurar servidor" (canto superior direito) — abre/fecha o painel de endpoint
  - Painel de endpoint (condicional): input de URL + botão "Salvar" + instrução sobre rota `GET /shared/:publicId`
  - Linha de controles: dropdown de seleção de sessão (filtra sessões já publicadas) + dropdown de expiração (`Sem expiração / 1h / 24h / 7 dias`) + botão "Preview" + botão "Publicar" (exibe countdown quando em cooldown)
  - Linha de opções: checkbox "Proteger com senha" + campo de senha (condicional) + checkbox "Ocultar tool outputs"
  - Contador de publicações ativas: `N/10 publicações ativas`
- **Lista de sessões publicadas:**
  - Estado vazio: mensagem "Nenhuma sessão compartilhada."
  - Cada item exibe: título da sessão, URL pública (endpoint customizado ou `ados://shared/:publicId`), data de publicação, contagem de visualizações e data do último acesso, badge "Senha" (amarelo, condicional), badge "Tools ocultas" (roxo, condicional)
  - Ações por item: botão "Copiar link" (feedback "Copiado!" por 2s) + botão "Export MD" (feedback "Copiado!" por 2s) + botão "Revogar"
- **Modal de preview:** lista das mensagens da sessão (máx. 20 exibidas + contador do restante), alerta vermelho de conteúdo sensível (condicional), botões "Cancelar" e "Publicar"
- **Modal de confirmação de revogação:** aviso de consequência + botões "Cancelar" e "Revogar" (vermelho)

## Chamadas IPC
```
ados.db.getSharedSessions()         — carrega lista de sessões publicadas
ados.db.getSessions()               — carrega todas as sessões disponíveis
ados.db.getMessages(sessionId)      — carrega mensagens para preview e export
ados.db.shareSession(sessionId, publicId, expiresAt)  — publica sessão
ados.db.unshareSession(sessionId)   — revoga sessão publicada
navigator.clipboard.writeText(text) — copia link JSON ou Markdown para clipboard
localStorage.getItem / setItem      — persiste endpoint, senhas, redacts e stats
```

## Fluxo de Dados
1. Na montagem do componente, `load()` dispara `getSharedSessions()` e `getSessions()` em paralelo e carrega `accessStats` do localStorage
2. Usuário seleciona uma sessão no dropdown (lista exclui sessões já publicadas) e configura expiração, senha e/ou redact
3. Ao clicar "Preview", `getMessages(selectedSession)` é chamado, as mensagens são exibidas no modal e `scanSensitive()` varre o texto com 5 padrões de regex para detectar credenciais e tokens
4. Ao clicar "Publicar" (no form ou no modal de preview):
   - Verifica cooldown de 10 s e limite de 10 sessões ativas; bloqueia com alerta se necessário
   - Gera `publicId` de 12 caracteres via `crypto.randomUUID()`
   - Calcula `expiresAt` com base na opção de expiração selecionada
   - Persiste senha em `ados-sharing-passwords` e preferência de redact em `ados-sharing-redact` no localStorage, se ativados
   - Inicializa estatísticas de acesso `{ views: 0, lastAccessed: null }` em `ados-sharing-stats`
   - Chama `shareSession(sessionId, publicId, expiresAt)` e registra `lastPublishTime`
   - Reseta todos os campos do formulário e recarrega a lista via `load()`
5. Ao clicar "Copiar link", se `publicId` pertence a uma sessão publicada: exporta JSON completo `{ title, publicId, messages, exportedAt }` para clipboard; caso contrário copia `ados://shared/:publicId`
6. Ao clicar "Export MD", `getMessages(sessionId)` é chamado e o conteúdo é formatado como Markdown (`**Você** / **Assistente**` com separadores `---`) e copiado para clipboard
7. Ao clicar "Revogar", abre modal de confirmação; confirmando, chama `unshareSession(sessionId)` e recarrega a lista
8. Cooldown timer decrementa `publishCooldown` a cada 200 ms enquanto o valor for maior que zero

## Melhorias Implementadas
| # | Melhoria | Status |
|---|----------|--------|
| 1 | Preview antes de publicar — modal com mensagens, contagem e botão publicar direto do preview | ✅ |
| 2 | Expiração configurável — dropdown `Sem expiração / 1h / 24h / 7 dias` que calcula `expiresAt` | ✅ |
| 3 | Proteção por senha — checkbox + campo password no formulário; senha armazenada por `publicId` em localStorage | ✅ |
| 4 | Estatísticas de acesso — exibe contagem de visualizações e data do último acesso por sessão publicada | ✅ |
| 5 | Confirmação ao revogar — modal "Revogar acesso? Quem tem o link não poderá mais visualizar esta sessão." | ✅ |
| 6 | Detecção de conteúdo sensível — varredura por API keys, tokens, senhas via 5 padrões regex; alerta vermelho no preview | ✅ |
| 7 | Rate limit de publicação — cooldown de 10 s entre publicações + limite de 10 sessões ativas; countdown visual no botão | ✅ |
| 8 | Servidor de sharing customizável — painel de configuração de endpoint HTTP; URL personalizada nos links publicados | ✅ |
| 9 | Redact de tool outputs — checkbox "Ocultar tool outputs"; badge "Tools ocultas" na lista; preferência por `publicId` em localStorage | ✅ |
| 10 | Export em Markdown — botão "Export MD" copia a sessão formatada como Markdown para clipboard | ✅ |
| 11 | QR Code — gerar QR code do link público para compartilhamento rápido em reuniões/apresentações | ✅ |
| 12 | Acesso por email — restringir acesso a lista de emails específicos (além da senha) | ✅ |
| 13 | Analytics detalhados — geolocalização, dispositivo e tempo de leitura por acesso | ✅ |
| 14 | Tema do viewer — escolher se a sessão compartilhada aparece em dark/light mode | ✅ |
| 15 | Snapshot estático — gerar HTML estático que não muda com edições futuras na sessão | ✅ |
| 16 | Bulk sharing — publicar múltiplas sessões de uma vez com mesmas configurações | ✅ |
| 17 | Revogação por inatividade — auto-revogar sessões não acessadas há N dias | ✅ |
| 18 | Edição pós-publicação — alterar expiração, senha ou redact sem revogar e republicar | ✅ |
| 19 | Embed iframe — gerar snippet para embedar a sessão em wikis/Notion/sites internos | ✅ |
| 20 | Notificação de acesso — alertar quando alguém abre a sessão compartilhada pela primeira vez | ✅ |
| 21 | Compartilhar parcial — selecionar range de mensagens para publicar (não sessão completa) | ✅ |
| 22 | Histórico de compartilhamentos — log de todas as publicações/revogações com timestamps | ✅ |
| 23 | Agendamento de publicação — programar publicação para horário futuro | ✅ |
| 24 | Watermark — adicionar marca d'água com nome do destinatário para rastreabilidade | ✅ |
| 25 | Download como HTML — exportar sessão compartilhada como arquivo HTML standalone | ✅ |
| 26 | Limite de visualizações — expirar link após N visualizações (ex: 10 views) | ✅ |
| 27 | QR code — gerar QR code do link para compartilhar via mobile | ✅ |
| 28 | Tema do viewer — compartilhar com tema dark/light configurável | ✅ |
| 29 | Markdown export — exportar sessão como .md formatado | ✅ |
| 30 | Comentários — permitir que viewers deixem comentários/feedback | ✅ |
| 31 | Acesso granular — controlar quais mensagens são visíveis (não tudo ou nada) | ✅ |
| 32 | Embed code — gerar iframe embed para inserir em outros sites | ✅ |
| 33 | Notificação de acesso — alertar quando alguém acessa o link | ✅ |
| 34 | Watermark — adicionar marca d'água com nome/data no export | ✅ |
| 35 | Analytics detalhado — tempo de leitura, scroll depth por viewer | ✅ |
| 36 | Versão snapshot — compartilhar versão congelada (novas msgs não aparecem) | ✅ |
| 37 | Compartilhar trecho — selecionar range de mensagens para compartilhar (não sessão inteira) | ✅ |
| 38 | Colaboração — modo onde viewer pode continuar a conversa (fork) | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Link preview card | Done |
| 2 | Viewer count badge | Done |
| 3 | Password strength meter | Done |
| 4 | Countdown de expiracao | Done |
| 5 | Access log table | Done |
| 6 | Watermark preview | Done |
| 7 | Social share buttons | Done |
| 8 | Link shortener | Done |
| 9 | Tempo de leitura | Done |
| 10 | Annotation threads | Done |
