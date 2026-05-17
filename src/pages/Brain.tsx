import { useState, useEffect, useRef, useCallback } from 'react';

type BrainTab = 'overview' | 'memory' | 'sync' | 'timeline' | 'duplicates' | 'graph';

interface Memory {
  id: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  usedBy?: string[];
}

interface MemoryVersion {
  content: string;
  timestamp: string;
}

interface CustomCategory {
  name: string;
  color: string;
}

const ados = (window as any).ados;

const defaultCategories = ['general', 'user', 'project', 'feedback', 'reference'];
const MEMORIES_PER_PAGE = 20;
const DECAY_DAYS = 90;
const MEMORY_QUOTA = 100;

// Feature 2: Templates de memoria
const memoryTemplates: { label: string; category: string; content: string }[] = [
  { label: 'Decisao', category: 'general', content: '**Decisao:** \n**Contexto:** \n**Alternativas:** \n**Resultado:** ' },
  { label: 'Aprendizado', category: 'feedback', content: '**Aprendizado:** \n**Fonte:** \n**Aplicacao:** ' },
  { label: 'Contato', category: 'user', content: '**Nome:** \n**Cargo:** \n**Empresa:** \n**Contato:** ' },
  { label: 'Processo', category: 'project', content: '**Processo:** \n**Etapas:**\n1. \n2. \n3. \n**Responsavel:** ' },
];

// Feature 6: Markdown renderer simples
function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-surface-2 px-1 rounded text-xs">$1</code>');
  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand-500 underline">$1</a>');
  // newlines
  html = html.replace(/\n/g, '<br/>');
  return html;
}

// Feature 1: Fuzzy match para busca semantica
function fuzzyMatch(text: string, query: string): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  if (textLower.includes(queryLower)) return 1;
  // Simple trigram similarity
  const getTrigrams = (s: string) => {
    const trigrams = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) trigrams.add(s.slice(i, i + 3));
    return trigrams;
  };
  const textTrigrams = getTrigrams(textLower);
  const queryTrigrams = getTrigrams(queryLower);
  if (queryTrigrams.size === 0) return 0;
  let matches = 0;
  queryTrigrams.forEach(t => { if (textTrigrams.has(t)) matches++; });
  return matches / queryTrigrams.size;
}

export default function Brain() {
  const [tab, setTab] = useState<BrainTab>('overview');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ content: '', category: 'general' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [formError, setFormError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  // #3 Tagging multiplo
  const [memoryTags, setMemoryTags] = useState<Record<string, string[]>>({});
  const [tagInput, setTagInput] = useState<Record<string, string>>({});
  // #4 Visualizacao de uso
  const [memoryUsage, setMemoryUsage] = useState<Record<string, string[]>>({});
  // #6 Paginacao
  const [currentPage, setCurrentPage] = useState(1);
  // #9 Sync incremental
  const [syncChanges, setSyncChanges] = useState<Array<{ id: string; action: string; timestamp: string }>>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  // #10 Backup automatico
  const backupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  // === NEW Feature 1: Busca semantica ===
  const [semanticSearch, setSemanticSearch] = useState('');

  // === NEW Feature 2: Templates (state handled inline) ===

  // === NEW Feature 3: Quota visual (uses MEMORY_QUOTA constant) ===

  // === NEW Feature 4: Snapshot periodico ===
  const [snapshots, setSnapshots] = useState<{ timestamp: string; count: number }[]>([]);

  // === NEW Feature 5: Ordenacao ===
  const [sortOrder, setSortOrder] = useState<'created' | 'edited' | 'relevance' | 'alpha'>('created');

  // === Feature 27: Memory health score ===
  const [healthScore, setHealthScore] = useState(100);

  // === Feature 28: Auto-cleanup stale memories ===
  const [cleanupPreview, setCleanupPreview] = useState<Memory[]>([]);
  const [showCleanupModal, setShowCleanupModal] = useState(false);

  // === Feature 30: Search with filters ===
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('');

  // === Feature 32: Memory merge ===
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);

  // === Feature 34: Memory graph visualization ===
  const [showGraph, setShowGraph] = useState(false);

  // === Feature 35: Memory access log ===
  const [accessLog, setAccessLog] = useState<Array<{ memId: string; timestamp: string }>>([]);
  const [showAccessLog, setShowAccessLog] = useState(false);

  // === Feature 36: Memory suggestions ===
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // === NEW Feature 7: Categorias customizaveis ===
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8b5cf6');

  // === NEW Feature 8: Metricas do brain ===
  const [mostAccessedId, setMostAccessedId] = useState<string | null>(null);

  // === Feature 1: Versionamento ===
  const [versionsModal, setVersionsModal] = useState<string | null>(null);

  // === Feature 2: Resolucao de conflitos ===
  const [conflictDetected, setConflictDetected] = useState<{ id: string; local: string; remote: string } | null>(null);

  // === Feature 3: Exportar memorias ===
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTagFilter, setExportTagFilter] = useState<string[]>([]);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');

  // === Feature 4: Importar memorias ===
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Memory[]>([]);
  const [importError, setImportError] = useState('');

  // === Feature 5: Memorias vinculadas ===
  const [linkMode, setLinkMode] = useState<string | null>(null);
  const [memoryLinks, setMemoryLinks] = useState<[string, string][]>([]);

  // === Feature 6: Decaimento de relevancia ===
  const [lastAccessed, setLastAccessed] = useState<Record<string, string>>({});
  const [archivedMemories, setArchivedMemories] = useState<Memory[]>([]);

  // === Feature 7: Memorias fixadas ===
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // === Feature 8: Bulk actions ===
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');

  // === UI/UX Improvement 1: Hover preview ===
  const [hoveredMemoryId, setHoveredMemoryId] = useState<string | null>(null);

  // === UI/UX Improvement 4: Importance score (manual overrides) ===
  const [importanceOverrides, setImportanceOverrides] = useState<Record<string, number>>({});

  // === UI/UX Improvement 5: Auto-categorization suggestion ===
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

  // === UI/UX Improvement 6: Real-time duplicate detection ===
  const [realtimeDuplicateWarning, setRealtimeDuplicateWarning] = useState<{ title: string } | null>(null);

  // === UI/UX Improvement 9: Deduplication panel state ===
  const [deduplicationPairs, setDeduplicationPairs] = useState<Array<{ a: Memory; b: Memory; similarity: number }>>([]);
  const [ignoredDedupPairs, setIgnoredDedupPairs] = useState<Set<string>>(new Set());

  useEffect(() => { loadMemories(); }, []);

  // Load persistent state from localStorage
  useEffect(() => {
    const links = JSON.parse(localStorage.getItem('ados-brain-links') || '[]');
    setMemoryLinks(links);
    const accessed = JSON.parse(localStorage.getItem('ados-brain-last-accessed') || '{}');
    setLastAccessed(accessed);
    const archived = JSON.parse(localStorage.getItem('ados-brain-archived') || '[]');
    setArchivedMemories(archived);
    const pinned = JSON.parse(localStorage.getItem('ados-brain-pinned') || '[]');
    setPinnedIds(pinned);
    // NEW: Load custom categories
    const cats = JSON.parse(localStorage.getItem('ados-brain-custom-categories') || '[]');
    setCustomCategories(cats);
    // Load importance overrides
    const overrides = JSON.parse(localStorage.getItem('ados-brain-importance-overrides') || '{}');
    setImportanceOverrides(overrides);
    // Load ignored dedup pairs
    const ignoredPairs = JSON.parse(localStorage.getItem('ados-brain-ignored-dedup') || '[]');
    setIgnoredDedupPairs(new Set(ignoredPairs));
    // NEW: Load snapshots list
    const snaps = JSON.parse(localStorage.getItem('ados-brain-snapshots') || '[]');
    setSnapshots(snaps);
    // NEW: Compute most accessed
    if (Object.keys(accessed).length > 0) {
      // most accessed = most recently accessed across all (proxy for "most accessed")
      const sorted = Object.entries(accessed as Record<string, string>).sort((a, b) => b[1].localeCompare(a[1]));
      if (sorted.length > 0) setMostAccessedId(sorted[0][0]);
    }
  }, []);

  // #10 Backup automatico — auto-save to localStorage every 5 minutes
  useEffect(() => {
    const saved = localStorage.getItem('ados-brain-last-backup');
    if (saved) setLastBackupAt(saved);
    backupIntervalRef.current = setInterval(() => {
      if (memories.length > 0) {
        const backup = JSON.stringify({ memories, exportedAt: new Date().toISOString() });
        localStorage.setItem('ados-brain-backup', backup);
        const now = new Date().toISOString();
        localStorage.setItem('ados-brain-last-backup', now);
        setLastBackupAt(now);
      }
    }, 5 * 60 * 1000);
    return () => { if (backupIntervalRef.current) clearInterval(backupIntervalRef.current); };
  }, [memories]);

  // #9 Sync incremental — track changes
  const trackChange = useCallback((id: string, action: 'add' | 'edit' | 'delete') => {
    const change = { id, action, timestamp: new Date().toISOString() };
    setSyncChanges(prev => [...prev, change]);
    const stored = JSON.parse(localStorage.getItem('ados-brain-sync-changes') || '[]');
    stored.push(change);
    localStorage.setItem('ados-brain-sync-changes', JSON.stringify(stored));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('ados-brain-sync-changes');
    if (stored) setSyncChanges(JSON.parse(stored));
    const lastSync = localStorage.getItem('ados-brain-last-sync');
    if (lastSync) setLastSyncAt(lastSync);
  }, []);

  const loadMemories = async () => {
    const rows = await ados.db.getMemories();
    // Ensure tags field exists
    const withTags = rows.map((m: any) => ({ ...m, tags: m.tags || [] }));
    setMemories(withTags);
    // #3 Load saved tags from localStorage
    const savedTags = JSON.parse(localStorage.getItem('ados-brain-tags') || '{}');
    setMemoryTags(savedTags);
    // #4 Load usage data
    try {
      const sessions = await ados.db.getSessions();
      const usage: Record<string, string[]> = {};
      for (const mem of withTags) {
        const refs = sessions.filter((s: any) =>
          s.title?.toLowerCase().includes(mem.content.slice(0, 30).toLowerCase()) ||
          s.context?.includes(mem.id)
        ).map((s: any) => s.title || s.id);
        if (refs.length > 0) usage[mem.id] = refs;
      }
      setMemoryUsage(usage);
    } catch {}
    setCurrentPage(1);
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      const rows = await ados.db.searchMemories(query);
      setMemories(rows);
    } else {
      loadMemories();
    }
  };

  const validateContent = (text: string): string => {
    if (text.trim().length < 10) return 'Minimo 10 caracteres';
    if (text.length > 2000) return 'Maximo 2000 caracteres';
    return '';
  };

  const checkDuplicate = (text: string): string => {
    const lower = text.toLowerCase().trim();
    if (lower.length < 10) return '';
    const similar = memories.find(m => {
      const mLower = m.content.toLowerCase().trim();
      if (mLower === lower) return true;
      const shorter = lower.length < mLower.length ? lower : mLower;
      const longer = lower.length < mLower.length ? mLower : lower;
      return longer.includes(shorter) || shorter.length / longer.length > 0.8 && longer.startsWith(shorter.slice(0, Math.floor(shorter.length * 0.8)));
    });
    return similar ? `Memoria similar ja existe: "${similar.content.slice(0, 50)}..."` : '';
  };

  const handleFormChange = (content: string) => {
    setForm({ ...form, content });
    setFormError(content.trim() ? validateContent(content) : '');
    setDuplicateWarning(content.trim().length >= 10 ? checkDuplicate(content) : '');
    // UI/UX Improvement 5: Auto-categorization suggestion
    if (content.trim().length >= 15) {
      const suggested = suggestCategoryFromContent(content);
      setSuggestedCategory(suggested);
    } else {
      setSuggestedCategory(null);
    }
    // UI/UX Improvement 6: Real-time duplicate detection
    const dupCheck = checkRealtimeDuplicate(content);
    setRealtimeDuplicateWarning(dupCheck);
  };

  const handleAdd = async () => {
    const error = validateContent(form.content);
    if (error) { setFormError(error); return; }
    const id = crypto.randomUUID();
    await ados.db.addMemory(id, form.content, form.category);
    trackChange(id, 'add');
    // Track access
    trackAccess(id);
    setForm({ content: '', category: 'general' });
    setFormError('');
    setDuplicateWarning('');
    setShowAdd(false);
    loadMemories();
  };

  const handleDelete = async (id: string) => {
    await ados.db.deleteMemory(id);
    trackChange(id, 'delete');
    setConfirmDelete(null);
    loadMemories();
  };

  // === Feature 1: Save version before editing ===
  const saveVersion = (id: string, previousContent: string) => {
    const key = `ados-brain-versions-${id}`;
    const versions: MemoryVersion[] = JSON.parse(localStorage.getItem(key) || '[]');
    versions.push({ content: previousContent, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(versions));
  };

  const getVersions = (id: string): MemoryVersion[] => {
    return JSON.parse(localStorage.getItem(`ados-brain-versions-${id}`) || '[]');
  };

  const restoreVersion = async (id: string, content: string) => {
    const mem = memories.find(m => m.id === id);
    if (!mem) return;
    saveVersion(id, mem.content);
    await ados.db.deleteMemory(id);
    await ados.db.addMemory(id, content, mem.category);
    trackChange(id, 'edit');
    setVersionsModal(null);
    loadMemories();
  };

  const handleEditSave = async (id: string) => {
    const error = validateContent(editContent);
    if (error) return;
    const mem = memories.find(m => m.id === id);
    if (mem) saveVersion(id, mem.content);
    await ados.db.deleteMemory(id);
    await ados.db.addMemory(id, editContent, mem?.category || 'general');
    trackChange(id, 'edit');
    trackAccess(id);
    setEditingId(null);
    setEditContent('');
    loadMemories();
  };

  // === Feature 2: Conflict resolution ===
  const handleConflictResolve = async (resolution: 'local' | 'remote' | 'merge') => {
    if (!conflictDetected) return;
    const { id, local, remote } = conflictDetected;
    let finalContent = local;
    if (resolution === 'remote') finalContent = remote;
    if (resolution === 'merge') finalContent = `${local}\n---\n${remote}`;
    const mem = memories.find(m => m.id === id);
    if (mem) saveVersion(id, mem.content);
    await ados.db.deleteMemory(id);
    await ados.db.addMemory(id, finalContent, mem?.category || 'general');
    trackChange(id, 'edit');
    setConflictDetected(null);
    loadMemories();
  };

  // Simulate conflict detection on sync
  const simulateConflictCheck = () => {
    if (memories.length > 0) {
      const randomMem = memories[Math.floor(Math.random() * memories.length)];
      setConflictDetected({
        id: randomMem.id,
        local: randomMem.content,
        remote: randomMem.content + ' [alterado remotamente]'
      });
    }
  };

  // #3 Tagging — add/remove tags for a memory
  const handleAddTag = (memId: string) => {
    const tag = (tagInput[memId] || '').trim();
    if (!tag) return;
    const current = memoryTags[memId] || [];
    if (current.includes(tag)) return;
    const updated = { ...memoryTags, [memId]: [...current, tag] };
    setMemoryTags(updated);
    localStorage.setItem('ados-brain-tags', JSON.stringify(updated));
    setTagInput({ ...tagInput, [memId]: '' });
  };

  const handleRemoveTag = (memId: string, tag: string) => {
    const current = memoryTags[memId] || [];
    const updated = { ...memoryTags, [memId]: current.filter(t => t !== tag) };
    setMemoryTags(updated);
    localStorage.setItem('ados-brain-tags', JSON.stringify(updated));
  };

  // #9 Sync incremental — mark sync as done
  const handleMarkSynced = () => {
    const now = new Date().toISOString();
    setLastSyncAt(now);
    setSyncChanges([]);
    localStorage.setItem('ados-brain-last-sync', now);
    localStorage.removeItem('ados-brain-sync-changes');
  };

  // === Feature 3: Export memories ===
  const getAllTags = (): string[] => {
    const allTags = new Set<string>();
    Object.values(memoryTags).forEach(tags => tags.forEach(t => allTags.add(t)));
    return Array.from(allTags);
  };

  const getFilteredExportMemories = (): Memory[] => {
    return memories.filter(m => {
      if (exportTagFilter.length > 0) {
        const mTags = memoryTags[m.id] || [];
        if (!exportTagFilter.some(t => mTags.includes(t))) return false;
      }
      if (exportDateFrom && new Date(m.createdAt) < new Date(exportDateFrom)) return false;
      if (exportDateTo && new Date(m.createdAt) > new Date(exportDateTo + 'T23:59:59')) return false;
      return true;
    });
  };

  const handleExport = (mode: 'clipboard' | 'download') => {
    const filtered = getFilteredExportMemories();
    const data = JSON.stringify({ memories: filtered, exportedAt: new Date().toISOString(), tags: memoryTags }, null, 2);
    if (mode === 'clipboard') {
      navigator.clipboard.writeText(data);
    } else {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brain-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setShowExportModal(false);
  };

  // === Feature 4: Import memories ===
  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (!parsed.memories || !Array.isArray(parsed.memories)) {
        setImportError('Formato invalido: esperado { memories: [...] }');
        return;
      }
      // Check duplicates by first 50 chars
      const existing = new Set(memories.map(m => m.content.slice(0, 50).toLowerCase()));
      const newOnes = parsed.memories.filter((m: Memory) =>
        !existing.has(m.content.slice(0, 50).toLowerCase())
      );
      setImportPreview(newOnes);
      setImportError(newOnes.length === 0 ? 'Todas as memorias ja existem (duplicadas).' : '');
    } catch (e) {
      setImportError('Erro ao ler clipboard ou JSON invalido.');
    }
  };

  const handleImportFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.memories || !Array.isArray(parsed.memories)) {
          setImportError('Formato invalido: esperado { memories: [...] }');
          return;
        }
        const existing = new Set(memories.map(m => m.content.slice(0, 50).toLowerCase()));
        const newOnes = parsed.memories.filter((m: Memory) =>
          !existing.has(m.content.slice(0, 50).toLowerCase())
        );
        setImportPreview(newOnes);
        setImportError(newOnes.length === 0 ? 'Todas as memorias ja existem (duplicadas).' : '');
      } catch {
        setImportError('Erro ao parsear JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    for (const mem of importPreview) {
      const id = crypto.randomUUID();
      await ados.db.addMemory(id, mem.content, mem.category || 'general');
      trackChange(id, 'add');
    }
    setShowImportModal(false);
    setImportPreview([]);
    setImportError('');
    loadMemories();
  };

  // === Feature 5: Memorias vinculadas ===
  const handleLinkClick = (memId: string) => {
    if (!linkMode) {
      setLinkMode(memId);
    } else if (linkMode === memId) {
      setLinkMode(null);
    } else {
      // Create bidirectional link
      const exists = memoryLinks.some(([a, b]) =>
        (a === linkMode && b === memId) || (a === memId && b === linkMode)
      );
      if (!exists) {
        const updated: [string, string][] = [...memoryLinks, [linkMode, memId]];
        setMemoryLinks(updated);
        localStorage.setItem('ados-brain-links', JSON.stringify(updated));
      }
      setLinkMode(null);
    }
  };

  const getLinkCount = (memId: string): number => {
    return memoryLinks.filter(([a, b]) => a === memId || b === memId).length;
  };

  // === Feature 6: Decaimento de relevancia ===
  const trackAccess = (id: string) => {
    const updated = { ...lastAccessed, [id]: new Date().toISOString() };
    setLastAccessed(updated);
    localStorage.setItem('ados-brain-last-accessed', JSON.stringify(updated));
  };

  const needsReview = (id: string): boolean => {
    const accessed = lastAccessed[id];
    if (!accessed) return true; // never accessed
    const daysSince = (Date.now() - new Date(accessed).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= DECAY_DAYS;
  };

  const handleArchive = (id: string) => {
    const mem = memories.find(m => m.id === id);
    if (!mem) return;
    const updated = [...archivedMemories, mem];
    setArchivedMemories(updated);
    localStorage.setItem('ados-brain-archived', JSON.stringify(updated));
    handleDelete(id);
  };

  // === Feature 7: Memorias fixadas ===
  const togglePin = (id: string) => {
    const updated = pinnedIds.includes(id) ? pinnedIds.filter(p => p !== id) : [...pinnedIds, id];
    setPinnedIds(updated);
    localStorage.setItem('ados-brain-pinned', JSON.stringify(updated));
  };

  // === Feature 8: Bulk actions ===
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await ados.db.deleteMemory(id);
      trackChange(id, 'delete');
    }
    setSelectedIds(new Set());
    loadMemories();
  };

  const handleBulkExport = () => {
    const selected = memories.filter(m => selectedIds.has(m.id));
    const data = JSON.stringify({ memories: selected, exportedAt: new Date().toISOString(), tags: memoryTags }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brain-export-selected-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSelectedIds(new Set());
  };

  const handleBulkTag = () => {
    const tag = bulkTagInput.trim();
    if (!tag) return;
    const updated = { ...memoryTags };
    for (const id of selectedIds) {
      const current = updated[id] || [];
      if (!current.includes(tag)) updated[id] = [...current, tag];
    }
    setMemoryTags(updated);
    localStorage.setItem('ados-brain-tags', JSON.stringify(updated));
    setBulkTagInput('');
    setShowBulkTag(false);
    setSelectedIds(new Set());
  };

  // === NEW Feature 7: Combined categories (default + custom) ===
  const categories = [...defaultCategories, ...customCategories.map(c => c.name)];

  const handleAddCustomCategory = () => {
    const name = newCatName.trim().toLowerCase();
    if (!name || categories.includes(name)) return;
    const updated = [...customCategories, { name, color: newCatColor }];
    setCustomCategories(updated);
    localStorage.setItem('ados-brain-custom-categories', JSON.stringify(updated));
    setNewCatName('');
    setNewCatColor('#8b5cf6');
    setShowAddCategory(false);
  };

  const handleRemoveCustomCategory = (name: string) => {
    const updated = customCategories.filter(c => c.name !== name);
    setCustomCategories(updated);
    localStorage.setItem('ados-brain-custom-categories', JSON.stringify(updated));
  };

  // === Feature 27: Compute health score ===
  useEffect(() => {
    if (memories.length === 0) { setHealthScore(100); return; }
    let score = 100;
    // Penalize for stale memories (not accessed in 90+ days)
    const staleCount = memories.filter(m => needsReview(m.id)).length;
    score -= Math.min(30, (staleCount / memories.length) * 40);
    // Penalize for memories without tags
    const untaggedCount = memories.filter(m => !(memoryTags[m.id]?.length)).length;
    score -= Math.min(20, (untaggedCount / memories.length) * 25);
    // Penalize for approaching quota
    if (memories.length >= MEMORY_QUOTA) score -= 20;
    else if (memories.length >= MEMORY_QUOTA * 0.8) score -= 10;
    // Penalize for no links
    const unlinkedCount = memories.filter(m => getLinkCount(m.id) === 0).length;
    score -= Math.min(15, (unlinkedCount / memories.length) * 15);
    setHealthScore(Math.max(0, Math.round(score)));
  }, [memories, memoryTags, lastAccessed, memoryLinks]);

  // === Feature 28: Auto-cleanup — find stale memories ===
  const handleAutoCleanup = () => {
    const stale = memories.filter(m => {
      const accessed = lastAccessed[m.id];
      if (!accessed) return true;
      const daysSince = (Date.now() - new Date(accessed).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= DECAY_DAYS && !pinnedIds.includes(m.id);
    });
    setCleanupPreview(stale);
    setShowCleanupModal(true);
  };

  const handleConfirmCleanup = async () => {
    for (const mem of cleanupPreview) {
      const updated = [...archivedMemories, mem];
      setArchivedMemories(updated);
      localStorage.setItem('ados-brain-archived', JSON.stringify(updated));
      await ados.db.deleteMemory(mem.id);
      trackChange(mem.id, 'delete');
    }
    setShowCleanupModal(false);
    setCleanupPreview([]);
    loadMemories();
  };

  // === Feature 32: Memory merge ===
  const handleToggleMergeSelect = (id: string) => {
    setMergeSelection(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleMergeMemories = async () => {
    if (mergeSelection.length < 2) return;
    const toMerge = memories.filter(m => mergeSelection.includes(m.id));
    const mergedContent = toMerge.map(m => m.content).join('\n---\n');
    const category = toMerge[0].category;
    // Delete old ones
    for (const m of toMerge) {
      await ados.db.deleteMemory(m.id);
      trackChange(m.id, 'delete');
    }
    // Create merged
    const newId = crypto.randomUUID();
    await ados.db.addMemory(newId, mergedContent, category);
    trackChange(newId, 'add');
    // Merge tags
    const mergedTags = Array.from(new Set(toMerge.flatMap(m => memoryTags[m.id] || [])));
    if (mergedTags.length > 0) {
      const updatedTags = { ...memoryTags, [newId]: mergedTags };
      toMerge.forEach(m => delete updatedTags[m.id]);
      setMemoryTags(updatedTags);
      localStorage.setItem('ados-brain-tags', JSON.stringify(updatedTags));
    }
    setMergeSelection([]);
    setMergeMode(false);
    setShowMergeModal(false);
    loadMemories();
  };

  // === Feature 35: Access log ===
  useEffect(() => {
    const log = JSON.parse(localStorage.getItem('ados-brain-access-log') || '[]');
    setAccessLog(log);
  }, []);

  const trackAccessWithLog = (id: string) => {
    trackAccess(id);
    const entry = { memId: id, timestamp: new Date().toISOString() };
    const updated = [...accessLog, entry].slice(-200);
    setAccessLog(updated);
    localStorage.setItem('ados-brain-access-log', JSON.stringify(updated));
  };

  // === Feature 36: Memory suggestions ===
  useEffect(() => {
    if (memories.length === 0) { setSuggestions([]); return; }
    const sugs: string[] = [];
    // Suggest tagging untagged memories
    const untagged = memories.filter(m => !(memoryTags[m.id]?.length));
    if (untagged.length > 3) sugs.push(`${untagged.length} memorias sem tags — considere categorizar`);
    // Suggest reviewing stale
    const stale = memories.filter(m => needsReview(m.id));
    if (stale.length > 0) sugs.push(`${stale.length} memorias nao acessadas ha 90+ dias — revisar ou arquivar`);
    // Suggest merging similar
    const checked = new Set<string>();
    let duplicateCount = 0;
    memories.forEach(m => {
      if (checked.has(m.id)) return;
      memories.forEach(n => {
        if (m.id === n.id || checked.has(n.id)) return;
        if (fuzzyMatch(m.content, n.content) > 0.7) {
          duplicateCount++;
          checked.add(n.id);
        }
      });
    });
    if (duplicateCount > 0) sugs.push(`${duplicateCount} par(es) de memorias similares — considere merge`);
    // Quota warning
    if (memories.length >= MEMORY_QUOTA * 0.9) sugs.push('Proximo do limite de memorias — considere arquivar');
    setSuggestions(sugs);
  }, [memories, memoryTags, lastAccessed]);

  // === NEW Feature 4: Snapshot ===
  const handleSaveSnapshot = () => {
    const ts = new Date().toISOString();
    const key = `ados-brain-snapshot-${ts}`;
    localStorage.setItem(key, JSON.stringify({ memories, tags: memoryTags, timestamp: ts }));
    const updated = [...snapshots, { timestamp: ts, count: memories.length }];
    setSnapshots(updated);
    localStorage.setItem('ados-brain-snapshots', JSON.stringify(updated));
  };

  // === UI/UX Improvement 4: Compute importance score ===
  const getImportanceScore = (memId: string): number => {
    if (importanceOverrides[memId]) return importanceOverrides[memId];
    const accessCount = accessLog.filter(e => e.memId === memId).length;
    const linkCount = getLinkCount(memId);
    const tagCount = (memoryTags[memId] || []).length;
    const raw = Math.min(5, Math.ceil((accessCount * 0.5 + linkCount * 1.5 + tagCount * 1) / 2));
    return Math.max(1, raw);
  };

  const setImportanceManual = (memId: string, score: number) => {
    const updated = { ...importanceOverrides, [memId]: score };
    setImportanceOverrides(updated);
    localStorage.setItem('ados-brain-importance-overrides', JSON.stringify(updated));
  };

  // === UI/UX Improvement 5: Auto-categorization ===
  const suggestCategoryFromContent = (content: string): string | null => {
    const lower = content.toLowerCase();
    const keywordMap: Record<string, string[]> = {
      user: ['nome', 'contato', 'email', 'telefone', 'cargo', 'empresa', 'pessoa'],
      project: ['projeto', 'sprint', 'task', 'deadline', 'entrega', 'milestone', 'roadmap'],
      feedback: ['feedback', 'aprendizado', 'melhoria', 'sugestao', 'review', 'bug', 'erro'],
      reference: ['link', 'documentacao', 'api', 'url', 'referencia', 'fonte', 'tutorial'],
    };
    let bestCat: string | null = null;
    let bestScore = 0;
    for (const [cat, keywords] of Object.entries(keywordMap)) {
      const score = keywords.filter(kw => lower.includes(kw)).length;
      if (score > bestScore) { bestScore = score; bestCat = cat; }
    }
    return bestScore > 0 ? bestCat : null;
  };

  // === UI/UX Improvement 6: Real-time duplicate detection (word overlap) ===
  const checkRealtimeDuplicate = (content: string): { title: string } | null => {
    if (content.trim().length < 20) return null;
    const words = new Set(content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    if (words.size < 3) return null;
    for (const mem of memories) {
      const memWords = new Set(mem.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      if (memWords.size === 0) continue;
      let overlap = 0;
      words.forEach(w => { if (memWords.has(w)) overlap++; });
      const similarity = overlap / Math.max(words.size, memWords.size);
      if (similarity > 0.8) {
        return { title: mem.content.slice(0, 60) };
      }
    }
    return null;
  };

  // === UI/UX Improvement 8: Export as Markdown ===
  const handleExportMarkdown = () => {
    const catGroups: Record<string, Memory[]> = {};
    for (const mem of memories) {
      if (!catGroups[mem.category]) catGroups[mem.category] = [];
      catGroups[mem.category].push(mem);
    }
    let md = '# Brain - Exportacao de Memorias\n\n';
    md += `> Exportado em ${new Date().toLocaleDateString('pt-BR')} | Total: ${memories.length} memorias\n\n`;
    md += '## Indice\n\n';
    for (const cat of Object.keys(catGroups)) {
      md += `- [${cat.charAt(0).toUpperCase() + cat.slice(1)}](#${cat})\n`;
    }
    md += '\n---\n\n';
    for (const [cat, mems] of Object.entries(catGroups)) {
      md += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
      for (const mem of mems) {
        const tags = (memoryTags[mem.id] || []).map(t => `\`${t}\``).join(' ');
        md += `### ${mem.content.slice(0, 60)}${mem.content.length > 60 ? '...' : ''}\n\n`;
        md += `${mem.content}\n\n`;
        md += `- **Criado:** ${new Date(mem.createdAt).toLocaleDateString('pt-BR')}\n`;
        if (tags) md += `- **Tags:** ${tags}\n`;
        md += `- **Links:** ${getLinkCount(mem.id)}\n`;
        md += '\n---\n\n';
      }
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brain-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === UI/UX Improvement 9: Compute deduplication pairs ===
  const computeDeduplicationPairs = useCallback(() => {
    const pairs: Array<{ a: Memory; b: Memory; similarity: number }> = [];
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const pairKey = `${memories[i].id}:${memories[j].id}`;
        if (ignoredDedupPairs.has(pairKey)) continue;
        const wordsA = new Set(memories[i].content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const wordsB = new Set(memories[j].content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        if (wordsA.size === 0 || wordsB.size === 0) continue;
        let overlap = 0;
        wordsA.forEach(w => { if (wordsB.has(w)) overlap++; });
        const similarity = overlap / Math.min(wordsA.size, wordsB.size);
        if (similarity > 0.7) {
          pairs.push({ a: memories[i], b: memories[j], similarity });
        }
      }
    }
    setDeduplicationPairs(pairs.sort((x, y) => y.similarity - x.similarity));
  }, [memories, ignoredDedupPairs]);

  const handleIgnoreDedupPair = (aId: string, bId: string) => {
    const key = `${aId}:${bId}`;
    const updated = new Set(ignoredDedupPairs);
    updated.add(key);
    setIgnoredDedupPairs(updated);
    localStorage.setItem('ados-brain-ignored-dedup', JSON.stringify(Array.from(updated)));
    setDeduplicationPairs(prev => prev.filter(p => !(p.a.id === aId && p.b.id === bId)));
  };

  const handleMergeDedupPair = async (aId: string, bId: string) => {
    const memA = memories.find(m => m.id === aId);
    const memB = memories.find(m => m.id === bId);
    if (!memA || !memB) return;
    const mergedContent = memA.content + '\n---\n' + memB.content;
    await ados.db.deleteMemory(aId);
    await ados.db.deleteMemory(bId);
    trackChange(aId, 'delete');
    trackChange(bId, 'delete');
    const newId = crypto.randomUUID();
    await ados.db.addMemory(newId, mergedContent, memA.category);
    trackChange(newId, 'add');
    const mergedTags = Array.from(new Set([...(memoryTags[aId] || []), ...(memoryTags[bId] || [])]));
    if (mergedTags.length > 0) {
      const updatedTags = { ...memoryTags, [newId]: mergedTags };
      delete updatedTags[aId];
      delete updatedTags[bId];
      setMemoryTags(updatedTags);
      localStorage.setItem('ados-brain-tags', JSON.stringify(updatedTags));
    }
    loadMemories();
  };

  // === UI/UX Improvement 3: Extended bulk actions ===
  const handleBulkChangeCategory = async (newCategory: string) => {
    for (const id of selectedIds) {
      const mem = memories.find(m => m.id === id);
      if (mem) {
        await ados.db.deleteMemory(id);
        await ados.db.addMemory(id, mem.content, newCategory);
        trackChange(id, 'edit');
      }
    }
    setSelectedIds(new Set());
    loadMemories();
  };

  const handleBulkArchive = async () => {
    for (const id of selectedIds) {
      const mem = memories.find(m => m.id === id);
      if (mem) {
        const updated = [...archivedMemories, mem];
        setArchivedMemories(updated);
        localStorage.setItem('ados-brain-archived', JSON.stringify(updated));
        await ados.db.deleteMemory(id);
        trackChange(id, 'delete');
      }
    }
    setSelectedIds(new Set());
    loadMemories();
  };

  const handleBulkUnlink = () => {
    const updated = memoryLinks.filter(([a, b]) => !selectedIds.has(a) && !selectedIds.has(b));
    setMemoryLinks(updated);
    localStorage.setItem('ados-brain-links', JSON.stringify(updated));
    setSelectedIds(new Set());
  };

  // === NEW Feature 1: Busca semantica (fuzzy filter) ===
  const getSemanticFiltered = useCallback((mems: Memory[]): Memory[] => {
    if (!semanticSearch.trim()) return mems;
    const scored = mems.map(m => ({ mem: m, score: fuzzyMatch(m.content, semanticSearch) }));
    return scored.filter(s => s.score > 0.3).sort((a, b) => b.score - a.score).map(s => s.mem);
  }, [semanticSearch]);

  // === NEW Feature 5: Ordenacao ===
  const applySortOrder = useCallback((mems: Memory[]): Memory[] => {
    const copy = [...mems];
    switch (sortOrder) {
      case 'created':
        return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'edited':
        return copy.sort((a, b) => {
          const aTime = a.updatedAt || a.createdAt;
          const bTime = b.updatedAt || b.createdAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
      case 'relevance':
        return copy.sort((a, b) => {
          const aAccess = lastAccessed[a.id] ? new Date(lastAccessed[a.id]).getTime() : 0;
          const bAccess = lastAccessed[b.id] ? new Date(lastAccessed[b.id]).getTime() : 0;
          return bAccess - aAccess;
        });
      case 'alpha':
        return copy.sort((a, b) => a.content.localeCompare(b.content));
      default:
        return copy;
    }
  }, [sortOrder, lastAccessed]);

  // === Pagination with pinned at top ===
  const sortedMemories = (() => {
    let filtered = memories;
    // Feature 30: Apply category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(m => m.category === filterCategory);
    }
    // Feature 30: Apply tag filter
    if (filterTag) {
      filtered = filtered.filter(m => (memoryTags[m.id] || []).includes(filterTag));
    }
    const semanticFiltered = getSemanticFiltered(filtered);
    const sorted = applySortOrder(semanticFiltered);
    const pinned = sorted.filter(m => pinnedIds.includes(m.id));
    const unpinned = sorted.filter(m => !pinnedIds.includes(m.id));
    return [...pinned, ...unpinned];
  })();

  const totalPages = Math.ceil(sortedMemories.length / MEMORIES_PER_PAGE);
  const paginatedMemories = sortedMemories.slice((currentPage - 1) * MEMORIES_PER_PAGE, currentPage * MEMORIES_PER_PAGE);

  const categoryColors: Record<string, string> = {
    general: 'bg-surface-3 text-muted',
    user: 'bg-blue-500/10 text-blue-500',
    project: 'bg-purple-500/10 text-purple-500',
    feedback: 'bg-yellow-500/10 text-yellow-600',
    reference: 'bg-green-500/10 text-green-500',
    // Add custom category colors dynamically
    ...Object.fromEntries(customCategories.map(c => [c.name, `text-white`])),
  };

  // Get category style (including custom colors)
  const getCategoryStyle = (cat: string): { className: string; style?: React.CSSProperties } => {
    const custom = customCategories.find(c => c.name === cat);
    if (custom) {
      return { className: 'text-[10px] px-2 py-0.5 rounded-full font-medium text-white', style: { backgroundColor: custom.color + '33', color: custom.color } };
    }
    return { className: `text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[cat] || categoryColors.general}` };
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="bg-surface-1 border border-default rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-primary flex items-center gap-2">
                Shared Brain
                <span className="text-[10px] px-2 py-0.5 bg-brand-600/20 text-brand-400 rounded-full font-medium">Beta</span>
              </h1>
              <p className="text-sm text-muted mt-1">
                Camada de memoria do workspace: {memories.length} registros armazenados localmente.
              </p>
            </div>
            <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
              {(['overview', 'memory', 'timeline', 'graph', 'duplicates', 'sync'] as BrainTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); if (t === 'duplicates') computeDeduplicationPairs(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tab === t ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                  }`}
                >
                  {t === 'overview' ? 'Visao geral' : t === 'memory' ? 'Memoria' : t === 'timeline' ? 'Timeline' : t === 'graph' ? 'Grafo' : t === 'duplicates' ? 'Duplicatas' : 'Sync e nos'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {/* UI/UX Improvement 10: Health Dashboard */}
        <div className="bg-surface-1 border border-default rounded-xl p-4 mb-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted uppercase tracking-wider">Memorias</span>
              <span className="text-sm font-bold text-primary">{memories.length}/{MEMORY_QUOTA}</span>
              <div className="w-20 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${memories.length >= MEMORY_QUOTA ? 'bg-red-500' : memories.length >= MEMORY_QUOTA * 0.8 ? 'bg-yellow-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, (memories.length / MEMORY_QUOTA) * 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted uppercase tracking-wider">Frescor</span>
              <span className="text-sm font-bold text-primary">
                {memories.length > 0 ? Math.round((memories.filter(m => {
                  const accessed = lastAccessed[m.id];
                  if (!accessed) return false;
                  const daysSince = (Date.now() - new Date(accessed).getTime()) / (1000 * 60 * 60 * 24);
                  return daysSince <= 30;
                }).length / memories.length) * 100) : 0}%
              </span>
              <span className="text-[10px] text-muted">acessadas 30d</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted uppercase tracking-wider">Categorias</span>
              <div className="flex gap-1">
                {categories.map(cat => {
                  const count = memories.filter(m => m.category === cat).length;
                  if (count === 0) return null;
                  return <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 text-secondary">{cat}: {count}</span>;
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className={`text-xs font-bold ${healthScore >= 70 ? 'text-green-500' : healthScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{healthScore}/100</span>
            </div>
          </div>
        </div>

        {tab === 'overview' && (
          <div>
            {/* Feature 27: Memory health score */}
            <div className="bg-surface-1 border border-default rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted">Saude da memoria</span>
                <span className={`text-xs font-bold ${healthScore >= 70 ? 'text-green-500' : healthScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{healthScore}/100</span>
              </div>
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${healthScore >= 70 ? 'bg-green-500' : healthScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${healthScore}%` }}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">
                {healthScore >= 70 ? 'Brain saudavel — memorias organizadas e acessadas.' : healthScore >= 40 ? 'Atencao — ha memorias sem tags ou obsoletas.' : 'Critico — muitas memorias desatualizadas.'}
              </p>
            </div>

            {/* Feature 36: Memory suggestions */}
            {suggestions.length > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <h4 className="text-xs font-medium text-yellow-600 mb-2">Sugestoes</h4>
                <ul className="space-y-1">
                  {suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-primary flex items-start gap-2">
                      <span className="text-yellow-500 shrink-0">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* NEW Feature 3: Quota visual */}
            <div className="bg-surface-1 border border-default rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted">Uso de memoria</span>
                <span className="text-xs font-medium text-primary">{memories.length}/{MEMORY_QUOTA}</span>
              </div>
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${memories.length >= MEMORY_QUOTA ? 'bg-red-500' : memories.length >= MEMORY_QUOTA * 0.8 ? 'bg-yellow-500' : 'bg-brand-600'}`}
                  style={{ width: `${Math.min(100, (memories.length / MEMORY_QUOTA) * 100)}%` }}
                />
              </div>
              {memories.length >= MEMORY_QUOTA * 0.8 && (
                <p className="text-[10px] text-yellow-500 mt-1">
                  {memories.length >= MEMORY_QUOTA ? 'Limite atingido! Considere arquivar memorias antigas.' : 'Proximo do limite. Considere revisar memorias.'}
                </p>
              )}
            </div>

            {/* NEW Feature 8: Metricas do brain */}
            <div className="bg-surface-1 border border-default rounded-xl p-5 mb-6">
              <h3 className="text-sm font-medium text-primary mb-3">Metricas do Brain</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Total memorias</p>
                  <p className="text-lg font-bold text-primary">{memories.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Categorias em uso</p>
                  <p className="text-lg font-bold text-primary">{categories.filter(c => memories.some(m => m.category === c)).length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Memoria mais acessada</p>
                  <p className="text-xs text-primary truncate">
                    {mostAccessedId ? (memories.find(m => m.id === mostAccessedId)?.content.slice(0, 40) || '—') + '...' : '—'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Distribuicao por categoria</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => {
                    const count = memories.filter(m => m.category === cat).length;
                    if (count === 0) return null;
                    const catStyle = getCategoryStyle(cat);
                    return (
                      <span key={cat} className={catStyle.className} style={catStyle.style}>
                        {cat}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Feature 28: Auto-cleanup button */}
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleAutoCleanup}
                disabled={memories.length === 0}
                className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs text-secondary font-medium transition-colors"
              >
                Auto-limpeza de memorias obsoletas
              </button>
              {/* Feature 32: Merge mode toggle */}
              <button
                onClick={() => { setMergeMode(!mergeMode); setMergeSelection([]); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mergeMode ? 'bg-purple-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
              >
                {mergeMode ? 'Cancelar merge' : 'Merge de duplicatas'}
              </button>
              {/* Feature 34: Graph toggle */}
              <button
                onClick={() => setShowGraph(!showGraph)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showGraph ? 'bg-blue-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
              >
                {showGraph ? 'Fechar grafo' : 'Grafo de conexoes'}
              </button>
              {/* Feature 35: Access log toggle */}
              <button
                onClick={() => setShowAccessLog(!showAccessLog)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAccessLog ? 'bg-green-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
              >
                Log de acessos
              </button>
            </div>

            {/* Feature 34: Memory graph visualization */}
            {showGraph && (
              <div className="bg-surface-1 border border-default rounded-xl p-5 mb-6">
                <h3 className="text-sm font-medium text-primary mb-3">Grafo de conexoes</h3>
                {memoryLinks.length === 0 ? (
                  <p className="text-xs text-muted">Nenhuma conexao entre memorias. Use o botao "Vincular" para criar links.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {memoryLinks.map(([a, b], i) => {
                      const memA = memories.find(m => m.id === a);
                      const memB = memories.find(m => m.id === b);
                      return (
                        <div key={i} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                          <span className="text-xs text-primary truncate flex-1">{memA?.content.slice(0, 40) || a.slice(0, 8)}...</span>
                          <span className="text-xs text-blue-500 shrink-0">↔</span>
                          <span className="text-xs text-primary truncate flex-1">{memB?.content.slice(0, 40) || b.slice(0, 8)}...</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-muted mt-2">{memoryLinks.length} conexao(oes) | {new Set(memoryLinks.flat()).size} nos</p>
              </div>
            )}

            {/* Feature 35: Access log */}
            {showAccessLog && (
              <div className="bg-surface-1 border border-default rounded-xl p-5 mb-6">
                <h3 className="text-sm font-medium text-primary mb-3">Log de acessos</h3>
                {accessLog.length === 0 ? (
                  <p className="text-xs text-muted">Nenhum acesso registrado ainda.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {accessLog.slice(-20).reverse().map((entry, i) => {
                      const mem = memories.find(m => m.id === entry.memId);
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-muted shrink-0">{new Date(entry.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-primary truncate">{mem?.content.slice(0, 50) || entry.memId.slice(0, 8)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <h2 className="text-lg font-semibold text-primary mb-4">Saude</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Estado</p>
                <p className="text-sm font-medium text-primary">Apenas local</p>
                <p className="text-xs text-muted">Schema v1</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Modo</p>
                <p className="text-sm font-medium text-primary">Ativo</p>
                <p className="text-xs text-muted">Memoria local habilitada</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Registros</p>
                <p className="text-sm font-medium text-primary">{memories.length}</p>
                <p className="text-xs text-muted">{categories.filter(c => memories.some(m => m.category === c)).length} categorias</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Ultima atualizacao</p>
                <p className="text-sm font-medium text-primary">{memories.length > 0 ? new Date(memories[0].createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                <p className="text-xs text-muted">1 raiz</p>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-primary mb-4">Por categoria</h2>
            <div className="grid grid-cols-5 gap-3">
              {categories.map(cat => {
                const count = memories.filter(m => m.category === cat).length;
                return (
                  <div key={cat} className="bg-surface-1 border border-default rounded-xl p-4 text-center">
                    <p className="text-lg font-bold text-primary">{count}</p>
                    <p className="text-xs text-muted capitalize">{cat}</p>
                  </div>
                );
              })}
            </div>

            {/* NEW Feature 7: Custom categories management */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-primary">Categorias customizadas</h2>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                >
                  + Nova categoria
                </button>
              </div>
              {showAddCategory && (
                <div className="bg-surface-1 border border-brand-500/30 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-3">
                    <input
                      placeholder="Nome da categoria..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder-muted outline-none"
                    />
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-default"
                    />
                    <button onClick={handleAddCustomCategory} disabled={!newCatName.trim()} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium">Criar</button>
                    <button onClick={() => setShowAddCategory(false)} className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary">Cancelar</button>
                  </div>
                </div>
              )}
              {customCategories.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {customCategories.map(cat => (
                    <div key={cat.name} className="flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-primary capitalize">{cat.name}</span>
                      <button onClick={() => handleRemoveCustomCategory(cat.name)} className="text-xs text-red-500 hover:text-red-400 ml-1">x</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">Nenhuma categoria customizada criada.</p>
              )}
            </div>

            {/* NEW Feature 4: Snapshot periodico */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-primary">Snapshots</h2>
                <button
                  onClick={handleSaveSnapshot}
                  disabled={memories.length === 0}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs text-secondary font-medium transition-colors"
                >
                  Salvar snapshot agora
                </button>
              </div>
              {snapshots.length > 0 ? (
                <div className="space-y-1">
                  {snapshots.slice(-5).reverse().map(s => (
                    <div key={s.timestamp} className="flex items-center justify-between bg-surface-1 border border-default rounded-lg px-4 py-2">
                      <span className="text-xs text-primary">{new Date(s.timestamp).toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-muted">{s.count} memorias</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">Nenhum snapshot salvo.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Memoria</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    placeholder="Buscar memoria"
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="bg-transparent text-xs text-primary placeholder-muted outline-none w-40"
                  />
                </div>
                {/* Feature 3: Export button */}
                <button
                  onClick={() => setShowExportModal(true)}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors"
                >
                  Exportar
                </button>
                {/* UI/UX Improvement 8: Export as Markdown */}
                <button
                  onClick={handleExportMarkdown}
                  disabled={memories.length === 0}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs text-secondary font-medium transition-colors"
                >
                  Exportar MD
                </button>
                {/* Feature 4: Import button */}
                <button
                  onClick={() => { setShowImportModal(true); setImportPreview([]); setImportError(''); }}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors"
                >
                  Importar
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {/* NEW Feature 1: Busca semantica + NEW Feature 5: Ordenacao */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  placeholder="Busca semantica (fuzzy match no conteudo)..."
                  value={semanticSearch}
                  onChange={(e) => { setSemanticSearch(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-xs text-primary placeholder-muted outline-none w-full"
                />
                {semanticSearch && (
                  <button onClick={() => setSemanticSearch('')} className="text-xs text-muted hover:text-primary">x</button>
                )}
              </div>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
              >
                <option value="created">Data criacao</option>
                <option value="edited">Ultima edicao</option>
                <option value="relevance">Relevancia</option>
                <option value="alpha">Alfabetico</option>
              </select>
            </div>

            {/* Feature 30: Category and tag filters */}
            <div className="flex items-center gap-3 mb-4">
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
              >
                <option value="all">Todas categorias</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterTag}
                onChange={(e) => { setFilterTag(e.target.value); setCurrentPage(1); }}
                className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
              >
                <option value="">Todas tags</option>
                {getAllTags().map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {(filterCategory !== 'all' || filterTag) && (
                <button
                  onClick={() => { setFilterCategory('all'); setFilterTag(''); setCurrentPage(1); }}
                  className="text-xs text-brand-500 hover:text-brand-400"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Feature 32: Merge mode bar */}
            {mergeMode && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
                <span className="text-xs text-purple-500">Modo merge: selecione 2+ memorias para combinar.</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMergeModal(true)}
                    disabled={mergeSelection.length < 2}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-xs text-white font-medium"
                  >
                    Merge ({mergeSelection.length})
                  </button>
                  <button onClick={() => { setMergeMode(false); setMergeSelection([]); }} className="text-xs text-purple-500 hover:text-purple-400 px-2 py-1">Cancelar</button>
                </div>
              </div>
            )}

            {/* Link mode indicator */}
            {linkMode && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
                <span className="text-xs text-blue-500">Modo vincular ativo. Clique em outra memoria para criar vinculo.</span>
                <button onClick={() => setLinkMode(null)} className="text-xs text-blue-500 hover:text-blue-400 px-2 py-1 rounded-lg">Cancelar</button>
              </div>
            )}

            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-4 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-3">Nova memoria</h3>
                {/* NEW Feature 2: Templates de memoria */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-[10px] text-muted self-center">Templates:</span>
                  {memoryTemplates.map(t => (
                    <button
                      key={t.label}
                      onClick={() => { setForm({ content: t.content, category: t.category }); setFormError(''); setDuplicateWarning(''); }}
                      className="px-2.5 py-1 bg-surface-2 hover:bg-surface-3 rounded-lg text-[10px] text-secondary font-medium transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <textarea
                      placeholder="Conteudo da memoria (min. 10 caracteres)..."
                      value={form.content}
                      onChange={(e) => handleFormChange(e.target.value)}
                      rows={3}
                      className={`w-full bg-surface-0 border rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none resize-none ${formError ? 'border-red-500/50' : 'border-default focus:border-brand-500/50'}`}
                    />
                    <div className="flex justify-between mt-1">
                      {formError ? <span className="text-[10px] text-red-500">{formError}</span> : <span />}
                      <span className={`text-[10px] ${form.content.length > 2000 ? 'text-red-500' : 'text-muted'}`}>{form.content.length}/2000</span>
                    </div>
                    {duplicateWarning && <p className="text-[10px] text-yellow-500 mt-1">⚠ {duplicateWarning}</p>}
                    {/* UI/UX Improvement 6: Real-time duplicate detection */}
                    {realtimeDuplicateWarning && !duplicateWarning && (
                      <p className="text-[10px] text-orange-500 mt-1">⚠ Memoria similar ja existe: &quot;{realtimeDuplicateWarning.title}&quot;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                    {/* UI/UX Improvement 5: Auto-categorization suggestion */}
                    {suggestedCategory && suggestedCategory !== form.category && (
                      <button
                        onClick={() => setForm({ ...form, category: suggestedCategory })}
                        className="px-2.5 py-1.5 bg-brand-600/10 border border-brand-500/30 rounded-lg text-[10px] text-brand-400 font-medium hover:bg-brand-600/20 transition-colors"
                      >
                        Sugestao: {suggestedCategory}
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowAdd(false); setFormError(''); setDuplicateWarning(''); }} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAdd}
                      disabled={!form.content.trim() || !!formError}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {memories.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-12 animate-fade-in">
                <div className="w-14 h-14 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500">
                    <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M10 21h4" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">
                  {search ? `Nenhuma memoria encontrada para "${search}".` : 'Nenhum registro de memoria ainda.'}
                </p>
                <p className="text-xs text-muted mb-4">Memorias permitem ao assistente lembrar informacoes importantes entre conversas.</p>
                {search ? (
                  <button onClick={() => { setShowAdd(true); setForm({ ...form, content: search }); setSearch(''); handleSearch(''); }} className="px-4 py-2 rounded-xl text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium">
                    + Criar memoria com "{search}"
                  </button>
                ) : (
                  <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium">
                    + Adicionar memoria
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              {paginatedMemories.map((mem) => (
                <div
                  key={mem.id}
                  onClick={() => { if (linkMode && linkMode !== mem.id) handleLinkClick(mem.id); trackAccessWithLog(mem.id); }}
                  onMouseEnter={() => setHoveredMemoryId(mem.id)}
                  onMouseLeave={() => setHoveredMemoryId(null)}
                  className={`bg-surface-1 border rounded-xl p-4 flex items-start justify-between gap-4 relative animate-fade-in ${
                    linkMode && linkMode !== mem.id ? 'border-blue-500/50 cursor-pointer hover:bg-blue-500/5' :
                    linkMode === mem.id ? 'border-blue-500 bg-blue-500/5' : 'border-default'
                  }`}
                >
                  {/* UI/UX Improvement 1: Hover preview tooltip */}
                  {hoveredMemoryId === mem.id && !editingId && (
                    <div className="absolute left-0 top-full mt-1 z-30 bg-surface-0 border border-default rounded-xl p-4 shadow-lg w-80 pointer-events-none">
                      <p className="text-xs text-primary mb-2">{mem.content.slice(0, 200)}{mem.content.length > 200 ? '...' : ''}</p>
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted">
                        {(memoryTags[mem.id] || []).length > 0 && <span>Tags: {(memoryTags[mem.id] || []).join(', ')}</span>}
                        <span>Links: {getLinkCount(mem.id)}</span>
                        <span>Acesso: {lastAccessed[mem.id] ? new Date(lastAccessed[mem.id]).toLocaleDateString('pt-BR') : 'Nunca'}</span>
                      </div>
                    </div>
                  )}
                  {/* Feature 8: Checkbox / Feature 32: Merge checkbox */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {mergeMode ? (
                      <input
                        type="checkbox"
                        checked={mergeSelection.includes(mem.id)}
                        onChange={() => handleToggleMergeSelect(mem.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 shrink-0 accent-purple-600"
                      />
                    ) : (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(mem.id)}
                      onChange={() => toggleSelect(mem.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 shrink-0 accent-brand-600"
                    />
                    )}
                    <div className="min-w-0 flex-1">
                      {editingId === mem.id ? (
                        <div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={2}
                            className="w-full bg-surface-0 border border-brand-500/50 rounded-lg px-3 py-2 text-sm text-primary outline-none resize-none"
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleEditSave(mem.id)} disabled={editContent.trim().length < 10} className="text-xs text-brand-500 hover:bg-brand-500/10 px-2 py-1 rounded-lg disabled:text-muted">Salvar</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-muted hover:bg-surface-2 px-2 py-1 rounded-lg">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        /* NEW Feature 6: Markdown no conteudo */
                        <div className="text-sm text-primary mb-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(mem.content) }} />
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {(() => {
                          const catStyle = getCategoryStyle(mem.category);
                          return <span className={catStyle.className} style={catStyle.style}>{mem.category}</span>;
                        })()}
                        <span className="text-[10px] text-muted">{new Date(mem.createdAt).toLocaleDateString('pt-BR')}</span>
                        {/* Feature 7: Pinned badge */}
                        {pinnedIds.includes(mem.id) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-600/10 text-brand-400 font-medium">Fixada</span>
                        )}
                        {/* Feature 5: Link count badge */}
                        {getLinkCount(mem.id) > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                            {getLinkCount(mem.id)} vinculo(s)
                          </span>
                        )}
                        {/* Feature 6: Decay badge */}
                        {needsReview(mem.id) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 font-medium">Revisar</span>
                        )}
                        {/* #4 Visualizacao de uso */}
                        {memoryUsage[mem.id] && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500" title={memoryUsage[mem.id].join(', ')}>
                            Usada em {memoryUsage[mem.id].length} sessao(oes)
                          </span>
                        )}
                        {/* UI/UX Improvement 4: Importance stars */}
                        <span className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              onClick={(e) => { e.stopPropagation(); setImportanceManual(mem.id, star); }}
                              className={`text-xs leading-none ${star <= getImportanceScore(mem.id) ? 'text-yellow-500' : 'text-surface-3 hover:text-yellow-300'}`}
                            >
                              ★
                            </button>
                          ))}
                        </span>
                      </div>
                      {/* #3 Tags */}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {(memoryTags[mem.id] || []).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 flex items-center gap-1">
                            {tag}
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(mem.id, tag); }} className="hover:text-red-400">x</button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input
                            placeholder="+ tag"
                            value={tagInput[mem.id] || ''}
                            onChange={(e) => setTagInput({ ...tagInput, [mem.id]: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(mem.id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-b border-dashed border-muted text-[10px] text-primary outline-none w-16 placeholder-muted"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {editingId !== mem.id && (
                    <div className="flex gap-1 shrink-0 flex-wrap">
                      {/* Feature 7: Pin button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePin(mem.id); }}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${pinnedIds.includes(mem.id) ? 'text-brand-500 bg-brand-500/10' : 'text-muted hover:text-primary hover:bg-surface-2'}`}
                        title={pinnedIds.includes(mem.id) ? 'Desafixar' : 'Fixar'}
                      >
                        {pinnedIds.includes(mem.id) ? '★' : '☆'}
                      </button>
                      {/* Feature 5: Link button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLinkClick(mem.id); }}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${linkMode === mem.id ? 'text-blue-500 bg-blue-500/10' : 'text-muted hover:text-primary hover:bg-surface-2'}`}
                        title="Vincular"
                      >
                        Vincular
                      </button>
                      {/* Feature 1: Versions button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setVersionsModal(mem.id); }}
                        className="text-xs text-muted hover:text-primary hover:bg-surface-2 px-2 py-1 rounded-lg transition-colors"
                      >
                        Versoes
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(mem.id); setEditContent(mem.content); }} className="text-xs text-muted hover:text-primary hover:bg-surface-2 px-2 py-1 rounded-lg transition-colors">
                        Editar
                      </button>
                      {/* Feature 6: Archive button */}
                      {needsReview(mem.id) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchive(mem.id); }}
                          className="text-xs text-yellow-600 hover:bg-yellow-500/10 px-2 py-1 rounded-lg transition-colors"
                        >
                          Arquivar
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(mem.id); }} className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors">
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* #6 Paginacao */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs text-secondary"
                >
                  Anterior
                </button>
                <span className="text-xs text-muted">Pagina {currentPage} de {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs text-secondary"
                >
                  Proxima
                </button>
              </div>
            )}

            {/* Feature 8: Bulk action bar — UI/UX Improvement 3: Extended */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-1 border border-default rounded-2xl px-6 py-3 shadow-lg flex items-center gap-3 z-40">
                <span className="text-xs text-muted">{selectedIds.size} selecionada(s)</span>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white font-medium"
                >
                  Excluir
                </button>
                <button
                  onClick={handleBulkExport}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium"
                >
                  Exportar
                </button>
                <button
                  onClick={() => setShowBulkTag(true)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs text-white font-medium"
                >
                  Tagar
                </button>
                {/* UI/UX Improvement 3: New bulk buttons */}
                <select
                  onChange={(e) => { if (e.target.value) handleBulkChangeCategory(e.target.value); e.target.value = ''; }}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium outline-none cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>Alterar Categoria</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={handleBulkArchive}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xs text-white font-medium"
                >
                  Arquivar
                </button>
                <button
                  onClick={handleBulkUnlink}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium"
                >
                  Desvincular
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-muted hover:text-primary px-2 py-1 rounded-lg"
                >
                  Limpar
                </button>
              </div>
            )}

            {/* Feature 8: Bulk tag modal */}
            {showBulkTag && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
                  <h3 className="text-base font-semibold text-primary mb-3">Adicionar tag a {selectedIds.size} memorias</h3>
                  <input
                    value={bulkTagInput}
                    onChange={(e) => setBulkTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBulkTag(); }}
                    placeholder="Nome da tag..."
                    className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none mb-4"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowBulkTag(false); setBulkTagInput(''); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    <button onClick={handleBulkTag} disabled={!bulkTagInput.trim()} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm text-white font-medium">Aplicar</button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal confirmacao de exclusao */}
            {confirmDelete && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
                  <h3 className="text-base font-semibold text-primary mb-2">Excluir memoria?</h3>
                  <p className="text-sm text-muted mb-4">Esta acao e irreversivel.</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Excluir</button>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 1: Versions modal */}
            {versionsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-base font-semibold text-primary mb-4">Historico de versoes</h3>
                  {getVersions(versionsModal).length === 0 ? (
                    <p className="text-sm text-muted">Nenhuma versao anterior encontrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {getVersions(versionsModal).slice().reverse().map((v, i) => (
                        <div key={i} className="bg-surface-1 border border-default rounded-xl p-4">
                          <p className="text-sm text-primary mb-2">{v.content}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted">{new Date(v.timestamp).toLocaleString('pt-BR')}</span>
                            <button
                              onClick={() => restoreVersion(versionsModal, v.content)}
                              className="text-xs text-brand-500 hover:bg-brand-500/10 px-2 py-1 rounded-lg"
                            >
                              Restaurar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-4">
                    <button onClick={() => setVersionsModal(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 2: Conflict resolution modal */}
            {conflictDetected && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-2xl w-full mx-4">
                  <h3 className="text-base font-semibold text-primary mb-4">Conflito detectado</h3>
                  <p className="text-sm text-muted mb-4">Conteudo diferente encontrado para a mesma memoria. Escolha como resolver:</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-surface-1 border border-default rounded-xl p-4">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Local</p>
                      <p className="text-sm text-primary">{conflictDetected.local}</p>
                    </div>
                    <div className="bg-surface-1 border border-default rounded-xl p-4">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Remoto</p>
                      <p className="text-sm text-primary">{conflictDetected.remote}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConflictDetected(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    <button onClick={() => handleConflictResolve('local')} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Manter Local</button>
                    <button onClick={() => handleConflictResolve('remote')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white font-medium">Usar Remoto</button>
                    <button onClick={() => handleConflictResolve('merge')} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white font-medium">Merge (concatenar)</button>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 3: Export modal */}
            {showExportModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
                  <h3 className="text-base font-semibold text-primary mb-4">Exportar memorias</h3>
                  <div className="space-y-4">
                    {getAllTags().length > 0 && (
                      <div>
                        <p className="text-xs text-muted mb-2">Filtrar por tags:</p>
                        <div className="flex flex-wrap gap-2">
                          {getAllTags().map(tag => (
                            <label key={tag} className="flex items-center gap-1 text-xs text-primary">
                              <input
                                type="checkbox"
                                checked={exportTagFilter.includes(tag)}
                                onChange={() => setExportTagFilter(prev =>
                                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                )}
                                className="accent-brand-600"
                              />
                              {tag}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted mb-1">Data inicio:</p>
                        <input
                          type="date"
                          value={exportDateFrom}
                          onChange={(e) => setExportDateFrom(e.target.value)}
                          className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted mb-1">Data fim:</p>
                        <input
                          type="date"
                          value={exportDateTo}
                          onChange={(e) => setExportDateTo(e.target.value)}
                          className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted">{getFilteredExportMemories().length} memorias serao exportadas.</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => { setShowExportModal(false); setExportTagFilter([]); setExportDateFrom(''); setExportDateTo(''); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    <button onClick={() => handleExport('clipboard')} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Copiar JSON</button>
                    <button onClick={() => handleExport('download')} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Download .json</button>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 4: Import modal */}
            {showImportModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-base font-semibold text-primary mb-4">Importar memorias</h3>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleImportFromClipboard}
                        className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium"
                      >
                        Ler do clipboard
                      </button>
                      <label className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium cursor-pointer">
                        Selecionar arquivo
                        <input type="file" accept=".json" onChange={handleImportFromFile} className="hidden" />
                      </label>
                    </div>
                    {importError && <p className="text-xs text-red-500">{importError}</p>}
                    {importPreview.length > 0 && (
                      <div>
                        <p className="text-xs text-muted mb-2">{importPreview.length} memorias novas para importar:</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {importPreview.slice(0, 10).map((m, i) => (
                            <div key={i} className="bg-surface-1 border border-default rounded-lg p-3">
                              <p className="text-xs text-primary truncate">{m.content}</p>
                              <span className="text-[10px] text-muted">{m.category}</span>
                            </div>
                          ))}
                          {importPreview.length > 10 && (
                            <p className="text-xs text-muted">... e mais {importPreview.length - 10} memorias</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => { setShowImportModal(false); setImportPreview([]); setImportError(''); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    {importPreview.length > 0 && (
                      <button onClick={handleConfirmImport} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">
                        Importar ({importPreview.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Feature 28: Auto-cleanup modal */}
            {showCleanupModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-base font-semibold text-primary mb-4">Auto-limpeza de memorias</h3>
                  {cleanupPreview.length === 0 ? (
                    <p className="text-sm text-muted">Nenhuma memoria obsoleta encontrada. Tudo em dia!</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted">{cleanupPreview.length} memorias nao acessadas ha 90+ dias serao arquivadas:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {cleanupPreview.slice(0, 10).map(m => (
                          <div key={m.id} className="bg-surface-1 border border-default rounded-lg p-3">
                            <p className="text-xs text-primary truncate">{m.content}</p>
                            <span className="text-[10px] text-muted">{m.category}</span>
                          </div>
                        ))}
                        {cleanupPreview.length > 10 && <p className="text-xs text-muted">... e mais {cleanupPreview.length - 10}</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowCleanupModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    {cleanupPreview.length > 0 && (
                      <button onClick={handleConfirmCleanup} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">
                        Arquivar ({cleanupPreview.length})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Feature 32: Merge modal */}
            {showMergeModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-base font-semibold text-primary mb-4">Merge de memorias</h3>
                  <p className="text-xs text-muted mb-3">{mergeSelection.length} memorias serao combinadas em uma unica:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                    {mergeSelection.map(id => {
                      const mem = memories.find(m => m.id === id);
                      return mem ? (
                        <div key={id} className="bg-surface-1 border border-default rounded-lg p-3">
                          <p className="text-xs text-primary">{mem.content.slice(0, 100)}{mem.content.length > 100 ? '...' : ''}</p>
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                    <button onClick={handleMergeMemories} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white font-medium">Confirmar merge</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UI/UX Improvement 7: Timeline view */}
        {tab === 'timeline' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Timeline de Memorias</h2>
            {memories.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma memoria para exibir na timeline.</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-surface-3 space-y-4 ml-4">
                {[...memories].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(mem => (
                  <div key={mem.id} className="relative">
                    <div className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-brand-600 border-2 border-surface-0" />
                    <div className="bg-surface-1 border border-default rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-muted font-medium">{new Date(mem.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {(() => { const catStyle = getCategoryStyle(mem.category); return <span className={catStyle.className} style={catStyle.style}>{mem.category}</span>; })()}
                      </div>
                      <p className="text-sm text-primary">{mem.content.slice(0, 150)}{mem.content.length > 150 ? '...' : ''}</p>
                      {(memoryTags[mem.id] || []).length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {(memoryTags[mem.id] || []).map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UI/UX Improvement 2: Relationship Graph (SVG-based) */}
        {tab === 'graph' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Grafo de Relacionamentos</h2>
            {memories.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma memoria para exibir no grafo.</p>
            ) : (
              <div className="bg-surface-1 border border-default rounded-xl p-4 overflow-auto">
                <svg width="800" height="500" className="mx-auto">
                  {(() => {
                    // Position nodes in a grid layout
                    const cols = Math.ceil(Math.sqrt(memories.length));
                    const cellW = 800 / (cols + 1);
                    const cellH = 500 / (Math.ceil(memories.length / cols) + 1);
                    const positions: Record<string, { x: number; y: number }> = {};
                    memories.forEach((mem, i) => {
                      const col = i % cols;
                      const row = Math.floor(i / cols);
                      positions[mem.id] = { x: cellW * (col + 1), y: cellH * (row + 1) };
                    });
                    return (
                      <>
                        {/* Draw links */}
                        {memoryLinks.map(([a, b], i) => {
                          const posA = positions[a];
                          const posB = positions[b];
                          if (!posA || !posB) return null;
                          return <line key={i} x1={posA.x} y1={posA.y} x2={posB.x} y2={posB.y} stroke="#6366f1" strokeWidth="1.5" strokeOpacity="0.5" />;
                        })}
                        {/* Draw nodes */}
                        {memories.map(mem => {
                          const pos = positions[mem.id];
                          if (!pos) return null;
                          const links = getLinkCount(mem.id);
                          const radius = Math.max(12, Math.min(24, 12 + links * 3));
                          const catColors: Record<string, string> = { general: '#6b7280', user: '#3b82f6', project: '#8b5cf6', feedback: '#eab308', reference: '#22c55e' };
                          const fillColor = catColors[mem.category] || '#6b7280';
                          return (
                            <g key={mem.id}>
                              <circle cx={pos.x} cy={pos.y} r={radius} fill={fillColor} fillOpacity="0.3" stroke={fillColor} strokeWidth="2" />
                              <text x={pos.x} y={pos.y + radius + 12} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted">
                                {mem.content.slice(0, 15)}{mem.content.length > 15 ? '..' : ''}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <p className="text-[10px] text-muted mt-2 text-center">{memories.length} nos | {memoryLinks.length} conexoes</p>
              </div>
            )}
          </div>
        )}

        {/* UI/UX Improvement 9: Deduplication Panel */}
        {tab === 'duplicates' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Duplicatas Detectadas</h2>
              <button
                onClick={computeDeduplicationPairs}
                className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors"
              >
                Reescanear
              </button>
            </div>
            {deduplicationPairs.length === 0 ? (
              <div className="bg-surface-1 border border-default rounded-xl p-6 text-center">
                <p className="text-sm text-muted">Nenhuma duplicata encontrada. Suas memorias estao bem organizadas.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deduplicationPairs.map((pair, i) => (
                  <div key={i} className="bg-surface-1 border border-default rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-muted">Similaridade: {Math.round(pair.similarity * 100)}%</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMergeDedupPair(pair.a.id, pair.b.id)}
                          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs text-white font-medium"
                        >
                          Mesclar
                        </button>
                        <button
                          onClick={() => handleIgnoreDedupPair(pair.a.id, pair.b.id)}
                          className="px-3 py-1 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium"
                        >
                          Ignorar
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-0 border border-default rounded-lg p-3">
                        <p className="text-xs text-primary mb-1">{pair.a.content.slice(0, 120)}{pair.a.content.length > 120 ? '...' : ''}</p>
                        <span className="text-[10px] text-muted">{pair.a.category} | {new Date(pair.a.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="bg-surface-0 border border-default rounded-lg p-3">
                        <p className="text-xs text-primary mb-1">{pair.b.content.slice(0, 120)}{pair.b.content.length > 120 ? '...' : ''}</p>
                        <span className="text-[10px] text-muted">{pair.b.category} | {new Date(pair.b.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'sync' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Sync e nos</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M4 12a8 8 0 0116 0M12 4v4M4 12h4M20 12h-4" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Sincronizacao nao configurada</p>
                  <p className="text-xs text-muted">Conecte outro dispositivo para sincronizar memorias entre maquinas.</p>
                </div>
              </div>
              <div className="bg-surface-0 border border-default rounded-lg p-4">
                <p className="text-xs text-muted mb-2">Nos conectados</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-500">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary">Este computador</p>
                    <p className="text-[10px] text-muted">No local ativo</p>
                  </div>
                  <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">Online</span>
                </div>
              </div>
            </div>

            {/* #9 Sync incremental */}
            <div className="bg-surface-1 border border-default rounded-xl p-6 mt-4">
              <h3 className="text-sm font-medium text-primary mb-3">Sync Incremental</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Ultimo sync:</span>
                  <span className="text-xs text-primary">{lastSyncAt ? new Date(lastSyncAt).toLocaleString('pt-BR') : 'Nunca'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Alteracoes pendentes:</span>
                  <span className="text-xs text-primary font-medium">{syncChanges.length}</span>
                </div>
                {syncChanges.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {syncChanges.slice(-10).map((ch, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded ${ch.action === 'add' ? 'bg-green-500/10 text-green-500' : ch.action === 'delete' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                          {ch.action}
                        </span>
                        <span className="text-muted font-mono truncate">{ch.id.slice(0, 8)}...</span>
                        <span className="text-muted ml-auto">{new Date(ch.timestamp).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkSynced}
                    disabled={syncChanges.length === 0}
                    className="mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white transition-all"
                  >
                    Marcar como sincronizado
                  </button>
                  {/* Feature 2: Simulate conflict */}
                  <button
                    onClick={simulateConflictCheck}
                    disabled={memories.length === 0}
                    className="mt-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs font-medium text-secondary transition-all"
                  >
                    Simular conflito
                  </button>
                </div>
              </div>
            </div>

            {/* #10 Backup automatico */}
            <div className="bg-surface-1 border border-default rounded-xl p-6 mt-4">
              <h3 className="text-sm font-medium text-primary mb-3">Backup Automatico</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Intervalo:</span>
                  <span className="text-xs text-primary">A cada 5 minutos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Ultimo backup:</span>
                  <span className="text-xs text-primary">{lastBackupAt ? new Date(lastBackupAt).toLocaleString('pt-BR') : 'Aguardando...'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Armazenamento:</span>
                  <span className="text-xs text-primary">localStorage</span>
                </div>
                <button
                  onClick={() => {
                    if (memories.length > 0) {
                      const backup = JSON.stringify({ memories, exportedAt: new Date().toISOString() });
                      localStorage.setItem('ados-brain-backup', backup);
                      const now = new Date().toISOString();
                      localStorage.setItem('ados-brain-last-backup', now);
                      setLastBackupAt(now);
                    }
                  }}
                  disabled={memories.length === 0}
                  className="mt-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs font-medium text-secondary transition-all"
                >
                  Backup agora
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
