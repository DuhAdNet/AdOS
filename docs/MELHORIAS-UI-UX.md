# JVOS — 20 Melhorias de UI/UX

## Estado Atual
- Electron + React 19 + Tailwind CSS 3.4
- Tema dark por padrão com toggle manual
- Font: Inter (system fallback)
- Paleta brand: indigo (#6366f1)
- 15 páginas, NavRail colapsável, SessionPanel

---

## 1. Skeleton Loading States
**Problema:** "Carregando..." em texto puro. Tela fica em branco durante loads.
**Solução:** Componentes skeleton com animação pulse para SessionPanel, Tools, Brain.

## 2. Empty States com Ilustrações
**Problema:** "Nenhuma sessão encontrada" sem contexto visual ou CTA.
**Solução:** Cards com ícone, texto explicativo e botão de ação principal.

## 3. Micro-animações de Transição
**Problema:** Interface estática — cliques, trocas de aba, modais sem motion.
**Solução:** fade-in (mensagens), slide-up (modais), scale-pop (botões), rotate (loading).

## 4. Contraste de Cores Melhorado
**Problema:** Texto muted (#64748b) em surface escuro: ~4.5:1 (abaixo do AAA 7:1).
**Solução:** Aumentar luminosidade do muted em dark mode. Cor disabled separada.

## 5. Barra de Progresso para Operações Longas
**Problema:** Sem indicador visual durante execução de tools/agents.
**Solução:** Barra linear fixa no topo durante: tool execution, delegação, builds.

## 6. Status Badges Color-Coded
**Problema:** Status de conexões/automações em texto puro.
**Solução:** Círculos coloridos: verde=ativo, amarelo=pendente, vermelho=erro, cinza=inativo.

## 7. Breadcrumb Navigation
**Problema:** Settings tem 12 tabs mas sem indicador de contexto.
**Solução:** Breadcrumb: "Configurações > Aparência > Tema".

## 8. Responsividade Adaptativa
**Problema:** Larguras fixas (180px sidebar, 260px panel) quebram em telas menores.
**Solução:** Breakpoints: <1024px esconde panel, <768px hamburger menu.

## 9. Sistema de Toast/Notificações
**Problema:** Nenhum feedback visual para eventos do sistema.
**Solução:** Stack de toasts (top-right): success/error/warning/info, auto-dismiss 3-5s.

## 10. Validação Visual em Formulários
**Problema:** Erros em texto puro, sem bordas vermelhas ou ícones.
**Solução:** FormField component: borda vermelha, ícone (!), help text contextual.

## 11. Focus Indicators (Acessibilidade)
**Problema:** Sem ring de foco visível para navegação por teclado.
**Solução:** `focus-visible:ring-2 focus-visible:ring-brand-500` em todos os interativos.

## 12. Scrollbar Styling Aprimorado
**Problema:** Scrollbar 6px difícil de pegar, thumb se mistura com background.
**Solução:** 8px, thumb mais opaco, cantos arredondados.

## 13. Tooltips para Texto Truncado
**Problema:** Títulos cortados em SessionPanel sem hover reveal.
**Solução:** Tooltip custom que mostra texto completo on hover.

## 14. Card Component Consistente
**Problema:** Profundidade visual inconsistente entre páginas.
**Solução:** Card reutilizável: padding p-4, rounded-xl, shadow + hover lift.

## 15. Theme Transition Suave
**Problema:** Toggle dark/light muda instantâneamente (jarring).
**Solução:** Transition 300ms nas variáveis CSS de cor.

## 16. Disabled State Claro
**Problema:** Botões disabled parecem clicáveis.
**Solução:** opacity-50 + cursor-not-allowed + aria-disabled.

## 17. Spacing Scale Consistente
**Problema:** gap-1, gap-1.5, gap-2, gap-2.5 misturados sem padrão.
**Solução:** Definir escala: xs(4px), sm(8px), md(12px), lg(16px), xl(24px).

## 18. Error Boundary com Fallback UI
**Problema:** Crash = tela branca.
**Solução:** ErrorBoundary que mostra mensagem + botão Reiniciar + Report.

## 19. Dashboard Empty/Placeholder States
**Problema:** Dashboard vazio parece quebrado.
**Solução:** Placeholder com "Adicione widgets" + sugestões da IA.

## 20. Design Tokens Centralizados
**Problema:** Cores e espaçamentos espalhados em 15+ arquivos.
**Solução:** Arquivo único `tokens.ts` com referência: cores, shadows, radius, motion.

---

## Priorização

| Prioridade | Melhorias | Esforço |
|-----------|-----------|---------|
| P0 (Quick Win) | 3, 4, 11, 12, 15, 16 | 30min cada |
| P1 (Componente) | 1, 9, 14, 18 | 2-4h cada |
| P2 (Feature) | 2, 5, 6, 10, 13 | 4-8h cada |
| P3 (Arquitetural) | 7, 8, 17, 19, 20 | 1-2 dias cada |

---

*Documento gerado em 17 de maio de 2026 — JVOS UI/UX Roadmap*
