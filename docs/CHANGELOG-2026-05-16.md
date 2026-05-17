# JVOS — Changelog 16/05/2026

## Resumo da Sessão

Sessão intensiva de implementação: **88 novas features** implementadas nos 11 menus do sistema (segunda rodada), além de correções de bugs e melhorias pontuais.

---

## 1. Segunda Rodada de Melhorias (88 features — 8 por menu)

### Tools.tsx (Ferramentas) — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Duplicar skill | Botão "Duplicar" cria cópia com sufixo "(cópia)" |
| 20 | Ordenação de conexões | Dropdown para ordenar MCP servers por nome/status/data |
| 21 | Webhook de eventos | Campo URL por skill; envia POST com resultado ao executar |
| 22 | Uso por skill | Contador de execuções exibido como badge "N usos" |
| 23 | OAuth refresh automático | Detecta token expirado e mostra botão "Renovar" |
| 24 | Multi-select bulk delete | Checkbox para selecionar múltiplas skills e excluir em lote |
| 25 | Preview de instrução hover | Tooltip com primeiras 100 chars da instrução |
| 26 | Indicador de saúde | Dot verde/amarelo/vermelho baseado em latência |

### Automations.tsx (Automações) — Melhorias #27-34
| # | Feature | Descrição |
|---|---------|-----------|
| 27 | Tags/categorias | Campo de tags + filtro por tag na lista |
| 28 | Logs expandidos | Clicar em entrada expande input/output/duração/erro |
| 29 | Prioridade de execução | Campo priority (1-5); fila executa por prioridade |
| 30 | Pause por tag | Pausar todas automações de uma tag de uma vez |
| 31 | Janela de execução | Horário permitido (ex: 9h-18h) por automação |
| 32 | Estatísticas globais | Card com total execuções, taxa sucesso, tempo médio |
| 33 | Notificação falha consecutiva | Alerta quando automação falha N vezes seguidas |
| 34 | Clone para workspace | Exportar automação como JSON para importar |

### Marketplace.tsx — Melhorias #21-28
| # | Feature | Descrição |
|---|---------|-----------|
| 21 | Collections temáticas | Coleções curadas (Produtividade, DevOps...) com filtro |
| 22 | Badge de popularidade | Badge "Popular" em items com >100 downloads |
| 23 | Notas de release | Release notes por versão, expandível |
| 24 | Desinstalação com limpeza | Oferecer remover configs/dados ao desinstalar |
| 25 | Skill favorita | Botão coração + filtro "Favoritos" |
| 26 | Modo compacto/lista | Toggle entre grid e lista compacta |
| 27 | Ordenação customizável | Dropdown: nome, data, downloads, rating, atualização |
| 28 | Relatório de uso mensal | Card com items instalados, atualizações, espaço |

### Brain.tsx — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Busca semântica | Fuzzy match no conteúdo das memórias |
| 20 | Templates de memória | Presets (Decisão, Aprendizado, Contato, Processo) |
| 21 | Quota visual | Barra de progresso uso vs. limite |
| 22 | Snapshot periódico | Backup timestamped do brain em localStorage |
| 23 | Ordenação | Dropdown: data, última edição, relevância, alfabético |
| 24 | Markdown no conteúdo | Renderização de bold, italic, code, links |
| 25 | Categorias customizáveis | Criar categorias próprias com nome e cor |
| 26 | Métricas do brain | Total memórias, distribuição, mais acessada |

### Telegram.tsx — Melhorias #22-29
| # | Feature | Descrição |
|---|---------|-----------|
| 22 | Inline commands | "/" mostra lista com autocomplete |
| 23 | Métricas de conversa | Total enviadas/recebidas, tempo médio resposta |
| 24 | Pinned messages | Fixar mensagens + seção "Fixadas" |
| 25 | Formatação avançada | Toolbar bold/italic/code/link |
| 26 | Status conexão detalhado | Latência, uptime, último erro |
| 27 | Grupos/canais | Filtro por tipo (Privado/Grupo/Canal) |
| 28 | Histórico paginado | Botão "Carregar mais" com paginação |
| 29 | Atalhos de teclado | Ctrl+Enter, Ctrl+Shift+P, Ctrl+/ |

### Labels.tsx — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Busca sessões por label | Clicar mostra sessões com a label |
| 20 | Label groups | Agrupar labels com collapse/expand |
| 21 | Ações automáticas | Ação ao aplicar label (notificar, mover, arquivar) |
| 22 | Cores acessibilidade | Validação contraste WCAG em tempo real |
| 23 | Histórico alterações | Log de mudanças com timestamp |
| 24 | Contagem tempo real | Atualiza a cada 30s via setInterval |
| 25 | Favoritar labels | Star; favoritas aparecem primeiro |
| 26 | Regras condicionais | Auto-label com condições AND/OR |

### Sharing.tsx (Compartilhar) — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Embed iframe | Snippet HTML para embedar em wikis/sites |
| 20 | Notificação de acesso | Alertar primeiro acesso à sessão |
| 21 | Compartilhar parcial | Selecionar range de mensagens |
| 22 | Histórico compartilhamentos | Log de publicações/revogações |
| 23 | Agendamento publicação | Date+time picker para publicar depois |
| 24 | Watermark | Marca d'água com nome do destinatário |
| 25 | Download HTML | Exportar como HTML standalone |
| 26 | Limite visualizações | Expirar após N views |

### Dashboards.tsx — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Import/Export | JSON para clipboard |
| 20 | Drill-down | Clicar métrica abre tabela de dados |
| 21 | Widget nota | Tipo "note" com textarea markdown |
| 22 | Duplicar dashboard | Clonar com todos widgets |
| 23 | Dashboard favorito | Star; favoritos primeiro nas abas |
| 24 | Sparkline | Últimos 30 pontos como mini-gráfico SVG |
| 25 | Modo apresentação | Fullscreen sem controles de edição |
| 26 | Cores por widget | Personalizar cor individual |

### HealthCheck.tsx — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Verificação updates | Check de nova versão disponível |
| 20 | Check SSL | Verificar validade de certificados MCP |
| 21 | Relatório comparativo | Diff lado a lado com anterior |
| 22 | Peso por check | Crítico vs. informativo (badge toggle) |
| 23 | Compartilhar relatório | Copiar resultado formatado para clipboard |
| 24 | Check permissões FS | Verificar acesso leitura/escrita nos paths |
| 25 | Tempo total diagnóstico | Exibir duração em ms |
| 26 | Health score numérico | Nota 0-100 baseada em peso dos checks |

### CloudSync.tsx — Melhorias #19-26
| # | Feature | Descrição |
|---|---------|-----------|
| 19 | Histórico versões | Visualizar snapshots com opção restore |
| 20 | Sync via QR code | QR ASCII para parear outro dispositivo |
| 21 | Métricas de sync | Total MB, frequência média, tempo médio |
| 22 | Exportar backup local | Download JSON completo via blob URL |
| 23 | Conflitos pendentes | Lista com ação por item |
| 24 | Sync Wi-Fi only | Bloquear em conexões metered |
| 25 | Validação endpoint | Testar antes de salvar |
| 26 | Progresso por categoria | % por tipo (sessões, labels, skills) |

### Settings.tsx — Melhorias #20-27
| # | Feature | Descrição |
|---|---------|-----------|
| 20 | Validação acessibilidade tema | Contraste WCAG com alerta |
| 21 | Sync cross-device | Export/import via cloud sync endpoint |
| 22 | Categorização permissions | Agrupar por contexto (file/network/system) |
| 23 | Changelog settings | Log de alterações com valor anterior/novo |
| 24 | Teste com prompt custom | Input real ao invés de ping |
| 25 | Lock settings sensíveis | Confirmação de senha para API keys/MCP |
| 26 | Wizard configuração | 4 steps para novos usuários |
| 27 | Tema OLED | Preto puro (#000) para AMOLED |

---

## 2. Correções de Bugs

### Telegram — Polling não recebia mensagens
- **Causa:** Polling não iniciava automaticamente ao abrir o app (dependia de ação manual)
- **Causa 2:** `getChats` consumia updates com `offset: 0`, causando perda de mensagens
- **Fix:** Auto-start polling no boot + `deleteWebhook` preventivo + `getChats` agora usa DB

### Telegram — Sistema de pareamento por código
- **Implementação:** Fluxo novo tipo G4 OS — gera código 6 dígitos no JVOS, usuário envia `/pair CÓDIGO` no Telegram
- **Backend:** `pendingPairCodes` map com TTL 5min, comando `/pair` no bot, IPC `generate-pair-code`
- **Frontend:** Card com digits estilizados, countdown, botão "Copiar comando", feedback de sucesso

### Chat — Imagens não mostravam thumbnail
- **Causa:** `displayContent` só salvava texto "📎 nome.png" sem base64
- **Fix:** Salvar como markdown image `![nome](data:...)` + renderizar `<img>` no MessageBubble
- **Tamanho:** Thumbnail compacta 120×80px (como G4 OS)

### Electron — "Cannot find module main.js"
- **Causa:** Build do TypeScript executava do working directory errado
- **Fix:** Recompilar com `tsc -p electron/tsconfig.json` do diretório correto

---

## 3. Melhorias Visuais

### Ícone do Brain na NavRail
- **Antes:** SVG genérico parecendo cubo/escudo
- **Depois:** Ícone de lâmpada/mente mais reconhecível em tamanho pequeno

---

## Métricas Finais

| Métrica | Valor |
|---------|-------|
| Features implementadas (2ª rodada) | 88 |
| Features totais acumuladas (todas rodadas) | 377 ✅ |
| Arquivos de página modificados | 11 |
| Arquivos backend modificados | 2 (telegram.ts, preload.ts) |
| Componentes modificados | 2 (NavRail.tsx, MessageBubble.tsx) |
| Build Vite | ✅ Sem erros |
| Build TypeScript (frontend) | ✅ (1 erro pré-existente em Chat.tsx) |
| Build Electron (backend) | ✅ Sem erros |

---

## Stack Técnica

- Electron 33 + React 19 + TypeScript 5.7 + Tailwind CSS 3.4 + Vite 6.4
- Padrão: single-file pages, hooks, IPC via `ados.*`, localStorage para persistência secundária
- Build: `npx vite build` (frontend) + `npx tsc -p electron/tsconfig.json` (backend)
