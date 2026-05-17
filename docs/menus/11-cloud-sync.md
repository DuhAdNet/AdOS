# 11. Cloud Sync

## Descrição
Sincroniza sessões, preferências e labels com um servidor remoto via HTTP POST. Suporta autenticação JWT, criptografia AES-256-GCM, compressão gzip, delta sync incremental, resolução de conflitos e retry automático com backoff exponencial.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `status` | `'disconnected' \| 'syncing' \| 'synced' \| 'error'` | Estado atual da sincronização |
| `endpoint` | `string` | URL do servidor de destino |
| `lastSync` | `string \| null` | ISO timestamp do último sync bem-sucedido |
| `autoSync` | `boolean` | Ativa sync automático a cada 5 minutos |
| `saved` | `boolean` | Feedback visual de configuração salva (2 s) |
| `urlError` | `string` | Mensagem de erro de validação de URL |
| `syncProgress` | `string` | Mensagem de progresso por etapa do sync |
| `syncDetails` | `string` | Resumo do último sync (ex.: "45 sessões, 12 labels") |
| `endpointOnline` | `boolean \| null` | Resultado do ping HEAD ao endpoint (atualizado a cada 30 s) |
| `conflict` | `SyncConflict \| null` | Dados do conflito detectado via HTTP 409 |
| `deltaEnabled` | `boolean` | Ativa envio apenas de alterações desde o último sync |
| `lastSyncVersion` | `number` | Número de versão do último sync (controle de delta) |
| `compressEnabled` | `boolean` | Ativa compressão gzip do payload via CompressionStream |
| `encryptEnabled` | `boolean` | Ativa criptografia AES-256-GCM antes do envio |
| `encryptKey` | `string` | Chave de criptografia informada pelo usuário |
| `jwtToken` | `string` | Bearer token para autenticação no JVOS-Server |
| `devices` | `Array<{ id, name, lastSync }>` | Lista de dispositivos conectados retornada pelo servidor |
| `retryCount` | `ref<number>` | Contador de tentativas de retry (máx. 3) |
| `retryTimer` | `ref<ReturnType<setTimeout> \| null>` | Referência ao timer de retry para limpeza no unmount |

### Interface `SyncConflict`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `localVersion` | `string` | Versão local no momento do conflito |
| `serverVersion` | `string` | Versão reportada pelo servidor |
| `localUpdated` | `string` | ISO timestamp local |
| `serverUpdated` | `string` | ISO timestamp do servidor |

## UI Layout

- **Cabeçalho da página** — título "Cloud Sync" e subtítulo descritivo
- **Card Status**
  - Badge colorido com rótulo: `Desconectado` (cinza) / `Sincronizando...` (azul) / `Sincronizado` (verde) / `Erro` (vermelho)
  - Linha "Última sincronização: DD/MM/YYYY HH:MM:SS" (visível quando `lastSync` existe)
  - Linha de detalhes do sync (`syncDetails`), em texto menor
  - Mensagem de progresso em tempo real (`syncProgress`), em azul
  - Indicador de conectividade: bolinha verde "Endpoint online" ou vermelha "Endpoint offline" (visível quando `endpoint` está preenchido)
- **Card Configuração**
  - Input mono `Endpoint do servidor` com validação de URL em tempo real e mensagem de erro inline
  - Toggle **Auto-sync** — sincronizar automaticamente a cada 5 minutos
  - Toggle **Delta Sync** — enviar apenas alterações desde a última sincronização; exibe "Versão atual: vN" quando ativo e versão > 0
  - Toggle **Compressão (gzip)** — comprimir payload antes de enviar (~70% redução)
  - Toggle **Criptografia (AES-256-GCM)** — encriptar dados antes de enviar ao servidor
  - Input senha **Chave de criptografia** (visível quando `encryptEnabled = true`); aviso amarelo se chave < 8 caracteres
  - Input senha **JWT Token (JVOS-Server)** — Bearer token opcional para autenticação
  - Botão **Salvar** — persiste todas as configurações; muda para "Salvo" (verde) por 2 segundos
  - Botão **Sincronizar Agora** — desabilitado se endpoint vazio ou sync em andamento
- **Card "O que é sincronizado"**
  - Sessões e mensagens (verde)
  - Preferências e configurações (verde)
  - Labels e pairings (verde)
  - API keys — criptografadas (amarelo)
  - MCP servers — apenas config, não credenciais (vermelho)
- **Card Dispositivos Conectados** (visível apenas quando `devices.length > 0`) — lista de dispositivos com nome e data do último sync
- **Modal de Conflito** (overlay `fixed inset-0`) — exibido quando `conflict !== null`
  - Exibe versão local e versão do servidor com timestamps
  - Botão **Manter Local** — força push dos dados locais ao servidor
  - Botão **Usar Servidor** — descarta alterações locais e aplica dados do servidor
  - Botão **Merge** — combina ambos (pode duplicar)
  - Botão **Cancelar** — fecha o modal sem resolver

## Chamadas IPC

```
// Leitura de configurações salvas (chamada no mount)
ados.db.getSetting('cloud_sync_endpoint')
ados.db.getSetting('cloud_sync_auto')
ados.db.getSetting('cloud_sync_last')
ados.db.getSetting('cloud_sync_delta')
ados.db.getSetting('cloud_sync_version')
ados.db.getSetting('cloud_sync_compress')
ados.db.getSetting('cloud_sync_encrypt')
ados.db.getSetting('cloud_sync_encrypt_key')
ados.db.getSetting('cloud_sync_jwt')

// Persistência de configurações (handleSave)
ados.db.setSetting('cloud_sync_endpoint', endpoint)
ados.db.setSetting('cloud_sync_auto', String(autoSync))
ados.db.setSetting('cloud_sync_delta', String(deltaEnabled))
ados.db.setSetting('cloud_sync_compress', String(compressEnabled))
ados.db.setSetting('cloud_sync_encrypt', String(encryptEnabled))
ados.db.setSetting('cloud_sync_encrypt_key', encryptKey)
ados.db.setSetting('cloud_sync_jwt', jwtToken)

// Coleta de dados para sync (handleSync)
ados.db.getSessions()
ados.db.getPreferences()
ados.db.getLabels()

// Persistência pós-sync bem-sucedido
ados.db.setSetting('cloud_sync_last', now)
ados.db.setSetting('cloud_sync_version', String(currentVersion))

// Aplicação de dados do servidor (resolução de conflito "Usar Servidor")
ados.db.setSetting('cloud_sync_server_data', JSON.stringify(data))

// Chamada HTTP de sync
fetch(endpoint, { method: 'POST', headers, body: payload })

// Ping de conectividade (a cada 30 s)
fetch(endpoint, { method: 'HEAD', signal: AbortSignal.timeout(5000) })

// Pull do servidor (resolução de conflito "Usar Servidor")
fetch(endpoint, { method: 'GET', headers })
```

## Payload de Sync

```json
// Full sync (deltaEnabled = false ou forceOverwrite = true)
{
  "sessions": [ /* todos os registros */ ],
  "preferences": { /* objeto de preferências */ },
  "labels": [ /* todos os labels */ ],
  "syncedAt": "2026-05-16T12:00:00.000Z",
  "version": 5,
  "isDelta": false
}

// Delta sync (deltaEnabled = true e lastSyncVersion > 0)
{
  "sessions": [ /* apenas sessões com updatedAt > lastSync */ ],
  "preferences": { /* objeto de preferências */ },
  "labels": [ /* todos os labels */ ],
  "syncedAt": "2026-05-16T12:00:00.000Z",
  "version": 5,
  "deltaFrom": 4,
  "isDelta": true
}

// Payload criptografado (encryptEnabled = true)
{
  "encrypted": "<base64 de IV(12 bytes) + ciphertext AES-256-GCM>",
  "algo": "AES-256-GCM"
}
```

**Headers HTTP enviados:**

| Header | Condição | Valor |
|--------|----------|-------|
| `Content-Type` | sempre | `application/json` |
| `Authorization` | `jwtToken` preenchido | `Bearer <token>` |
| `X-Encrypted` | `encryptEnabled = true` | `"true"` |
| `X-Compress-Request` | `compressEnabled = true` | `"true"` |
| `Content-Encoding` | compressão ativa e bem-sucedida | `"gzip"` |
| `Content-Type` | compressão ativa e bem-sucedida | `application/octet-stream` |

## Fluxo de Dados

1. **Mount** — `load()` lê todas as 9 chaves de configuração do banco local via `ados.db.getSetting` e popula os estados correspondentes
2. **Ping contínuo** — efeito separado monitora `endpoint`; executa `HEAD` imediatamente e repete a cada 30 s, atualizando `endpointOnline`
3. **handleSave** — valida URL, persiste as 7 configurações editáveis no banco local, exibe feedback "Salvo" por 2 segundos
4. **handleSync** — coleta `sessions`, `preferences` e `labels` via IPC; monta `dataToSend` (full ou delta conforme `deltaEnabled`); aplica criptografia AES-256-GCM se ativada; aplica compressão gzip se ativada; adiciona header JWT se preenchido; envia via `POST`
5. **Detecção de conflito (HTTP 409)** — popula `conflict` com versões local e servidor; exibe modal; sync interrompido até resolução
6. **Resolução de conflito**
   - *Manter Local*: chama `handleSync(true)` com `forceOverwrite = true`
   - *Usar Servidor*: faz `GET` no endpoint, aplica dados recebidos localmente via `setSetting`
   - *Merge*: chama `handleSync(true)` com `forceOverwrite = true`
7. **Sync bem-sucedido** — persiste `cloud_sync_last` e `cloud_sync_version`; atualiza `lastSync`, `lastSyncVersion`, `syncDetails`; zera `retryCount`; verifica se response contém `devices` e atualiza lista
8. **Retry com backoff** — em caso de erro, incrementa `retryCount`; agenda novo `handleSync()` em 30 s (1ª falha), 60 s (2ª) ou 300 s (3ª); após 3 tentativas exibe "Máximo de tentativas atingido" e zera contador
9. **Unmount** — `clearTimeout(retryTimer.current)` cancela qualquer retry pendente

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Validação de URL em tempo real — borda vermelha e mensagem inline ao digitar URL inválida | ✅ |
| 2 | Progresso de upload por etapa — "Coletando sessões...", "Calculando delta...", "Criptografando payload...", "Enviando dados...", "Retry em Xs..." | ✅ |
| 3 | Detalhes do último sync — exibe contagem de sessões e labels abaixo do timestamp | ✅ |
| 4 | Resolução de conflito — detecta HTTP 409, exibe modal com versões local/servidor e 3 opções de resolução (Manter Local, Usar Servidor, Merge) | ✅ |
| 5 | Indicador de conectividade do endpoint — ping HEAD a cada 30 s com badge online/offline em tempo real | ✅ |
| 6 | Delta sync — envia apenas sessões modificadas desde o último sync, com campo `deltaFrom` e versionamento incremental | ✅ |
| 7 | Compressão gzip — usa `CompressionStream` API para comprimir o payload (~70% redução), com fallback transparente | ✅ |
| 8 | Retry automático com backoff exponencial — 3 tentativas em 30 s, 60 s e 5 min; contador zerado após sucesso | ✅ |
| 9 | Criptografia AES-256-GCM — usa Web Crypto API com IV aleatório de 12 bytes; payload enviado como base64 com header `X-Encrypted` | ✅ |
| 10 | Integração com JVOS-Server — campo JWT Token com autenticação Bearer; seção "Dispositivos Conectados" exibe multi-device info do response | ✅ |
| 11 | Sync seletivo — escolher quais categorias sincronizar (sessões, labels, skills, automações, brain) com toggles individuais | ✅ |
| 12 | Agendamento de sync — configurar sync automático em intervalos (1h, 6h, 12h, 24h) além do manual | ✅ |
| 13 | Log de sync detalhado — histórico das últimas 20 sincronizações com bytes transferidos, itens e status | ✅ |
| 14 | Bandwidth throttle — limitar velocidade de upload para não impactar conexão em uso | ✅ |
| 15 | Sync parcial em falha — se a conexão cair no meio, retomar do ponto onde parou (resume) | ✅ |
| 16 | Verificação de integridade — checksum SHA-256 do payload com validação server-side; alerta se divergir | ✅ |
| 17 | Notificação de sync concluído — feedback visual + som opcional ao concluir sync em background | ✅ |
| 18 | Wipe remoto — botão para apagar dados do servidor (com confirmação dupla) ao desconectar dispositivo | ✅ |
| 19 | Histórico de versões do servidor — visualizar snapshots anteriores com opção de restore | ✅ |
| 20 | Sync via QR code — gerar QR para parear rapidamente outro dispositivo | ✅ |
| 21 | Métricas de sync — total sincronizado (MB), frequência média, tempo médio por sync | ✅ |
| 22 | Exportar backup local — baixar snapshot completo como arquivo .json criptografado | ✅ |
| 23 | Conflitos pendentes — lista de conflitos não resolvidos com ação requerida por item | ✅ |
| 24 | Sync por Wi-Fi only — opção de bloquear sync em dados móveis/conexões metered | ✅ |
| 25 | Validação de endpoint antes de salvar — testar conectividade e autenticação ao configurar | ✅ |
| 26 | Indicador de progresso por categoria — mostrar % enviado por tipo (sessões, labels, skills) | ✅ |
| 27 | Sync seletivo — escolher quais sessões/labels sincronizar | ✅ |
| 28 | Bandwidth indicator — mostrar tamanho do payload antes de sync | ✅ |
| 29 | Offline queue — acumular mudanças offline e sync quando reconectar | ✅ |
| 30 | Merge inteligente — resolver conflitos automaticamente por timestamp | ✅ |
| 31 | Sync de skills — incluir skills/workflows no sync | ✅ |
| 32 | Sync de dashboards — incluir dashboards e widgets | ✅ |
| 33 | Audit trail remoto — log de syncs no servidor com quem/quando/o quê | ✅ |
| 34 | Multi-server — suportar múltiplos endpoints de sync (backup redundante) | ✅ |
| 35 | Sync schedule — agendar sync para horários específicos (ex: fim do dia) | ✅ |
| 36 | Partial sync — sync incremental por sessão (não tudo de uma vez) | ✅ |
| 37 | Sync de automações — incluir automações no sync cross-device | ✅ |
| 38 | Recovery mode — restaurar estado completo de um backup remoto | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Progress ring SVG | Done |
| 2 | Conflict diff viewer | Done |
| 3 | Bandwidth gauge | Done |
| 4 | Sync history timeline | Done |
| 5 | Category item counts | Done |
| 6 | Device last-seen | Done |
| 7 | Encryption badge | Done |
| 8 | Retry queue visual | Done |
| 9 | Schedule calendar | Done |
| 10 | Donut chart de storage | Done |
