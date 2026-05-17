# JVOS — 15 Melhorias Inspiradas no OpenClaw

## Contexto

O OpenClaw é um AI assistant open-source (372K+ stars) com arquitetura multi-canal, plugins, e execução local. Analisamos o código-fonte completo para extrair padrões aplicáveis ao JVOS.

---

## 1. Plugin System com Registro Dinâmico

**O que o OpenClaw faz:**
- Plugins se registram via `api-builder.ts` com handlers tipados: `registerTool`, `registerHook`, `registerChannel`, `registerProvider`
- Cada plugin declara capabilities, schema de config, e lifecycle hooks
- Plugins podem ser code-level (in-process) ou bundle-level (external)

**Arquivo de referência:** `src/plugins/api-builder.ts`

**Aplicação no JVOS:**
```typescript
// electron/plugin-registry.ts
interface JvosPlugin {
  id: string;
  name: string;
  version: string;
  capabilities: ('tool' | 'channel' | 'provider' | 'memory')[];
  activate(ctx: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

const registry = new Map<string, JvosPlugin>();

export function registerPlugin(plugin: JvosPlugin) {
  registry.set(plugin.id, plugin);
  plugin.activate({ ipc, db, config });
}
```

**Benefício:** Integrações (Gmail, Slack, Sheets) viram plugins isolados. Adicionar novo serviço = criar plugin, sem tocar no core.

---

## 2. Context Engine Plugável com Compaction

**O que o OpenClaw faz:**
- Interface `ContextEngine` com métodos: `bootstrap`, `ingest`, `assemble`, `compact`, `maintain`
- Compaction reduz tokens por sumarização, respeitando budget
- Suporta proactive overflow detection e deferred compaction
- Apenas 1 memory plugin ativo por vez

**Arquivo de referência:** `src/context-engine/types.ts`

**Aplicação no JVOS:**
```typescript
// electron/context-engine.ts
interface ContextEngine {
  ingest(message: Message): Promise<void>;
  assemble(tokenBudget: number): Promise<Message[]>;
  compact(): Promise<{ tokensAfter: number; summary: string }>;
  maintain(): Promise<void>;
}
```

**Benefício:** O JVOS hoje usa transcript cru. Com compaction inteligente, sessões longas não estouram contexto — sumariza automaticamente mantendo apenas o essencial.

---

## 3. Tool Availability com Expressões de Condição

**O que o OpenClaw faz:**
- Cada tool tem `ToolAvailabilityExpression` — condições que determinam se o tool aparece pro agente
- Planner avalia auth/config/env/plugin signals antes de expor tools
- Tools indisponíveis ficam hidden com diagnóstico (por quê estão hidden)

**Arquivo de referência:** `src/tools/planner.ts`, `src/tools/availability.ts`

**Aplicação no JVOS:**
```typescript
// Cada tool declara quando está disponível
{
  name: 'send_email',
  availability: {
    requires: ['gmail_connected'],
    unless: ['user_plan_free']
  }
}
```

**Benefício:** O LLM só vê tools que realmente podem executar. Evita erros de "integração não conectada" e economiza tokens no prompt (menos tools = prompt menor).

---

## 4. Session Isolation (Multi-Sessão Paralela)

**O que o OpenClaw faz:**
- Cada conversa/contexto é uma sessão isolada com próprio transcript e state
- Sessions podem ser spawned, paused, archived independentemente
- Cron jobs rodam em `isolated-agent` sessions separadas da principal
- Session keys hierárquicas: `mainSessionKey` > `sessionKey` > `subagentSessionKey`

**Arquivo de referência:** `src/sessions/`, `src/cron/isolated-agent/`

**Aplicação no JVOS:**
- Automações (Actions Engine) devem rodar em sessões isoladas, não na sessão principal
- Cada listener pode ter sua própria sessão de processamento
- Subagentes spawnam em contexto isolado (não poluem o chat principal)

**Benefício:** Workflows em background não interferem na conversa ativa. O usuário pode conversar normalmente enquanto 10 automações rodam em paralelo.

---

## 5. Channel Abstraction Layer (Multi-Superfície)

**O que o OpenClaw faz:**
- "Channel" é uma interface abstrata: qualquer superfície de comunicação (Discord, Slack, WhatsApp, Terminal)
- Cada channel implementa: `sendMessage`, `sendTyping`, `updateStatus`, `handleInbound`
- Turn Kernel unifica o dispatch: inbound → route → agent → reply pipeline → outbound

**Arquivo de referência:** `src/channels/turn/kernel.ts`, `src/channels/message/reply-pipeline.ts`

**Aplicação no JVOS:**
```typescript
interface JvosChannel {
  id: string;
  type: 'desktop-chat' | 'whatsapp' | 'telegram' | 'slack' | 'email';
  sendMessage(msg: ChannelMessage): Promise<void>;
  onInbound(handler: InboundHandler): void;
}
```

**Benefício:** O chat desktop, WhatsApp listener, e notificações via Slack usam a mesma interface. Adicionar Telegram = implementar 1 interface, o router cuida do resto.

---

## 6. Cron com Delivery Context e Isolated Execution

**O que o OpenClaw faz:**
- 3 tipos de schedule: `at` (one-shot), `every` (interval), `cron` (expressão)
- Cada job tem `DeliveryContext` — onde/como roda (canal, agente isolado, etc.)
- Jobs persistidos em arquivo com migration support
- Failure notification automática se job falha
- Session reaper limpa sessões de jobs concluídos

**Arquivo de referência:** `src/cron/schedule.ts`, `src/cron/delivery.ts`

**Aplicação no JVOS:**
- O Actions Engine já tem cron básico — aprimorar com:
  - Delivery context (notificar no chat? email? slack?)
  - Failure notification automática
  - Isolated execution (não bloqueia UI)
  - Session cleanup pós-execução

**Benefício:** Automações agendadas ficam robustas: se falham, avisam. Se completam, limpam. Sem vazamento de memória.

---

## 7. Stall Detection e Watchdog para Listeners

**O que o OpenClaw faz:**
- `transport/stall-watchdog.ts` detecta quando um channel para de receber eventos
- Health monitoring periódico de canais
- Graceful reconnection com exponential backoff
- Active sessions shutdown tracker para clean exit

**Arquivo de referência:** `src/channels/transport/stall-watchdog.ts`

**Aplicação no JVOS:**
```typescript
// electron/listener-watchdog.ts
class ListenerWatchdog {
  private lastEvent: Map<string, number> = new Map();
  
  heartbeat(listenerId: string) {
    this.lastEvent.set(listenerId, Date.now());
  }
  
  check() {
    for (const [id, last] of this.lastEvent) {
      if (Date.now() - last > STALL_THRESHOLD) {
        this.restart(id);
        this.notify(`Listener ${id} reiniciado por inatividade`);
      }
    }
  }
}
```

**Benefício:** Listeners que travam (Gmail timeout, Sheets API limit) são detectados e reiniciados automaticamente. Zero intervenção manual.

---

## 8. Security Audit com Sandboxing por Nível

**O que o OpenClaw faz:**
- 3 modos: `off` (sessão principal), `non-main` (sessões externas sandboxed), `all`
- Docker sandbox com: bind mounts read-only, network isolation, seccomp profiles
- Audit automático detecta `dangerous_bind_mount`, `dangerous_network_mode`
- DM policy enforcement (pairing, open, locked)

**Arquivo de referência:** `src/security/audit.ts`

**Aplicação no JVOS:**
- Tools do Actions Engine que executam comandos (`run_command`) devem ter sandbox
- Listeners de fontes externas (WhatsApp) rodam em contexto restrito
- Audit periódico: "Esse flow acessa filesystem? Precisa de permissão explícita"

**Benefício:** O empresário configura automações sem risco de uma action malformada deletar arquivos ou acessar credenciais.

---

## 9. Model Catalog com Tiered Pricing e Status

**O que o OpenClaw faz:**
- Catálogo unificado de modelos com: provider, custo (input/output/cache), capabilities, status
- Status: `available`, `preview`, `deprecated`, `disabled`
- Tiered pricing (preço muda por volume)
- Model replacement tracking (`replaces`, `replacedBy`)
- Runtime refresh: catalog se atualiza sozinho

**Arquivo de referência:** `src/model-catalog/types.ts`

**Aplicação no JVOS:**
```typescript
interface ModelEntry {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  cost: { inputPer1K: number; outputPer1K: number };
  capabilities: ('text' | 'vision' | 'code' | 'fast')[];
  status: 'available' | 'deprecated';
  replacedBy?: string;
}
```

**Benefício:** O router do JVOS pode escolher o modelo mais barato que atende a capability necessária. Modelo depreciado? Fallback automático.

---

## 10. Live Canvas (UI Interativa Controlada pelo Agente)

**O que o OpenClaw faz:**
- Servidor HTTP local (porta 18793) serve HTML/CSS/JS interativo
- Bridge TCP conecta com apps companion (macOS/iOS)
- Agente pode: `present`, `hide`, `navigate`, `eval` (executar JS), `snapshot`
- Live reload via Chokidar + WebSocket injection
- URL sanitization com prefixos seguros

**Arquivo de referência:** `/skills/canvas/SKILL.md`, `/ui/src/ui/canvas-url.ts`

**Aplicação no JVOS:**
- O agente pode criar dashboards/relatórios HTML interativos e mostrá-los numa janela
- Canvas para: visualizar dados, relatórios ao vivo, formulários de input
- Agente gera HTML → serve localmente → mostra em BrowserWindow do Electron

```typescript
// electron/canvas-server.ts
import http from 'http';
const CANVAS_PORT = 18793;

export function serveCanvas(html: string): string {
  // Serve HTML numa porta local, retorna URL
  // Electron abre BrowserWindow com a URL
}
```

**Benefício:** O JVOS pode mostrar resultados visuais ricos — dashboards, gráficos, formulários — sem depender apenas do chat. O agente "desenha" interfaces.

---

## 11. Inbound Event Context (Enriquecimento de Mensagem)

**O que o OpenClaw faz:**
- Toda mensagem inbound ganha contexto enriquecido antes de chegar no agente:
  - `SenderFacts` — quem mandou, roles, permissões
  - `ConversationFacts` — tipo de chat, label, espaço
  - `MessageFacts` — corpo raw + processado + comandos
  - `AccessFacts` — se foi menção, se tem autorização

**Arquivo de referência:** `src/channels/inbound-event/context.ts`

**Aplicação no JVOS:**
- Quando listener captura evento (novo email, mensagem WhatsApp), enriquecer antes de processar:
  - Email: sender reputation, thread history, urgency score
  - WhatsApp: contato CRM, último contato, sentimento
  - Sheets: delta (o que mudou vs. estado anterior)

**Benefício:** O agente recebe contexto rico, não raw data. Decisões mais inteligentes sem gastar tokens pedindo "me dê mais contexto".

---

## 12. Webhook Ingress com Guards e Rate Limiting

**O que o OpenClaw faz:**
- Request body size limits configuráveis
- Anomaly tracking (detecta padrões suspeitos)
- Rate limiting por source
- Multiple webhook target routing
- Graceful degradation se upstream estiver lento

**Arquivo de referência:** `src/plugin-sdk/webhook-ingress.ts`

**Aplicação no JVOS:**
- O Actions Engine aceita webhooks (n8n manda dados pro JVOS). Precisa de:
  - Body size limit (evitar payload gigante)
  - Rate limit (evitar flood)
  - Validation (assinatura HMAC)
  - Timeout com resposta parcial

**Benefício:** JVOS exposto via webhook fica seguro contra abuso. Necessário para integração bidirecional com n8n/Make.

---

## 13. Voice-First Interface com Provider Registry

**O que o OpenClaw faz:**
- Provider registry plugável: ElevenLabs, OpenAI TTS, etc.
- TTS com directive parsing: `{{tts:texto alternativo}}`
- Talk Session Controller: WebSocket streaming, codec negotiation
- Modos: Agent Consult (one-shot) e Agent Talkback (live streaming)
- Persona system: cada personalidade pode ter voz diferente

**Arquivo de referência:** `src/tts/provider-registry.ts`, `src/talk/talk-session-controller.ts`

**Aplicação no JVOS:**
```typescript
// electron/voice/tts-registry.ts
interface TtsProvider {
  id: string;
  synthesize(text: string, voice: string): Promise<Buffer>;
  streamSynthesize(text: string, voice: string): AsyncGenerator<Buffer>;
}

// Registro de providers
registerTtsProvider('elevenlabs', new ElevenLabsProvider());
registerTtsProvider('openai-tts', new OpenAITtsProvider());
```

**Benefício:** O empresário fala com o JVOS por voz. Áudio → transcrição → agente → TTS → resposta em áudio. Hands-free total, como as 20 ideias propõem.

---

## 14. Event-Driven Hooks System

**O que o OpenClaw faz:**
- Hooks registram reações a eventos do sistema:
  - `onToolResult` — quando tool retorna resultado
  - `onAssistantText` — quando agente gera texto
  - `onSessionCreate` — nova sessão criada
  - `onError` — quando algo falha
- Middleware pattern: hooks podem transformar dados antes de seguir

**Arquivo de referência:** `src/hooks/`

**Aplicação no JVOS:**
```typescript
// electron/hooks.ts
type HookEvent = 'session:create' | 'tool:result' | 'flow:complete' | 
                 'listener:event' | 'memory:save' | 'error:fatal';

const hooks = new Map<HookEvent, Hook[]>();

export function on(event: HookEvent, handler: Hook) {
  hooks.get(event)?.push(handler) ?? hooks.set(event, [handler]);
}

// Exemplo: toda vez que um flow completa, salva log
on('flow:complete', async (data) => {
  await saveToActivityLog(data);
  await notifyIfConfigured(data);
});
```

**Benefício:** Automações reativas sem polling. "Quando X acontecer, faça Y" — o coração das 20 ideias de ouro (repetições → automação).

---

## 15. Onboarding Wizard Inteligente

**O que o OpenClaw faz:**
- `src/wizard/` — wizard interativo de setup
- Detecta ambiente (OS, ferramentas instaladas, canais disponíveis)
- Configura channels incrementalmente
- Setup wizard por channel plugin (cada integração tem seu próprio wizard)
- Progressive disclosure: começa simples, oferece avançado depois

**Arquivo de referência:** `src/wizard/`

**Aplicação no JVOS:**
```
Wizard JVOS (5 minutos):
1. "Qual seu cargo?" → adapta skills ativadas
2. "Quais ferramentas usa?" → ativa listeners/integrações relevantes
3. "O que mais toma seu tempo?" → sugere automações pré-built
4. "Conecte uma conta" → OAuth simplificado, 1 botão
5. "Pronto!" → primeira automação rodando
```

**Benefício:** Onboarding que converte. O empresário sente valor no minuto 1. Cada integração tem wizard próprio que guia passo-a-passo.

---

## Resumo: Prioridade de Implementação no JVOS

| # | Melhoria | Impacto | Esforço | Prioridade |
|---|----------|---------|---------|------------|
| 1 | Context Engine + Compaction | Alto (economia tokens) | Médio | P0 |
| 2 | Event-Driven Hooks | Alto (automações reativas) | Baixo | P0 |
| 3 | Tool Availability Expressions | Alto (UX + tokens) | Baixo | P0 |
| 4 | Session Isolation | Alto (estabilidade) | Médio | P1 |
| 5 | Stall Watchdog p/ Listeners | Alto (confiabilidade) | Baixo | P1 |
| 6 | Channel Abstraction | Alto (escalabilidade) | Alto | P1 |
| 7 | Plugin System | Alto (extensibilidade) | Alto | P1 |
| 8 | Cron com Delivery Context | Médio (robustez) | Baixo | P1 |
| 9 | Security Audit/Sandbox | Médio (segurança) | Médio | P2 |
| 10 | Live Canvas | Médio (UX rich) | Médio | P2 |
| 11 | Inbound Event Enrichment | Médio (inteligência) | Médio | P2 |
| 12 | Webhook Guards | Médio (segurança) | Baixo | P2 |
| 13 | Voice Interface | Alto (diferencial) | Alto | P2 |
| 14 | Model Catalog | Médio (economia) | Médio | P3 |
| 15 | Onboarding Wizard | Alto (conversão) | Médio | P3 |

---

## Próximos Passos Recomendados

**Sprint 1 (P0 — 2 semanas):**
1. Implementar Context Engine com compaction no `llm.ts`
2. Criar sistema de hooks em `electron/hooks.ts`
3. Adicionar availability expressions no `tools.ts`

**Sprint 2 (P1 — 3 semanas):**
4. Session isolation para Actions Engine
5. Watchdog para listeners
6. Channel abstraction layer
7. Delivery context no cron

**Sprint 3 (P2 — 4 semanas):**
8. Canvas server (HTML interativo)
9. Event enrichment nos listeners
10. Security audit básico
11. Webhook guards

---

*Análise baseada no código-fonte do OpenClaw (github.com/openclaw/openclaw)*
*Documento gerado em 17 de maio de 2026 — JVOS Strategy*
