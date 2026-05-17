# 1. Sessões (Chat)

## Descrição
Tela principal do JVOS — onde o usuário conversa com a IA. Suporta streaming multi-provider, tool calling, multi-agent routing, fila de mensagens, compactação de contexto, navegador integrado, anexos de arquivo (incluindo imagens com visão) e voice input.

## Estrutura de Estado
| Estado | Tipo | Função |
|--------|------|--------|
| messages | Message[] | Histórico da conversa |
| input | string | Texto digitado |
| loading | boolean | Stream LLM em andamento |
| streamContent | string | Texto acumulado do stream |
| toolSteps | Array | Passos de tool execution |
| selectedModel | string | Modelo ativo |
| effortLevel | 'low'/'medium'/'high' | Tier de velocidade/qualidade |
| reasoningLevel | 'none'/'medium'/'max' | Nível de raciocínio |
| routingEnabled | boolean | Multi-agent ativo |
| connectedTools | number | Tools MCP conectadas |
| attachments | Array<{name, content, type?, mimeType?}> | Arquivos/imagens anexados |
| messageQueue | string[] | Fila de mensagens pendentes |
| compactedContextRef | ref<string> | Contexto compactado (sem deletar msgs) |
| tokenEstimate | {contextTokens, cost} | Estimativa de uso do contexto |
| browserSessionId | string | ID do browser ativo |

## UI Layout
- **Welcome Screen**: Sugestões rápidas (reunião 1:1, plano estratégico, analisar métricas)
- **Message List**: Bolhas user/assistant com markdown rendered
- **Tool Steps**: Indicador de progresso com nome da tool + duração
- **Input Bar**: Botão anexo, textarea com drag-drop, voice input, send/stop/enqueue
- **Queue Panel**: Mensagens enfileiradas com controles (editar, remover, reordenar, enviar, limpar)
- **Bottom Bar (esquerda)**: Seletor de modo, Multi-Agent toggle, Compactar
- **Bottom Bar (direita)**: Indicador de contexto (círculo), custo, ferramentas, botão navegador
- **Mode Popup**: 3 tiers (Fast/Balanced/Smart)
- **Reasoning Popup**: 3 níveis (Sem/Raciocínio/Máximo)

## Submenus e Controles

---

### A. Seletor de Modo (Fast / Balanced / Smart)

**Estado atual:**
- 3 opções em popup, cada uma define modelo + maxTokens + temperature
- Persiste por sessão via `db.setSessionSetting`

| Tier | Modelo | maxTokens | Temp |
|------|--------|-----------|------|
| Fast | gpt-4.1-nano | 512 | 0.3 |
| Balanced | gpt-4.1-mini | 2048 | 0.5 |
| Smart | gpt-4.1 | 16000 | 0.7 |

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Mostrar modelo ativo ao lado do label (ex: "Smart · gpt-4.1") | ✅ |
| 2 | Atalho de teclado por tier (Ctrl+1/2/3) | ✅ |
| 3 | Permitir configurar qual modelo cada tier usa (Settings > Modelos) | ✅ |
| 4 | Indicador visual de custo relativo ($/$$/$$$) por tier | ✅ |
| 5 | Auto-switch para Smart quando detecta complexidade na mensagem | ✅ |
| 6 | Tooltip com tempo médio de resposta estimado por tier | ✅ |
| 7 | Badge "recomendado" no Balanced para novos usuários | ✅ |

---

### B. Seletor de Raciocínio

**Estado atual:**
- 3 níveis em popup separado
- Quando ativo, sobrescreve o modelo do tier com o3 ou o4-mini
- Persiste por sessão

| Nível | Modelo | Descrição |
|-------|--------|-----------|
| Sem raciocínio | (usa tier) | Respostas rápidas |
| Raciocínio | o4-mini | Equilíbrio |
| Raciocínio máximo | o3 | Profundo |

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Toggle rápido com 1 click (none→medium→max→none) | ✅ |
| 2 | Indicador na mensagem de resposta que usou raciocínio | ✅ |
| 3 | Atalho de teclado (Ctrl+R) para toggle | ✅ |
| 4 | Mostrar "thinking tokens" consumidos no indicador de contexto | ✅ |
| 5 | Sugerir raciocínio quando detecta pergunta complexa | ✅ |
| 6 | Warning quando raciocínio + contexto cheio pode falhar | ✅ |
| 7 | Ícone com glow/animação quando raciocínio está ativo | ✅ |

---

### C. Multi-Agent Toggle

**Estado atual:**
- Botão on/off no footer esquerdo
- Quando ativo, roteia tarefas para modelos especializados via `agents.route()`
- Persiste globalmente

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Log visual de roteamento inline ("Roteado para Claude Sonnet") | ✅ |
| 2 | Popup mostrando quais agentes estão disponíveis e seus modelos | ✅ |
| 3 | Badge com contagem de sub-tarefas executadas na mensagem | ✅ |
| 4 | Permitir forçar agente específico via prefixo (@agent) | ✅ |
| 5 | Fallback visual quando um agente falha (badge de erro + retry) | ✅ |
| 6 | Auto-disable quando só tem 1 provider configurado | ✅ |
| 7 | Indicador de latência por agente no popup | ✅ |

---

### D. Botão Compactar

**Estado atual:**
- Aparece quando `messages.length > 20`
- Envia mensagens antigas para LLM resumir
- Salva resumo em `compactedContextRef` (ref, não deleta mensagens visíveis)
- Contexto compactado é usado como "system" nas próximas chamadas

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Compactação automática ao atingir 70% do contexto | ✅ |
| 2 | Mostrar quanto contexto foi liberado após compactar (feedback visual) | ✅ |
| 3 | Preview do resumo antes de confirmar | ✅ |
| 4 | Notificação quando contexto está quase cheio sugerindo compactar | ✅ |
| 5 | Undo de compactação (manter backup do contexto anterior) | ✅ |
| 6 | Animação de progress bar durante compactação | ✅ |
| 7 | Badge mostrando quantas vezes já foi compactado na sessão | ✅ |

---

### E. Indicador de Contexto (Círculo)

**Estado atual:**
- Círculo SVG no footer direito com % dentro
- Base: 128K tokens (hardcoded)
- Cores: verde (<50%), amarelo (50-80%), vermelho (>80%)
- Tooltip com contagem absoluta de tokens

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Click abre breakdown detalhado (msgs, system, tools, compacted) | ✅ |
| 2 | MAX_CONTEXT dinâmico baseado no modelo ativo (128K, 200K, 1M) | ✅ |
| 3 | Alarme visual (pulse/glow) quando passa de 80% | ✅ |
| 4 | Projeção ("em ~4 msgs atinge 100%") no tooltip | ✅ |
| 5 | Reset visual com animação ao compactar | ✅ |
| 6 | Mostrar custo acumulado da sessão no tooltip | ✅ |
| 7 | Distinguir tokens de input vs output no breakdown | ✅ |

---

### F. Navegador Integrado

**Estado atual:**
- BrowserWindow Electron independente por sessão (Map<sessionId, BrowserWindow>) — sem `parent` para evitar bug Windows de janela inclicável
- Abre via botão globo no footer ou via tool call
- Minimizar = hide (skipTaskbar: false, aparece na taskbar)
- Pill na title bar para restaurar
- Suporta: navigate, back, forward, reload, screenshot, executeJS, resize, PiP

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Barra de endereço editável na janela do browser | ✅ |
| 2 | Captura de screenshot com 1 click e inserção no chat como imagem | ✅ |
| 3 | Highlight/selecionar texto no browser e enviar como contexto ao chat | ✅ |
| 4 | Histórico de URLs visitadas por sessão (acessível no tooltip do pill) | ✅ |
| 5 | Bookmarks rápidos (sites frequentes configuráveis) | ✅ |
| 6 | Picture-in-picture mode (janela menor sempre-no-topo) | ✅ |
| 7 | Cookie/session persistence entre reaberturas da mesma sessão | ✅ |

---

### G. Fila de Mensagens

**Estado atual:**
- Mensagens enviadas durante processamento são enfileiradas
- Auto-envia quando stream termina
- Controles: enviar agora (pular), mover cima/baixo, editar (confirm/cancel), remover, limpar tudo
- Placeholder: "Digite para enfileirar (Enter para adicionar à fila)..."

**7 Melhorias selecionadas:**

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Drag & drop para reordenar itens na fila | ✅ |
| 2 | Estimativa de quando cada mensagem será processada | ✅ |
| 3 | Persistir fila entre reloads (salvar no DB da sessão) | ✅ |
| 4 | Merge de mensagens adjacentes em uma só (botão) | ✅ |
| 5 | Atalho Ctrl+E para editar último item da fila | ✅ |
| 6 | Modo "burst" — enviar todas como contexto único | ✅ |
| 7 | Cancelar processamento atual e avançar para próxima da fila | ✅ |

---

## Chamadas IPC
```
ados.db.getMessages(), addMessage(), getSessionSetting(), setSessionSetting()
ados.providers.listModels(), getDefaultModel()
ados.mcp.listServers(), getAllTools()
ados.agents.getRouting(), setRouting(), route(), get()
ados.llm.stream(), stop(), onStreamChunk(), onStreamEnd(), onStreamError(), onToolCall()
ados.browser.open(), show(), hide(), close(), navigate(), screenshot(), executeJs()
```

## Fluxo de Dados
1. Usuário digita → `input` state
2. Se loading: → `messageQueue.push()` (enfileira)
3. Se livre: Send → `addMessage()` → `llm.stream()` → SSE chunks → `streamContent`
4. Tool calls interceptadas → `onToolCall()` → executa → retorna → continua stream
5. Stream end → verifica fila → auto-envia próxima → loop
6. Multi-agent: `agents.route(input)` → seleciona bot → injeta system prompt → stream
7. Compactação: mensagens antigas → LLM resume → salva em ref → próximas chamadas incluem resumo

---

## Melhorias Gerais Já Implementadas

| # | Melhoria | Status |
|---|----------|--------|
| 1 | Loading skeleton ao carregar mensagens | ✅ |
| 2 | Botão de retry em caso de erro | ✅ |
| 3 | Feedback visual de anexo grande (progress + limite 10MB) | ✅ |
| 4 | Indicador de token/custo estimado por sessão | ✅ |
| 5 | Atalho Esc para cancelar stream | ✅ |
| 6 | Debounce no model selector | ✅ |
| 7 | Limit no acumulador de stream (200K chars) | ✅ |
| 8 | Cleanup de listeners na troca de sessão | ✅ |
| 9 | Persistir tool steps em crash | ✅ |
| 10 | Validação de modelo antes do stream | ✅ |
| 11 | Fila de mensagens com queue controls | ✅ |
| 12 | Compactação sem deletar histórico visível | ✅ |
| 13 | Indicador circular de contexto por sessão | ✅ |
| 14 | Suporte a imagens/visão multimodal (Anthropic, OpenAI, Google) | ✅ |
| 15 | Navegador integrado multi-sessão com hide/show | ✅ |
| 16 | Menu unificado 3 tiers (sem modelo exposto) | ✅ |
| 17 | Raciocínio separado como opção independente | ✅ |
| 18 | Limite de tool iterations aumentado para 30 | ✅ |
| 19 | Configuração de modelos customizados por sessão (override do default em Settings) | ✅ |
| 20 | Thinking tokens — exibir tokens de raciocínio colapsáveis abaixo da resposta | ✅ |
| 21 | Barra de endereço editável na janela do browser integrado | ✅ |
| 22 | Bookmarks rápidos no browser (sites frequentes configuráveis) | ✅ |
| 23 | Mensagens favoritas — marcar mensagens importantes com star para busca rápida | ✅ |
| 24 | Template de prompt — botão para inserir templates pré-salvos no input | ✅ |
| 25 | Split view — visualizar duas sessões lado a lado na mesma janela | ✅ |
| 26 | Exportar sessão como PDF — gerar documento formatado com todas as mensagens e outputs | ✅ |
| 27 | Chat persiste ao navegar menus — usa `className="hidden"` em vez de unmount condicional | ✅ |
| 28 | Voice transcription multi-provider — fallback Groq → OpenAI → Google Gemini via net.fetch | ✅ |
| 29 | Browser sem parent window — evita bug Windows de janela inclicável após hide | ✅ |
| 30 | Citação de mensagem — clicar em mensagem anterior insere como quote no input para responder com contexto | ✅ |
| 31 | Resposta parcial salva — se o app fechar durante stream, recuperar o texto já recebido ao reabrir | ✅ |
| 32 | Busca no histórico — Ctrl+F para buscar texto em todas as mensagens da sessão | ✅ |
| 33 | Copiar bloco de código — botão de cópia em cada code fence com feedback visual | ✅ |
| 34 | Reenviar mensagem — botão para reenviar a última mensagem do usuário com um clique | ✅ |
| 35 | Branching — criar ramificação a partir de qualquer mensagem (fork da conversa) | ✅ |
| 36 | Scroll automático inteligente — pausar auto-scroll quando user scrolla para cima; botão "Ir ao fim" | ✅ |
| 37 | Drag-and-drop múltiplos arquivos — suportar vários arquivos de uma vez como anexo | ✅ |
| 38 | Token counter live — mostrar estimativa de tokens do input enquanto digita | ✅ |
| 39 | Pin de mensagem — fixar mensagens importantes no topo da sessão | ✅ |
| 40 | Sugestões de follow-up — IA sugere 3 perguntas relacionadas após cada resposta | ✅ |
| 41 | Diff view — quando IA edita código, mostrar diff colorido antes/depois | ✅ |

---

## Melhorias v3 — UX Premium (2026-05-17)

| # | Melhoria | Descrição | Status |
|---|----------|-----------|--------|
| 42 | Seleção múltipla de mensagens | Modo multi-select com checkboxes + toolbar flutuante (Delete/Export/Pin) | ✅ |
| 43 | Animação de entrada de mensagem | Fade-in + slide-up com @keyframes fadeSlideIn | ✅ |
| 44 | Typing indicator aprimorado | Dots animados antes do streaming começar | ✅ |
| 45 | Toast de cópia | Feedback visual "✓ Copiado!" fixo no bottom-center por 2s | ✅ |
| 46 | Modal de atalhos (Ctrl+/) | Overlay com grid de todos os atalhos disponíveis | ✅ |
| 47 | Welcome state melhorado | Animação pulse no ícone + "Dicas rápidas" colapsável | ✅ |
| 48 | Timestamp por mensagem | Hora exata (HH:MM) visível no hover de cada mensagem | ✅ |
| 49 | Context badge pulsante | Pulsa vermelho + tooltip "Considere compactar" quando >75% | ✅ |
| 50 | Exportar conversa | Botão download MD com todas as mensagens formatadas | ✅ |
| 51 | Tooltips de onboarding | Dicas de primeiro uso (reasoning, queue, context) via localStorage | ✅ |
