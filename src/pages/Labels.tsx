import { useState, useEffect, useRef, useCallback } from 'react';

const ados = (window as any).ados;

interface Label {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  autoPattern: string | null;
  expiresAt?: string | null;
  gradient?: string | null;
  icon?: string | null;
  archived?: boolean;
  skillTrigger?: string | null;
  autoArchiveDays?: number | null;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

// Improvement 1: Categorized color palette with swatches
const COLOR_PALETTE = {
  'Básicas': [
    { hex: '#ef4444', name: 'Vermelho' },
    { hex: '#f97316', name: 'Laranja' },
    { hex: '#f59e0b', name: 'Âmbar' },
    { hex: '#10b981', name: 'Esmeralda' },
    { hex: '#3b82f6', name: 'Azul' },
    { hex: '#6366f1', name: 'Índigo' },
    { hex: '#8b5cf6', name: 'Violeta' },
    { hex: '#6b7280', name: 'Cinza' },
  ],
  'Pastéis': [
    { hex: '#fca5a5', name: 'Rosa claro' },
    { hex: '#fdba74', name: 'Pêssego' },
    { hex: '#fde047', name: 'Limão' },
    { hex: '#86efac', name: 'Menta' },
    { hex: '#93c5fd', name: 'Celeste' },
    { hex: '#c4b5fd', name: 'Lavanda' },
    { hex: '#f9a8d4', name: 'Pink' },
    { hex: '#a5b4fc', name: 'Periwinkle' },
  ],
  'Vibrantes': [
    { hex: '#dc2626', name: 'Rubi' },
    { hex: '#ea580c', name: 'Tangerina' },
    { hex: '#ca8a04', name: 'Ouro' },
    { hex: '#059669', name: 'Jade' },
    { hex: '#2563eb', name: 'Royal' },
    { hex: '#7c3aed', name: 'Uva' },
    { hex: '#db2777', name: 'Magenta' },
    { hex: '#0891b2', name: 'Teal' },
  ],
};

const LABEL_TEMPLATES: Record<string, { name: string; color: string }[]> = {
  'Projetos': [
    { name: 'Ativo', color: '#10b981' },
    { name: 'Concluído', color: '#3b82f6' },
    { name: 'Arquivado', color: '#6b7280' },
  ],
  'Prioridades': [
    { name: 'Alta', color: '#ef4444' },
    { name: 'Média', color: '#f59e0b' },
    { name: 'Baixa', color: '#10b981' },
  ],
  'Status': [
    { name: 'To Do', color: '#6366f1' },
    { name: 'Em Progresso', color: '#f59e0b' },
    { name: 'Done', color: '#10b981' },
  ],
};

// Feature: Accessibility color contrast validation (WCAG AA)
function getRelativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkWCAGContrast(color: string): { passes: boolean; ratio: number; level: string } {
  const white = '#ffffff';
  const dark = '#1a1a2e';
  const ratioOnWhite = getContrastRatio(color, white);
  const ratioOnDark = getContrastRatio(color, dark);
  const bestRatio = Math.max(ratioOnWhite, ratioOnDark);
  if (bestRatio >= 7) return { passes: true, ratio: bestRatio, level: 'AAA' };
  if (bestRatio >= 4.5) return { passes: true, ratio: bestRatio, level: 'AA' };
  if (bestRatio >= 3) return { passes: false, ratio: bestRatio, level: 'AA Large' };
  return { passes: false, ratio: bestRatio, level: 'Falha' };
}

// Feature: Label change history entry
interface LabelChangeEntry {
  id: string;
  labelId: string;
  labelName: string;
  action: 'rename' | 'recolor' | 'delete' | 'create' | 'favorite' | 'unfavorite';
  details: string;
  timestamp: string;
}

// Feature: Label group
interface LabelGroup {
  id: string;
  name: string;
  labelIds: string[];
  collapsed: boolean;
}

// Feature: Automatic actions
interface LabelAction {
  labelId: string;
  type: 'move_folder' | 'notify' | 'auto_archive';
  config: string;
}

// Feature: Conditional rules
interface ConditionalRule {
  id: string;
  labelId: string;
  conditions: { pattern: string; operator: 'AND' | 'OR' }[];
}

function validateRegex(pattern: string): { valid: boolean; error: string } {
  if (!pattern.trim()) return { valid: true, error: '' };
  try {
    const re = new RegExp(pattern);
    const start = performance.now();
    re.test('a'.repeat(100));
    if (performance.now() - start > 100) return { valid: false, error: 'Pattern muito lento (possível ReDoS)' };
    return { valid: true, error: '' };
  } catch (e: any) {
    return { valid: false, error: e.message || 'Regex inválida' };
  }
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[\s\-]/g, '');
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Labels() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [autoPattern, setAutoPattern] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [regexStatus, setRegexStatus] = useState<{ valid: boolean; error: string }>({ valid: true, error: '' });
  const [nameError, setNameError] = useState('');
  const [nameSimilarWarning, setNameSimilarWarning] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [labelUsage, setLabelUsage] = useState<Record<string, number>>({});
  const [patternMatches, setPatternMatches] = useState<string[]>([]);
  const [patternMatchCount, setPatternMatchCount] = useState(0);
  const [allSessions, setAllSessions] = useState<Array<{ id: string; title: string; labels?: string[] }>>([]);
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState('#6366f1');
  const [dragId, setDragId] = useState<string | null>(null);
  const [batchApplying, setBatchApplying] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState(0);
  const [parentLabel, setParentLabel] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  // Feature 1: Merge
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSurvivor, setMergeSurvivor] = useState<string | null>(null);
  // Feature 3: Templates
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  // Feature 4: Import/Export
  const [importExportMsg, setImportExportMsg] = useState('');
  // Feature 5: Trend
  const [trendData, setTrendData] = useState<Record<string, number>>({});
  // Feature 6: Undo drag-drop
  const previousOrderRef = useRef<Label[] | null>(null);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<any>(null);
  // Feature 8: Expiration
  const [expiresAt, setExpiresAt] = useState('');

  // NEW Feature 1: Busca de sessões por label
  const [viewingLabelSessions, setViewingLabelSessions] = useState<string | null>(null);
  const [labelSessions, setLabelSessions] = useState<Array<{ id: string; title: string }>>([]);

  // NEW Feature 2: Label groups
  const [labelGroups, setLabelGroups] = useState<LabelGroup[]>(() => {
    try { return JSON.parse(localStorage.getItem('label-groups') || '[]'); } catch { return []; }
  });
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupAssignLabel, setGroupAssignLabel] = useState<string | null>(null);

  // NEW Feature 3: Ações automáticas por label
  const [labelActions, setLabelActions] = useState<LabelAction[]>(() => {
    try { return JSON.parse(localStorage.getItem('label-actions') || '[]'); } catch { return []; }
  });
  const [showActionsModal, setShowActionsModal] = useState<string | null>(null);
  const [newActionType, setNewActionType] = useState<'move_folder' | 'notify' | 'auto_archive'>('notify');
  const [newActionConfig, setNewActionConfig] = useState('');

  // NEW Feature 4: Cores de acessibilidade
  const [colorContrastWarning, setColorContrastWarning] = useState<{ passes: boolean; ratio: number; level: string } | null>(null);

  // NEW Feature 5: Histórico de alterações
  const [changeHistory, setChangeHistory] = useState<LabelChangeEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('label-change-history') || '[]'); } catch { return []; }
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // NEW Feature 6: Contagem em tempo real (30s interval)
  const countIntervalRef = useRef<any>(null);

  // NEW Feature 7: Favoritar labels
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('label-favorites') || '[]')); } catch { return new Set(); }
  });

  // NEW Feature 8: Regras condicionais
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>(() => {
    try { return JSON.parse(localStorage.getItem('label-conditional-rules') || '[]'); } catch { return []; }
  });
  const [showRulesModal, setShowRulesModal] = useState<string | null>(null);
  const [ruleConditions, setRuleConditions] = useState<{ pattern: string; operator: 'AND' | 'OR' }[]>([{ pattern: '', operator: 'AND' }]);

  // Feature 28: Filtro combinado (AND/OR)
  const [filterMode, setFilterMode] = useState<'off' | 'AND' | 'OR'>('off');
  const [filterLabelIds, setFilterLabelIds] = useState<Set<string>>(new Set());
  const [filteredSessions, setFilteredSessions] = useState<Array<{ id: string; title: string }>>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Feature 29: Labels automáticas por skill
  const [skillTrigger, setSkillTrigger] = useState('');

  // Feature 30: Cor por gradiente
  const [useGradient, setUseGradient] = useState(false);
  const [gradientColor2, setGradientColor2] = useState('#3b82f6');

  // Feature 31: Ícone por label
  const [labelIcon, setLabelIcon] = useState('');

  // Feature 32: Estatísticas temporais modal
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsHistory, setStatsHistory] = useState<Record<string, Record<string, number>>>({});

  // Feature 33: Sugestão de label
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ sessionId: string; title: string; suggestedLabel: string; confidence: number }>>([]);

  // Feature 34: Arquivar label
  const [showArchived, setShowArchived] = useState(false);

  // Feature 37: Atalho de teclado
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [labelShortcuts, setLabelShortcuts] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('label-shortcuts') || '{}'); } catch { return {}; }
  });
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);

  // Feature 38: Auto-archive days
  const [autoArchiveDays, setAutoArchiveDays] = useState<number>(0);

  // Improvement 2: Drag visual feedback - insertion line
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below'>('below');

  // Improvement 4: Usage analytics sparkline data (last 7 days)
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>({});

  // Improvement 5: Bulk rename/delete multi-select
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkRename, setShowBulkRename] = useState(false);
  const [bulkRenamePrefix, setBulkRenamePrefix] = useState('');

  // Improvement 8: Template editor
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateLabelIds, setNewTemplateLabelIds] = useState<Set<string>>(new Set());
  const [customTemplates, setCustomTemplates] = useState<Array<{ name: string; description: string; labels: { name: string; color: string }[] }>>(() => {
    try { return JSON.parse(localStorage.getItem('label-custom-templates') || '[]'); } catch { return []; }
  });

  // Improvement 9: Command palette (Ctrl+K)
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Improvement 10: Global undo/redo
  const [undoStack, setUndoStack] = useState<Array<{ action: string; data: any; description: string }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ action: string; data: any; description: string }>>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const undoToastTimer = useRef<any>(null);

  useEffect(() => { load(); }, []);

  // Feature 5: Store trend data daily
  useEffect(() => {
    if (Object.keys(labelUsage).length > 0) {
      const key = 'label-trend-' + new Date().toISOString().slice(0, 10);
      localStorage.setItem(key, JSON.stringify(labelUsage));
    }
  }, [labelUsage]);

  // Feature 5: Load trend from 7 days ago
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const key = 'label-trend-' + d.toISOString().slice(0, 10);
    const stored = localStorage.getItem(key);
    if (stored) {
      try { setTrendData(JSON.parse(stored)); } catch {}
    }
  }, []);

  // NEW Feature 6: Auto-refresh counts every 30s
  useEffect(() => {
    countIntervalRef.current = setInterval(async () => {
      const sessions = await ados.db?.getSessions?.()?.catch(() => []) || [];
      setAllSessions(sessions);
      const usage: Record<string, number> = {};
      for (const label of labels) {
        usage[label.id] = sessions.filter((s: any) => s.labels?.includes(label.id)).length;
      }
      setLabelUsage(usage);
    }, 30000);
    return () => { if (countIntervalRef.current) clearInterval(countIntervalRef.current); };
  }, [labels]);

  // NEW Feature 4: Check contrast when color changes
  useEffect(() => {
    if (color) {
      const result = checkWCAGContrast(color);
      setColorContrastWarning(result);
    }
  }, [color]);

  // Persist favorites
  useEffect(() => {
    localStorage.setItem('label-favorites', JSON.stringify([...favorites]));
  }, [favorites]);

  // Persist groups
  useEffect(() => {
    localStorage.setItem('label-groups', JSON.stringify(labelGroups));
  }, [labelGroups]);

  // Persist actions
  useEffect(() => {
    localStorage.setItem('label-actions', JSON.stringify(labelActions));
  }, [labelActions]);

  // Persist change history
  useEffect(() => {
    localStorage.setItem('label-change-history', JSON.stringify(changeHistory));
  }, [changeHistory]);

  // Persist conditional rules
  useEffect(() => {
    localStorage.setItem('label-conditional-rules', JSON.stringify(conditionalRules));
  }, [conditionalRules]);

  // Persist shortcuts
  useEffect(() => {
    localStorage.setItem('label-shortcuts', JSON.stringify(labelShortcuts));
  }, [labelShortcuts]);

  // Feature 32: Load stats history (last 7 days)
  useEffect(() => {
    const history: Record<string, Record<string, number>> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = 'label-trend-' + d.toISOString().slice(0, 10);
      const stored = localStorage.getItem(key);
      if (stored) {
        try { history[d.toISOString().slice(0, 10)] = JSON.parse(stored); } catch {}
      }
    }
    setStatsHistory(history);
  }, [labelUsage]);

  // Feature 37: Global keyboard shortcut listener + Improvement 9 (Ctrl+K) + Improvement 10 (Ctrl+Z/Y)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setShowShortcutModal(true);
      }
      // Improvement 9: Ctrl+K command palette
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setCommandSearch('');
      }
      // Improvement 10: Ctrl+Z undo, Ctrl+Y redo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleGlobalUndo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleGlobalRedo();
      }
      // Check label shortcuts (Ctrl+1..9)
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        const shortcutKey = `Ctrl+${e.key}`;
        const labelId = Object.entries(labelShortcuts).find(([_, v]) => v === shortcutKey)?.[0];
        if (labelId) {
          e.preventDefault();
          handleBatchApply(labelId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [labelShortcuts, undoStack, redoStack]);

  // Improvement 4: Build sparkline data from stats history
  useEffect(() => {
    const data: Record<string, number[]> = {};
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    for (const label of labels) {
      data[label.id] = days.map(d => statsHistory[d]?.[label.id] || 0);
    }
    setSparklineData(data);
  }, [statsHistory, labels]);

  // Improvement 8: Persist custom templates
  useEffect(() => {
    localStorage.setItem('label-custom-templates', JSON.stringify(customTemplates));
  }, [customTemplates]);

  // Improvement 9: Focus command palette input
  useEffect(() => {
    if (showCommandPalette && commandInputRef.current) {
      setTimeout(() => commandInputRef.current?.focus(), 50);
    }
  }, [showCommandPalette]);

  // Feature 28: Filter sessions by combined labels
  useEffect(() => {
    if (filterMode === 'off' || filterLabelIds.size === 0) {
      setFilteredSessions([]);
      return;
    }
    const ids = [...filterLabelIds];
    const result = allSessions.filter(s => {
      const sessionLabels = s.labels || [];
      if (filterMode === 'AND') return ids.every(id => sessionLabels.includes(id));
      return ids.some(id => sessionLabels.includes(id));
    });
    setFilteredSessions(result);
  }, [filterMode, filterLabelIds, allSessions]);

  const load = async () => {
    const rows = await ados.db.getLabels();
    const sorted = rows.sort((a: Label, b: Label) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Feature 8: Auto-delete expired labels
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expired = sorted.filter((l: Label) => l.expiresAt && new Date(l.expiresAt) < now);
    for (const exp of expired) {
      await ados.db.deleteLabel(exp.id);
    }
    const remaining = expired.length > 0
      ? sorted.filter((l: Label) => !expired.some((e: Label) => e.id === l.id))
      : sorted;

    setLabels(remaining);
    const sessions = await ados.db.getSessions().catch(() => []);
    setAllSessions(sessions);
    const usage: Record<string, number> = {};
    for (const label of remaining) {
      usage[label.id] = sessions.filter((s: any) => s.labels?.includes(label.id)).length;
    }
    setLabelUsage(usage);
  };

  // NEW Feature 5: Add change to history
  const addChangeEntry = useCallback((labelId: string, labelName: string, action: LabelChangeEntry['action'], details: string) => {
    const entry: LabelChangeEntry = {
      id: crypto.randomUUID(),
      labelId,
      labelName,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    setChangeHistory(prev => [entry, ...prev].slice(0, 100));
  }, []);

  // NEW Feature 1: View sessions for a label
  const handleViewLabelSessions = useCallback((labelId: string) => {
    const sessions = allSessions.filter(s => (s.labels || []).includes(labelId));
    setLabelSessions(sessions);
    setViewingLabelSessions(labelId);
  }, [allSessions]);

  // NEW Feature 7: Toggle favorite
  const toggleFavorite = useCallback((labelId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
        const label = labels.find(l => l.id === labelId);
        if (label) addChangeEntry(labelId, label.name, 'unfavorite', 'Removido dos favoritos');
      } else {
        next.add(labelId);
        const label = labels.find(l => l.id === labelId);
        if (label) addChangeEntry(labelId, label.name, 'favorite', 'Adicionado aos favoritos');
      }
      return next;
    });
  }, [labels, addChangeEntry]);

  // NEW Feature 2: Group management
  const handleCreateGroup = useCallback(() => {
    if (!newGroupName.trim()) return;
    const group: LabelGroup = { id: crypto.randomUUID(), name: newGroupName.trim(), labelIds: [], collapsed: false };
    setLabelGroups(prev => [...prev, group]);
    setNewGroupName('');
  }, [newGroupName]);

  const handleToggleGroupCollapse = useCallback((groupId: string) => {
    setLabelGroups(prev => prev.map(g => g.id === groupId ? { ...g, collapsed: !g.collapsed } : g));
  }, []);

  const handleAssignToGroup = useCallback((groupId: string, labelId: string) => {
    setLabelGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const ids = g.labelIds.includes(labelId) ? g.labelIds.filter(id => id !== labelId) : [...g.labelIds, labelId];
        return { ...g, labelIds: ids };
      }
      return g;
    }));
    setGroupAssignLabel(null);
  }, []);

  const handleDeleteGroup = useCallback((groupId: string) => {
    setLabelGroups(prev => prev.filter(g => g.id !== groupId));
  }, []);

  // NEW Feature 3: Action management
  const handleAddAction = useCallback((labelId: string) => {
    if (!newActionConfig.trim()) return;
    const action: LabelAction = { labelId, type: newActionType, config: newActionConfig.trim() };
    setLabelActions(prev => [...prev, action]);
    setNewActionConfig('');
  }, [newActionType, newActionConfig]);

  const handleRemoveAction = useCallback((labelId: string, index: number) => {
    setLabelActions(prev => {
      const forLabel = prev.filter(a => a.labelId === labelId);
      const toRemove = forLabel[index];
      if (!toRemove) return prev;
      let count = 0;
      return prev.filter(a => {
        if (a.labelId === labelId) {
          if (count === index) { count++; return false; }
          count++;
        }
        return true;
      });
    });
  }, []);

  // NEW Feature 3: Execute actions when label is applied
  const executeLabelActions = useCallback((labelId: string) => {
    const actions = labelActions.filter(a => a.labelId === labelId);
    for (const action of actions) {
      if (action.type === 'notify') {
        // Use notification API if available
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Label aplicada`, { body: action.config });
        }
      }
      // move_folder and auto_archive would use IPC
      if (action.type === 'move_folder') {
        ados.db?.moveSessionToFolder?.(action.config);
      }
    }
  }, [labelActions]);

  // NEW Feature 8: Conditional rules management
  const handleSaveConditionalRule = useCallback((labelId: string) => {
    const validConditions = ruleConditions.filter(c => c.pattern.trim());
    if (validConditions.length === 0) return;
    const existing = conditionalRules.findIndex(r => r.labelId === labelId);
    const rule: ConditionalRule = { id: existing >= 0 ? conditionalRules[existing].id : crypto.randomUUID(), labelId, conditions: validConditions };
    if (existing >= 0) {
      setConditionalRules(prev => prev.map((r, i) => i === existing ? rule : r));
    } else {
      setConditionalRules(prev => [...prev, rule]);
    }
    setShowRulesModal(null);
    setRuleConditions([{ pattern: '', operator: 'AND' }]);
  }, [ruleConditions, conditionalRules]);

  const handleDeleteConditionalRule = useCallback((labelId: string) => {
    setConditionalRules(prev => prev.filter(r => r.labelId !== labelId));
  }, []);

  // Feature 28: Toggle filter label
  const toggleFilterLabel = useCallback((labelId: string) => {
    setFilterLabelIds(prev => {
      const next = new Set(prev);
      if (next.has(labelId)) next.delete(labelId); else next.add(labelId);
      return next;
    });
  }, []);

  // Feature 33 + Improvement 7: Generate label suggestions with confidence
  const handleGenerateSuggestions = useCallback(() => {
    const unlabeled = allSessions.filter(s => !s.labels || s.labels.length === 0);
    const suggs: Array<{ sessionId: string; title: string; suggestedLabel: string; confidence: number }> = [];
    for (const session of unlabeled.slice(0, 20)) {
      const title = (session.title || '').toLowerCase();
      for (const label of labels) {
        if (label.autoPattern) {
          try {
            if (new RegExp(label.autoPattern, 'i').test(title)) {
              suggs.push({ sessionId: session.id, title: session.title, suggestedLabel: label.name, confidence: 90 });
              break;
            }
          } catch {}
        }
        // Simple keyword match as fallback - lower confidence
        if (title.includes(label.name.toLowerCase())) {
          suggs.push({ sessionId: session.id, title: session.title, suggestedLabel: label.name, confidence: 60 });
          break;
        }
      }
    }
    // Improvement 7: Sort by confidence descending
    suggs.sort((a, b) => b.confidence - a.confidence);
    setSuggestions(suggs);
    setShowSuggestions(true);
  }, [allSessions, labels]);

  // Feature 34: Archive/unarchive a label
  const handleArchiveLabel = useCallback(async (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label) return;
    await ados.db.updateLabel(labelId, { archived: !label.archived });
    addChangeEntry(labelId, label.name, label.archived ? 'create' : 'delete', label.archived ? `Label "${label.name}" desarquivada` : `Label "${label.name}" arquivada`);
    load();
  }, [labels, addChangeEntry]);

  // Feature 38: Auto-archive sessions with label after N days
  const handleAutoArchiveSessions = useCallback(async (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label || !label.autoArchiveDays) return;
    const threshold = Date.now() - (label.autoArchiveDays * 86400000);
    const sessionsWithLabel = allSessions.filter(s => (s.labels || []).includes(labelId));
    let archived = 0;
    for (const session of sessionsWithLabel) {
      // Archive sessions (mark as archived via updateSession)
      await ados.db.updateSession?.(session.id, { archived: true });
      archived++;
    }
    return archived;
  }, [labels, allSessions]);

  // NEW Feature 8: Evaluate conditional rule against session title
  const evaluateConditionalRule = useCallback((rule: ConditionalRule, title: string): boolean => {
    if (rule.conditions.length === 0) return false;
    let result = false;
    for (let i = 0; i < rule.conditions.length; i++) {
      const cond = rule.conditions[i];
      try {
        const matches = new RegExp(cond.pattern, 'i').test(title);
        if (i === 0) { result = matches; }
        else if (cond.operator === 'AND') { result = result && matches; }
        else { result = result || matches; }
      } catch { return false; }
    }
    return result;
  }, []);

  // Improvement 10: Global undo/redo handlers
  const pushUndo = useCallback((action: string, data: any, description: string) => {
    setUndoStack(prev => [...prev.slice(-49), { action, data, description }]);
    setRedoStack([]);
    setUndoToast(description);
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 4000);
  }, []);

  const handleGlobalUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, last]);
    if (last.action === 'delete') {
      await ados.db.addLabel(last.data.id, last.data.name, last.data.color, last.data.parentId, last.data.autoPattern);
    } else if (last.action === 'create') {
      await ados.db.deleteLabel(last.data.id);
    } else if (last.action === 'update') {
      await ados.db.updateLabel(last.data.id, last.data.previousFields);
    }
    load();
    setUndoToast('Desfeito: ' + last.description);
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 3000);
  }, [undoStack]);

  const handleGlobalRedo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, last]);
    if (last.action === 'delete') {
      await ados.db.deleteLabel(last.data.id);
    } else if (last.action === 'create') {
      await ados.db.addLabel(last.data.id, last.data.name, last.data.color, last.data.parentId, last.data.autoPattern);
    } else if (last.action === 'update') {
      await ados.db.updateLabel(last.data.id, last.data.newFields);
    }
    load();
    setUndoToast('Refeito: ' + last.description);
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 3000);
  }, [redoStack]);

  // Improvement 5: Bulk operations
  const handleBulkToggle = useCallback((labelId: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(labelId)) next.delete(labelId); else next.add(labelId);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    for (const id of bulkSelected) {
      const label = labels.find(l => l.id === id);
      if (label) {
        pushUndo('delete', { id, name: label.name, color: label.color, parentId: label.parentId, autoPattern: label.autoPattern }, `Excluiu "${label.name}"`);
        await ados.db.deleteLabel(id);
        addChangeEntry(id, label.name, 'delete', `Label "${label.name}" excluída em lote`);
      }
    }
    setBulkSelected(new Set());
    load();
  }, [bulkSelected, labels, addChangeEntry, pushUndo]);

  const handleBulkRename = useCallback(async () => {
    if (!bulkRenamePrefix.trim()) return;
    let i = 1;
    for (const id of bulkSelected) {
      const label = labels.find(l => l.id === id);
      if (label) {
        const newName = `${bulkRenamePrefix.trim()} ${i}`;
        pushUndo('update', { id, previousFields: { name: label.name }, newFields: { name: newName } }, `Renomeou "${label.name}" -> "${newName}"`);
        await ados.db.updateLabel(id, { name: newName });
        addChangeEntry(id, label.name, 'rename', `Renomeado em lote: "${label.name}" → "${newName}"`);
        i++;
      }
    }
    setBulkSelected(new Set());
    setShowBulkRename(false);
    setBulkRenamePrefix('');
    load();
  }, [bulkSelected, bulkRenamePrefix, labels, addChangeEntry, pushUndo]);

  const handleBulkArchive = useCallback(async () => {
    for (const id of bulkSelected) {
      const label = labels.find(l => l.id === id);
      if (label) {
        await ados.db.updateLabel(id, { archived: true });
        addChangeEntry(id, label.name, 'delete', `Label "${label.name}" arquivada em lote`);
      }
    }
    setBulkSelected(new Set());
    load();
  }, [bulkSelected, labels, addChangeEntry]);

  // Improvement 8: Save custom template
  const handleSaveCustomTemplate = useCallback(() => {
    if (!newTemplateName.trim() || newTemplateLabelIds.size === 0) return;
    const templateLabels = [...newTemplateLabelIds].map(id => {
      const l = labels.find(lb => lb.id === id);
      return l ? { name: l.name, color: l.color } : null;
    }).filter(Boolean) as { name: string; color: string }[];
    setCustomTemplates(prev => [...prev, { name: newTemplateName.trim(), description: newTemplateDesc.trim(), labels: templateLabels }]);
    setNewTemplateName('');
    setNewTemplateDesc('');
    setNewTemplateLabelIds(new Set());
    setShowTemplateEditor(false);
  }, [newTemplateName, newTemplateDesc, newTemplateLabelIds, labels]);

  const handleApplyCustomTemplate = useCallback(async (template: { name: string; labels: { name: string; color: string }[] }) => {
    for (const tpl of template.labels) {
      const exists = labels.some(l => l.name.toLowerCase() === tpl.name.toLowerCase());
      if (!exists) {
        const id = crypto.randomUUID();
        await ados.db.addLabel(id, tpl.name, tpl.color, null, null);
      }
    }
    load();
  }, [labels]);

  const handleDeleteCustomTemplate = useCallback((index: number) => {
    setCustomTemplates(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Improvement 9: Command palette actions
  const commandPaletteResults = (() => {
    if (!commandSearch.trim()) return labels.filter(l => !l.archived).slice(0, 10);
    const q = commandSearch.toLowerCase();
    return labels.filter(l => !l.archived && l.name.toLowerCase().includes(q));
  })();

  const handleCommandSelect = useCallback(async (labelId: string) => {
    setShowCommandPalette(false);
    setCommandSearch('');
    handleBatchApply(labelId);
  }, []);

  const handlePatternChange = (value: string) => {
    setAutoPattern(value);
    const status = validateRegex(value);
    setRegexStatus(status);
    // Feature 7: Preview match count
    if (value.trim() && status.valid) {
      try {
        const re = new RegExp(value, 'i');
        const matched = allSessions.filter(s => re.test(s.title || ''));
        setPatternMatchCount(matched.length);
        setPatternMatches(matched.map(s => s.title).slice(0, 5));
      } catch { setPatternMatches([]); setPatternMatchCount(0); }
    } else {
      setPatternMatches([]);
      setPatternMatchCount(0);
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setNameSimilarWarning('');
    if (!value.trim()) { setNameError(''); return; }

    // Exact duplicate check
    const exactDup = labels.find(l => l.name.toLowerCase().trim() === value.trim().toLowerCase());
    if (exactDup) {
      setNameError(`Já existe label "${exactDup.name}"`);
      return;
    }
    setNameError('');

    // Feature 2: Advanced similarity check (normalized: no spaces/hyphens)
    const normalizedInput = normalize(value);
    const similar = labels.find(l => normalize(l.name) === normalizedInput && l.name.toLowerCase().trim() !== value.trim().toLowerCase());
    if (similar) {
      setNameSimilarWarning(`Similar à label existente: ${similar.name}`);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || nameError || !regexStatus.valid) return;
    const id = crypto.randomUUID();
    await ados.db.addLabel(id, name.trim(), color, parentLabel, autoPattern.trim() || null);
    // Feature 8: Store expiration
    const extraFields: any = {};
    if (expiresAt) extraFields.expiresAt = expiresAt;
    if (useGradient && gradientColor2) extraFields.gradient = `linear-gradient(135deg, ${color}, ${gradientColor2})`;
    if (labelIcon.trim()) extraFields.icon = labelIcon.trim();
    if (skillTrigger.trim()) extraFields.skillTrigger = skillTrigger.trim();
    if (autoArchiveDays > 0) extraFields.autoArchiveDays = autoArchiveDays;
    if (Object.keys(extraFields).length > 0) {
      await ados.db.updateLabel(id, extraFields);
    }
    // NEW Feature 5: Log creation + Improvement 10: undo stack
    addChangeEntry(id, name.trim(), 'create', `Label "${name.trim()}" criada com cor ${color}`);
    pushUndo('create', { id, name: name.trim(), color, parentId: parentLabel, autoPattern: autoPattern.trim() || null }, `Criou "${name.trim()}"`);
    setName('');
    setAutoPattern('');
    setParentLabel(null);
    setPatternMatches([]);
    setPatternMatchCount(0);
    setRegexStatus({ valid: true, error: '' });
    setShowCustomColor(false);
    setExpiresAt('');
    setNameSimilarWarning('');
    setUseGradient(false);
    setGradientColor2('#3b82f6');
    setLabelIcon('');
    setSkillTrigger('');
    setAutoArchiveDays(0);
    load();
  };

  // Feature 4: Drag-and-drop with undo + Improvement 2: Visual feedback
  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, targetId?: string) => {
    e.preventDefault();
    if (targetId && targetId !== dragId) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setDragOverId(targetId);
      setDragOverPosition(e.clientY < midY ? 'above' : 'below');
    }
  };
  const handleDragLeave = () => { setDragOverId(null); };
  const handleDragEnd = () => { setDragId(null); setDragOverId(null); };
  const handleDrop = async (targetId: string) => {
    setDragOverId(null);
    if (!dragId || dragId === targetId) return;
    // Feature 6: Save previous order
    previousOrderRef.current = [...labels];
    const newLabels = [...labels];
    const dragIdx = newLabels.findIndex(l => l.id === dragId);
    const targetIdx = newLabels.findIndex(l => l.id === targetId);
    const [moved] = newLabels.splice(dragIdx, 1);
    newLabels.splice(targetIdx, 0, moved);
    setLabels(newLabels);
    for (let i = 0; i < newLabels.length; i++) {
      await ados.db.updateLabel(newLabels[i].id, { sortOrder: i });
    }
    setDragId(null);
    // Feature 6: Show undo banner
    setShowUndoBanner(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setShowUndoBanner(false);
      previousOrderRef.current = null;
    }, 10000);
  };

  // Feature 6: Undo handler
  const handleUndoDrag = async () => {
    if (!previousOrderRef.current) return;
    const restored = previousOrderRef.current;
    setLabels(restored);
    for (let i = 0; i < restored.length; i++) {
      await ados.db.updateLabel(restored[i].id, { sortOrder: i });
    }
    previousOrderRef.current = null;
    setShowUndoBanner(false);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  // Feature 9: Batch apply
  const handleBatchApply = async (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    if (!label?.autoPattern) return;
    setBatchApplying(labelId);
    try {
      const re = new RegExp(label.autoPattern, 'i');
      const matching = allSessions.filter(s => re.test(s.title || '') && !(s.labels || []).includes(labelId));
      for (const session of matching) {
        const currentLabels = session.labels || [];
        await ados.db.updateSession(session.id, { labels: [...currentLabels, labelId] });
        window.dispatchEvent(new CustomEvent('label:applied', { detail: { labelId, sessionId: session.id } }));
      }
      setBatchCount(matching.length);
      setTimeout(() => setBatchCount(0), 3000);
    } catch {}
    setBatchApplying(null);
    load();
  };

  // Feature 1: Merge handler
  const handleMerge = async () => {
    if (!mergeSurvivor || selectedForMerge.size < 2) return;
    const toDelete = [...selectedForMerge].filter(id => id !== mergeSurvivor);
    // Reassign sessions from deleted labels to survivor
    for (const deletedId of toDelete) {
      const sessionsWithLabel = allSessions.filter(s => (s.labels || []).includes(deletedId));
      for (const session of sessionsWithLabel) {
        const currentLabels = (session.labels || []).filter((l: string) => l !== deletedId);
        if (!currentLabels.includes(mergeSurvivor)) {
          currentLabels.push(mergeSurvivor);
          window.dispatchEvent(new CustomEvent('label:applied', { detail: { labelId: mergeSurvivor, sessionId: session.id } }));
        }
        await ados.db.updateSession(session.id, { labels: currentLabels });
      }
      await ados.db.deleteLabel(deletedId);
    }
    setSelectedForMerge(new Set());
    setShowMergeModal(false);
    setMergeSurvivor(null);
    load();
  };

  // Feature 1: Toggle merge selection
  const toggleMergeSelect = (id: string) => {
    const next = new Set(selectedForMerge);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedForMerge(next);
  };

  // Feature 3: Apply template
  const handleApplyTemplate = async (groupName: string) => {
    const templates = LABEL_TEMPLATES[groupName];
    if (!templates) return;
    for (const tpl of templates) {
      const exists = labels.some(l => l.name.toLowerCase() === tpl.name.toLowerCase());
      if (!exists) {
        const id = crypto.randomUUID();
        await ados.db.addLabel(id, tpl.name, tpl.color, null, null);
      }
    }
    setShowTemplatesModal(false);
    load();
  };

  // Feature 4: Export
  const handleExport = () => {
    const data = labels.map(l => ({
      name: l.name,
      color: l.color,
      autoPattern: l.autoPattern,
      parentId: l.parentId,
      sortOrder: l.sortOrder,
      expiresAt: (l as any).expiresAt || null,
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setImportExportMsg('Exportado para clipboard!');
    setTimeout(() => setImportExportMsg(''), 3000);
  };

  // Feature 4: Import
  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('JSON inválido');
      let created = 0;
      for (const item of data) {
        if (!item.name || !item.color) continue;
        const exists = labels.some(l => l.name.toLowerCase() === item.name.toLowerCase());
        if (!exists) {
          const id = crypto.randomUUID();
          await ados.db.addLabel(id, item.name, item.color, item.parentId || null, item.autoPattern || null);
          if (item.expiresAt) {
            await ados.db.updateLabel(id, { expiresAt: item.expiresAt });
          }
          created++;
        }
      }
      setImportExportMsg(`Importado: ${created} label(s) criada(s).`);
      setTimeout(() => setImportExportMsg(''), 3000);
      load();
    } catch (e: any) {
      setImportExportMsg('Erro ao importar: ' + (e.message || 'JSON inválido'));
      setTimeout(() => setImportExportMsg(''), 4000);
    }
  };

  // Hierarchy helpers — NEW Feature 7: favorites sort first, Feature 34: filter archived
  const rootLabels = labels.filter(l => !l.parentId && (showArchived || !l.archived)).sort((a, b) => {
    const aFav = favorites.has(a.id) ? 0 : 1;
    const bFav = favorites.has(b.id) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return 0;
  });
  const archivedLabels = labels.filter(l => l.archived);
  const childLabels = (parentId: string) => labels.filter(l => l.parentId === parentId);
  const toggleParent = (id: string) => {
    const next = new Set(expandedParents);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedParents(next);
  };

  const handleDelete = async (id: string) => {
    const label = labels.find(l => l.id === id);
    if (label) {
      addChangeEntry(id, label.name, 'delete', `Label "${label.name}" excluída`);
      pushUndo('delete', { id, name: label.name, color: label.color, parentId: label.parentId, autoPattern: label.autoPattern }, `Excluiu "${label.name}"`);
    }
    await ados.db.deleteLabel(id);
    setConfirmDelete(null);
    load();
  };

  const handleUpdate = async (id: string, fields: Partial<Label>) => {
    const label = labels.find(l => l.id === id);
    if (label) {
      const previousFields: any = {};
      const newFields: any = {};
      if (fields.name && fields.name !== label.name) {
        previousFields.name = label.name;
        newFields.name = fields.name;
        addChangeEntry(id, label.name, 'rename', `Renomeado: "${label.name}" → "${fields.name}"`);
      }
      if (fields.color && fields.color !== label.color) {
        previousFields.color = label.color;
        newFields.color = fields.color;
        addChangeEntry(id, label.name, 'recolor', `Cor alterada: ${label.color} → ${fields.color}`);
      }
      if (Object.keys(previousFields).length > 0) {
        pushUndo('update', { id, previousFields, newFields }, `Editou "${label.name}"`);
      }
    }
    await ados.db.updateLabel(id, fields);
    setEditing(null);
    load();
  };

  // Feature 5: Trend indicator
  const getTrend = (labelId: string) => {
    const current = labelUsage[labelId] || 0;
    const past = trendData[labelId] || 0;
    if (current > past) return 'up';
    if (current < past) return 'down';
    return 'same';
  };

  // Improvement 4: Render sparkline SVG
  const renderSparkline = (labelId: string) => {
    const data = sparklineData[labelId];
    if (!data || data.every(v => v === 0)) return null;
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => `${i * 12},${20 - (v / max) * 18}`).join(' ');
    return (
      <svg width="72" height="20" className="shrink-0" viewBox="0 0 72 20">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-brand-500"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Render label card (reusable for root and children) — with Improvements 2,3,4,5,6
  const renderLabelCard = (label: Label, isChild = false) => {
    const parentLabelName = label.parentId ? labels.find(l => l.id === label.parentId)?.name : null;
    const hasChildren = childLabels(label.id).length > 0;
    const isBeingDragged = dragId === label.id;
    const showInsertAbove = dragOverId === label.id && dragOverPosition === 'above';
    const showInsertBelow = dragOverId === label.id && dragOverPosition === 'below';

    return (
      <div key={label.id} className="relative">
        {/* Improvement 2: Blue insertion line above */}
        {showInsertAbove && (
          <div className="absolute -top-[2px] left-0 right-0 h-[3px] bg-blue-500 rounded-full z-10" />
        )}
        {/* Improvement 6: Tree-view connector lines for children */}
        <div
          draggable
          onDragStart={() => handleDragStart(label.id)}
          onDragOver={(e) => handleDragOver(e, label.id)}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={() => handleDrop(label.id)}
          className={`bg-surface-1 border rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 cursor-grab transition-all duration-150
            ${isChild ? 'ml-8 mt-1 border-l-2 border-l-brand-500/30' : ''}
            ${isBeingDragged ? 'border-brand-500 opacity-60 scale-[1.02] shadow-lg' : 'border-default'}
          `}
          style={isBeingDragged ? { transform: 'scale(1.02)' } : undefined}
        >
          {/* Improvement 5: Bulk mode checkbox */}
          {bulkMode && (
            <input
              type="checkbox"
              checked={bulkSelected.has(label.id)}
              onChange={() => handleBulkToggle(label.id)}
              className="w-4 h-4 accent-brand-600 shrink-0"
            />
          )}
          {/* Feature 1: Merge checkbox */}
          {!bulkMode && (
            <input
              type="checkbox"
              checked={selectedForMerge.has(label.id)}
              onChange={() => toggleMergeSelect(label.id)}
              className="w-3.5 h-3.5 accent-brand-600 shrink-0"
            />
          )}
          {/* NEW Feature 7: Favorite star */}
          <button
            onClick={() => toggleFavorite(label.id)}
            className={`text-sm shrink-0 transition-colors ${favorites.has(label.id) ? 'text-yellow-400' : 'text-muted hover:text-yellow-400'}`}
            title={favorites.has(label.id) ? 'Remover dos favoritos' : 'Favoritar'}
          >
            {favorites.has(label.id) ? '★' : '☆'}
          </button>
          {/* Improvement 6: Hierarchy expand/collapse with rotate chevron */}
          {!isChild && hasChildren ? (
            <button
              onClick={() => toggleParent(label.id)}
              className="text-xs text-muted hover:text-primary w-4 transition-transform duration-200"
              style={{ transform: expandedParents.has(label.id) ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              ▶
            </button>
          ) : (
            <span className="w-4 text-xs text-muted">{isChild ? '' : '⠿'}</span>
          )}
          {/* Improvement 3: Rich preview - color swatch + gradient preview */}
          <div
            className="w-5 h-5 rounded-md shrink-0 cursor-pointer hover:ring-2 hover:ring-brand-500 transition-all shadow-sm"
            style={{ background: label.gradient || label.color }}
            onClick={() => handleViewLabelSessions(label.id)}
            title="Ver sessões com esta label"
          />
          {/* Feature 31: Label icon */}
          {label.icon && <span className="text-sm shrink-0">{label.icon}</span>}
          {editing === label.id ? (
            <input
              defaultValue={label.name}
              autoFocus
              onBlur={(e) => handleUpdate(label.id, { name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(label.id, { name: (e.target as HTMLInputElement).value }); }}
              className="flex-1 bg-surface-0 border border-default rounded px-2 py-1 text-sm text-primary outline-none"
            />
          ) : (
            <div className="flex-1 min-w-0">
              <span className="text-sm text-primary font-medium block truncate">{label.name}</span>
              {/* Improvement 3: Parent name visible */}
              {parentLabelName && (
                <span className="text-[10px] text-muted">em {parentLabelName}</span>
              )}
            </div>
          )}
          {/* Improvement 3: Usage count always visible */}
          <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            {labelUsage[label.id] || 0} usos
            {getTrend(label.id) === 'up' && <span className="text-green-500">↑</span>}
            {getTrend(label.id) === 'down' && <span className="text-red-500">↓</span>}
          </span>
          {/* Improvement 4: Sparkline */}
          {renderSparkline(label.id)}
          {label.autoPattern && (
            <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">{label.autoPattern}</span>
          )}
          {/* NEW Feature 8: Conditional rule indicator */}
          {conditionalRules.find(r => r.labelId === label.id) && (
            <span className="text-[10px] text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full">
              ⟁ {conditionalRules.find(r => r.labelId === label.id)!.conditions.length} condições
            </span>
          )}
          {/* NEW Feature 3: Actions indicator */}
          {labelActions.filter(a => a.labelId === label.id).length > 0 && (
            <span className="text-[10px] text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full">
              ⚡ {labelActions.filter(a => a.labelId === label.id).length}
            </span>
          )}
          {/* Feature 8: Expiration badge */}
          {(label as any).expiresAt && (
            <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Expira em {daysUntil((label as any).expiresAt)}d
            </span>
          )}
          {/* Batch apply button */}
          {label.autoPattern && (
            <button
              onClick={() => handleBatchApply(label.id)}
              disabled={batchApplying === label.id}
              className="text-[10px] text-brand-500 hover:bg-brand-500/10 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              title="Aplicar a todas sessões que matcham"
            >
              {batchApplying === label.id ? '...' : 'Batch'}
            </button>
          )}
          {/* NEW Feature 3: Actions button */}
          <button onClick={() => setShowActionsModal(label.id)} className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors" title="Ações automáticas">⚡</button>
          {/* NEW Feature 8: Rules button */}
          <button onClick={() => { setShowRulesModal(label.id); const existing = conditionalRules.find(r => r.labelId === label.id); setRuleConditions(existing ? existing.conditions : [{ pattern: '', operator: 'AND' }]); }} className="text-xs text-purple-500 hover:text-purple-400 transition-colors" title="Regras condicionais">⟁</button>
          {/* NEW Feature 2: Assign to group */}
          <button onClick={() => setGroupAssignLabel(label.id)} className="text-xs text-muted hover:text-primary transition-colors" title="Atribuir a grupo">⊞</button>
          {/* Feature 29: Skill trigger badge */}
          {label.skillTrigger && (
            <span className="text-[10px] text-teal-500 bg-teal-500/10 px-2 py-0.5 rounded-full">⚙ {label.skillTrigger}</span>
          )}
          {/* Feature 38: Auto-archive badge */}
          {label.autoArchiveDays && label.autoArchiveDays > 0 && (
            <span className="text-[10px] text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">📦 {label.autoArchiveDays}d</span>
          )}
          <button onClick={() => setEditing(label.id)} className="text-xs text-muted hover:text-primary transition-colors">Editar</button>
          {/* Feature 34: Archive button */}
          <button onClick={() => handleArchiveLabel(label.id)} className="text-xs text-amber-500 hover:text-amber-400 transition-colors" title={label.archived ? 'Desarquivar' : 'Arquivar'}>
            {label.archived ? '📤' : '📥'}
          </button>
          <button onClick={() => setConfirmDelete(label.id)} className="text-xs text-red-500 hover:text-red-400 transition-colors">Excluir</button>
        </div>
        {/* Improvement 2: Blue insertion line below */}
        {showInsertBelow && (
          <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-blue-500 rounded-full z-10" />
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Labels</h1>
            <p className="text-sm text-muted mt-1">Organize sessões com marcadores hierárquicos e regras automáticas.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Feature 1: Merge button */}
            {selectedForMerge.size >= 2 && (
              <button
                onClick={() => { setShowMergeModal(true); setMergeSurvivor(null); }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-medium text-white transition-all"
              >
                Merge ({selectedForMerge.size})
              </button>
            )}
            {/* NEW Feature 2: Groups button */}
            <button
              onClick={() => setShowGroupModal(true)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Grupos
            </button>
            {/* NEW Feature 5: History button */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Histórico
            </button>
            {/* Feature 3: Templates button */}
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Templates
            </button>
            {/* Feature 4: Export/Import buttons */}
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Exportar
            </button>
            <button
              onClick={handleImport}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Importar
            </button>
            {/* Feature 28: Filter button */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${showFilterPanel ? 'bg-brand-600/10 border-brand-500/30 text-brand-500' : 'bg-surface-2 hover:bg-surface-3 border-default text-secondary'}`}
            >
              Filtro
            </button>
            {/* Feature 33: Suggestions button */}
            <button
              onClick={handleGenerateSuggestions}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Sugestões
            </button>
            {/* Feature 32: Stats button */}
            <button
              onClick={() => setShowStatsModal(true)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
            >
              Stats
            </button>
            {/* Feature 37: Shortcuts button */}
            <button
              onClick={() => setShowShortcutModal(true)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
              title="Ctrl+L"
            >
              Atalhos
            </button>
            {/* Improvement 5: Bulk mode toggle */}
            <button
              onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
              className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${bulkMode ? 'bg-brand-600/10 border-brand-500/30 text-brand-500' : 'bg-surface-2 hover:bg-surface-3 border-default text-secondary'}`}
            >
              {bulkMode ? 'Sair Seleção' : 'Multi-selecionar'}
            </button>
            {/* Improvement 9: Command palette hint */}
            <button
              onClick={() => { setShowCommandPalette(true); setCommandSearch(''); }}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-lg text-xs font-medium text-secondary transition-all"
              title="Ctrl+K"
            >
              Ctrl+K
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl space-y-6">
          {/* Feature 4: Import/export feedback */}
          {importExportMsg && (
            <div className="bg-brand-600/10 border border-brand-500/30 rounded-lg px-4 py-2">
              <p className="text-xs text-brand-500">{importExportMsg}</p>
            </div>
          )}

          {/* Feature 28: Filter panel */}
          {showFilterPanel && (
            <div className="bg-surface-1 border border-default rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-primary">Filtro Combinado de Labels</h3>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as 'off' | 'AND' | 'OR')}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="off">Desligado</option>
                  <option value="AND">AND (todas)</option>
                  <option value="OR">OR (qualquer)</option>
                </select>
              </div>
              {filterMode !== 'off' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {labels.filter(l => !l.archived).map(l => (
                      <button
                        key={l.id}
                        onClick={() => toggleFilterLabel(l.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${filterLabelIds.has(l.id) ? 'ring-2 ring-brand-500 bg-brand-600/10 text-brand-500' : 'bg-surface-2 text-secondary hover:bg-surface-3'}`}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.icon && <span>{l.icon}</span>}
                        {l.name}
                      </button>
                    ))}
                  </div>
                  {filteredSessions.length > 0 && (
                    <div className="bg-surface-0 border border-default rounded-lg p-3">
                      <p className="text-[10px] text-muted mb-2">{filteredSessions.length} sessões encontradas ({filterMode})</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {filteredSessions.slice(0, 10).map(s => (
                          <p key={s.id} className="text-xs text-primary truncate">• {s.title || 'Sem título'}</p>
                        ))}
                        {filteredSessions.length > 10 && <p className="text-[10px] text-muted">... e mais {filteredSessions.length - 10}</p>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Feature 6: Undo banner */}
          {showUndoBanner && (
            <div className="bg-surface-2 border border-default rounded-lg px-4 py-2 flex items-center justify-between">
              <p className="text-xs text-secondary">Reordenado</p>
              <button
                onClick={handleUndoDrag}
                className="text-xs text-brand-500 hover:text-brand-400 font-medium transition-colors"
              >
                Desfazer
              </button>
            </div>
          )}

          {/* Improvement 5: Bulk actions floating toolbar */}
          {bulkMode && bulkSelected.size > 0 && (
            <div className="sticky top-0 z-30 bg-surface-1 border border-brand-500/30 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
              <span className="text-sm font-medium text-primary">{bulkSelected.size} selecionado(s)</span>
              <div className="flex-1" />
              <button
                onClick={() => setShowBulkRename(true)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs font-medium text-white transition-all"
              >
                Renomear {bulkSelected.size} itens
              </button>
              <button
                onClick={handleBulkArchive}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-xs font-medium text-white transition-all"
              >
                Arquivar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium text-white transition-all"
              >
                Excluir {bulkSelected.size} itens
              </button>
            </div>
          )}

          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-primary">Nova Label</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nome da label"
                  className={`w-full bg-surface-0 border rounded-lg px-3 py-2 text-sm text-primary outline-none ${nameError ? 'border-red-500/50' : nameSimilarWarning ? 'border-yellow-500/50' : 'border-default focus:border-brand-500/50'}`}
                />
                {nameError && <p className="text-[10px] text-red-500 mt-1">{nameError}</p>}
                {/* Feature 2: Similarity warning */}
                {!nameError && nameSimilarWarning && <p className="text-[10px] text-yellow-500 mt-1">{nameSimilarWarning}</p>}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    value={autoPattern}
                    onChange={(e) => handlePatternChange(e.target.value)}
                    placeholder="Auto-apply pattern (regex)"
                    className={`flex-1 bg-surface-0 border rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none ${!regexStatus.valid ? 'border-red-500/50' : 'border-default focus:border-brand-500/50'}`}
                  />
                  {autoPattern && (
                    <span className={`text-xs shrink-0 ${regexStatus.valid ? 'text-green-500' : 'text-red-500'}`}>
                      {regexStatus.valid ? '✓' : '✗'}
                    </span>
                  )}
                </div>
                {!regexStatus.valid && <p className="text-[10px] text-red-500 mt-1">{regexStatus.error}</p>}
                {/* Feature 7: Match count preview */}
                {autoPattern.trim() && regexStatus.valid && (
                  <p className="text-[10px] text-blue-500 mt-1">Matcharia {patternMatchCount} sessões existentes</p>
                )}
                {patternMatches.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] text-green-500">Exemplos:</p>
                    {patternMatches.map((t, i) => (
                      <p key={i} className="text-[10px] text-muted truncate">• {t}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Parent label + expiration row */}
            <div className="flex items-center gap-3">
              <select
                value={parentLabel || ''}
                onChange={(e) => setParentLabel(e.target.value || null)}
                className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
              >
                <option value="">Sem pai (raiz)</option>
                {labels.filter(l => !l.parentId).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <span className="text-[10px] text-muted">Label pai</span>
              {/* Feature 8: Expiration input */}
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                placeholder="Expiração"
              />
              <span className="text-[10px] text-muted">Expiração (opcional)</span>
            </div>
            {/* Feature 29/30/31/38: Extra fields row */}
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={labelIcon}
                onChange={(e) => setLabelIcon(e.target.value)}
                placeholder="Ícone (emoji)"
                className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-24"
                maxLength={2}
              />
              <input
                value={skillTrigger}
                onChange={(e) => setSkillTrigger(e.target.value)}
                placeholder="Skill trigger (nome)"
                className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-40"
              />
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={useGradient} onChange={(e) => setUseGradient(e.target.checked)} className="rounded border-default" />
                <span className="text-[10px] text-secondary">Gradiente</span>
              </label>
              {useGradient && (
                <input type="color" value={gradientColor2} onChange={(e) => setGradientColor2(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none" />
              )}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={autoArchiveDays}
                  onChange={(e) => setAutoArchiveDays(parseInt(e.target.value) || 0)}
                  className="bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none w-14"
                />
                <span className="text-[10px] text-muted">Auto-archive (dias)</span>
              </div>
            </div>
            {/* Improvement 1: Categorized color palette with swatches */}
            <div className="space-y-3">
              {Object.entries(COLOR_PALETTE).map(([category, colors]) => (
                <div key={category}>
                  <p className="text-[10px] text-muted mb-1.5 font-medium uppercase tracking-wider">{category}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {colors.map(c => (
                      <button
                        key={c.hex}
                        onClick={() => { setColor(c.hex); setShowCustomColor(false); }}
                        className={`w-6 h-6 rounded-md transition-all relative group ${color === c.hex && !showCustomColor ? 'ring-2 ring-offset-2 ring-offset-surface-1 ring-brand-500 scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-0 border border-default text-[9px] text-primary px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          {c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setShowCustomColor(!showCustomColor)}
                  className={`w-6 h-6 rounded-md border-2 border-dashed transition-all flex items-center justify-center text-[10px] text-muted ${showCustomColor ? 'ring-2 ring-offset-2 ring-offset-surface-1 ring-brand-500 scale-110 border-brand-500' : 'border-default hover:scale-110'}`}
                  style={showCustomColor ? { backgroundColor: customColor } : {}}
                  title="Cor personalizada"
                >
                  {!showCustomColor && '+'}
                </button>
                {showCustomColor && (
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
                    className="w-8 h-6 rounded cursor-pointer border-none"
                  />
                )}
                {/* NEW Feature 4: WCAG contrast warning */}
                {colorContrastWarning && !colorContrastWarning.passes && (
                  <span className="text-[10px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                    ⚠ Contraste {colorContrastWarning.ratio.toFixed(1)}:1 ({colorContrastWarning.level})
                  </span>
                )}
                {colorContrastWarning && colorContrastWarning.passes && (
                  <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
                    ✓ {colorContrastWarning.level} ({colorContrastWarning.ratio.toFixed(1)}:1)
                  </span>
                )}
                <button
                  onClick={handleAdd}
                  disabled={!name.trim() || !!nameError || !regexStatus.valid}
                  className="ml-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>

          {/* Batch apply feedback */}
          {batchCount > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
              <p className="text-xs text-green-500">Label aplicada a {batchCount} sessão(ões) com sucesso.</p>
            </div>
          )}

          {/* NEW Feature 2: Label Groups display */}
          {labelGroups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider">Grupos</h3>
              {labelGroups.map(group => (
                <div key={group.id} className="bg-surface-1 border border-default rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-surface-2" onClick={() => handleToggleGroupCollapse(group.id)}>
                    <span className="text-xs text-muted">{group.collapsed ? '▶' : '▼'}</span>
                    <span className="text-sm font-medium text-primary flex-1">{group.name}</span>
                    <span className="text-[10px] text-muted">{group.labelIds.length} labels</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className="text-xs text-red-500 hover:text-red-400">×</button>
                  </div>
                  {!group.collapsed && group.labelIds.length > 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                      {group.labelIds.map(lid => {
                        const l = labels.find(lb => lb.id === lid);
                        if (!l) return null;
                        return (
                          <span key={lid} className="inline-flex items-center gap-1 text-xs text-secondary bg-surface-2 px-2 py-0.5 rounded-full">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                            {l.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feature 34: Show archived toggle */}
          {archivedLabels.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-default" />
                <span className="text-xs text-secondary">Mostrar arquivadas ({archivedLabels.length})</span>
              </label>
            </div>
          )}

          {labels.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Nenhuma label criada.</p>
          ) : (
            <div className="space-y-2">
              {rootLabels.map(label => (
                <div key={label.id}>
                  {renderLabelCard(label)}
                  {/* Improvement 6: Tree-view with connector lines and expand/collapse animation */}
                  {expandedParents.has(label.id) && (
                    <div className="relative ml-4 pl-4 border-l-2 border-brand-500/20 space-y-1 mt-1 transition-all duration-200">
                      {childLabels(label.id).map(child => renderLabelCard(child, true))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Excluir label?</h3>
            <p className="text-sm text-muted mb-4">
              {labelUsage[confirmDelete] > 0
                ? `Esta label está em ${labelUsage[confirmDelete]} sessões. Excluir mesmo assim?`
                : 'Esta ação é irreversível.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 1: Merge modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Merge de Labels</h3>
            <p className="text-sm text-muted mb-4">Escolha a label que sobreviverá. As sessões das outras serão reatribuídas.</p>
            <div className="space-y-2 mb-4">
              {[...selectedForMerge].map(id => {
                const label = labels.find(l => l.id === id);
                if (!label) return null;
                return (
                  <label key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-1 cursor-pointer">
                    <input
                      type="radio"
                      name="merge-survivor"
                      checked={mergeSurvivor === id}
                      onChange={() => setMergeSurvivor(id)}
                      className="accent-brand-600"
                    />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: label.color }} />
                    <span className="text-sm text-primary">{label.name}</span>
                    <span className="text-[10px] text-muted">({labelUsage[id] || 0} sessões)</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button
                onClick={handleMerge}
                disabled={!mergeSurvivor}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm text-white font-medium"
              >
                Confirmar Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 3 + Improvement 8: Templates modal with custom template editor */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-primary mb-2">Templates de Labels</h3>
            <p className="text-sm text-muted mb-4">Aplique um grupo de labels pré-definidas ou crie seus próprios templates.</p>
            {/* Improvement 8: Create template button */}
            <button
              onClick={() => setShowTemplateEditor(true)}
              className="w-full mb-4 px-4 py-2 bg-brand-600/10 hover:bg-brand-600/20 border border-brand-500/30 rounded-lg text-xs font-medium text-brand-500 transition-all"
            >
              + Criar Template
            </button>
            <div className="space-y-4 mb-4">
              {Object.entries(LABEL_TEMPLATES).map(([groupName, items]) => (
                <div key={groupName} className="bg-surface-1 border border-default rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-primary">{groupName}</h4>
                    <button
                      onClick={() => handleApplyTemplate(groupName)}
                      className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs font-medium text-white transition-all"
                    >
                      Aplicar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map(item => (
                      <span key={item.name} className="flex items-center gap-1.5 text-xs text-secondary">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {/* Improvement 8: Custom templates */}
              {customTemplates.map((tpl, idx) => (
                <div key={idx} className="bg-surface-1 border border-brand-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-primary">{tpl.name}</h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApplyCustomTemplate(tpl)}
                        className="px-3 py-1 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs font-medium text-white transition-all"
                      >
                        Aplicar
                      </button>
                      <button
                        onClick={() => handleDeleteCustomTemplate(idx)}
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {tpl.description && <p className="text-[10px] text-muted mb-2">{tpl.description}</p>}
                  <div className="flex flex-wrap gap-2">
                    {tpl.labels.map(item => (
                      <span key={item.name} className="flex items-center gap-1.5 text-xs text-secondary">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowTemplatesModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement 8: Template editor modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Criar Template</h3>
            <p className="text-sm text-muted mb-4">Defina nome, descrição e selecione labels existentes para o template.</p>
            <div className="space-y-3 mb-4">
              <input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Nome do template"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
              />
              <input
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
              />
              <div>
                <p className="text-xs text-muted mb-2">Selecionar labels para o template:</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {labels.filter(l => !l.archived).map(l => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setNewTemplateLabelIds(prev => {
                          const next = new Set(prev);
                          if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                          return next;
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${newTemplateLabelIds.has(l.id) ? 'ring-2 ring-brand-500 bg-brand-600/10 text-brand-500' : 'bg-surface-2 text-secondary hover:bg-surface-3'}`}
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.icon && <span>{l.icon}</span>}
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowTemplateEditor(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button
                onClick={handleSaveCustomTemplate}
                disabled={!newTemplateName.trim() || newTemplateLabelIds.size === 0}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white"
              >
                Salvar Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 1: Sessions by label modal */}
      {viewingLabelSessions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">
              Sessões com label: {labels.find(l => l.id === viewingLabelSessions)?.name}
            </h3>
            {labelSessions.length === 0 ? (
              <p className="text-sm text-muted py-4">Nenhuma sessão encontrada com esta label.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
                {labelSessions.map(session => (
                  <div key={session.id} className="flex items-center gap-2 px-3 py-2 bg-surface-1 rounded-lg">
                    <span className="text-sm text-primary truncate flex-1">{session.title || 'Sem título'}</span>
                    <span className="text-[10px] text-muted shrink-0">{session.id.slice(0, 8)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted">{labelSessions.length} sessão(ões)</span>
              <button onClick={() => setViewingLabelSessions(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 2: Groups modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Grupos de Labels</h3>
            <p className="text-sm text-muted mb-4">Organize labels em grupos com collapse/expand.</p>
            <div className="flex items-center gap-2 mb-4">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Nome do grupo"
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
              />
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white transition-all"
              >
                Criar Grupo
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {labelGroups.map(group => (
                <div key={group.id} className="bg-surface-1 border border-default rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary">{group.name}</span>
                    <button onClick={() => handleDeleteGroup(group.id)} className="text-xs text-red-500">Excluir</button>
                  </div>
                  <p className="text-[10px] text-muted">{group.labelIds.length} labels atribuídas</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 2: Assign label to group popover */}
      {groupAssignLabel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Atribuir a Grupo</h3>
            <p className="text-sm text-muted mb-4">Selecione o grupo para a label "{labels.find(l => l.id === groupAssignLabel)?.name}"</p>
            {labelGroups.length === 0 ? (
              <p className="text-sm text-muted py-2">Nenhum grupo criado. Crie um grupo primeiro.</p>
            ) : (
              <div className="space-y-1 mb-4">
                {labelGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => handleAssignToGroup(group.id, groupAssignLabel)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${group.labelIds.includes(groupAssignLabel) ? 'bg-brand-600/10 text-brand-500' : 'hover:bg-surface-1 text-primary'}`}
                  >
                    {group.name} {group.labelIds.includes(groupAssignLabel) && '✓'}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setGroupAssignLabel(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 3: Actions modal */}
      {showActionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">
              Ações Automáticas: {labels.find(l => l.id === showActionsModal)?.name}
            </h3>
            <p className="text-sm text-muted mb-4">Ao aplicar esta label, as seguintes ações serão executadas:</p>
            <div className="space-y-2 mb-4">
              {labelActions.filter(a => a.labelId === showActionsModal).map((action, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-2">
                  <span className="text-xs text-primary flex-1">
                    {action.type === 'notify' && '🔔 Notificar: '}
                    {action.type === 'move_folder' && '📁 Mover para: '}
                    {action.type === 'auto_archive' && '📦 Arquivar: '}
                    {action.config}
                  </span>
                  <button onClick={() => handleRemoveAction(showActionsModal, idx)} className="text-xs text-red-500">×</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <select
                value={newActionType}
                onChange={(e) => setNewActionType(e.target.value as any)}
                className="bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
              >
                <option value="notify">Notificar</option>
                <option value="move_folder">Mover para pasta</option>
                <option value="auto_archive">Arquivar</option>
              </select>
              <input
                value={newActionConfig}
                onChange={(e) => setNewActionConfig(e.target.value)}
                placeholder={newActionType === 'notify' ? 'Mensagem...' : newActionType === 'move_folder' ? 'Nome da pasta...' : 'Após X dias...'}
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none focus:border-brand-500/50"
              />
              <button
                onClick={() => handleAddAction(showActionsModal)}
                disabled={!newActionConfig.trim()}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white"
              >
                +
              </button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowActionsModal(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 5: History modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Histórico de Alterações</h3>
            <p className="text-sm text-muted mb-4">Log de mudanças em labels (renomear, mudar cor, excluir).</p>
            {changeHistory.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">Nenhuma alteração registrada.</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto mb-4">
                {changeHistory.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 px-3 py-2 bg-surface-1 rounded-lg">
                    <span className="text-xs shrink-0 mt-0.5">
                      {entry.action === 'rename' && '✏️'}
                      {entry.action === 'recolor' && '🎨'}
                      {entry.action === 'delete' && '🗑️'}
                      {entry.action === 'create' && '➕'}
                      {entry.action === 'favorite' && '⭐'}
                      {entry.action === 'unfavorite' && '☆'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary truncate">{entry.details}</p>
                      <p className="text-[10px] text-muted">{new Date(entry.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center">
              {changeHistory.length > 0 && (
                <button
                  onClick={() => setChangeHistory([])}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Limpar histórico
                </button>
              )}
              <button onClick={() => setShowHistoryModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium ml-auto">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 8: Conditional Rules modal */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">
              Regras Condicionais: {labels.find(l => l.id === showRulesModal)?.name}
            </h3>
            <p className="text-sm text-muted mb-4">Auto-label com condições compostas (AND/OR entre padrões de texto).</p>
            <div className="space-y-2 mb-4">
              {ruleConditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {idx > 0 && (
                    <select
                      value={cond.operator}
                      onChange={(e) => {
                        const next = [...ruleConditions];
                        next[idx] = { ...next[idx], operator: e.target.value as 'AND' | 'OR' };
                        setRuleConditions(next);
                      }}
                      className="bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none w-16"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}
                  {idx === 0 && <span className="text-xs text-muted w-16">Se</span>}
                  <input
                    value={cond.pattern}
                    onChange={(e) => {
                      const next = [...ruleConditions];
                      next[idx] = { ...next[idx], pattern: e.target.value };
                      setRuleConditions(next);
                    }}
                    placeholder="Padrão regex..."
                    className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary font-mono outline-none focus:border-brand-500/50"
                  />
                  {ruleConditions.length > 1 && (
                    <button
                      onClick={() => setRuleConditions(prev => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-red-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setRuleConditions(prev => [...prev, { pattern: '', operator: 'AND' }])}
              className="text-xs text-brand-500 hover:text-brand-400 mb-4 block"
            >
              + Adicionar condição
            </button>
            {/* Preview matches */}
            {ruleConditions.some(c => c.pattern.trim()) && (
              <div className="bg-surface-1 border border-default rounded-lg p-3 mb-4">
                <p className="text-[10px] text-muted mb-1">Preview: sessões que matcham</p>
                <p className="text-xs text-primary">
                  {allSessions.filter(s => {
                    const rule: ConditionalRule = { id: '', labelId: showRulesModal!, conditions: ruleConditions.filter(c => c.pattern.trim()) };
                    return evaluateConditionalRule(rule, s.title || '');
                  }).length} sessões
                </p>
              </div>
            )}
            <div className="flex justify-between">
              <div className="flex gap-2">
                {conditionalRules.find(r => r.labelId === showRulesModal) && (
                  <button
                    onClick={() => { handleDeleteConditionalRule(showRulesModal!); setShowRulesModal(null); }}
                    className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 rounded-lg text-xs text-red-500 font-medium"
                  >
                    Remover regra
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowRulesModal(null); setRuleConditions([{ pattern: '', operator: 'AND' }]); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                <button
                  onClick={() => handleSaveConditionalRule(showRulesModal!)}
                  disabled={!ruleConditions.some(c => c.pattern.trim())}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white"
                >
                  Salvar Regra
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 32: Stats temporal modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Estatísticas Temporais</h3>
            <p className="text-sm text-muted mb-4">Uso de labels nos últimos 7 dias.</p>
            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {labels.filter(l => !l.archived).slice(0, 15).map(label => {
                const days = Object.keys(statsHistory).sort();
                const values = days.map(d => statsHistory[d]?.[label.id] || 0);
                const max = Math.max(...values, 1);
                return (
                  <div key={label.id} className="bg-surface-1 border border-default rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: label.gradient || label.color }} />
                      {label.icon && <span className="text-xs">{label.icon}</span>}
                      <span className="text-xs font-medium text-primary">{label.name}</span>
                      <span className="text-[10px] text-muted ml-auto">{labelUsage[label.id] || 0} sessões</span>
                    </div>
                    <div className="flex items-end gap-1 h-8">
                      {days.map((d, i) => (
                        <div key={d} className="flex-1 flex flex-col items-center gap-0.5">
                          <div
                            className="w-full rounded-sm transition-all"
                            style={{ height: `${Math.max(2, (values[i] / max) * 28)}px`, backgroundColor: label.color }}
                          />
                          <span className="text-[8px] text-muted">{d.slice(8)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowStatsModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 33 + Improvement 7: Suggestions modal with confidence */}
      {showSuggestions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Sugestões de Labels</h3>
            <p className="text-sm text-muted mb-4">Labels sugeridas para sessões sem marcadores. Ordenadas por confiança.</p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Nenhuma sugestão encontrada.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-surface-1 border border-default rounded-lg px-3 py-2">
                    {/* Improvement 7: Confidence badge */}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      s.confidence >= 80 ? 'bg-green-500/10 text-green-500' :
                      s.confidence >= 50 ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-red-500/10 text-red-500'
                    }`}>
                      {s.confidence >= 80 ? 'Alta' : s.confidence >= 50 ? 'Média' : 'Baixa'} {s.confidence}%
                    </span>
                    <span className="text-xs text-primary flex-1 truncate">{s.title || 'Sem título'}</span>
                    <span className="text-[10px] text-brand-500 bg-brand-600/10 px-2 py-0.5 rounded-full shrink-0">{s.suggestedLabel}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setShowSuggestions(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 37: Shortcuts modal */}
      {showShortcutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Atalhos de Teclado</h3>
            <p className="text-sm text-muted mb-4">Atribua Ctrl+1..9 para aplicar labels rapidamente. Ctrl+L abre este painel.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {labels.filter(l => !l.archived).map(label => {
                const shortcut = labelShortcuts[label.id] || '';
                return (
                  <div key={label.id} className="flex items-center gap-3 bg-surface-1 border border-default rounded-lg px-3 py-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: label.gradient || label.color }} />
                    {label.icon && <span className="text-xs">{label.icon}</span>}
                    <span className="text-xs text-primary flex-1">{label.name}</span>
                    {editingShortcut === label.id ? (
                      <select
                        value={shortcut}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Remove previous assignment of this shortcut
                          const updated = Object.fromEntries(Object.entries(labelShortcuts).filter(([_, v]) => v !== val));
                          if (val) updated[label.id] = val;
                          else delete updated[label.id];
                          setLabelShortcuts(updated);
                          setEditingShortcut(null);
                        }}
                        autoFocus
                        onBlur={() => setEditingShortcut(null)}
                        className="bg-surface-0 border border-default rounded px-2 py-1 text-xs text-primary outline-none"
                      >
                        <option value="">Nenhum</option>
                        {[1,2,3,4,5,6,7,8,9].map(n => (
                          <option key={n} value={`Ctrl+${n}`}>Ctrl+{n}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingShortcut(label.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${shortcut ? 'bg-brand-600/10 text-brand-500' : 'bg-surface-2 text-muted'}`}
                      >
                        {shortcut || 'Definir'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowShortcutModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement 9: Command Palette (Ctrl+K) */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-[15vh] z-[60]" onClick={() => setShowCommandPalette(false)}>
          <div className="bg-surface-0 border border-default rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-default">
              <span className="text-sm text-muted">🔍</span>
              <input
                ref={commandInputRef}
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Buscar label para aplicar..."
                className="flex-1 bg-transparent text-sm text-primary outline-none placeholder-muted"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowCommandPalette(false);
                  if (e.key === 'Enter' && commandPaletteResults.length > 0) {
                    handleCommandSelect(commandPaletteResults[0].id);
                  }
                }}
              />
              <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded">Esc</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {commandPaletteResults.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">Nenhuma label encontrada.</p>
              ) : (
                commandPaletteResults.map(label => (
                  <button
                    key={label.id}
                    onClick={() => handleCommandSelect(label.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-1 transition-colors text-left"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: label.gradient || label.color }} />
                    {label.icon && <span className="text-sm">{label.icon}</span>}
                    <span className="text-sm text-primary flex-1">{label.name}</span>
                    {labelShortcuts[label.id] && (
                      <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded">{labelShortcuts[label.id]}</span>
                    )}
                    <span className="text-[10px] text-muted">{labelUsage[label.id] || 0} usos</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Improvement 5: Bulk rename modal */}
      {showBulkRename && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Renomear em Lote</h3>
            <p className="text-sm text-muted mb-4">As {bulkSelected.size} labels selecionadas serão renomeadas com um prefixo numerado.</p>
            <input
              value={bulkRenamePrefix}
              onChange={(e) => setBulkRenamePrefix(e.target.value)}
              placeholder="Prefixo (ex: Projeto)"
              className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50 mb-4"
              autoFocus
            />
            <p className="text-[10px] text-muted mb-4">Resultado: "{bulkRenamePrefix || 'Prefixo'} 1", "{bulkRenamePrefix || 'Prefixo'} 2", ...</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBulkRename(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button
                onClick={handleBulkRename}
                disabled={!bulkRenamePrefix.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white"
              >
                Renomear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Improvement 10: Undo toast */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-surface-1 border border-default rounded-xl px-4 py-2.5 shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-xs text-primary">{undoToast}</span>
          <button
            onClick={handleGlobalUndo}
            className="text-xs text-brand-500 hover:text-brand-400 font-medium"
          >
            Desfazer (Ctrl+Z)
          </button>
        </div>
      )}
    </div>
  );
}
