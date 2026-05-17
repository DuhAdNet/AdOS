# JVOS — Changelog 17/05/2026

## Resumo da Sessão

Sessão de bugfixes e melhorias de estabilidade: **8 correções** de bugs reportados + **1 nova feature** (botão Editar nas Automações).

---

## Bugfixes

| # | Bug | Correção | Arquivos |
|---|-----|----------|----------|
| 1 | "Configure a API key OpenAI" poluindo o composer | Removido texto inline de erro; VoiceInput só mostra ícone vermelho silenciosamente | `src/components/VoiceInput.tsx` |
| 2 | "Error launching app" (missing dist/electron/main.js) | Build order: vite primeiro, tsc depois — vite limpa dist/ | Build pipeline |
| 3 | Marketplace ícones infantis (emojis) | Substituídos por símbolos geométricos (◈◇▣◉⬡◫△○□◎▷▥) | `src/pages/Marketplace.tsx` |
| 4 | Browser fica inclicável após minimizar | Removido `parent: mainWindow` de BrowserWindow + `skipTaskbar: false` | `electron/browser.ts` |
| 5 | Chat morre ao navegar para outros menus | Trocado render condicional por `className="hidden"` para preservar estado | `src/App.tsx` |
| 6 | Voice transcription não transcreve | OAuth não tem scope Whisper; implementado fallback multi-provider (Groq→OpenAI→Google Gemini) | `electron/llm.ts` |
| 7 | "model.startsWith is not a function" no Testar Prompt | Settings passava args invertidos `chat(providerId, messages)` → corrigido para `chat(messages, model)` com mapeamento por provider | `src/pages/Settings.tsx` |
| 8 | Google transcription usa `https` module instável | Migrado para `net.fetch` do Electron + adicionado console.log de debug | `electron/llm.ts` |

---

## Nova Feature

| # | Feature | Descrição | Arquivos |
|---|---------|-----------|----------|
| 1 | Botão Editar nas Automações | Abre formulário preenchido com dados existentes; salva via `updateAutomation` sem criar nova | `src/pages/Automations.tsx`, `electron/database.ts`, `electron/preload.ts` |

---

## Mudanças de Infraestrutura

| Mudança | Detalhes |
|---------|----------|
| Novo provider: Groq | Llama 3.3 70B + Whisper Large V3 (transcrição gratuita); `type: 'openai'` com baseUrl customizada |
| `resolveProvider()` atualizado | Reconhece modelos `llama*`/`mixtral*`/`whisper*` como Groq |
| `db:update-automation` | Novo IPC handler para UPDATE ao invés de INSERT |
| `ados.db.updateAutomation()` | Exposto no preload para o frontend |

---

## Docs Atualizados

- `docs/menus/00-indice.md` — 6 providers (adicionado Groq)
- `docs/menus/01-sessoes-chat.md` — Melhorias #27-29 (hidden, voice multi-provider, browser sem parent)
- `docs/menus/03-automacoes.md` — `editingId`, botão Editar, `updateAutomation`, melhoria #35
- `docs/menus/04-marketplace.md` — Ícones geométricos documentados
- `docs/menus/12-settings.md` — Melhorias #28-29 (fix test prompt, Groq provider)

---

## Telegram Bridge via Renderer (RESOLVIDO)

### Problema
O bot do Telegram não respondia — endpoint OAuth Codex (`chatgpt.com/backend-api/codex`) retorna 400 para chamadas feitas diretamente do processo Electron main.

### Causa Raiz
O OAuth token do Codex só funciona em chamadas feitas **dentro do contexto do renderer** (BrowserWindow). Chamadas do main process são rejeitadas com `400 status code (no body)`.

### Solução: Renderer Bridge
O Telegram delega a geração de resposta para o **renderer** — exatamente o mesmo caminho que o chat principal usa.

**Fluxo:**
1. Mensagem chega do Telegram → `telegram.ts` salva no banco (sessão pareada)
2. `telegram.ts` envia `telegram:process-message` ao renderer via `webContents.send()`
3. **App.tsx** escuta → pega histórico → chama `ados.llm.stream()` (mesmo stream do chat)
4. Stream completa → renderer chama `ados.telegram.replyFromSession(chatId, reply, sessionId)`
5. `telegram.ts` recebe → salva resposta → envia para Telegram

### Arquivos Modificados
- `electron/telegram.ts` — `handleAutoReply` emite para renderer
- `electron/preload.ts` — expõe `onProcessMessage` e `replyFromSession`
- `src/App.tsx` — listener global para `telegram:process-message`
- `electron/llm.ts` — `generateReplyViaLLM` exportada, condição `usingOAuth || isResponsesModel()`

---

## Pendente

- [ ] Sincronização bidirecional: mensagens do TG não atualizam visualmente o chat em tempo real
- [ ] Mensagens digitadas no chat não vão para o Telegram (caminho inverso)
- [ ] Transcrição de voz: key Google pode falhar com safeStorage
- [ ] Implementar versão Linux do JVOS
- [ ] Fluxo MCP: direcionar usuário para link de credenciais ao criar source

---

## Melhorias v3 — UX Premium (140 melhorias em 14 menus)

Implementadas 10 melhorias de UX premium em cada um dos 14 menus laterais do JVOS.
Todas compilando com 0 erros TypeScript. Build verificado.

### Resumo por menu:

| Menu | Destaques |
|------|-----------|
| Chat | Multi-select, animacao entrada, toast, export MD, onboarding |
| Settings | Breadcrumb, undo/redo, command palette, WCAG badge, templates |
| Tools | Drag conexoes, health grade A-F, workflow visualizer, shortcut overlay |
| Telegram | Status envio, reactions, avatars, unread badges, search |
| HealthCheck | Progress bar, trend chart, quick fix, sparklines, uptime badge |
| CloudSync | Progress ring, diff viewer, donut chart, timeline, bandwidth gauge |
| Labels | Color palette, undo/redo, command palette, sparklines, tree-view |
| Brain | Graph SVG, timeline, dedup panel, health dashboard, importance score |
| Sharing | Link preview, social share, strength meter, countdown, annotations |
| Marketplace | Bulk install, rating histogram, publisher profiles, saved filters |
| Automations | Cron builder, execution timeline, drag reorder, variable preview |
| Dashboards | Widget templates, threshold slider, milestone toast, metric comparison |
| Preferences | Theme preview, timezone live, notification matrix, import/export |
| Shortcuts | Recorder, category tabs, conflict checker, interactive tester |

### Tambem nesta sessao:
- MessageBubble: highlight de mentions (@skill, /workflow) com badge colorido
- MessageBubble: tipografia melhorada (14px, line-height 1.7, spacing premium)
