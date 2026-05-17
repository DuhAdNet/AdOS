import { useState, useEffect, useCallback, useRef } from 'react';

interface Shortcut {
  action: string;
  label: string;
  keys: string;
  category: 'navegacao' | 'edicao' | 'sistema';
  voiceCommand?: string;
  touchGesture?: string;
  usageCount?: number;
}

const SHORTCUTS: Shortcut[] = [
  { action: 'new-session', label: 'Nova Sessão', keys: 'Ctrl+N', category: 'navegacao', voiceCommand: '"Nova sessão"', touchGesture: 'Deslizar direita' },
  { action: 'search', label: 'Buscar', keys: 'Ctrl+K', category: 'navegacao', voiceCommand: '"Buscar"', touchGesture: 'Deslizar para baixo' },
  { action: 'settings', label: 'Configurações', keys: 'Ctrl+,', category: 'sistema', voiceCommand: '"Abrir configurações"', touchGesture: 'Toque longo no header' },
  { action: 'toggle-theme', label: 'Alternar Tema', keys: 'Ctrl+Shift+D', category: 'sistema', voiceCommand: '"Mudar tema"', touchGesture: 'Duplo toque no header' },
  { action: 'send-message', label: 'Enviar Mensagem', keys: 'Enter', category: 'edicao', voiceCommand: '"Enviar"', touchGesture: 'Toque no botão enviar' },
  { action: 'new-line', label: 'Nova Linha', keys: 'Shift+Enter', category: 'edicao', voiceCommand: '"Nova linha"', touchGesture: 'Toque no botão quebra' },
  { action: 'voice-input', label: 'Input por Voz', keys: 'Ctrl+Shift+V', category: 'edicao', voiceCommand: '"Ativar voz"', touchGesture: 'Toque longo no mic' },
  { action: 'close-session', label: 'Fechar Sessão', keys: 'Ctrl+W', category: 'navegacao', voiceCommand: '"Fechar sessão"', touchGesture: 'Deslizar esquerda' },
  { action: 'next-session', label: 'Próxima Sessão', keys: 'Ctrl+Tab', category: 'navegacao', voiceCommand: '"Próxima"', touchGesture: 'Deslizar esquerda na tab' },
  { action: 'prev-session', label: 'Sessão Anterior', keys: 'Ctrl+Shift+Tab', category: 'navegacao', voiceCommand: '"Anterior"', touchGesture: 'Deslizar direita na tab' },
];

// Known OS shortcuts that may conflict
const OS_CONFLICTS = ['Ctrl+W', 'Ctrl+N', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+T', 'Ctrl+Q'];

function getUsageStats(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem('ados_shortcut_usage') || '{}');
  } catch { return {}; }
}
function saveUsageStats(stats: Record<string, number>) {
  localStorage.setItem('ados_shortcut_usage', JSON.stringify(stats));
}

function getCustomBindings(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('ados_custom_shortcuts') || '{}');
  } catch { return {}; }
}
function saveCustomBindings(bindings: Record<string, string>) {
  localStorage.setItem('ados_custom_shortcuts', JSON.stringify(bindings));
}

export default function Shortcuts() {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'navegacao' | 'edicao' | 'sistema'>('all');
  const [recording, setRecording] = useState<string | null>(null);
  const [customBindings, setCustomBindings] = useState<Record<string, string>>(getCustomBindings());
  const [usageStats, setUsageStats] = useState<Record<string, number>>(getUsageStats());
  const [contextMode, setContextMode] = useState(false);
  const [testerResult, setTesterResult] = useState<string | null>(null);
  const [testerActive, setTesterActive] = useState(false);
  const testerRef = useRef<HTMLDivElement>(null);

  // Track global key presses for usage stats
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.key && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      const combo = parts.join('+');

      // If recording a shortcut
      if (recording && combo.length > 0 && parts.length > 1) {
        e.preventDefault();
        const updated = { ...customBindings, [recording]: combo };
        setCustomBindings(updated);
        saveCustomBindings(updated);
        setRecording(null);
        return;
      }

      // If tester is active
      if (testerActive) {
        e.preventDefault();
        const allShortcuts = SHORTCUTS.map(s => ({
          ...s,
          keys: customBindings[s.action] || s.keys,
        }));
        const match = allShortcuts.find(s => s.keys === combo);
        setTesterResult(match ? `${combo} → ${match.label}` : `${combo} → Nenhuma ação vinculada`);
        return;
      }

      // Track usage
      const allShortcuts = SHORTCUTS.map(s => ({
        ...s,
        keys: customBindings[s.action] || s.keys,
      }));
      const match = allShortcuts.find(s => s.keys === combo);
      if (match) {
        const stats = getUsageStats();
        stats[match.action] = (stats[match.action] || 0) + 1;
        setUsageStats({ ...stats });
        saveUsageStats(stats);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recording, testerActive, customBindings]);

  const getEffectiveKeys = (s: Shortcut) => customBindings[s.action] || s.keys;

  const filtered = SHORTCUTS.filter(s => {
    const matchesFilter = s.label.toLowerCase().includes(filter.toLowerCase()) ||
      getEffectiveKeys(s).toLowerCase().includes(filter.toLowerCase());
    const matchesTab = activeTab === 'all' || s.category === activeTab;
    return matchesFilter && matchesTab;
  });

  const totalForFilter = SHORTCUTS.filter(s => activeTab === 'all' || s.category === activeTab).length;

  const hasConflict = (keys: string) => OS_CONFLICTS.includes(keys);

  // Export cheatsheet
  const handleExportCheatsheet = () => {
    const lines = ['# JVOS — Atalhos de Teclado', ''];
    const categories = { navegacao: 'Navegação', edicao: 'Edição', sistema: 'Sistema' };
    for (const [cat, catLabel] of Object.entries(categories)) {
      lines.push(`## ${catLabel}`, '');
      SHORTCUTS.filter(s => s.category === cat).forEach(s => {
        lines.push(`- **${s.label}**: \`${getEffectiveKeys(s)}\``);
      });
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ados-shortcuts.md'; a.click();
    URL.revokeObjectURL(url);
  };

  // Usage chart data
  const usageChartData = SHORTCUTS
    .map(s => ({ label: s.label, count: usageStats[s.action] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxUsage = Math.max(...usageChartData.map(d => d.count), 1);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Atalhos de Teclado</h1>
        <p className="text-sm text-muted mt-1">Referência de shortcuts disponíveis no JVOS.</p>

        {/* Category tabs */}
        <div className="mt-4 flex items-center gap-2">
          {([
            { id: 'all', label: 'Todos' },
            { id: 'navegacao', label: 'Navegação' },
            { id: 'edicao', label: 'Edição' },
            { id: 'sistema', label: 'Sistema' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id ? 'bg-brand-600/10 text-brand-500' : 'text-muted hover:text-secondary hover:bg-surface-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setContextMode(!contextMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                contextMode ? 'bg-brand-600/10 text-brand-500' : 'text-muted hover:text-secondary hover:bg-surface-2'
              }`}
              title="Mostrar apenas atalhos da página ativa"
            >
              Contexto
            </button>
            <button
              onClick={handleExportCheatsheet}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-medium text-secondary transition-colors"
            >
              Exportar Cheatsheet
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-2 max-w-sm flex-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar atalhos..."
              className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none"
            />
          </div>
          {/* Match count display */}
          <span className="text-xs text-muted">
            {filtered.length} de {totalForFilter} encontrados
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl space-y-1">
          {filtered.map(s => {
            const effectiveKeys = getEffectiveKeys(s);
            const conflict = hasConflict(effectiveKeys);
            return (
              <div key={s.action} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-surface-1 transition-colors group">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary">{s.label}</span>
                    {conflict && (
                      <span className="text-[10px] bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded-full" title="Pode conflitar com atalho do sistema operacional">
                        Conflito OS
                      </span>
                    )}
                  </div>
                  {/* Accessibility: voice command */}
                  {s.voiceCommand && (
                    <span className="text-[10px] text-muted mt-0.5">Voz: {s.voiceCommand}</span>
                  )}
                  {/* Touch alternatives */}
                  {s.touchGesture && (
                    <span className="text-[10px] text-muted">Touch: {s.touchGesture}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2.5 py-1 bg-surface-2 border border-default rounded-lg text-xs font-mono text-secondary">
                    {effectiveKeys}
                  </kbd>
                  {/* Shortcut recorder button */}
                  <button
                    onClick={() => setRecording(recording === s.action ? null : s.action)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors opacity-0 group-hover:opacity-100 ${
                      recording === s.action
                        ? 'bg-red-500/10 text-red-500 animate-pulse'
                        : 'bg-surface-2 hover:bg-surface-3 text-muted'
                    }`}
                  >
                    {recording === s.action ? 'Pressione...' : 'Gravar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive tester */}
        <div className="max-w-2xl mt-6">
          <div
            ref={testerRef}
            className={`border rounded-xl p-4 transition-colors ${
              testerActive ? 'border-brand-500 bg-brand-500/5' : 'border-default bg-surface-1'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-primary">Testador Interativo</h3>
              <button
                onClick={() => { setTesterActive(!testerActive); setTesterResult(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  testerActive ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'
                }`}
              >
                {testerActive ? 'Desativar' : 'Ativar'}
              </button>
            </div>
            <p className="text-xs text-muted">
              {testerActive
                ? 'Pressione qualquer combinação de teclas para ver qual ação é disparada.'
                : 'Ative o testador para verificar combinações de teclas em tempo real.'}
            </p>
            {testerResult && (
              <div className="mt-2 px-3 py-2 bg-surface-0 border border-default rounded-lg text-sm text-primary font-mono">
                {testerResult}
              </div>
            )}
          </div>
        </div>

        {/* Usage frequency chart */}
        <div className="max-w-2xl mt-6">
          <div className="border border-default bg-surface-1 rounded-xl p-4">
            <h3 className="text-sm font-medium text-primary mb-3">Frequência de Uso</h3>
            {usageChartData.every(d => d.count === 0) ? (
              <p className="text-xs text-muted">Nenhum uso registrado ainda. Use atalhos para ver estatísticas.</p>
            ) : (
              <div className="space-y-2">
                {usageChartData.map(d => (
                  <div key={d.label} className="flex items-center gap-3">
                    <span className="text-xs text-secondary w-32 truncate">{d.label}</span>
                    <div className="flex-1 h-4 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500/60 rounded-full transition-all"
                        style={{ width: `${(d.count / maxUsage) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted w-6 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
