# 6. Telegram

## Descrição
Integração com bot do Telegram — recebe e envia mensagens em tempo real, pareia chats do Telegram com sessões do JVOS para comunicação bidirecional automatizada, com persistência local, rate limiting, reconexão automática e deduplicação de mensagens.

## Estrutura de Estado
| Estado | Tipo | Função |
|--------|------|--------|
| `tab` | `'inbox' \| 'send' \| 'pairings' \| 'config'` | Aba ativa no momento |
| `hasToken` | `boolean` | Indica se o token do bot está configurado |
| `tokenInput` | `string` | Valor digitado no campo de token |
| `botInfo` | `any` | Dados do bot retornados pela API (first_name, username) |
| `polling` | `boolean` | Indica se o polling de mensagens está ativo |
| `messages` | `TelegramMessage[]` | Lista de todas as mensagens recebidas e enviadas |
| `chats` | `TelegramChat[]` | Lista de chats conhecidos pelo bot |
| `selectedChat` | `number \| null` | ID do chat atualmente selecionado no inbox/envio |
| `sendText` | `string` | Conteúdo da mensagem a ser enviada |
| `sending` | `boolean` | Indica que um envio está em progresso |
| `sendStatus` | `'sent' \| 'error' \| ''` | Status do último envio (exibido temporariamente) |
| `configStatus` | `string` | Mensagem de status/erro ao salvar o token |
| `pairings` | `Pairing[]` | Lista de pairings chat↔sessão cadastrados |
| `sessions` | `Session[]` | Lista de sessões do JVOS disponíveis para pairing |
| `pairChat` | `number \| null` | Chat selecionado no form de novo pairing |
| `pairSession` | `string` | Sessão selecionada no form de novo pairing |
| `pairDirection` | `string` | Direção do pairing (`both`, `tg-to-session`, `session-to-tg`) |
| `inboxSearch` | `string` | Texto de busca aplicado às mensagens do inbox |
| `confirmRemoveToken` | `boolean` | Controla exibição do modal de confirmação de remoção do token |
| `confirmUnpair` | `{ chatId: number; sessionId: string } \| null` | Dados do pairing a remover; controla exibição do modal |
| `unreadCount` | `number` | Contador de mensagens não lidas (zerado ao abrir inbox) |
| `showMarkdownPreview` | `boolean` | Alterna entre modo edição e preview de markdown na aba Enviar |
| `persistedMessages` | `TelegramMessage[]` | Mensagens carregadas do localStorage na inicialização |
| `lastSendTime` | `number` | Timestamp do último envio (usado para rate limiting) |
| `cooldownRemaining` | `number` | Segundos restantes do cooldown de envio |
| `reconnecting` | `boolean` | Indica que a reconexão automática está em andamento |
| `seenMessageIds` (ref) | `Set<string>` | Set de chaves `chatId-messageId` para deduplicação |
| `messagesEndRef` (ref) | `HTMLDivElement` | Referência ao fim da lista de mensagens para scroll automático |
| `lastReadCountRef` (ref) | `number` | Referência ao último valor lido do contador de não-lidas |
| `reconnectAttemptRef` (ref) | `number` | Contador de tentativas de reconexão (controla o backoff) |
| `reconnectTimerRef` (ref) | `ReturnType<typeof setTimeout> \| null` | Handle do timer de reconexão para cancelamento |

## UI Layout
- **Header fixo:** título "Telegram" + subtítulo com `@username` do bot (ou instrução de conexão quando sem token)
- **Botão de polling** (visível apenas com token): indicador com ponto animado verde quando ativo ("Escutando") ou ponto cinza quando parado ("Parado")
- **Barra de abas:** `Inbox`, `Enviar`, `Pairings` (visíveis apenas com token) e `Configurar` (sempre visível); aba ativa destacada em `bg-brand-600`
- **Badge de não-lidas:** bolinha vermelha com número sobre o botão `Inbox` quando há mensagens não lidas e a aba ativa não é inbox; exibe "99+" para valores acima de 99
- **Área de conteúdo:** rolável, renderiza o conteúdo da aba ativa
- **Modal "Desconectar bot?":** overlay com confirmação destrutiva (vermelho) antes de remover o token
- **Modal "Remover pairing?":** overlay com confirmação destrutiva (vermelho) antes de desvincular um pairing

## Abas

### Configurar (`config`)
- Card "Bot Token" com instrução de uso do `@BotFather`
- **Sem token:** campo `password` para colar o token + botão "Conectar" (desabilitado se vazio) + mensagem de erro em vermelho
- **Com token:** card com ícone do Telegram, nome e username do bot + badge "Conectado" (verde) + link "Desconectar bot" (vermelho, abre modal de confirmação)
- Card "Como funciona" com lista numerada de instruções em 5 passos

### Inbox (`inbox`)
- **Sidebar esquerda (224px):** campo de busca por texto nas mensagens + botão "Todas (N)" + botões por chat com contagem individual; estado vazio exibe instrução
- **Painel principal:** lista de mensagens com layout de chat (mensagens recebidas à esquerda em `bg-surface-2`, mensagens enviadas à direita em `bg-brand-600`); mensagens recebidas exibem nome do remetente e título do chat (quando não privado); cada mensagem exibe horário em formato `pt-BR`; estado vazio mostra "Aguardando mensagens..." ou instrução para ativar polling

### Enviar (`send`)
- Select de destinatário (lista de chats conhecidos com tipo) + aviso quando não há chats
- Label "Mensagem" com toggle "Preview / Editar"
  - **Modo edição:** textarea com 4 linhas
  - **Modo preview:** div que renderiza `**bold**`, `*bold*`, `_italic_` e `` `code` `` como HTML
- Nota de suporte a Markdown abaixo do campo
- Botão "Enviar" (desabilitado sem texto, sem chat selecionado, durante envio ou durante cooldown); exibe "Enviando...", "Aguarde Xs" ou texto padrão
- Feedback inline: "✓ Enviado" (verde) por 3s após sucesso; "✗ Erro ao enviar" (vermelho) após falha
- Indicador "Reconectando..." (amarelo, pulsante) quando reconexão automática está em andamento

### Pairings (`pairings`)
- Card "Novo Pairing" com grade de 3 selects: **Chat** (chats conhecidos) + **Sessão** (sessões do JVOS) + **Direção** (Bidirecional / Telegram → Sessão / Sessão → Telegram)
- Botão "Vincular" (desabilitado se chat ou sessão não selecionados)
- Lista de pairings ativos: cada item exibe nome do chat, seta de direção (`↔`, `→` ou `←`), nome da sessão, label de direção e botão "Remover" (abre modal de confirmação)
- Estado vazio: mensagem "Nenhum pairing configurado."

## Chamadas IPC

```
// Token e bot
ados.telegram.getToken()
ados.telegram.setToken(token)
ados.telegram.removeToken()
ados.telegram.getMe()

// Chats e polling
ados.telegram.getChats()
ados.telegram.pollingStatus()
ados.telegram.startPolling()
ados.telegram.stopPolling()

// Mensagens
ados.telegram.send(chatId, text)
ados.telegram.onMessage(callback)
ados.telegram.removeListeners()

// Pairings (via DB)
ados.db.getTelegramPairings()
ados.db.pairTelegram(chatId, sessionId, direction)
ados.db.unpairTelegram(chatId, sessionId)
ados.db.getSessions()

// Evento de pairing via bot
ados.telegram.onPairingUpdated(callback)
```

## Fluxo de Dados

1. Na montagem do componente, `checkToken()` verifica se há token salvo; se sim, redireciona para a aba `inbox`
2. Na montagem, mensagens persistidas são lidas do `localStorage` (`ados-telegram-messages`) e carregadas em `messages` e `seenMessageIds`
3. Quando `hasToken` muda para `true`, carrega `botInfo`, `chats`, status de polling e `pairings` em paralelo; registra listener de `onPairingUpdated`
4. O listener `onMessage` é registrado sempre que `hasToken`, `chats` ou `tab` mudam; ao receber uma mensagem, verifica deduplicação pelo Set `seenMessageIds`, adiciona à lista, persiste no localStorage (últimas 500 mensagens com TTL de 30 dias) e incrementa `unreadCount` se a aba ativa não for `inbox`
5. Ao abrir a aba `inbox`, `unreadCount` é zerado automaticamente via `useEffect`
6. `filteredMessages` é computado a partir de `messages`, filtrando por `selectedChat` (quando selecionado) e por `inboxSearch` (quando preenchido)
7. Após cada atualização de `messages`, o scroll da lista é movido automaticamente para o fim via `messagesEndRef`
8. Ao enviar mensagem (`handleSend`): verifica cooldown de 2s (rate limiting), chama `ados.telegram.send()`, adiciona a mensagem enviada à lista local com `from: null` para identificação visual, persiste no localStorage e atualiza `sendStatus`
9. Se `startPolling()` falha ou um envio falha sem polling ativo, `attemptReconnect()` é acionado com exponential backoff: tenta após 5s, 15s, 30s e 60s; `reconnectAttemptRef` controla o índice do delay; ao receber mensagem com sucesso, o contador é zerado
10. Ao salvar um novo pairing (`handlePair`), chama `ados.db.pairTelegram()` e recarrega a lista; ao remover, chama `ados.db.unpairTelegram()` após confirmação no modal

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Notificação de nova mensagem — badge vermelho com contador no botão Inbox; reseta ao abrir a aba | ✅ |
| 2 | Preview de markdown — toggle Preview/Editar na aba Enviar renderiza bold, italic e code em tempo real | ✅ |
| 3 | Busca em mensagens — campo de busca na sidebar do inbox filtra mensagens por texto em tempo real | ✅ |
| 4 | Confirmação ao remover token — modal "Desconectar bot?" com aviso de impacto antes de executar | ✅ |
| 5 | Status de entrega — exibe "✓ Enviado" (verde) ou "✗ Erro ao enviar" (vermelho) após tentativa de envio | ✅ |
| 6 | Persistência de mensagens — mensagens salvas no localStorage (últimas 500, TTL 30 dias); recarregadas ao abrir o app | ✅ |
| 7 | Rate limiting de envio — cooldown de 2s entre envios com indicador visual "Aguarde Xs" no botão | ✅ |
| 8 | Reconexão automática — exponential backoff (5s, 15s, 30s, 60s) ao perder conexão; indicador "Reconectando..." visível | ✅ |
| 9 | Deduplicação de mensagens — `seenMessageIds` ref com Set de `chatId-messageId` previne duplicatas em reconexão | ✅ |
| 10 | Confirmação ao remover pairing — modal de confirmação antes de desvincular chat de sessão | ✅ |
| 11 | Scroll automático — lista de mensagens rola para o fim automaticamente ao receber nova mensagem | ✅ |
| 12 | Chats descobertos em tempo real — chats novos detectados via `onMessage` são adicionados à lista sem reload | ✅ |
| 13 | Sincronização de pairings via bot — listener `onPairingUpdated` recarrega pairings e chats ao receber comando pelo bot | ✅ |
| 14 | Envio de mídia — suporte a envio de imagens, documentos e áudio além de texto | ✅ |
| 15 | Respostas rápidas — templates de resposta pré-definidos acessíveis com um clique | ✅ |
| 16 | Filtros no inbox — filtrar por tipo (texto/mídia), período (hoje, 7d, 30d) e remetente | ✅ |
| 17 | Notificação desktop — Notification API para novas mensagens quando app está em background | ✅ |
| 18 | Agendamento de mensagem — agendar envio para horário futuro com preview | ✅ |
| 19 | Auto-resposta — regras de resposta automática por keyword ou fora de horário comercial | ✅ |
| 20 | Exportar conversa — baixar histórico de um chat como Markdown ou PDF | ✅ |
| 21 | Multi-bot — suporte a múltiplos bots simultaneamente com seletor no header | ✅ |
| 22 | Inline commands — executar skills direto do Telegram via comandos do bot (/skill-name) | ✅ |
| 23 | Métricas de conversa — dashboard com msgs enviadas/recebidas por dia e tempo médio de resposta | ✅ |
| 24 | Pinned messages — fixar mensagens importantes no topo do chat para referência rápida | ✅ |
| 25 | Formatação avançada — suporte a botões inline, links e formatação HTML no envio | ✅ |
| 26 | Status de conexão detalhado — exibir latência do polling, uptime % e última falha | ✅ |
| 27 | Grupos e canais — suporte a envio/recebimento em grupos e canais do Telegram | ✅ |
| 28 | Histórico por chat — paginação no inbox com "Carregar mais" para chats com muitas mensagens | ✅ |
| 29 | Atalhos de teclado — Ctrl+Enter para enviar, Ctrl+N para novo chat, Esc para fechar | ✅ |
| 30 | Respostas rápidas — templates de resposta pré-configurados por chat | ✅ |
| 31 | Filtro por chat — sidebar com lista de chats para filtrar inbox | ✅ |
| 32 | Notificação nativa — push notification do OS quando chega mensagem | ✅ |
| 33 | Auto-reply — resposta automática configurável por chat/horário | ✅ |
| 34 | Forward para sessão — encaminhar mensagem do TG direto para sessão JVOS | ✅ |
| 35 | Media viewer — visualizar imagens/documentos recebidos inline | ✅ |
| 36 | Métricas de resposta — tempo médio de resposta por chat | ✅ |
| 37 | Agendamento de envio — enviar mensagem em horário específico | ✅ |
| 38 | Labels no chat — categorizar chats com tags coloridas | ✅ |
| 39 | Busca global — buscar texto em todas as mensagens de todos os chats | ✅ |
| 40 | Webhook de entrada — disparar skill/automação quando receber mensagem com keyword | ✅ |
| 41 | Multi-bot — suportar múltiplos bots com tokens diferentes | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Status de envio | Done |
| 2 | Typing indicator | Done |
| 3 | Read receipts | Done |
| 4 | Media preview | Done |
| 5 | Emoji reactions | Done |
| 6 | Quote/Reply | Done |
| 7 | Busca em conversas | Done |
| 8 | Avatars com iniciais | Done |
| 9 | Badges de nao-lido | Done |
| 10 | Timeline de delivery | Done |
