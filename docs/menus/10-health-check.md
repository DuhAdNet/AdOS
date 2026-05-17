# 10. Health Check

## Descrição
Diagnóstico do sistema JVOS — executa verificações em paralelo nos providers LLM, servidores MCP, banco de dados, integração Telegram, modelo padrão, runtime Electron, espaço em disco e uso de memória. Suporta execução manual, agendamento automático, modo Deep Check e notificações nativas do sistema operacional.

## Estrutura de Estado

| Estado | Tipo | Função |
|--------|------|--------|
| `results` | `CheckResult[]` | Lista de resultados da última execução de diagnóstico |
| `running` | `boolean` | Indica se há uma execução de diagnóstico em andamento |
| `history` | `HistoryEntry[]` | Histórico das últimas 10 execuções (timestamp + resultados) |
| `showHistory` | `boolean` | Controla a visibilidade do painel de histórico expandível |
| `notifications` | `string[]` | Fila das últimas 5 mensagens de alerta geradas por falhas |
| `scheduledInterval` | `number` | Intervalo de execução automática em horas (0 = desativado) |
| `deepCheck` | `boolean` | Ativa o modo de verificação profunda com teste real de latência de API |
| `scheduledTimer` | `ref<ReturnType<setInterval>>` | Referência ao timer de agendamento automático (via `useRef`) |

## UI Layout

- **Header fixo**: título "Health Check" + subtítulo descritivo
- **Banner de alertas recentes**: aparece condicionalmente quando há erros/warnings na fila `notifications`; inclui botão "Limpar"
- **Barra de controles**:
  - Botão "Executar Diagnóstico" (desabilitado com texto "Verificando..." durante execução)
  - Checkbox "Deep Check" para alternar modo de verificação profunda
  - Dropdown "Auto:" com opções Off / 1h / 6h / 12h / 24h para agendamento automático
- **Card de status geral**: exibe "Sistema saudável" (verde), "Atenção necessária" (amarelo) ou "Problemas detectados" (vermelho), com contagem de checks que passaram
- **Lista de resultados**: um card por verificação, contendo:
  - Indicador colorido (dot verde/amarelo/vermelho/pulsante para pending)
  - Nome do check
  - Mensagem de detalhe
  - Botão de ação rápida contextual (ex: "Configurar →", "Ver ferramentas →") quando aplicável
- **Painel de histórico**: expansível via toggle "▶/▼ Histórico (N execuções)", exibe execuções anteriores com timestamp formatado em pt-BR, contagem de OK e indicadores de erro/warning

## Verificações Executadas

1. **LLM Provider** — lista todos os providers via `ados.providers.list()` e verifica se ao menos um possui API key configurada; reporta quantos estão ativos
2. **LLM Provider (Deep)** — ativado somente quando `deepCheck = true`; executa `ados.llm.testKey()` com payload `'__ping__'` no primeiro provider com key disponível, mede latência em ms e classifica como warning se latência > 5000ms ou se houver erro na resposta
3. **MCP Servers** — lista servidores via `ados.mcp.listServers()` e conta quantos têm `status === 'connected'`; reporta `X/Y conectados`; warning se parcialmente conectado ou nenhum configurado
4. **Database** — chama `ados.db.getSessions()` e reporta o número de sessões existentes; erro se a chamada falhar
5. **Telegram Bot** — verifica via `ados.telegram.getToken()` se o token está configurado; warning (opcional) se não configurado
6. **Modelo Padrão** — verifica via `ados.providers.getDefaultModel()` se há um modelo padrão selecionado; warning se nenhum modelo estiver definido
7. **Electron Runtime** — check estático que reporta a plataforma via `navigator.platform`; sempre retorna `ok`
8. **Disk Space** — usa `navigator.storage.estimate()` (primário) ou `ados.system.getDiskSpace()` (fallback) para calcular espaço livre; `warning` se livre < 1000MB, `error` se < 100MB
9. **Memory (Heap / JS Heap / Memory)** — usa `ados.system.getMemoryUsage()` (primário) ou `performance.memory` (fallback) para medir heap utilizado; `warning` se heap > 500MB com sugestão de reiniciar

## Chamadas IPC

```ts
// Providers e modelos
ados.providers.list()                          // lista todos os providers e suas chaves
ados.providers.getDefaultModel()               // retorna o modelo padrão selecionado
ados.llm.testKey(providerId, '__ping__')       // testa latência real do provider (Deep Check)

// MCP
ados.mcp.listServers()                         // lista servidores MCP e seus status

// Banco de dados
ados.db.getSessions()                          // retorna todas as sessões salvas
ados.db.getSetting('health_check_interval')    // carrega intervalo de agendamento salvo
ados.db.setSetting('health_check_interval', value) // persiste intervalo de agendamento

// Integrações
ados.telegram.getToken()                       // verifica se token do bot está configurado

// Sistema
ados.system.getDiskSpace()                     // retorna espaço livre em disco (fallback)
ados.system.getMemoryUsage()                   // retorna uso de heap do processo (fallback)

// Navegação
ados.nav.go(page)                              // navega para outra página ao clicar em ação rápida
```

## Fluxo de Dados

1. Componente monta → `useEffect` dispara `runChecks()` e `loadSchedule()` simultaneamente
2. `loadSchedule()` lê `health_check_interval` do banco e restaura o intervalo agendado no estado
3. `useEffect` monitora mudanças em `scheduledInterval` → recria ou cancela o `setInterval` conforme o valor
4. `runChecks()` define `running = true`, limpa `results` (se execução manual) e dispara todas as 8 funções de verificação em paralelo via `Promise.all()`
5. Cada função de verificação retorna um objeto `CheckResult` com `name`, `status`, `message` e `action` opcional
6. Os resultados são escritos em `results` e uma nova entrada é adicionada ao início de `history` (máximo de 10 entradas)
7. `running` é definido como `false`
8. O componente verifica se há `errors` ou `warnings` nos resultados; se sim, monta mensagem de alerta, adiciona à fila `notifications` (máximo 5) e tenta exibir notificação nativa via `Notification API` (solicitando permissão se necessário)
9. O status geral é derivado dos `results` em tempo real: `error` se qualquer check falhou, `warning` se há avisos, `ok` se todos passaram

## Melhorias Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Execução automática no startup via `useEffect` ao montar o componente | ✅ |
| 2 | Indicadores visuais por severidade: dots verde/amarelo/vermelho e labels contextuais | ✅ |
| 3 | Ações rápidas por resultado com botão "Configurar →" / "Ver ferramentas →" e navegação via `ados.nav.go()` | ✅ |
| 4 | Histórico das últimas 10 execuções com timestamp em pt-BR, expansível via toggle | ✅ |
| 5 | Notificação proativa: banner de alertas recentes + Notification API nativa do SO ao detectar falhas | ✅ |
| 6 | Execução de todos os checks em paralelo via `Promise.all()` para reduzir tempo total | ✅ |
| 7 | Modo Deep Check com teste real de latência ao provider via `ados.llm.testKey()`, exibindo tempo em ms | ✅ |
| 8 | Verificação de espaço em disco via `navigator.storage.estimate()` com fallback para `ados.system.getDiskSpace()` | ✅ |
| 9 | Verificação de uso de memória via `ados.system.getMemoryUsage()` com fallback para `performance.memory` | ✅ |
| 10 | Agendamento automático configurável (Off / 1h / 6h / 12h / 24h) com persistência via `ados.db.setSetting()` | ✅ |
| 11 | Exportar relatório — botão "Export" gera PDF ou Markdown com todos os resultados e recomendações | ✅ |
| 12 | Comparação histórica — gráfico mostrando evolução dos checks ao longo das últimas 10 execuções | ✅ |
| 13 | Categorias de checks — agrupar verificações por tipo (Sistema, Rede, Storage, LLM) com collapse individual | ✅ |
| 14 | Checks customizáveis — permitir ao usuário adicionar verificações próprias (URL ping, port check, script) | ✅ |
| 15 | Thresholds configuráveis — ajustar limites de alerta (ex: disco 80% → 90%) por check | ✅ |
| 16 | Integração com automações — disparar automação específica quando health check detecta falha | ✅ |
| 17 | Badge no menu — ícone do Health Check no nav exibe dot vermelho quando último check teve falhas | ✅ |
| 18 | Quiet hours — não exibir notificações nativas fora do horário configurado (ex: 22h-8h) | ✅ |
| 19 | Verificação de updates do app — checar se há nova versão do JVOS disponível | ✅ |
| 20 | Check de certificados SSL — verificar validade de certificados das conexões configuradas | ✅ |
| 21 | Relatório comparativo — comparar resultado atual vs. anterior lado a lado com diff | ✅ |
| 22 | Peso por check — permitir configurar quais checks são críticos vs. informativos | ✅ |
| 23 | Compartilhar relatório — enviar resultado do health check via Telegram ou clipboard formatado | ✅ |
| 24 | Check de permissões do filesystem — verificar se app tem acesso de leitura/escrita nos paths configurados | ✅ |
| 25 | Tempo total de diagnóstico — exibir quanto tempo levou a execução completa em ms | ✅ |
| 26 | Health score numérico — nota de 0-100 baseada no peso e resultado de todos os checks | ✅ |
| 27 | Benchmark de latência — medir e comparar latência entre providers | ✅ |
| 28 | Check de disco detalhado — alertar quando < 1GB livre | ✅ |
| 29 | Check de versão — verificar se há atualização do JVOS disponível | ✅ |
| 30 | Export de relatório — gerar PDF/MD com resultado do health check | ✅ |
| 31 | Comparar com anterior — diff visual entre última e penúltima execução | ✅ |
| 32 | Webhook de alerta — enviar POST para URL quando check falhar | ✅ |
| 33 | Check de MCP — verificar se todos os MCP servers estão respondendo | ✅ |
| 34 | Uptime tracker — percentual de uptime por provider nos últimos 7 dias | ✅ |
| 35 | Check de memórias — verificar integridade das memórias no Brain | ✅ |
| 36 | Auto-heal — tentar corrigir problemas simples automaticamente (reconnect, clear cache) | ✅ |
| 37 | Check de automações — verificar se automações pendentes falharam | ✅ |
| 38 | Check de credentials — verificar se API keys ainda são válidas | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Progress bar animada | Done |
| 2 | Grafico de tendencia | Done |
| 3 | Cores por severidade | Done |
| 4 | Quick Fix buttons | Done |
| 5 | Countdown proximo check | Done |
| 6 | Comparacao antes/depois | Done |
| 7 | Export relatorio MD | Done |
| 8 | Thresholds configuraveis | Done |
| 9 | Resource sparklines | Done |
| 10 | Uptime badge | Done |
