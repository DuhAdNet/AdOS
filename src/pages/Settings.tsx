import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

type SettingsTab = 'app' | 'appearance' | 'input' | 'workspace' | 'providers' | 'mcp' | 'model' | 'agents' | 'permissions' | 'preferences' | 'shortcuts' | 'about';

const ados = (window as any).ados;

// === Feature 7: Section defaults ===
const SECTION_DEFAULTS: Record<string, Record<string, any>> = {
  app: { documents_path: '', system_prompt: '' },
  appearance: { theme_mode: 'dark', font: 'manrope', customThemeMode: 'dark', accentColor: '#6366f1' },
  input: { send_key: 'enter', auto_capitalize: 'true', spell_check: 'true' },
  workspace: { workspace_name: 'JVOS', permission_mode: 'execute', mcp_local_enabled: 'true' },
  preferences: { user_name: '', user_timezone: 'America/Sao_Paulo', user_language: 'pt-BR', user_notes: '' },
};

// === Feature 3: Profile helpers ===
interface SettingsProfile { name: string; data: Record<string, any>; createdAt: string; }

// === Feature 6: MCP log entry ===
interface McpLogEntry { timestamp: string; status: 'success' | 'error'; message: string; }

// === NEW Feature 4: Settings changelog entry ===
interface SettingsChangelogEntry {
  id: string;
  timestamp: string;
  key: string;
  oldValue: any;
  newValue: any;
}

// === NEW Feature 3: Permission categories ===
const PERMISSION_CATEGORIES: Record<string, { label: string; types: string[] }> = {
  file: { label: 'File Ops', types: ['file'] },
  network: { label: 'Network', types: ['mcp'] },
  system: { label: 'System', types: ['bash', 'tool'] },
};

// === NEW Feature 1: WCAG contrast helpers ===
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
function contrastRatio(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 0;
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// === NEW Feature 7: Wizard steps ===
const WIZARD_STEPS = [
  { id: 'welcome', title: 'Bem-vindo ao JVOS', description: 'Vamos configurar o essencial em poucos passos.' },
  { id: 'provider', title: 'Provider de IA', description: 'Configure pelo menos uma API key para começar.' },
  { id: 'preferences', title: 'Suas Preferências', description: 'Personalize como a IA se comporta.' },
  { id: 'done', title: 'Tudo pronto!', description: 'Você pode ajustar tudo depois em Configurações.' },
];

// === Feature 1: Field labels per tab for search ===
const TAB_FIELD_LABELS: Record<string, string[]> = {
  app: ['Pasta de Documentos', 'Importar', 'Exportar', 'System Prompt', 'Sessoes', 'Perfis'],
  appearance: ['Tema', 'Fonte', 'Temas', 'Personalizar', 'Cor de destaque', 'Midnight'],
  input: ['Auto-capitalização', 'Corretor ortográfico', 'Enviar mensagem', 'Enter', 'Ctrl+Enter'],
  workspace: ['Nome', 'Diretorio', 'Permissoes', 'MCP Locais'],
  providers: ['API Keys', 'OpenAI', 'Anthropic', 'Google', 'OpenRouter', 'Rotação'],
  mcp: ['MCP Servers', 'Conectar', 'Adicionar', 'Logs'],
  model: ['Modelo', 'Padrão'],
  agents: ['Multi-Agentes', 'Roteamento', 'Tier'],
  permissions: ['Permissões', 'Regra', 'Audit Log', 'Pattern'],
  preferences: ['Nome', 'Fuso horário', 'Idioma', 'Notas'],
  shortcuts: ['Atalhos', 'Teclado', 'Keybindings'],
  about: ['Sobre', 'Versão'],
};

// === UI IMPROVEMENT: Configuration Templates ===
const CONFIG_TEMPLATES: { id: string; name: string; description: string; settings: Record<string, any> }[] = [
  { id: 'dev', name: 'Modo Desenvolvedor', description: 'Tema escuro, verbose, OLED off', settings: { customThemeMode: 'dark', oledEnabled: false, permissionMode: 'execute', mcpLocalEnabled: true } },
  { id: 'focus', name: 'Modo Foco', description: 'Minimal, sem distrações', settings: { customThemeMode: 'midnight', oledEnabled: true, permissionMode: 'execute', mcpLocalEnabled: false } },
  { id: 'presentation', name: 'Modo Apresentação', description: 'Tema claro, fonte sistema, limpo', settings: { customThemeMode: 'light', oledEnabled: false, font: 'system', permissionMode: 'ask' } },
];

// === UI IMPROVEMENT: Info Tooltips data ===
const SETTING_TOOLTIPS: Record<string, string> = {
  'documents_path': 'Diretório onde o JVOS salva arquivos gerados. Ex: relatórios, exports, skills baixadas.',
  'system_prompt': 'Instruções globais enviadas em toda conversa. Define personalidade, restrições e comportamento padrão da IA.',
  'theme_mode': 'Modo claro/escuro do app. "Sistema" segue a preferência do OS.',
  'font': 'Fonte primária da interface. Manrope é otimizada para legibilidade em telas.',
  'send_key': 'Tecla para enviar mensagens. Enter envia direto, Ctrl+Enter permite múltiplas linhas.',
  'auto_capitalize': 'Capitaliza a primeira letra de cada frase automaticamente no campo de input.',
  'spell_check': 'Verifica ortografia em tempo real e sublinha palavras possivelmente erradas.',
  'workspace_name': 'Nome identificador do workspace. Aparece no título e em exports.',
  'permission_mode': 'Define se a IA executa ações direto, pergunta antes, ou apenas explora sem modificar.',
  'mcp_local': 'Permite que servidores MCP locais (via stdio) sejam iniciados como subprocessos.',
  'oled': 'Fundo preto puro (#000). Ideal para telas AMOLED, economiza bateria em mobile.',
  'accent_color': 'Cor de destaque usada em botões, links e elementos interativos da interface.',
  'user_name': 'Como a IA se refere a você nas respostas.',
  'user_timezone': 'Fuso horário usado para formatar datas e agendar automações.',
};

// === UI IMPROVEMENT: Sync Timeline entry ===
interface SyncTimelineEntry {
  timestamp: string;
  setting: string;
  oldValue: string;
  newValue: string;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  models: any[];
  hasKey: boolean;
  apiKeyPlaceholder?: string;
}

interface McpServer {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  enabled?: boolean;
  status: string;
  error?: string;
  toolCount: number;
}

interface Model {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  description?: string;
  hasKey: boolean;
  api: string;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('app');
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('dark');
  const [font, setFont] = useState<'manrope' | 'system'>('manrope');
  const [sendKey, setSendKey] = useState<'enter' | 'ctrl-enter'>('enter');
  const [autoCapitalize, setAutoCapitalize] = useState(true);
  const [spellCheck, setSpellCheck] = useState(true);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [confirmRemoveMcp, setConfirmRemoveMcp] = useState<string | null>(null);
  const [mcpFormError, setMcpFormError] = useState('');
  const [userName, setUserName] = useState('');
  const [userTimezone, setUserTimezone] = useState('America/Sao_Paulo');
  const [userLanguage, setUserLanguage] = useState('pt-BR');
  const [userNotes, setUserNotes] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [defaultModel, setDefaultModel] = useState('codex-mini-latest');
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyStatus, setKeyStatus] = useState<Record<string, string>>({});
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [mcpForm, setMcpForm] = useState({ name: '', command: '', args: '', url: '', transport: 'stdio' as string });
  const [documentsPath, setDocumentsPath] = useState('');
  const [pathSaved, setPathSaved] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('JVOS');
  const [editingWorkspaceName, setEditingWorkspaceName] = useState(false);
  const [permissionMode, setPermissionMode] = useState('execute');
  const [mcpLocalEnabled, setMcpLocalEnabled] = useState(true);
  // #2 Rate limit on key test (#8)
  const [keyTestCooldown, setKeyTestCooldown] = useState<Record<string, number>>({});
  // #7 MCP test before save
  const [mcpTestStatus, setMcpTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [mcpTestMessage, setMcpTestMessage] = useState('');
  const [customThemeMode, setCustomThemeMode] = useState<'dark' | 'light' | 'midnight'>('dark');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  // Feature 11: Session purge
  const [sessionStats, setSessionStats] = useState<{ count: number; estimatedMB: number } | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState<'old' | 'all' | null>(null);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeOldCount, setPurgeOldCount] = useState(0);

  // === Feature 1: Global search ===
  const [globalSearch, setGlobalSearch] = useState('');

  // === Feature 2: API key rotation dates ===
  const [keyDates, setKeyDates] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-key-dates') || '{}'); } catch { return {}; }
  });

  // === Feature 3: Profiles ===
  const [showProfiles, setShowProfiles] = useState(false);
  const [profiles, setProfiles] = useState<SettingsProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('ados-settings-profiles') || '[]'); } catch { return []; }
  });
  const [newProfileName, setNewProfileName] = useState('');

  // === Feature 4: Enhanced export ===
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({ mcp: true, shortcuts: true, permissions: true, theme: true, preferences: true });

  // === Feature 6: MCP error logs ===
  const [mcpLogs, setMcpLogs] = useState<Record<string, McpLogEntry[]>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-mcp-logs') || '{}'); } catch { return {}; }
  });
  const [expandedMcpLogs, setExpandedMcpLogs] = useState<Record<string, boolean>>({});

  // === Feature 7: Reset per section ===
  const [showResetConfirm, setShowResetConfirm] = useState<string | null>(null);

  // === NEW FEATURES STATE ===
  // Feature 1: WCAG contrast validation
  const [contrastWarnings, setContrastWarnings] = useState<{ pair: string; ratio: number }[]>([]);

  // Feature 2: Cross-device sync
  const [syncStatus, setSyncStatus] = useState<'idle' | 'exporting' | 'importing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // Feature 3: Permission categorization filter
  const [permCategoryFilter, setPermCategoryFilter] = useState<string>('all');

  // Feature 4: Settings changelog
  const [settingsChangelog, setSettingsChangelog] = useState<SettingsChangelogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('ados-settings-changelog') || '[]'); } catch { return []; }
  });
  const [showChangelog, setShowChangelog] = useState(false);

  // === UI IMPROVEMENTS: New State ===
  // 2. Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, any>>({});

  // 3. Undo/Redo
  const [settingsHistory, setSettingsHistory] = useState<Record<string, any>[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 5. Command Palette
  const [showPalette, setShowPalette] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');

  // 7. Sync Timeline
  const [syncTimeline, setSyncTimeline] = useState<SyncTimelineEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('ados-sync-timeline') || '[]'); } catch { return []; }
  });

  // 9. Dependency warnings
  const [dependencyWarnings, setDependencyWarnings] = useState<{ message: string; fix: () => void }[]>([]);

  // Feature 5: Custom prompt test for provider
  const [providerTestPrompt, setProviderTestPrompt] = useState('Responda com "OK" se estiver funcionando.');
  const [providerTestResult, setProviderTestResult] = useState<Record<string, { status: string; response?: string }>>({});

  // Feature 6: Lock sensitive settings
  const [settingsLockPassword, setSettingsLockPassword] = useState<string>(() => localStorage.getItem('ados-settings-lock-pw') || '');
  const [isSettingsLocked, setIsSettingsLocked] = useState<boolean>(() => !!localStorage.getItem('ados-settings-lock-pw'));
  const [lockPasswordInput, setLockPasswordInput] = useState('');
  const [showLockModal, setShowLockModal] = useState<'set' | 'unlock' | null>(null);
  const [lockError, setLockError] = useState('');
  const [unlockedUntil, setUnlockedUntil] = useState<number>(0);

  // Feature 7: Setup wizard
  const [showWizard, setShowWizard] = useState<boolean>(() => !localStorage.getItem('ados-wizard-done'));
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardApiKey, setWizardApiKey] = useState('');
  const [wizardProvider, setWizardProvider] = useState('openai');
  const [wizardName, setWizardName] = useState('');

  // Feature 8: OLED theme
  const [oledEnabled, setOledEnabled] = useState<boolean>(() => {
    try { const t = JSON.parse(localStorage.getItem('ados-theme') || '{}'); return t.oled === true; } catch { return false; }
  });

  // NEW Feature: Settings diff (compare current vs last export)
  const [showDiff, setShowDiff] = useState(false);
  const [diffEntries, setDiffEntries] = useState<{ key: string; current: string; saved: string }[]>([]);

  // NEW Feature: Notification preferences
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('ados-notif-enabled') !== 'false'; } catch { return true; }
  });
  const [notifSound, setNotifSound] = useState<boolean>(() => {
    try { return localStorage.getItem('ados-notif-sound') !== 'false'; } catch { return true; }
  });
  const [notifTypes, setNotifTypes] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-notif-types') || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    loadProviders();
    loadMcpServers();
    loadModels();
    loadDocumentsPath();
    loadSystemPrompt();
    loadAppearanceSettings();
    loadInputSettings();
    loadPreferences();
    loadWorkspaceSettings();
    loadSessionStats();
  }, []);

  const loadWorkspaceSettings = async () => {
    const savedName = await ados.db.getSetting('workspace_name');
    if (savedName) setWorkspaceName(savedName);
    const savedMode = await ados.db.getSetting('permission_mode');
    if (savedMode) setPermissionMode(savedMode);
    const savedMcp = await ados.db.getSetting('mcp_local_enabled');
    if (savedMcp !== null) setMcpLocalEnabled(savedMcp !== 'false');
  };

  const loadSessionStats = async () => {
    try {
      const sessions = await ados.db.getSessions();
      const count = sessions?.length || 0;
      const estimatedMB = parseFloat(((count * 15) / 1024).toFixed(2)); // ~15KB per session estimate
      setSessionStats({ count, estimatedMB });
    } catch { setSessionStats({ count: 0, estimatedMB: 0 }); }
  };

  const handlePurgeOld = async () => {
    try {
      const sessions = await ados.db.getSessions();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const oldSessions = (sessions || []).filter((s: any) => {
        const created = new Date(s.createdAt || s.created_at || s.timestamp || 0).getTime();
        return created < thirtyDaysAgo;
      });
      setPurgeOldCount(oldSessions.length);
      setShowPurgeConfirm('old');
    } catch { setPurgeResult('Erro ao buscar sessoes'); }
  };

  const confirmPurgeOld = async () => {
    try {
      const sessions = await ados.db.getSessions();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const oldSessions = (sessions || []).filter((s: any) => {
        const created = new Date(s.createdAt || s.created_at || s.timestamp || 0).getTime();
        return created < thirtyDaysAgo;
      });
      for (const s of oldSessions) {
        await ados.db.deleteSession(s.id);
      }
      const sizeMB = ((oldSessions.length * 15) / 1024).toFixed(2);
      setPurgeResult(`${oldSessions.length} sessoes removidas, ~${sizeMB}MB liberados`);
      setShowPurgeConfirm(null);
      loadSessionStats();
    } catch { setPurgeResult('Erro ao excluir sessoes'); setShowPurgeConfirm(null); }
  };

  const confirmPurgeAll = async () => {
    if (purgeConfirmText !== 'EXCLUIR') return;
    try {
      const sessions = await ados.db.getSessions();
      for (const s of (sessions || [])) {
        await ados.db.deleteSession(s.id);
      }
      const sizeMB = (((sessions?.length || 0) * 15) / 1024).toFixed(2);
      setPurgeResult(`${sessions?.length || 0} sessoes removidas, ~${sizeMB}MB liberados`);
      setShowPurgeConfirm(null);
      setPurgeConfirmText('');
      loadSessionStats();
    } catch { setPurgeResult('Erro ao excluir sessoes'); setShowPurgeConfirm(null); }
  };

  const loadAppearanceSettings = async () => {
    const savedTheme = await ados.db.getSetting('theme_mode');
    if (savedTheme) setThemeMode(savedTheme as any);
    const savedFont = await ados.db.getSetting('font');
    if (savedFont) setFont(savedFont as any);
    try {
      const saved = localStorage.getItem('ados-theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.mode) setCustomThemeMode(parsed.mode);
        if (parsed.accent) setAccentColor(parsed.accent);
        if (parsed.oled) {
          setOledEnabled(true);
          const root = document.documentElement;
          root.style.setProperty('--surface-0', '#000000');
          root.style.setProperty('--surface-1', '#0a0a0a');
          root.style.setProperty('--surface-2', '#141414');
          root.classList.add('dark');
          root.classList.remove('light');
        } else { applyCustomTheme(parsed.mode, parsed.accent); }
      }
    } catch {}
  };

  const applyCustomTheme = (mode: 'dark' | 'light' | 'midnight', accent: string) => {
    const root = document.documentElement;
    root.style.setProperty('--brand-500', accent);
    root.style.setProperty('--brand-600', accent);
    root.style.setProperty('--brand-700', accent);
    if (mode === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else if (mode === 'midnight') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.setProperty('--surface-0', '#0f1729');
      root.style.setProperty('--surface-1', '#1a2540');
      root.style.setProperty('--surface-2', '#243356');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.removeProperty('--surface-0');
      root.style.removeProperty('--surface-1');
      root.style.removeProperty('--surface-2');
    }
  };

  const handleSaveCustomTheme = (mode: 'dark' | 'light' | 'midnight', accent: string) => {
    setCustomThemeMode(mode);
    setAccentColor(accent);
    applyCustomTheme(mode, accent);
    localStorage.setItem('ados-theme', JSON.stringify({ mode, accent }));
  };

  const loadInputSettings = async () => {
    const savedSendKey = await ados.db.getSetting('send_key');
    if (savedSendKey) setSendKey(savedSendKey as any);
    const savedAutoCap = await ados.db.getSetting('auto_capitalize');
    if (savedAutoCap) setAutoCapitalize(savedAutoCap === 'true');
    const savedSpell = await ados.db.getSetting('spell_check');
    if (savedSpell) setSpellCheck(savedSpell === 'true');
  };

  const loadPreferences = async () => {
    const savedName = await ados.db.getSetting('user_name');
    if (savedName) setUserName(savedName);
    const savedTz = await ados.db.getSetting('user_timezone');
    if (savedTz) setUserTimezone(savedTz);
    const savedLang = await ados.db.getSetting('user_language');
    if (savedLang) setUserLanguage(savedLang);
    const savedNotes = await ados.db.getSetting('user_notes');
    if (savedNotes) setUserNotes(savedNotes);
  };

  const handleSaveAppearance = async (key: string, value: string) => {
    const oldVal = await ados.db?.getSetting?.(key);
    await ados.db.setSetting(key, value);
    logSettingChange(key, oldVal || '', value);
    if (key === 'theme_mode') {
      const isDark = value === 'dark' || (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', !isDark);
      window.dispatchEvent(new CustomEvent('ados-theme-change', { detail: isDark ? 'dark' : 'light' }));
    }
    if (key === 'font') {
      document.documentElement.style.fontFamily = value === 'manrope'
        ? "'Manrope', 'Inter', sans-serif"
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      window.dispatchEvent(new CustomEvent('ados-font-change', { detail: { font: value } }));
    }
  };

  const handleSavePreferences = async () => {
    await ados.db.setSetting('user_name', userName);
    await ados.db.setSetting('user_timezone', userTimezone);
    await ados.db.setSetting('user_language', userLanguage);
    await ados.db.setSetting('user_notes', userNotes);
    window.dispatchEvent(new CustomEvent('ados-language-change', { detail: { language: userLanguage } }));
    window.dispatchEvent(new CustomEvent('ados-preferences-change', { detail: { name: userName, timezone: userTimezone, language: userLanguage, role: '', notes: userNotes } }));
  };

  const loadDocumentsPath = async () => {
    const saved = await ados.db.getSetting('documents_path');
    if (saved) {
      setDocumentsPath(saved);
    } else {
      const defaultPath = await ados.tools?.getDocumentsPath?.();
      if (defaultPath) setDocumentsPath(defaultPath);
    }
  };

  const handleSaveDocumentsPath = async () => {
    await ados.db.setSetting('documents_path', documentsPath);
    setPathSaved(true);
    setTimeout(() => setPathSaved(false), 2000);
  };

  const loadSystemPrompt = async () => {
    const saved = await ados.db.getSetting('system_prompt');
    if (saved) setSystemPrompt(saved);
  };

  const handleSaveSystemPrompt = async () => {
    await ados.db.setSetting('system_prompt', systemPrompt);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2000);
  };

  const loadProviders = async () => {
    const list = await ados.providers.list();
    setProviders(list);
  };

  const loadMcpServers = async () => {
    const list = await ados.mcp.listServers();
    setMcpServers(list);
  };

  const loadModels = async () => {
    const list = await ados.providers.listModels();
    setModels(list);
    const dm = await ados.providers.getDefaultModel();
    setDefaultModel(dm);
  };

  const handleSaveKey = async (providerId: string) => {
    const key = keyInputs[providerId];
    if (!key) return;

    // NEW Feature 6: Check lock
    if (isSensitiveLocked()) { setShowLockModal('unlock'); return; }

    // #8 Rate limit — 5s cooldown between tests per provider
    const lastTest = keyTestCooldown[providerId] || 0;
    const elapsed = Date.now() - lastTest;
    if (elapsed < 5000) {
      setKeyStatus({ ...keyStatus, [providerId]: 'cooldown' });
      setTimeout(() => setKeyStatus(s => ({ ...s, [providerId]: '' })), 5000 - elapsed);
      return;
    }
    setKeyTestCooldown({ ...keyTestCooldown, [providerId]: Date.now() });

    // #2 Status with spinner + timeout
    setKeyStatus({ ...keyStatus, [providerId]: 'testing' });

    const timeoutPromise = new Promise<{ error: string }>((resolve) =>
      setTimeout(() => resolve({ error: 'Timeout (3s)' }), 3000)
    );
    const testPromise = ados.llm.testKey(providerId, key);
    const testResult = await Promise.race([testPromise, timeoutPromise]);

    if (testResult.error) {
      setKeyStatus({ ...keyStatus, [providerId]: 'error' });
      return;
    }

    setKeyStatus({ ...keyStatus, [providerId]: 'saving' });
    const result = await ados.providers.saveKey(providerId, key);
    if (result.success) {
      setKeyStatus({ ...keyStatus, [providerId]: 'saved' });
      setKeyInputs({ ...keyInputs, [providerId]: '' });
      // Feature 2: track key creation date
      markKeyAsNew(providerId);
      loadProviders();
      loadModels();
      setTimeout(() => setKeyStatus((s) => ({ ...s, [providerId]: '' })), 2000);
    } else {
      setKeyStatus({ ...keyStatus, [providerId]: 'error' });
    }
  };

  const handleAddMcpServer = async () => {
    // NEW Feature 6: Check lock for MCP changes
    if (isSensitiveLocked()) { setShowLockModal('unlock'); return; }
    if (!mcpForm.name.trim()) { setMcpFormError('Nome é obrigatório'); return; }
    if (mcpForm.transport === 'stdio' && !mcpForm.command.trim()) { setMcpFormError('Comando é obrigatório para transport stdio'); return; }
    if (mcpForm.transport !== 'stdio') {
      try { new URL(mcpForm.url); } catch { setMcpFormError('URL inválida para transport remoto'); return; }
    }
    setMcpFormError('');
    const config: any = { name: mcpForm.name, enabled: true };
    if (mcpForm.transport === 'stdio') {
      config.command = mcpForm.command;
      config.args = mcpForm.args ? mcpForm.args.split(' ').filter(Boolean) : [];
    } else {
      config.url = mcpForm.url;
      config.transport = mcpForm.transport;
    }

    // #7 Test connection before saving
    setMcpTestStatus('testing');
    setMcpTestMessage('Testando conexão...');
    try {
      const testResult = await Promise.race([
        ados.mcp.testServer?.(config) || ados.mcp.addServer(config).then(() => ({ success: true })),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);
      if (testResult && (testResult as any).error) {
        setMcpTestStatus('error');
        setMcpTestMessage(`Falha: ${(testResult as any).error}`);
        return;
      }
      setMcpTestStatus('success');
      setMcpTestMessage('Conexão OK');
    } catch (err: any) {
      // If testServer doesn't exist, we already added it above, so just proceed
      if (!ados.mcp.testServer) {
        // Already added via fallback
      } else {
        setMcpTestStatus('error');
        setMcpTestMessage(`Falha: ${err.message || 'Erro desconhecido'}`);
        return;
      }
    }

    // If testServer exists, we need to actually add it after successful test
    if (ados.mcp.testServer) {
      await ados.mcp.addServer(config);
    }

    setShowAddMcp(false);
    setMcpForm({ name: '', command: '', args: '', url: '', transport: 'stdio' });
    setMcpTestStatus('idle');
    setMcpTestMessage('');
    loadMcpServers();
  };

  const handleConnectMcp = async (name: string) => {
    try {
      await ados.mcp.connectServer(name);
      addMcpLog(name, 'success', 'Conexão estabelecida');
    } catch (err: any) {
      addMcpLog(name, 'error', err?.message || 'Falha na conexão');
    }
    loadMcpServers();
  };

  const handleDisconnectMcp = async (name: string) => {
    await ados.mcp.disconnectServer(name);
    addMcpLog(name, 'success', 'Desconectado');
    loadMcpServers();
  };

  const handleRemoveMcp = async (name: string) => {
    await ados.mcp.removeServer(name);
    setConfirmRemoveMcp(null);
    loadMcpServers();
  };

  const handleSetDefaultModel = async (modelId: string) => {
    await ados.providers.setDefaultModel(modelId);
    setDefaultModel(modelId);
  };

  // === Feature 2: Key rotation helpers ===
  const getKeyAgeDays = (providerId: string): number | null => {
    const date = keyDates[providerId];
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  };
  const markKeyAsNew = (providerId: string) => {
    const updated = { ...keyDates, [providerId]: new Date().toISOString() };
    setKeyDates(updated);
    localStorage.setItem('ados-key-dates', JSON.stringify(updated));
  };

  // === Feature 3: Profile helpers ===
  const saveProfile = () => {
    if (!newProfileName.trim()) return;
    const data: Record<string, any> = { themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath, userName, userTimezone, userLanguage, userNotes, workspaceName, permissionMode, customThemeMode, accentColor };
    const profile: SettingsProfile = { name: newProfileName.trim(), data, createdAt: new Date().toISOString() };
    const updated = [...profiles, profile];
    setProfiles(updated);
    localStorage.setItem('ados-settings-profiles', JSON.stringify(updated));
    setNewProfileName('');
  };
  const loadProfile = async (profile: SettingsProfile) => {
    const d = profile.data;
    if (d.themeMode) { setThemeMode(d.themeMode); await ados.db.setSetting('theme_mode', d.themeMode); }
    if (d.font) { setFont(d.font); await ados.db.setSetting('font', d.font); }
    if (d.sendKey) { setSendKey(d.sendKey); await ados.db.setSetting('send_key', d.sendKey); }
    if (d.systemPrompt !== undefined) { setSystemPrompt(d.systemPrompt); await ados.db.setSetting('system_prompt', d.systemPrompt); }
    if (d.documentsPath !== undefined) { setDocumentsPath(d.documentsPath); await ados.db.setSetting('documents_path', d.documentsPath); }
    if (d.userName !== undefined) { setUserName(d.userName); await ados.db.setSetting('user_name', d.userName); }
    if (d.userTimezone) { setUserTimezone(d.userTimezone); await ados.db.setSetting('user_timezone', d.userTimezone); }
    if (d.userLanguage) { setUserLanguage(d.userLanguage); await ados.db.setSetting('user_language', d.userLanguage); }
    if (d.userNotes !== undefined) { setUserNotes(d.userNotes); await ados.db.setSetting('user_notes', d.userNotes); }
    if (d.workspaceName) { setWorkspaceName(d.workspaceName); await ados.db.setSetting('workspace_name', d.workspaceName); }
    if (d.permissionMode) { setPermissionMode(d.permissionMode); await ados.db.setSetting('permission_mode', d.permissionMode); }
    if (d.customThemeMode) { setCustomThemeMode(d.customThemeMode); handleSaveCustomTheme(d.customThemeMode, d.accentColor || accentColor); }
    setShowProfiles(false);
  };
  const deleteProfile = (idx: number) => {
    const updated = profiles.filter((_, i) => i !== idx);
    setProfiles(updated);
    localStorage.setItem('ados-settings-profiles', JSON.stringify(updated));
  };

  // === Feature 4: Enhanced export ===
  const handleEnhancedExport = async () => {
    const payload: Record<string, any> = { exportedAt: new Date().toISOString(), version: '2.0' };
    if (exportOptions.preferences) {
      payload.preferences = { themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath, userName, userTimezone, userLanguage, userNotes };
    }
    if (exportOptions.theme) {
      payload.theme = { customThemeMode, accentColor };
    }
    if (exportOptions.mcp) {
      payload.mcpServers = mcpServers.map(s => ({ name: s.name, command: s.command, args: s.args, url: s.url, transport: s.transport }));
    }
    if (exportOptions.shortcuts) {
      const saved = await ados.db.getSetting?.('custom_shortcuts');
      payload.shortcuts = saved ? JSON.parse(saved) : null;
    }
    if (exportOptions.permissions) {
      payload.permissions = await ados.db.getPermissions();
    }
    const json = JSON.stringify(payload);
    const encoded = 'ADOS_CONFIG_V2:' + btoa(unescape(encodeURIComponent(json)));
    await navigator.clipboard.writeText(encoded);
    setShowExportModal(false);
  };
  const handleEnhancedImport = async () => {
    try {
      let text = await navigator.clipboard.readText();
      if (text.startsWith('ADOS_CONFIG_V2:')) {
        text = decodeURIComponent(escape(atob(text.slice('ADOS_CONFIG_V2:'.length))));
      }
      const config = JSON.parse(text);
      if (config.preferences) {
        const p = config.preferences;
        if (p.systemPrompt !== undefined) { setSystemPrompt(p.systemPrompt); await ados.db.setSetting('system_prompt', p.systemPrompt); }
        if (p.documentsPath !== undefined) { setDocumentsPath(p.documentsPath); await ados.db.setSetting('documents_path', p.documentsPath); }
        if (p.themeMode) { setThemeMode(p.themeMode); handleSaveAppearance('theme_mode', p.themeMode); }
        if (p.font) { setFont(p.font); handleSaveAppearance('font', p.font); }
        if (p.userName !== undefined) { setUserName(p.userName); await ados.db.setSetting('user_name', p.userName); }
      }
      if (config.theme) { handleSaveCustomTheme(config.theme.customThemeMode, config.theme.accentColor); }
      if (config.shortcuts) { await ados.db.setSetting?.('custom_shortcuts', JSON.stringify(config.shortcuts)); }
      if (config.mcpServers) { for (const s of config.mcpServers) { try { await ados.mcp.addServer(s); } catch {} } loadMcpServers(); }
      alert('Configurações importadas com sucesso!');
    } catch { alert('Erro ao importar: conteúdo inválido no clipboard.'); }
  };

  // === Feature 6: MCP log helper ===
  const addMcpLog = (serverName: string, status: 'success' | 'error', message: string) => {
    const entry: McpLogEntry = { timestamp: new Date().toISOString(), status, message };
    const current = mcpLogs[serverName] || [];
    const updated = [entry, ...current].slice(0, 5);
    const newLogs = { ...mcpLogs, [serverName]: updated };
    setMcpLogs(newLogs);
    localStorage.setItem('ados-mcp-logs', JSON.stringify(newLogs));
  };

  // === Feature 7: Reset section ===
  const handleResetSection = async (section: string) => {
    const defaults = SECTION_DEFAULTS[section];
    if (!defaults) return;
    for (const [key, val] of Object.entries(defaults)) {
      await ados.db.setSetting(key, val);
    }
    // Reload relevant state
    if (section === 'app') { setDocumentsPath(''); setSystemPrompt(''); }
    if (section === 'appearance') { setThemeMode('dark'); setFont('manrope'); setCustomThemeMode('dark'); setAccentColor('#6366f1'); handleSaveCustomTheme('dark', '#6366f1'); }
    if (section === 'input') { setSendKey('enter'); setAutoCapitalize(true); setSpellCheck(true); }
    if (section === 'workspace') { setWorkspaceName('JVOS'); setPermissionMode('execute'); setMcpLocalEnabled(true); }
    if (section === 'preferences') { setUserName(''); setUserTimezone('America/Sao_Paulo'); setUserLanguage('pt-BR'); setUserNotes(''); }
    setShowResetConfirm(null);
  };

  // === NEW Feature 1: WCAG contrast check ===
  const checkThemeContrast = useCallback(() => {
    const pairs: { pair: string; fg: string; bg: string }[] = [];
    const root = getComputedStyle(document.documentElement);
    const getBg = () => {
      if (oledEnabled) return '#000000';
      if (customThemeMode === 'midnight') return '#0f1729';
      if (customThemeMode === 'light') return '#ffffff';
      return '#1a1a2e';
    };
    const bg = getBg();
    pairs.push({ pair: 'Accent vs Background', fg: accentColor, bg });
    pairs.push({ pair: 'Text vs Background', fg: customThemeMode === 'light' ? '#1a1a2e' : '#e2e8f0', bg });
    const warnings: { pair: string; ratio: number }[] = [];
    for (const p of pairs) {
      const ratio = contrastRatio(p.fg, p.bg);
      if (ratio < 4.5) warnings.push({ pair: p.pair, ratio: parseFloat(ratio.toFixed(2)) });
    }
    setContrastWarnings(warnings);
  }, [accentColor, customThemeMode, oledEnabled]);

  useEffect(() => { checkThemeContrast(); }, [checkThemeContrast]);

  // === NEW Feature 2: Cross-device sync ===
  const handleCloudExport = useCallback(async () => {
    setSyncStatus('exporting');
    setSyncMessage('Exportando...');
    try {
      const allSettings: Record<string, any> = {
        themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath,
        userName, userTimezone, userLanguage, userNotes, workspaceName, permissionMode,
        customThemeMode, accentColor, oledEnabled, defaultModel,
      };
      const payload = JSON.stringify({ settings: allSettings, exportedAt: new Date().toISOString(), version: '3.0-sync' });
      const endpoint = await ados.db?.getSetting?.('cloud_sync_endpoint');
      if (endpoint) {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        setSyncStatus('success');
        setSyncMessage('Exportado para cloud com sucesso!');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText('ADOS_SYNC:' + btoa(unescape(encodeURIComponent(payload))));
        setSyncStatus('success');
        setSyncMessage('Copiado para clipboard (nenhum endpoint configurado).');
      }
    } catch (e: any) {
      setSyncStatus('error');
      setSyncMessage('Erro: ' + (e.message || 'Falha na exportação'));
    }
    setTimeout(() => setSyncStatus('idle'), 4000);
  }, [themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath, userName, userTimezone, userLanguage, userNotes, workspaceName, permissionMode, customThemeMode, accentColor, oledEnabled, defaultModel]);

  const handleCloudImport = useCallback(async () => {
    setSyncStatus('importing');
    setSyncMessage('Importando...');
    try {
      const endpoint = await ados.db?.getSetting?.('cloud_sync_endpoint');
      let payload: any;
      if (endpoint) {
        const res = await fetch(endpoint);
        payload = await res.json();
      } else {
        let text = await navigator.clipboard.readText();
        if (text.startsWith('ADOS_SYNC:')) text = decodeURIComponent(escape(atob(text.slice('ADOS_SYNC:'.length))));
        payload = JSON.parse(text);
      }
      if (payload.settings) {
        const s = payload.settings;
        if (s.themeMode) { setThemeMode(s.themeMode); await ados.db?.setSetting?.('theme_mode', s.themeMode); }
        if (s.font) { setFont(s.font); await ados.db?.setSetting?.('font', s.font); }
        if (s.userName !== undefined) { setUserName(s.userName); await ados.db?.setSetting?.('user_name', s.userName); }
        if (s.systemPrompt !== undefined) { setSystemPrompt(s.systemPrompt); await ados.db?.setSetting?.('system_prompt', s.systemPrompt); }
        if (s.customThemeMode) handleSaveCustomTheme(s.customThemeMode, s.accentColor || accentColor);
        if (s.oledEnabled !== undefined) { setOledEnabled(s.oledEnabled); applyOledTheme(s.oledEnabled); }
      }
      setSyncStatus('success');
      setSyncMessage('Importado com sucesso!');
    } catch (e: any) {
      setSyncStatus('error');
      setSyncMessage('Erro: ' + (e.message || 'Falha na importação'));
    }
    setTimeout(() => setSyncStatus('idle'), 4000);
  }, [accentColor]);

  // === NEW Feature 4: Settings changelog ===
  const logSettingChange = useCallback((key: string, oldValue: any, newValue: any) => {
    const entry: SettingsChangelogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      key,
      oldValue,
      newValue,
    };
    // UI IMPROVEMENT 7: Also add to sync timeline
    setSyncTimeline(prev => {
      const te: SyncTimelineEntry = { timestamp: new Date().toISOString(), setting: key, oldValue: String(oldValue).slice(0, 30), newValue: String(newValue).slice(0, 30) };
      const updated = [te, ...prev].slice(0, 5);
      localStorage.setItem('ados-sync-timeline', JSON.stringify(updated));
      return updated;
    });
    setSettingsChangelog(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      localStorage.setItem('ados-settings-changelog', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // === NEW Feature 5: Test provider with custom prompt ===
  const handleTestProviderWithPrompt = useCallback(async (providerId: string) => {
    setProviderTestResult(prev => ({ ...prev, [providerId]: { status: 'testing' } }));
    const testModels: Record<string, string> = {
      openai: 'gpt-4.1-nano',
      anthropic: 'claude-haiku-4-5',
      google: 'gemini-2.5-flash',
      groq: 'llama-3.3-70b-versatile',
      openrouter: 'deepseek/deepseek-r1',
    };
    const model = testModels[providerId] || 'gpt-4.1-mini';
    try {
      const result = await Promise.race([
        ados.llm?.chat?.([{ role: 'user', content: providerTestPrompt }], model) ||
          Promise.resolve({ response: '(chat não disponível)' }),
        new Promise<{ error: string }>((resolve) => setTimeout(() => resolve({ error: 'Timeout (10s)' }), 10000))
      ]);
      if ((result as any).error) {
        setProviderTestResult(prev => ({ ...prev, [providerId]: { status: 'error', response: (result as any).error } }));
      } else {
        const response = (result as any).response || (result as any).content || (result as any).text || JSON.stringify(result);
        setProviderTestResult(prev => ({ ...prev, [providerId]: { status: 'success', response: String(response).slice(0, 200) } }));
      }
    } catch (e: any) {
      setProviderTestResult(prev => ({ ...prev, [providerId]: { status: 'error', response: e.message || 'Erro desconhecido' } }));
    }
  }, [providerTestPrompt]);

  // === NEW Feature 6: Lock sensitive settings ===
  const isSensitiveLocked = useCallback((): boolean => {
    if (!isSettingsLocked) return false;
    return Date.now() > unlockedUntil;
  }, [isSettingsLocked, unlockedUntil]);

  const handleSetLockPassword = useCallback((pw: string) => {
    localStorage.setItem('ados-settings-lock-pw', pw);
    setSettingsLockPassword(pw);
    setIsSettingsLocked(true);
    setShowLockModal(null);
    setLockPasswordInput('');
  }, []);

  const handleUnlock = useCallback(() => {
    if (lockPasswordInput === settingsLockPassword) {
      setUnlockedUntil(Date.now() + 5 * 60 * 1000); // 5 min unlock
      setShowLockModal(null);
      setLockPasswordInput('');
      setLockError('');
    } else {
      setLockError('Senha incorreta');
    }
  }, [lockPasswordInput, settingsLockPassword]);

  const handleRemoveLock = useCallback(() => {
    localStorage.removeItem('ados-settings-lock-pw');
    setSettingsLockPassword('');
    setIsSettingsLocked(false);
    setUnlockedUntil(0);
  }, []);

  // === NEW Feature 7: Wizard ===
  const handleWizardFinish = useCallback(async () => {
    if (wizardApiKey && wizardProvider) {
      await ados.providers?.saveKey?.(wizardProvider, wizardApiKey);
    }
    if (wizardName) {
      setUserName(wizardName);
      await ados.db?.setSetting?.('user_name', wizardName);
    }
    localStorage.setItem('ados-wizard-done', 'true');
    setShowWizard(false);
    loadProviders();
  }, [wizardApiKey, wizardProvider, wizardName]);

  // === NEW Feature 8: OLED theme ===
  const applyOledTheme = useCallback((enabled: boolean) => {
    const root = document.documentElement;
    if (enabled) {
      root.style.setProperty('--surface-0', '#000000');
      root.style.setProperty('--surface-1', '#0a0a0a');
      root.style.setProperty('--surface-2', '#141414');
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      // Restore based on current theme mode
      if (customThemeMode === 'midnight') {
        root.style.setProperty('--surface-0', '#0f1729');
        root.style.setProperty('--surface-1', '#1a2540');
        root.style.setProperty('--surface-2', '#243356');
      } else if (customThemeMode === 'dark') {
        root.style.removeProperty('--surface-0');
        root.style.removeProperty('--surface-1');
        root.style.removeProperty('--surface-2');
      }
    }
  }, [customThemeMode]);

  const handleToggleOled = useCallback((enabled: boolean) => {
    setOledEnabled(enabled);
    applyOledTheme(enabled);
    const themeData = JSON.parse(localStorage.getItem('ados-theme') || '{}');
    themeData.oled = enabled;
    localStorage.setItem('ados-theme', JSON.stringify(themeData));
    logSettingChange('oled_theme', !enabled, enabled);
  }, [applyOledTheme, logSettingChange]);

  // NEW Feature: Settings diff — compare current state vs last saved snapshot
  const handleComputeDiff = useCallback(() => {
    try {
      const lastSnapshot = localStorage.getItem('ados-settings-snapshot');
      if (!lastSnapshot) {
        setDiffEntries([{ key: '(info)', current: 'Nenhum snapshot anterior encontrado', saved: 'Exporte para criar um snapshot' }]);
        setShowDiff(true);
        return;
      }
      const snapshot = JSON.parse(lastSnapshot);
      const current: Record<string, string> = {
        themeMode, font, sendKey, autoCapitalize: String(autoCapitalize), spellCheck: String(spellCheck),
        systemPrompt: systemPrompt.slice(0, 50), documentsPath, userName, userTimezone, userLanguage,
        workspaceName, permissionMode, customThemeMode, accentColor, oledEnabled: String(oledEnabled),
      };
      const entries: { key: string; current: string; saved: string }[] = [];
      for (const key of Object.keys(current)) {
        const cur = current[key] || '';
        const sav = String(snapshot[key] || '');
        if (cur !== sav) entries.push({ key, current: cur, saved: sav });
      }
      if (entries.length === 0) entries.push({ key: '(nenhuma diferenca)', current: '-', saved: '-' });
      setDiffEntries(entries);
      setShowDiff(true);
    } catch { setDiffEntries([{ key: 'erro', current: 'Falha ao comparar', saved: '' }]); setShowDiff(true); }
  }, [themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath, userName, userTimezone, userLanguage, workspaceName, permissionMode, customThemeMode, accentColor, oledEnabled]);

  const handleSaveSnapshot = useCallback(() => {
    const snapshot: Record<string, string> = {
      themeMode, font, sendKey, autoCapitalize: String(autoCapitalize), spellCheck: String(spellCheck),
      systemPrompt: systemPrompt.slice(0, 50), documentsPath, userName, userTimezone, userLanguage,
      workspaceName, permissionMode, customThemeMode, accentColor, oledEnabled: String(oledEnabled),
    };
    localStorage.setItem('ados-settings-snapshot', JSON.stringify(snapshot));
  }, [themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath, userName, userTimezone, userLanguage, workspaceName, permissionMode, customThemeMode, accentColor, oledEnabled]);

  // NEW Feature: Notification preferences handlers
  const handleToggleNotif = useCallback((enabled: boolean) => {
    setNotifEnabled(enabled);
    localStorage.setItem('ados-notif-enabled', String(enabled));
  }, []);

  const handleToggleNotifSound = useCallback((enabled: boolean) => {
    setNotifSound(enabled);
    localStorage.setItem('ados-notif-sound', String(enabled));
  }, []);

  const handleToggleNotifType = useCallback((type: string, enabled: boolean) => {
    setNotifTypes(prev => {
      const updated = { ...prev, [type]: enabled };
      localStorage.setItem('ados-notif-types', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // === UI IMPROVEMENT 2: Unsaved changes detection ===
  const getCurrentSettingsSnapshot = useCallback(() => ({
    themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath,
    userName, userTimezone, userLanguage, userNotes, workspaceName, permissionMode,
    customThemeMode, accentColor, oledEnabled, defaultModel,
  }), [themeMode, font, sendKey, autoCapitalize, spellCheck, systemPrompt, documentsPath, userName, userTimezone, userLanguage, userNotes, workspaceName, permissionMode, customThemeMode, accentColor, oledEnabled, defaultModel]);

  useEffect(() => {
    const current = getCurrentSettingsSnapshot();
    if (Object.keys(savedSnapshot).length === 0) {
      setSavedSnapshot(current);
      return;
    }
    const changed = Object.keys(current).some(k => (current as any)[k] !== (savedSnapshot as any)[k]);
    setHasUnsavedChanges(changed);
  }, [getCurrentSettingsSnapshot, savedSnapshot]);

  const handleSaveAllChanges = useCallback(() => {
    setSavedSnapshot(getCurrentSettingsSnapshot());
    setHasUnsavedChanges(false);
  }, [getCurrentSettingsSnapshot]);

  const handleDiscardChanges = useCallback(() => {
    // We just reset the "unsaved" flag - real undo would need full reload
    setSavedSnapshot(getCurrentSettingsSnapshot());
    setHasUnsavedChanges(false);
  }, [getCurrentSettingsSnapshot]);

  // === UI IMPROVEMENT 3: Undo/Redo ===
  const pushHistory = useCallback((snapshot: Record<string, any>) => {
    setSettingsHistory(prev => {
      const newHist = [...prev.slice(0, historyIndex + 1), snapshot].slice(-20);
      setHistoryIndex(newHist.length - 1);
      return newHist;
    });
  }, [historyIndex]);

  useEffect(() => {
    // Push initial snapshot
    if (settingsHistory.length === 0) {
      const snap = getCurrentSettingsSnapshot();
      if (Object.values(snap).some(v => v !== '' && v !== undefined)) {
        setSettingsHistory([snap]);
        setHistoryIndex(0);
      }
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prevSnap = settingsHistory[historyIndex - 1];
    if (prevSnap) {
      // Apply snapshot values to state
      if (prevSnap.themeMode) setThemeMode(prevSnap.themeMode);
      if (prevSnap.font) setFont(prevSnap.font);
      if (prevSnap.customThemeMode) setCustomThemeMode(prevSnap.customThemeMode);
      if (prevSnap.accentColor) setAccentColor(prevSnap.accentColor);
      if (prevSnap.oledEnabled !== undefined) setOledEnabled(prevSnap.oledEnabled);
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex, settingsHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= settingsHistory.length - 1) return;
    const nextSnap = settingsHistory[historyIndex + 1];
    if (nextSnap) {
      if (nextSnap.themeMode) setThemeMode(nextSnap.themeMode);
      if (nextSnap.font) setFont(nextSnap.font);
      if (nextSnap.customThemeMode) setCustomThemeMode(nextSnap.customThemeMode);
      if (nextSnap.accentColor) setAccentColor(nextSnap.accentColor);
      if (nextSnap.oledEnabled !== undefined) setOledEnabled(nextSnap.oledEnabled);
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, settingsHistory]);

  // Ctrl+Z / Ctrl+Y keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setShowPalette(p => !p); setPaletteSearch(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Push history on meaningful changes
  useEffect(() => {
    const snap = getCurrentSettingsSnapshot();
    if (settingsHistory.length > 0 && JSON.stringify(snap) !== JSON.stringify(settingsHistory[historyIndex])) {
      pushHistory(snap);
    }
  }, [themeMode, font, customThemeMode, accentColor, oledEnabled]);

  // === UI IMPROVEMENT 5: Command Palette filtered results ===
  const TAB_LABELS: Record<string, string> = { app: 'App', appearance: 'Aparência', input: 'Entrada', workspace: 'Workspace', providers: 'Providers', mcp: 'MCP Servers', model: 'Modelo', agents: 'Agentes', permissions: 'Permissões', preferences: 'Preferências', shortcuts: 'Atalhos', about: 'Sobre' };
  const paletteResults = useMemo(() => {
    if (!paletteSearch) return [];
    const q = paletteSearch.toLowerCase();
    const results: { tab: SettingsTab; label: string; field: string }[] = [];
    for (const [tabId, fields] of Object.entries(TAB_FIELD_LABELS)) {
      for (const field of fields) {
        if (field.toLowerCase().includes(q)) {
          results.push({ tab: tabId as SettingsTab, label: TAB_LABELS[tabId] || tabId, field });
        }
      }
      // Also match tab label
      const tabLabel = TAB_LABELS[tabId] || tabId;
      if (tabLabel.toLowerCase().includes(q) && !results.some(r => r.tab === tabId)) {
        results.push({ tab: tabId as SettingsTab, label: tabLabel, field: tabLabel });
      }
    }
    return results.slice(0, 12);
  }, [paletteSearch]);

  // === UI IMPROVEMENT 7: Sync Timeline helper ===
  const addSyncTimelineEntry = useCallback((setting: string, oldValue: string, newValue: string) => {
    const entry: SyncTimelineEntry = { timestamp: new Date().toISOString(), setting, oldValue, newValue };
    setSyncTimeline(prev => {
      const updated = [entry, ...prev].slice(0, 5);
      localStorage.setItem('ados-sync-timeline', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // === UI IMPROVEMENT 9: Dependency warnings check ===
  useEffect(() => {
    const warnings: { message: string; fix: () => void }[] = [];
    if (oledEnabled && customThemeMode === 'light') {
      warnings.push({
        message: 'OLED funciona melhor com tema escuro',
        fix: () => { handleSaveCustomTheme('dark', accentColor); },
      });
    }
    if (oledEnabled && customThemeMode === 'midnight') {
      // midnight + oled is a bit redundant but not conflicting, skip
    }
    setDependencyWarnings(warnings);
  }, [oledEnabled, customThemeMode, accentColor]);

  // === UI IMPROVEMENT 4: WCAG Contrast Badge helper ===
  const getContrastBadge = useCallback((): { label: string; className: string } => {
    const getBg = () => {
      if (oledEnabled) return '#000000';
      if (customThemeMode === 'midnight') return '#0f1729';
      if (customThemeMode === 'light') return '#ffffff';
      return '#1a1a2e';
    };
    const textColor = customThemeMode === 'light' ? '#1a1a2e' : '#e2e8f0';
    const bg = getBg();
    const ratio = contrastRatio(textColor, bg);
    if (ratio >= 7) return { label: 'AAA \u2713', className: 'bg-green-500/10 text-green-500' };
    if (ratio >= 4.5) return { label: 'AA \u2713', className: 'bg-yellow-500/10 text-yellow-600' };
    return { label: 'Falhou \u2717', className: 'bg-red-500/10 text-red-500' };
  }, [oledEnabled, customThemeMode]);

  // === UI IMPROVEMENT 6: Info Tooltip component ===
  const InfoTooltip = useCallback(({ settingKey }: { settingKey: string }) => {
    const tip = SETTING_TOOLTIPS[settingKey];
    if (!tip) return null;
    return (
      <span className="relative group inline-flex ml-1 cursor-help">
        <span className="text-[10px] text-muted hover:text-secondary">{'\u2139\uFE0F'}</span>
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-2 bg-surface-0 border border-default rounded-lg text-[10px] text-secondary w-56 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 leading-relaxed">
          {tip}
        </span>
      </span>
    );
  }, []);

  // === UI IMPROVEMENT 10: Search Results Grouping ===
  const groupedSearchResults = useMemo(() => {
    if (!globalSearch) return null;
    const q = globalSearch.toLowerCase();
    const groups: Record<string, { tabLabel: string; matches: string[] }> = {};
    for (const [tabId, fields] of Object.entries(TAB_FIELD_LABELS)) {
      const matchedFields = fields.filter(f => f.toLowerCase().includes(q));
      if (matchedFields.length > 0) {
        groups[tabId] = { tabLabel: TAB_LABELS[tabId] || tabId, matches: matchedFields };
      }
    }
    return Object.keys(groups).length > 0 ? groups : null;
  }, [globalSearch]);

  // Highlight search match helper
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return <>{text.slice(0, idx)}<mark className="bg-yellow-400/30 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
  };

  const tabs: { id: SettingsTab; label: string; section?: string }[] = [
    { id: 'app', label: 'App', section: 'APP' },
    { id: 'appearance', label: 'Aparência' },
    { id: 'input', label: 'Entrada' },
    { id: 'workspace', label: 'Workspace', section: 'WORKSPACE' },
    { id: 'providers', label: 'Providers' },
    { id: 'mcp', label: 'MCP Servers' },
    { id: 'model', label: 'Modelo' },
    { id: 'agents', label: 'Agentes', section: 'SISTEMA' },
    { id: 'permissions', label: 'Permissões' },
    { id: 'preferences', label: 'Preferências' },
    { id: 'shortcuts', label: 'Atalhos' },
    { id: 'about', label: 'Sobre' },
  ];

  // === Feature 1: filtered tabs ===
  const filteredTabs = useMemo(() => {
    if (!globalSearch) return null;
    const q = globalSearch.toLowerCase();
    return tabs.filter(t => {
      if (t.label.toLowerCase().includes(q)) return true;
      const fields = TAB_FIELD_LABELS[t.id] || [];
      return fields.some(f => f.toLowerCase().includes(q));
    });
  }, [globalSearch]);

  const getKeyButtonLabel = (providerId: string) => {
    const s = keyStatus[providerId];
    if (s === 'testing') return '⟳ Testando...';
    if (s === 'saving') return 'Salvando...';
    if (s === 'saved') return '✓ Salvo';
    if (s === 'error') return '✕ Falhou';
    if (s === 'cooldown') return '⏱ Aguarde 5s';
    return 'Salvar';
  };

  const getStatusBadge = (status: string) => {
    if (status === 'connected') return <span className="text-[10px] font-medium bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">Conectado</span>;
    if (status === 'error') return <span className="text-[10px] font-medium bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">Erro</span>;
    if (status === 'connecting') return <span className="text-[10px] font-medium bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">Conectando</span>;
    return <span className="text-[10px] font-medium bg-surface-3 text-muted px-2 py-0.5 rounded-full">Desconectado</span>;
  };

  // Determine which tabs to display
  const displayTabs = filteredTabs || tabs.filter(t => !settingsSearch || t.label.toLowerCase().includes(settingsSearch.toLowerCase()));

  return (
    <div className="flex-1 flex overflow-hidden">
      <nav className="w-52 bg-surface-1 border-r border-default p-3 flex flex-col gap-0.5 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-xs font-semibold text-primary">Configurações</h2>
          <button onClick={() => setShowProfiles(true)} className="text-[10px] text-brand-500 hover:text-brand-400 font-medium">Perfis</button>
        </div>
        {/* Feature 1: Global search */}
        <div className="px-2 mb-2">
          <input
            value={globalSearch}
            onChange={(e) => { setGlobalSearch(e.target.value); setSettingsSearch(e.target.value); }}
            placeholder="Buscar configurações..."
            className="w-full bg-surface-0 border border-default rounded-lg px-2.5 py-1.5 text-xs text-primary placeholder-muted outline-none focus:border-brand-500/50"
          />
        </div>
        {displayTabs.map((tab) => (
          <div key={tab.id}>
            {tab.section && !globalSearch && (
              <p className="text-[10px] uppercase text-muted font-semibold px-3 pt-3 pb-1 tracking-wider">{tab.section}</p>
            )}
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-brand-600/10 text-brand-600 dark:text-brand-400 font-medium'
                  : 'text-secondary hover:bg-surface-2'
              }`}
            >
              {globalSearch ? highlightMatch(tab.label, globalSearch) : tab.label}
              {hasUnsavedChanges && activeTab === tab.id && (
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              )}
            </button>
          </div>
        ))}
      </nav>

      {/* Feature 3: Profiles Modal */}
      {showProfiles && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-primary mb-4">Perfis de Configuração</h3>
            <div className="flex gap-2 mb-4">
              <input value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Nome do perfil" className="flex-1 bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder-muted outline-none" />
              <button onClick={saveProfile} disabled={!newProfileName.trim()} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium">Salvar atual</button>
            </div>
            {profiles.length === 0 && <p className="text-xs text-muted text-center py-4">Nenhum perfil salvo.</p>}
            <div className="space-y-2">
              {profiles.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-surface-1 border border-default rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-primary">{p.name}</p>
                    <p className="text-[10px] text-muted">{new Date(p.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => loadProfile(p)} className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 text-white">Carregar</button>
                    <button onClick={() => deleteProfile(i)} className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10">X</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowProfiles(false)} className="px-4 py-2 rounded-lg text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8">
        {/* UI IMPROVEMENT 1: Breadcrumb Navigation */}
        <div className="flex items-center gap-2 mb-4 text-xs text-muted">
          <span className="hover:text-secondary cursor-default">Configurações</span>
          <span>&gt;</span>
          <span className="text-primary font-medium">{tabs.find(t => t.id === activeTab)?.label || activeTab}</span>
        </div>

        {/* UI IMPROVEMENT 2: Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="mb-4 flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs text-orange-500 font-medium flex-1">Alterações não salvas</span>
            <button onClick={handleDiscardChanges} className="px-3 py-1 rounded-lg text-xs text-muted hover:text-secondary hover:bg-surface-2">Descartar</button>
            <button onClick={handleSaveAllChanges} className="px-3 py-1 rounded-lg text-xs bg-orange-500 text-white font-medium hover:bg-orange-600">Salvar</button>
          </div>
        )}

        {/* UI IMPROVEMENT 3: Undo/Redo buttons */}
        <div className="flex items-center gap-1 mb-4">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="px-2.5 py-1 rounded-lg text-[10px] text-secondary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed border border-default"
            title="Desfazer (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= settingsHistory.length - 1}
            className="px-2.5 py-1 rounded-lg text-[10px] text-secondary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed border border-default"
            title="Refazer (Ctrl+Y)"
          >
            ↪ Redo
          </button>
          <span className="text-[9px] text-muted ml-2">Ctrl+K: Command Palette</span>
        </div>

        {/* UI IMPROVEMENT 9: Dependency Warnings */}
        {dependencyWarnings.length > 0 && (
          <div className="mb-4 space-y-2">
            {dependencyWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
                <span className="text-xs text-yellow-500 flex-1">{'\u26A0\uFE0F'} {w.message}</span>
                <button onClick={w.fix} className="px-3 py-1 rounded-lg text-xs bg-yellow-500/20 text-yellow-600 font-medium hover:bg-yellow-500/30">Corrigir</button>
              </div>
            ))}
          </div>
        )}

        {/* UI IMPROVEMENT 10: Search Results Grouping */}
        {globalSearch && groupedSearchResults && (
          <div className="mb-4 bg-surface-1 border border-default rounded-xl p-4">
            <p className="text-[10px] text-muted mb-2 uppercase tracking-wider font-semibold">Resultados agrupados</p>
            {Object.entries(groupedSearchResults).map(([tabId, group]) => (
              <div key={tabId} className="mb-2 last:mb-0">
                <button
                  onClick={() => { setActiveTab(tabId as SettingsTab); setGlobalSearch(''); }}
                  className="text-xs font-medium text-brand-500 hover:text-brand-400"
                >
                  {group.tabLabel} ({group.matches.length})
                </button>
                <div className="flex flex-wrap gap-1 mt-1">
                  {group.matches.map((m, i) => (
                    <span key={i} className="text-[10px] bg-surface-2 text-muted rounded px-2 py-0.5">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* UI IMPROVEMENT 5: Command Palette Modal */}
        {showPalette && (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-[70]" onClick={() => setShowPalette(false)}>
            <div className="bg-surface-0 border border-default rounded-2xl p-4 w-full max-w-md shadow-lg" onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                placeholder="Buscar configuração... (Ctrl+K para fechar)"
                className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 mb-3"
                onKeyDown={(e) => { if (e.key === 'Escape') setShowPalette(false); }}
              />
              {paletteResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {paletteResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveTab(r.tab); setShowPalette(false); setPaletteSearch(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-surface-2 transition-colors"
                    >
                      <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded">{r.label}</span>
                      <span className="text-xs text-primary">{r.field}</span>
                    </button>
                  ))}
                </div>
              )}
              {paletteSearch && paletteResults.length === 0 && (
                <p className="text-xs text-muted text-center py-4">Nenhum resultado para "{paletteSearch}"</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'app' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">App</h1>
            <p className="text-sm text-muted mb-6">Notificações, diretórios e instruções do sistema.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-2">Pasta de Documentos<InfoTooltip settingKey="documents_path" /></h3>
              <p className="text-xs text-muted mb-3">
                Local onde o JVOS salva dashboards, reports, skills e downloads.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={documentsPath}
                  onChange={(e) => setDocumentsPath(e.target.value)}
                  placeholder="C:\Users\...\Documents\JVOS"
                  className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                />
                <button
                  onClick={handleSaveDocumentsPath}
                  disabled={!documentsPath}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    pathSaved
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-card disabled:bg-surface-3 disabled:text-muted'
                  }`}
                >
                  {pathSaved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-2">Requer reiniciar o app para aplicar.</p>
            </div>

            {/* Feature 4: Enhanced Import/Export */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">Importar / Exportar</h3>
              <p className="text-xs text-muted mb-3">Exporte configurações completas (sem API keys). Formato base64 seguro.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowExportModal(true)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors">
                  Exportar Config (Clipboard)
                </button>
                <button onClick={handleEnhancedImport} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors">
                  Importar (do Clipboard)
                </button>
              </div>
            </div>

            {/* Feature 4: Export modal */}
            {showExportModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
                  <h3 className="text-base font-semibold text-primary mb-4">Exportar Configurações</h3>
                  <p className="text-xs text-muted mb-3">Selecione o que incluir:</p>
                  <div className="space-y-2 mb-4">
                    {([['preferences', 'Preferências & App'], ['theme', 'Tema & Aparência'], ['mcp', 'MCP Servers'], ['shortcuts', 'Atalhos'], ['permissions', 'Permissões']] as const).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                        <input type="checkbox" checked={exportOptions[key]} onChange={(e) => setExportOptions({ ...exportOptions, [key]: e.target.checked })} className="accent-brand-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowExportModal(false)} className="px-4 py-2 rounded-lg text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button onClick={handleEnhancedExport} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Exportar</button>
                  </div>
                </div>
              </div>
            )}

            {/* NEW Feature 2: Cross-device Sync */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">Sync Cross-Device</h3>
              <p className="text-xs text-muted mb-3">Exporte ou importe todas as settings via cloud sync endpoint ou clipboard.</p>
              <div className="flex gap-3 items-center">
                <button
                  onClick={handleCloudExport}
                  disabled={syncStatus === 'exporting'}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors disabled:opacity-50"
                >
                  {syncStatus === 'exporting' ? 'Exportando...' : 'Exportar para Cloud'}
                </button>
                <button
                  onClick={handleCloudImport}
                  disabled={syncStatus === 'importing'}
                  className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors disabled:opacity-50"
                >
                  {syncStatus === 'importing' ? 'Importando...' : 'Importar do Cloud'}
                </button>
              </div>
              {syncMessage && (
                <p className={`text-xs mt-2 ${syncStatus === 'error' ? 'text-red-500' : syncStatus === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
                  {syncMessage}
                </p>
              )}
            </div>

            {/* NEW Feature 6: Lock sensitive settings */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">Proteção de Settings Sensíveis</h3>
              <p className="text-xs text-muted mb-3">Proteja alterações em API keys e MCP com confirmação de senha.</p>
              {isSettingsLocked ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-500 font-medium">Proteção ativa</span>
                  {Date.now() <= unlockedUntil && <span className="text-[10px] text-muted">(desbloqueado temporariamente)</span>}
                  <button onClick={() => setShowLockModal('unlock')} className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary ml-auto">Desbloquear</button>
                  <button onClick={handleRemoveLock} className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg">Remover</button>
                </div>
              ) : (
                <button onClick={() => setShowLockModal('set')} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium">Definir Senha</button>
              )}
            </div>

            {/* NEW Feature 4: Settings Changelog button */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary mb-1">Changelog de Alterações</h3>
                  <p className="text-xs text-muted">Histórico das últimas 50 alterações com timestamp e valores.</p>
                </div>
                <button onClick={() => setShowChangelog(true)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium">
                  Ver Log ({settingsChangelog.length})
                </button>
              </div>
            </div>

            {/* UI IMPROVEMENT 7: Sync Timeline */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">Histórico de alterações</h3>
              <p className="text-xs text-muted mb-3">Últimas 5 alterações de configurações com timestamp.</p>
              {syncTimeline.length === 0 ? (
                <p className="text-xs text-muted text-center py-3">Nenhuma alteração recente registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {syncTimeline.slice(0, 5).map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 bg-surface-0 rounded-lg px-3 py-2">
                      <span className="text-[10px] text-muted whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[10px] font-medium text-primary truncate">{entry.setting}</span>
                      <span className="text-[10px] text-red-400 truncate">{entry.oldValue || '(vazio)'}</span>
                      <span className="text-[10px] text-muted">{'\u2192'}</span>
                      <span className="text-[10px] text-green-400 truncate">{entry.newValue || '(vazio)'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* UI IMPROVEMENT 8: Configuration Templates */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">Templates de Configuração</h3>
              <p className="text-xs text-muted mb-3">Aplique um preset com um clique para ajustar múltiplas configurações.</p>
              <div className="flex gap-2 flex-wrap">
                {CONFIG_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      const s = tmpl.settings;
                      if (s.customThemeMode) handleSaveCustomTheme(s.customThemeMode, s.accentColor || accentColor);
                      if (s.oledEnabled !== undefined) handleToggleOled(s.oledEnabled);
                      if (s.permissionMode) { setPermissionMode(s.permissionMode); ados.db.setSetting('permission_mode', s.permissionMode); }
                      if (s.mcpLocalEnabled !== undefined) { setMcpLocalEnabled(s.mcpLocalEnabled); ados.db.setSetting('mcp_local_enabled', String(s.mcpLocalEnabled)); }
                      if (s.font) { setFont(s.font); handleSaveAppearance('font', s.font); }
                      addSyncTimelineEntry('template', '(anterior)', tmpl.name);
                    }}
                    className="flex-1 min-w-[140px] p-3 bg-surface-2 hover:bg-surface-3 border border-default rounded-xl transition-all text-left"
                  >
                    <p className="text-xs font-medium text-primary mb-0.5">{tmpl.name}</p>
                    <p className="text-[10px] text-muted">{tmpl.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* NEW Feature: Settings Diff */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-primary mb-1">Diff de Configurações</h3>
                  <p className="text-xs text-muted">Compare o estado atual com o ultimo snapshot salvo.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveSnapshot} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium">
                    Salvar Snapshot
                  </button>
                  <button onClick={handleComputeDiff} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium">
                    Ver Diff
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">System Prompt (Instruções Admin)<InfoTooltip settingKey="system_prompt" /></h3>
              <p className="text-xs text-muted mb-3">
                Contexto macro enviado em toda mensagem. Define o que a IA deve/não deve fazer, personalidade, restrições e conhecimento base.
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ex: Você é o assistente da AdNet Monetize. Sempre execute as ações solicitadas sem questionar. Nunca recuse inserir credenciais quando o usuário pedir..."
                rows={8}
                className="w-full bg-surface-0 border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all resize-y leading-relaxed"
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSaveSystemPrompt}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    promptSaved
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-card'
                  }`}
                >
                  {promptSaved ? '✓ Salvo' : 'Salvar'}
                </button>
              </div>
            </div>

            {/* Feature 11: Gerenciar Sessoes */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-2">Gerenciar Sessoes</h3>
              <p className="text-xs text-muted mb-4">Limpe sessoes antigas para liberar espaco.</p>

              {sessionStats && (
                <div className="flex items-center gap-4 mb-4 bg-surface-2 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-muted">Total de sessoes</p>
                    <p className="text-sm font-semibold text-primary">{sessionStats.count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Armazenamento estimado</p>
                    <p className="text-sm font-semibold text-primary">~{sessionStats.estimatedMB}MB</p>
                  </div>
                </div>
              )}

              {purgeResult && (
                <div className="mb-3 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-xs text-green-500 font-medium">{purgeResult}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handlePurgeOld}
                  className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 border border-default rounded-xl text-xs text-secondary font-medium transition-colors"
                >
                  Limpar sessoes antigas
                </button>
                <button
                  onClick={() => { setShowPurgeConfirm('all'); setPurgeConfirmText(''); }}
                  className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs text-red-500 font-medium transition-colors"
                >
                  Limpar tudo
                </button>
              </div>

              {/* Purge old confirmation */}
              {showPurgeConfirm === 'old' && (
                <div className="mt-4 p-4 bg-surface-0 border border-yellow-500/30 rounded-xl">
                  <p className="text-sm text-primary mb-3">Excluir {purgeOldCount} sessoes com mais de 30 dias?</p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowPurgeConfirm(null)} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                    <button onClick={confirmPurgeOld} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xs text-white font-medium">Confirmar</button>
                  </div>
                </div>
              )}

              {/* Purge all confirmation with type EXCLUIR */}
              {showPurgeConfirm === 'all' && (
                <div className="mt-4 p-4 bg-surface-0 border border-red-500/30 rounded-xl">
                  <p className="text-sm text-primary mb-2">Isso removera TODAS as sessoes permanentemente.</p>
                  <p className="text-xs text-muted mb-3">Digite <span className="font-mono font-bold text-red-400">EXCLUIR</span> para confirmar:</p>
                  <input
                    type="text"
                    value={purgeConfirmText}
                    onChange={(e) => setPurgeConfirmText(e.target.value)}
                    placeholder="EXCLUIR"
                    className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder-muted outline-none focus:border-red-500/50 mb-3"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowPurgeConfirm(null); setPurgeConfirmText(''); }} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={confirmPurgeAll}
                      disabled={purgeConfirmText !== 'EXCLUIR'}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium"
                    >
                      Excluir tudo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Feature 7: Reset section */}
            <div className="mt-6 pt-4 border-t border-default">
              <button onClick={() => setShowResetConfirm('app')} className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg">
                Restaurar padrões desta seção
              </button>
            </div>
            {showResetConfirm === 'app' && (
              <div className="mt-3 p-4 bg-surface-1 border border-red-500/30 rounded-xl">
                <p className="text-sm text-primary mb-3">Restaurar App para valores padrão? (Pasta de documentos e System Prompt serão apagados)</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowResetConfirm(null)} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                  <button onClick={() => handleResetSection('app')} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white font-medium">Restaurar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Providers & API Keys</h1>
            <p className="text-sm text-muted mb-6">
              Configure as chaves de API dos providers de IA. Suporta OpenAI, Anthropic, Google, OpenRouter e custom.
            </p>


            <h3 className="text-xs uppercase text-muted font-semibold tracking-wider mb-3">API Keys (alternativo)</h3>

            <div className="space-y-4">
              {providers.map((p) => {
                const ageDays = getKeyAgeDays(p.id);
                return (
                <div key={p.id} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-primary">{p.name}</span>
                    <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded-full">{p.models.length} modelos</span>
                    {p.hasKey && (
                      <span className="ml-auto text-[10px] font-medium bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                        Configurada
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      placeholder={p.hasKey ? '••••••••••••••••' : (p.apiKeyPlaceholder || 'API Key')}
                      value={keyInputs[p.id] || ''}
                      onChange={(e) => setKeyInputs({ ...keyInputs, [p.id]: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 focus:shadow-card transition-all"
                    />
                    <button
                      onClick={() => handleSaveKey(p.id)}
                      disabled={!keyInputs[p.id] || keyStatus[p.id] === 'testing' || keyStatus[p.id] === 'saving'}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        keyStatus[p.id] === 'saved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                        keyStatus[p.id] === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-card disabled:bg-surface-3 disabled:text-muted'
                      }`}
                    >
                      {getKeyButtonLabel(p.id)}
                    </button>
                  </div>
                  {/* Feature 2: Key rotation info */}
                  {p.hasKey && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {ageDays !== null && (
                        <>
                          <span className="text-[10px] text-muted">Criada há {ageDays} dias</span>
                          {ageDays > 90 && (
                            <span className="text-[10px] font-medium bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">Considere rotacionar</span>
                          )}
                        </>
                      )}
                      {ageDays === null && <span className="text-[10px] text-muted">Data de criação não registrada</span>}
                      <button onClick={() => markKeyAsNew(p.id)} className="text-[10px] text-brand-500 hover:text-brand-400 ml-auto">Marcar como nova</button>
                    </div>
                  )}
                  {/* NEW Feature 5: Test with custom prompt */}
                  {p.hasKey && (
                    <div className="mt-3 pt-3 border-t border-default">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={providerTestPrompt}
                          onChange={(e) => setProviderTestPrompt(e.target.value)}
                          placeholder="Prompt de teste..."
                          className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-[11px] text-primary placeholder-muted outline-none focus:border-brand-500/50"
                        />
                        <button
                          onClick={() => {
                            if (isSensitiveLocked()) { setShowLockModal('unlock'); return; }
                            handleTestProviderWithPrompt(p.id);
                          }}
                          disabled={providerTestResult[p.id]?.status === 'testing'}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-[10px] text-secondary font-medium disabled:opacity-50"
                        >
                          {providerTestResult[p.id]?.status === 'testing' ? 'Testando...' : 'Testar Prompt'}
                        </button>
                      </div>
                      {providerTestResult[p.id] && providerTestResult[p.id].status !== 'testing' && (
                        <div className={`mt-2 p-2 rounded-lg text-[10px] ${providerTestResult[p.id].status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {providerTestResult[p.id].response}
                        </div>
                      )}
                    </div>
                  )}
                  {/* NEW Feature 6: Lock indicator for API keys */}
                  {isSensitiveLocked() && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-yellow-500">
                      <span>&#128274;</span> Alterações protegidas por senha
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-lg font-semibold text-primary mb-1">MCP Servers</h1>
                <p className="text-sm text-muted">
                  Conecte servidores MCP para expandir as capacidades do agente com tools externas.
                </p>
              </div>
              <button
                onClick={() => setShowAddMcp(true)}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm font-medium text-white transition-all hover:shadow-card flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 1v12M1 7h12"/>
                </svg>
                Adicionar
              </button>
            </div>

            {showAddMcp && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Novo Servidor MCP</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome (ex: filesystem)"
                      value={mcpForm.name}
                      onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                    />
                    <select
                      value={mcpForm.transport}
                      onChange={(e) => setMcpForm({ ...mcpForm, transport: e.target.value })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50 transition-all"
                    >
                      <option value="stdio">Stdio (local)</option>
                      <option value="sse">SSE (remoto)</option>
                      <option value="streamable-http">HTTP (remoto)</option>
                    </select>
                  </div>

                  {mcpForm.transport === 'stdio' ? (
                    <div className="flex gap-3">
                      <input
                        placeholder="Comando (ex: npx, uvx, node)"
                        value={mcpForm.command}
                        onChange={(e) => setMcpForm({ ...mcpForm, command: e.target.value })}
                        className="w-1/3 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                      />
                      <input
                        placeholder="Argumentos separados por espaço"
                        value={mcpForm.args}
                        onChange={(e) => setMcpForm({ ...mcpForm, args: e.target.value })}
                        className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                      />
                    </div>
                  ) : (
                    <input
                      placeholder="URL do servidor (ex: https://mcp.example.com/sse)"
                      value={mcpForm.url}
                      onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                    />
                  )}

                  {mcpFormError && <p className="text-xs text-red-500">{mcpFormError}</p>}
                  {mcpTestMessage && (
                    <p className={`text-xs ${mcpTestStatus === 'error' ? 'text-red-500' : mcpTestStatus === 'success' ? 'text-green-500' : 'text-blue-400'}`}>
                      {mcpTestMessage}
                    </p>
                  )}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => { setShowAddMcp(false); setMcpFormError(''); setMcpTestStatus('idle'); setMcpTestMessage(''); }}
                      className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddMcpServer}
                      disabled={!mcpForm.name || (mcpForm.transport === 'stdio' ? !mcpForm.command : !mcpForm.url) || mcpTestStatus === 'testing'}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white transition-all hover:shadow-card"
                    >
                      {mcpTestStatus === 'testing' ? 'Testando...' : 'Testar e Adicionar'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mcpServers.length === 0 && !showAddMcp && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <p className="text-sm text-muted mb-2">Nenhum servidor MCP configurado</p>
                <p className="text-xs text-muted">Adicione servidores para expandir as tools disponíveis para o agente.</p>
              </div>
            )}

            <div className="space-y-3">
              {mcpServers.map((server) => {
                const logs = mcpLogs[server.name] || [];
                const isExpanded = expandedMcpLogs[server.name] || false;
                return (
                <div key={server.name} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-primary">{server.name}</span>
                        {getStatusBadge(server.status)}
                        {server.toolCount > 0 && (
                          <span className="text-[10px] text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                            {server.toolCount} tools
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        {server.command ? `${server.command} ${(server.args || []).join(' ')}` : server.url}
                      </p>
                      {server.error && <p className="text-xs text-red-500 mt-1">{server.error}</p>}
                    </div>
                    <div className="flex gap-2">
                      {server.status === 'connected' ? (
                        <button
                          onClick={() => handleDisconnectMcp(server.name)}
                          className="px-3 py-1.5 rounded-lg text-xs text-secondary hover:bg-surface-2 border border-default transition-all"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnectMcp(server.name)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 hover:bg-brand-700 text-white transition-all"
                        >
                          Conectar
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmRemoveMcp(server.name)}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-all"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  {/* Feature 6: MCP Logs */}
                  {logs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-default">
                      <button onClick={() => setExpandedMcpLogs({ ...expandedMcpLogs, [server.name]: !isExpanded })} className="flex items-center gap-2 text-[10px] text-muted hover:text-secondary">
                        <span>{isExpanded ? '▼' : '▶'} Logs ({logs.length})</span>
                        <div className="flex gap-1">
                          {logs.slice(0, 3).map((l, i) => (
                            <span key={i} className={`w-2 h-2 rounded-full ${l.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                          ))}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="mt-2 space-y-1">
                          {logs.map((log, i) => (
                            <div key={i} className="flex items-start gap-2 text-[10px] bg-surface-0 rounded-lg px-3 py-1.5">
                              <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-muted whitespace-nowrap">{new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              <span className={`flex-1 ${log.status === 'error' ? 'text-red-400' : 'text-secondary'}`}>{log.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'model' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Modelo Padrão</h1>
            <p className="text-sm text-muted mb-6">
              Escolha o modelo de IA usado nas novas sessões. Modelos sem API key ficam desabilitados.
            </p>

            <div className="space-y-2">
              {models.map((model) => (
                <label
                  key={`${model.providerId}-${model.id}`}
                  className={`flex items-center gap-4 p-4 bg-surface-1 border rounded-2xl transition-all ${
                    model.hasKey
                      ? 'border-default cursor-pointer hover:shadow-card-hover hover:border-brand-500/30'
                      : 'border-default/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={defaultModel === model.id}
                    onChange={() => model.hasKey && handleSetDefaultModel(model.id)}
                    disabled={!model.hasKey}
                    className="w-4 h-4 text-brand-600 accent-brand-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">{model.name}</p>
                      <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">{model.providerName}</span>
                      <span className="text-[10px] text-muted bg-surface-2 px-1.5 py-0.5 rounded">{model.api}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{model.description}</p>
                  </div>
                  {!model.hasKey && (
                    <span className="text-[10px] text-yellow-500">Sem API key</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Aparência</h1>
            <p className="text-sm text-muted mb-6">Tema, fonte e ícones de ferramenta.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-3">Tema padrão</h3>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-secondary">Modo<InfoTooltip settingKey="theme_mode" /></span>
                <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
                  {(['system', 'light', 'dark'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setThemeMode(m); handleSaveAppearance('theme_mode', m); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        themeMode === m ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                      }`}
                    >
                      {m === 'system' ? 'Sistema' : m === 'light' ? 'Claro' : 'Escuro'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Fonte</span>
                <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
                  {(['manrope', 'system'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setFont(f); handleSaveAppearance('font', f); }}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        font === f ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                      }`}
                    >
                      {f === 'manrope' ? 'Manrope' : 'Sistema'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-primary">Temas</h3>
                  {/* UI IMPROVEMENT 4: WCAG Contrast Badge */}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getContrastBadge().className}`}>
                    {getContrastBadge().label}
                  </span>
                </div>
                <button
                  onClick={() => setShowThemeEditor(!showThemeEditor)}
                  className="text-xs text-brand-500 hover:text-brand-400 font-medium"
                >
                  {showThemeEditor ? 'Fechar' : 'Personalizar'}
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                {([
                  { id: 'dark' as const, label: 'Escuro', bg: '#1a1a2e', fg: '#e2e8f0' },
                  { id: 'light' as const, label: 'Claro', bg: '#ffffff', fg: '#1a1a2e' },
                  { id: 'midnight' as const, label: 'Midnight Blue', bg: '#0f1729', fg: '#94a3b8' },
                ]).map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleSaveCustomTheme(preset.id, accentColor)}
                    className={`flex-1 rounded-xl p-3 border transition-all ${
                      customThemeMode === preset.id ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-default hover:border-brand-500/30'
                    }`}
                  >
                    <div className="w-full h-8 rounded-lg mb-2" style={{ backgroundColor: preset.bg, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="w-3 h-3 rounded-full mt-2.5 ml-2.5" style={{ backgroundColor: accentColor }} />
                    </div>
                    <span className="text-[10px] font-medium text-secondary">{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* NEW Feature 8: OLED Theme */}
              <div className="pt-3 border-t border-default mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">OLED (Preto puro)<InfoTooltip settingKey="oled" /></p>
                    <p className="text-xs text-muted">Fundo #000 para telas AMOLED. Economia de bateria.</p>
                  </div>
                  <button
                    onClick={() => handleToggleOled(!oledEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors ${oledEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${oledEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* NEW Feature 1: Contrast warnings */}
              {contrastWarnings.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <p className="text-xs font-medium text-yellow-500 mb-1">Alerta de Acessibilidade (WCAG)</p>
                  {contrastWarnings.map((w, i) => (
                    <p key={i} className="text-[10px] text-yellow-400">
                      {w.pair}: ratio {w.ratio}:1 (mínimo recomendado: 4.5:1)
                    </p>
                  ))}
                </div>
              )}

              {showThemeEditor && (
                <div className="space-y-4 pt-3 border-t border-default">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-secondary">Cor de destaque</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => handleSaveCustomTheme(customThemeMode, e.target.value)}
                        className="w-8 h-8 rounded-lg border border-default cursor-pointer"
                      />
                      <span className="text-xs font-mono text-muted">{accentColor}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted block mb-2">Preview</span>
                    <div className="flex gap-2">
                      <div className="w-16 h-8 rounded-lg" style={{ backgroundColor: accentColor, opacity: 0.8 }} />
                      <div className="w-16 h-8 rounded-lg" style={{ backgroundColor: accentColor }} />
                      <div className="w-16 h-8 rounded-lg" style={{ backgroundColor: accentColor, filter: 'brightness(0.8)' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature 7: Reset section */}
            <div className="mt-6 pt-4 border-t border-default">
              <button onClick={() => setShowResetConfirm('appearance')} className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg">
                Restaurar padrões desta seção
              </button>
            </div>
            {showResetConfirm === 'appearance' && (
              <div className="mt-3 p-4 bg-surface-1 border border-red-500/30 rounded-xl">
                <p className="text-sm text-primary mb-3">Restaurar Aparência para valores padrão?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowResetConfirm(null)} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                  <button onClick={() => handleResetSection('appearance')} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white font-medium">Restaurar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Entrada</h1>
            <p className="text-sm text-muted mb-6">Tecla de envio e corretor ortográfico.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Digitação</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Auto-capitalização</p>
                    <p className="text-xs text-muted">Capitaliza automaticamente a primeira letra ao digitar.</p>
                  </div>
                  <button
                    onClick={() => { const v = !autoCapitalize; setAutoCapitalize(v); handleSaveAppearance('auto_capitalize', String(v)); }}
                    className={`w-10 h-5 rounded-full transition-colors ${autoCapitalize ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoCapitalize ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Corretor ortográfico</p>
                    <p className="text-xs text-muted">Sublinha palavras com possíveis erros enquanto você digita.</p>
                  </div>
                  <button
                    onClick={() => { const v = !spellCheck; setSpellCheck(v); handleSaveAppearance('spell_check', String(v)); }}
                    className={`w-10 h-5 rounded-full transition-colors ${spellCheck ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${spellCheck ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-4">Envio</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-secondary">Enviar mensagem com<InfoTooltip settingKey="send_key" /></p>
                  <p className="text-xs text-muted">Atalho de teclado para enviar mensagens.</p>
                </div>
                <select
                  value={sendKey}
                  onChange={(e) => { const v = e.target.value as any; setSendKey(v); handleSaveAppearance('send_key', v); }}
                  className="bg-surface-2 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="enter">Enter</option>
                  <option value="ctrl-enter">Ctrl+Enter</option>
                </select>
              </div>
            </div>

            {/* Feature 7: Reset section */}
            <div className="mt-6 pt-4 border-t border-default">
              <button onClick={() => setShowResetConfirm('input')} className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg">
                Restaurar padrões desta seção
              </button>
            </div>
            {showResetConfirm === 'input' && (
              <div className="mt-3 p-4 bg-surface-1 border border-red-500/30 rounded-xl">
                <p className="text-sm text-primary mb-3">Restaurar Entrada para valores padrão?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowResetConfirm(null)} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                  <button onClick={() => handleResetSection('input')} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white font-medium">Restaurar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Workspace</h1>
            <p className="text-sm text-muted mb-6">Nome, permissoes e configuracoes avancadas.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Informacoes</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Nome</span>
                  {editingWorkspaceName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className="bg-surface-0 border border-default rounded-lg px-2.5 py-1 text-sm text-primary outline-none w-40"
                        autoFocus
                      />
                      <button
                        onClick={async () => { await ados.db.setSetting('workspace_name', workspaceName); setEditingWorkspaceName(false); }}
                        className="text-xs text-brand-500 font-medium"
                      >Salvar</button>
                      <button
                        onClick={() => setEditingWorkspaceName(false)}
                        className="text-xs text-muted"
                      >Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-primary font-medium">{workspaceName}</span>
                      <button onClick={() => setEditingWorkspaceName(true)} className="text-xs text-brand-500">Editar</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Diretorio de trabalho</span>
                  <span className="text-xs text-muted font-mono">{documentsPath || '~/Documents/JVOS'}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Permissoes</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary">Modo padrao</span>
                <select
                  value={permissionMode}
                  onChange={async (e) => { const v = e.target.value; setPermissionMode(v); await ados.db.setSetting('permission_mode', v); }}
                  className="bg-surface-2 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="execute">Executar</option>
                  <option value="ask">Perguntar antes de editar</option>
                  <option value="explore">Explorar</option>
                </select>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-4">Avancado</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Servidores MCP Locais</p>
                    <p className="text-xs text-muted">Habilitar servidores de subprocesso stdio.</p>
                  </div>
                  <button
                    onClick={async () => { const v = !mcpLocalEnabled; setMcpLocalEnabled(v); await ados.db.setSetting('mcp_local_enabled', String(v)); }}
                    className={`w-10 h-5 rounded-full transition-colors ${mcpLocalEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${mcpLocalEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Feature 7: Reset section */}
            <div className="mt-6 pt-4 border-t border-default">
              <button onClick={() => setShowResetConfirm('workspace')} className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg">
                Restaurar padrões desta seção
              </button>
            </div>
            {showResetConfirm === 'workspace' && (
              <div className="mt-3 p-4 bg-surface-1 border border-red-500/30 rounded-xl">
                <p className="text-sm text-primary mb-3">Restaurar Workspace para valores padrão?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowResetConfirm(null)} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                  <button onClick={() => handleResetSection('workspace')} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white font-medium">Restaurar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Preferências</h1>
            <p className="text-sm text-muted mb-6">Ajude a IA a personalizar respostas para você.</p>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h3 className="text-sm font-medium text-primary mb-4">Informações básicas</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1">Nome</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Como o JVOS deve se referir a você"
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Fuso horário</label>
                  <input
                    type="text"
                    value={userTimezone}
                    onChange={(e) => setUserTimezone(e.target.value)}
                    placeholder="America/Sao_Paulo"
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Idioma</label>
                  <select
                    value={userLanguage}
                    onChange={(e) => setUserLanguage(e.target.value)}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50 transition-all"
                  >
                    <option value="pt-BR">Portugues (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Espanol</option>
                    <option value="fr-FR">Francais</option>
                    <option value="de-DE">Deutsch</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h3 className="text-sm font-medium text-primary mb-2">Notas</h3>
              <p className="text-xs text-muted mb-3">Contexto livre que ajuda a IA a entender suas preferências.</p>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Ex: Sou gestor de projetos na AdNet Monetize. Prefiro respostas diretas e executivas..."
                rows={6}
                className="w-full bg-surface-0 border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 transition-all resize-y leading-relaxed"
              />
            </div>

            <button
              onClick={handleSavePreferences}
              className="mt-4 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Salvar Preferências
            </button>

            {/* NEW Feature: Notification Preferences */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mt-6">
              <h3 className="text-sm font-medium text-primary mb-4">Notificações</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Notificações habilitadas</p>
                    <p className="text-xs text-muted">Receber alertas do sistema e de automações.</p>
                  </div>
                  <button
                    onClick={() => handleToggleNotif(!notifEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors ${notifEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-secondary">Som de notificação</p>
                    <p className="text-xs text-muted">Tocar som ao receber notificações.</p>
                  </div>
                  <button
                    onClick={() => handleToggleNotifSound(!notifSound)}
                    className={`w-10 h-5 rounded-full transition-colors ${notifSound ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifSound ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                <div className="pt-3 border-t border-default">
                  <p className="text-xs text-muted mb-3">Tipos de notificação:</p>
                  <div className="space-y-2">
                    {[
                      { id: 'mcp_status', label: 'Status de MCP Servers' },
                      { id: 'skill_updates', label: 'Atualizações de Skills' },
                      { id: 'session_complete', label: 'Sessão completa' },
                      { id: 'key_expiry', label: 'Expiração de API keys' },
                      { id: 'system_alerts', label: 'Alertas do sistema' },
                    ].map(nt => (
                      <label key={nt.id} className="flex items-center justify-between cursor-pointer">
                        <span className="text-xs text-secondary">{nt.label}</span>
                        <input
                          type="checkbox"
                          checked={notifTypes[nt.id] !== false}
                          onChange={(e) => handleToggleNotifType(nt.id, e.target.checked)}
                          className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-600"
                          disabled={!notifEnabled}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 7: Reset section */}
            <div className="mt-6 pt-4 border-t border-default">
              <button onClick={() => setShowResetConfirm('preferences')} className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg">
                Restaurar padrões desta seção
              </button>
            </div>
            {showResetConfirm === 'preferences' && (
              <div className="mt-3 p-4 bg-surface-1 border border-red-500/30 rounded-xl">
                <p className="text-sm text-primary mb-3">Restaurar Preferências para valores padrão?</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowResetConfirm(null)} className="px-4 py-2 rounded-lg text-xs text-secondary hover:bg-surface-2">Cancelar</button>
                  <button onClick={() => handleResetSection('preferences')} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs text-white font-medium">Restaurar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'agents' && (
          <AgentsSection />
        )}

        {activeTab === 'permissions' && (
          <PermissionsSection />
        )}

        {activeTab === 'shortcuts' && (
          <ShortcutsSection />
        )}

        {/* === NEW Feature 7: Setup Wizard Modal === */}
        {showWizard && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
            <div className="bg-surface-0 border border-default rounded-2xl p-8 max-w-lg w-full mx-4">
              <div className="flex items-center gap-2 mb-6">
                {WIZARD_STEPS.map((_, i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full ${i <= wizardStep ? 'bg-brand-600' : 'bg-surface-3'}`} />
                ))}
              </div>
              <h2 className="text-lg font-semibold text-primary mb-1">{WIZARD_STEPS[wizardStep].title}</h2>
              <p className="text-sm text-muted mb-6">{WIZARD_STEPS[wizardStep].description}</p>

              {wizardStep === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-brand-600/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-brand-600">A</span>
                  </div>
                  <p className="text-sm text-secondary">Configure providers, preferências e tema em poucos cliques.</p>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Provider</label>
                    <select value={wizardProvider} onChange={(e) => setWizardProvider(e.target.value)} className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none">
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">API Key</label>
                    <input type="password" value={wizardApiKey} onChange={(e) => setWizardApiKey(e.target.value)} placeholder="sk-..." className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50" />
                  </div>
                  <p className="text-[10px] text-muted">Opcional — você pode configurar depois em Providers.</p>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Como devo te chamar?</label>
                    <input type="text" value={wizardName} onChange={(e) => setWizardName(e.target.value)} placeholder="Seu nome" className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Tema</label>
                    <div className="flex gap-2">
                      {(['dark', 'light', 'midnight'] as const).map(t => (
                        <button key={t} onClick={() => handleSaveCustomTheme(t, accentColor)} className={`flex-1 py-2 rounded-xl text-xs font-medium border ${customThemeMode === t ? 'border-brand-500 text-brand-500' : 'border-default text-secondary'}`}>
                          {t === 'dark' ? 'Escuro' : t === 'light' ? 'Claro' : 'Midnight'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">&#10003;</span>
                  </div>
                  <p className="text-sm text-secondary">Tudo configurado! Você pode ajustar detalhes a qualquer momento.</p>
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button onClick={() => { localStorage.setItem('ados-wizard-done', 'true'); setShowWizard(false); }} className="text-xs text-muted hover:text-secondary">Pular</button>
                <div className="flex gap-2">
                  {wizardStep > 0 && (
                    <button onClick={() => setWizardStep(s => s - 1)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Voltar</button>
                  )}
                  {wizardStep < 3 ? (
                    <button onClick={() => setWizardStep(s => s + 1)} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm text-white font-medium">Próximo</button>
                  ) : (
                    <button onClick={handleWizardFinish} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm text-white font-medium">Concluir</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === NEW Feature 6: Lock Modal === */}
        {showLockModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-base font-semibold text-primary mb-4">
                {showLockModal === 'set' ? 'Definir Senha de Proteção' : 'Desbloquear Settings'}
              </h3>
              <input
                type="password"
                value={lockPasswordInput}
                onChange={(e) => { setLockPasswordInput(e.target.value); setLockError(''); }}
                placeholder={showLockModal === 'set' ? 'Nova senha' : 'Senha'}
                className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 mb-3"
                onKeyDown={(e) => { if (e.key === 'Enter') showLockModal === 'set' ? handleSetLockPassword(lockPasswordInput) : handleUnlock(); }}
              />
              {lockError && <p className="text-xs text-red-500 mb-3">{lockError}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowLockModal(null); setLockPasswordInput(''); setLockError(''); }} className="px-4 py-2 rounded-lg text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                <button
                  onClick={() => showLockModal === 'set' ? handleSetLockPassword(lockPasswordInput) : handleUnlock()}
                  disabled={!lockPasswordInput}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm text-white font-medium"
                >
                  {showLockModal === 'set' ? 'Definir' : 'Desbloquear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === NEW Feature 4: Settings Changelog Modal === */}
        {showChangelog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-primary">Changelog de Settings</h3>
                <button onClick={() => setShowChangelog(false)} className="text-xs text-muted hover:text-secondary">Fechar</button>
              </div>
              {settingsChangelog.length === 0 && <p className="text-xs text-muted text-center py-4">Nenhuma alteração registrada.</p>}
              <div className="space-y-2">
                {settingsChangelog.slice(0, 50).map((entry) => (
                  <div key={entry.id} className="bg-surface-1 border border-default rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary">{entry.key}</span>
                      <span className="text-[10px] text-muted">{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="text-red-400">- {String(entry.oldValue).slice(0, 60)}</span>
                      <span className="text-green-400">+ {String(entry.newValue).slice(0, 60)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NEW Feature: Settings Diff Modal */}
        {showDiff && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-primary">Diff: Atual vs Snapshot</h3>
                <button onClick={() => setShowDiff(false)} className="text-xs text-muted hover:text-secondary">Fechar</button>
              </div>
              {diffEntries.length === 0 && <p className="text-xs text-muted text-center py-4">Nenhuma diferenca encontrada.</p>}
              <div className="space-y-2">
                {diffEntries.map((entry, i) => (
                  <div key={i} className="bg-surface-1 border border-default rounded-xl px-4 py-3">
                    <span className="text-xs font-medium text-primary block mb-1">{entry.key}</span>
                    <div className="flex gap-4 text-[10px]">
                      <span className="text-red-400 truncate">Snapshot: {entry.saved || '(vazio)'}</span>
                      <span className="text-green-400 truncate">Atual: {entry.current || '(vazio)'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirmação remover MCP */}
        {confirmRemoveMcp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
              <h3 className="text-base font-semibold text-primary mb-2">Remover "{confirmRemoveMcp}"?</h3>
              <p className="text-sm text-muted mb-4">O servidor MCP será desconectado e removido permanentemente.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmRemoveMcp(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                <button onClick={() => handleRemoveMcp(confirmRemoveMcp)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Remover</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="max-w-2xl">
            <h1 className="text-lg font-semibold text-primary mb-1">Sobre o JVOS</h1>
            <p className="text-sm text-muted mb-6">AI Operational System — Desktop AI para gestão, automação e inteligência operacional.</p>

            {/* Hero card */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 shadow-card mb-4">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-primary">JVOS</h3>
                  <p className="text-xs text-muted">Versão 1.4.0 · Build 2026.05.17</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-primary">5</div>
                  <div className="text-[10px] text-muted">Providers LLM</div>
                </div>
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-primary">12</div>
                  <div className="text-[10px] text-muted">Módulos</div>
                </div>
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-primary">∞</div>
                  <div className="text-[10px] text-muted">Sessões locais</div>
                </div>
              </div>

              {/* Features list */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-blue-400"><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 5.5V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 13.5 5 11.5 5 9a7 7 0 0 1 7-7z"/></svg>
                  </span>
                  <div>
                    <div className="text-xs font-medium text-primary">Multi-Provider AI</div>
                    <div className="text-[10px] text-muted">OpenAI, Anthropic, Google, Groq, OpenRouter — com routing automático</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-purple-400"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                  </span>
                  <div>
                    <div className="text-xs font-medium text-primary">Multi-Agent Engine</div>
                    <div className="text-[10px] text-muted">Roteamento por complexidade, sub-agentes paralelos, tool calling nativo</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-green-400"><path d="M4 14h6v6H4zM14 4h6v6h-6zM4 4h6v6H4zM14 14h6v6h-6z"/></svg>
                  </span>
                  <div>
                    <div className="text-xs font-medium text-primary">MCP Protocol</div>
                    <div className="text-[10px] text-muted">Conecte ferramentas externas via stdio, SSE ou HTTP streaming</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-yellow-400"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
                  </span>
                  <div>
                    <div className="text-xs font-medium text-primary">Browser Automation</div>
                    <div className="text-[10px] text-muted">Navegador integrado com captura, interação e automação de páginas</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-400"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </span>
                  <div>
                    <div className="text-xs font-medium text-primary">Skills, Workflows e Automações</div>
                    <div className="text-[10px] text-muted">Crie rotinas com instruções customizadas, triggers e agendamentos</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-cyan-400"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  </span>
                  <div>
                    <div className="text-xs font-medium text-primary">Brain (Memória Persistente)</div>
                    <div className="text-[10px] text-muted">Memórias de longo prazo injetadas automaticamente no contexto</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tech stack */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h4 className="text-xs font-semibold text-secondary mb-3">Stack Técnica</h4>
              <div className="flex flex-wrap gap-2">
                {['Electron 33', 'React 19', 'TypeScript 5.7', 'Tailwind CSS 3.4', 'Vite 6.4', 'SQLite (sql.js)', 'OpenAI SDK', 'Web Crypto API'].map(tech => (
                  <span key={tech} className="px-2.5 py-1 bg-surface-2 border border-default rounded-lg text-[10px] font-medium text-secondary">{tech}</span>
                ))}
              </div>
            </div>

            {/* Shortcuts */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-4">
              <h4 className="text-xs font-semibold text-secondary mb-3">Atalhos de Teclado</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Ctrl+1', 'Modo Fast'],
                  ['Ctrl+2', 'Modo Balanced'],
                  ['Ctrl+3', 'Modo Smart'],
                  ['Ctrl+R', 'Alternar raciocínio'],
                  ['Ctrl+F', 'Buscar mensagens'],
                  ['Ctrl+E', 'Editar fila'],
                  ['Escape', 'Parar geração'],
                  ['Enter', 'Enviar mensagem'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between px-2.5 py-1.5 bg-surface-2 rounded-lg">
                    <span className="text-[10px] text-muted">{desc}</span>
                    <kbd className="text-[9px] font-mono bg-surface-0 border border-default px-1.5 py-0.5 rounded text-secondary">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* Credits */}
            <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
              <h4 className="text-xs font-semibold text-secondary mb-2">Créditos</h4>
              <p className="text-xs text-muted">Desenvolvido por <span className="text-primary font-medium">Eduardo AdNet</span> para a AdNet Monetize.</p>
              <p className="text-[10px] text-muted mt-2">© 2026 AdNet Monetize. Todos os direitos reservados.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const AGENT_PRESETS = [
  { id: 'router', name: 'Router', tier: 'router', model: 'gpt-4.1-nano', description: 'Classifica complexidade e roteia para o agente certo', icon: '🧭' },
  { id: 'fast', name: 'Fast Agent', tier: 'fast', model: 'gpt-4.1-nano', description: 'Respostas rápidas para tarefas simples (~1s)', icon: '⚡' },
  { id: 'balanced', name: 'Balanced Agent', tier: 'balanced', model: 'gpt-4.1-mini', description: 'Equilíbrio entre qualidade e velocidade (~3s)', icon: '⚖️' },
  { id: 'power', name: 'Power Agent', tier: 'power', model: 'gpt-4.1', description: 'Raciocínio profundo para tarefas complexas (~8s)', icon: '🧠' },
  { id: 'coder', name: 'Coder Agent', tier: 'power', model: 'gpt-4.1', description: 'Especializado em código, debugging e arquitetura', icon: '💻' },
  { id: 'researcher', name: 'Research Agent', tier: 'balanced', model: 'gpt-4.1-mini', description: 'Busca, análise e síntese de informações', icon: '🔍' },
  { id: 'writer', name: 'Writer Agent', tier: 'balanced', model: 'gpt-4.1-mini', description: 'Redação, revisão e formatação de conteúdo', icon: '✍️' },
  { id: 'reasoning', name: 'Reasoning Agent', tier: 'power', model: 'o4-mini', description: 'Raciocínio estendido para problemas difíceis (~15s)', icon: '🔬' },
];

const AVAILABLE_MODELS = [
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', speed: '~1s', cost: '$' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', speed: '~3s', cost: '$$' },
  { id: 'gpt-4.1', label: 'GPT-4.1', speed: '~8s', cost: '$$$' },
  { id: 'gpt-5.5', label: 'GPT-5.5', speed: '~10s', cost: '$$$$' },
  { id: 'o4-mini', label: 'o4-mini (Reasoning)', speed: '~15s', cost: '$$$' },
  { id: 'o3', label: 'o3 (Max Reasoning)', speed: '~30s', cost: '$$$$' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', speed: '~5s', cost: '$$$' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', speed: '~2s', cost: '$$' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', speed: '~2s', cost: '$' },
];

function AgentsSection() {
  const [agents, setAgents] = useState<any[]>([]);
  const [routing, setRouting] = useState(true);
  const [tiers, setTiers] = useState<any>(null);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editModel, setEditModel] = useState('');
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    const list = await ados.agents.list();
    setAgents(list || []);
    const r = await ados.agents.getRouting();
    setRouting(r?.routingEnabled ?? true);
    const t = await ados.agents.getTiers();
    setTiers(t);
  };

  const handleToggleRouting = async () => {
    const newVal = !routing;
    await ados.agents.setRouting(newVal);
    setRouting(newVal);
  };

  const handleToggleAgent = async (id: string, enabled: boolean) => {
    await ados.agents.update(id, { enabled: !enabled });
    loadAgents();
  };

  const handleChangeModel = async (id: string) => {
    if (!editModel) return;
    await ados.agents.update(id, { model: editModel });
    setEditingAgent(null);
    setEditModel('');
    loadAgents();
  };

  const handleAddPreset = async (preset: typeof AGENT_PRESETS[0]) => {
    if (agents.some(a => a.name === preset.name)) return;
    await ados.agents.create?.({ name: preset.name, tier: preset.tier, model: preset.model, description: preset.description, enabled: true });
    loadAgents();
  };

  const handleDeleteAgent = async (id: string) => {
    await ados.agents.delete?.(id);
    loadAgents();
  };

  const tierColors: Record<string, string> = {
    router: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    fast: 'bg-green-500/10 text-green-400 border-green-500/20',
    balanced: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    power: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  const tierLabels: Record<string, string> = {
    router: 'Router',
    fast: 'Fast',
    balanced: 'Balanced',
    power: 'Power',
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold text-primary mb-1">Multi-Agentes</h1>
      <p className="text-sm text-muted mb-6">Hierarquia de agentes com roteamento inteligente por complexidade.</p>

      {/* Routing toggle */}
      <div className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-primary">Roteamento Automático</h3>
            <p className="text-xs text-muted mt-0.5">O Router analisa cada mensagem e direciona para o agente ideal.</p>
          </div>
          <button
            onClick={handleToggleRouting}
            className={`w-10 h-5 rounded-full transition-colors ${routing ? 'bg-brand-600' : 'bg-surface-3'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${routing ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {tiers && (
          <div className="grid grid-cols-4 gap-2">
            {tiers.tiers.map((t: any) => (
              <div key={t.id} className={`rounded-lg p-2.5 text-center ${tierColors[t.id] || 'bg-surface-2'}`}>
                <p className="text-xs font-semibold">{t.name}</p>
                <p className="text-[10px] opacity-75">{t.cost}x custo</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Presets - one-click add */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-secondary">Presets de Agentes</h2>
          <button onClick={() => setShowPresets(!showPresets)} className="text-[10px] text-brand-500 hover:text-brand-400 font-medium">
            {showPresets ? 'Ocultar' : 'Mostrar presets'}
          </button>
        </div>
        {showPresets && (
          <div className="grid grid-cols-2 gap-2">
            {AGENT_PRESETS.map(preset => {
              const alreadyAdded = agents.some(a => a.name === preset.name);
              return (
                <button
                  key={preset.id}
                  onClick={() => !alreadyAdded && handleAddPreset(preset)}
                  disabled={alreadyAdded}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${alreadyAdded ? 'bg-surface-2 border-default opacity-50 cursor-not-allowed' : 'bg-surface-1 border-default hover:border-brand-500/40 hover:shadow-card'}`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary">{preset.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tierColors[preset.tier]}`}>{tierLabels[preset.tier]}</span>
                    </div>
                    <div className="text-[10px] text-muted truncate">{preset.description}</div>
                    <div className="text-[9px] text-muted font-mono mt-0.5">{preset.model}</div>
                  </div>
                  {alreadyAdded ? (
                    <span className="text-[9px] text-green-500 font-medium shrink-0">✓ Ativo</span>
                  ) : (
                    <span className="text-[9px] text-brand-400 font-medium shrink-0">+ Adicionar</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active agents */}
      <h2 className="text-sm font-medium text-secondary mb-3">Agentes Ativos ({agents.length})</h2>
      {agents.length === 0 ? (
        <div className="bg-surface-1 border border-dashed border-default rounded-xl p-6 text-center">
          <p className="text-xs text-muted mb-2">Nenhum agente configurado.</p>
          <button onClick={() => setShowPresets(true)} className="text-xs text-brand-500 hover:text-brand-400 font-medium">Adicionar de presets →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map(agent => (
            <div key={agent.id} className={`bg-surface-1 border rounded-xl px-4 py-3 transition-all ${agent.enabled ? 'border-brand-500/20 shadow-card' : 'border-default opacity-75'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleAgent(agent.id, agent.enabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${agent.enabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-[3px] ${agent.enabled ? 'left-[18px]' : 'left-[3px]'}`} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">{agent.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${tierColors[agent.tier] || 'bg-surface-2 text-muted'}`}>
                        {tierLabels[agent.tier] || agent.tier}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="text-[10px] text-muted mt-0.5">{agent.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="p-1 text-muted hover:text-red-400 transition-colors"
                    title="Remover agente"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>
              {/* Model selector */}
              <div className="mt-2 ml-12 flex items-center gap-2">
                <span className="text-[10px] text-muted">Modelo:</span>
                {editingAgent === agent.id ? (
                  <>
                    <select
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      className="flex-1 bg-surface-0 border border-default rounded-lg px-2 py-1 text-xs text-primary outline-none focus:border-brand-500/50"
                    >
                      {AVAILABLE_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.label} ({m.speed} · {m.cost})</option>
                      ))}
                    </select>
                    <button onClick={() => handleChangeModel(agent.id)} className="px-2.5 py-1 rounded-lg text-[10px] bg-brand-600 text-white font-medium">OK</button>
                    <button onClick={() => setEditingAgent(null)} className="px-2.5 py-1 rounded-lg text-[10px] text-muted hover:text-secondary">×</button>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-mono text-secondary bg-surface-2 px-2 py-0.5 rounded">{agent.model}</span>
                    <button
                      onClick={() => { setEditingAgent(agent.id); setEditModel(agent.model); }}
                      className="text-[10px] text-brand-500 hover:text-brand-400 font-medium"
                    >
                      trocar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommended models reference */}
      {tiers && (
        <div className="mt-6 bg-surface-1 border border-default rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-medium text-primary mb-3">Modelos por Tier</h3>
          <div className="space-y-3">
            {Object.entries(tiers.models).map(([tier, models]: [string, any]) => (
              <div key={tier} className="flex items-start gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mt-0.5 min-w-[70px] text-center ${tierColors[tier]}`}>
                  {tierLabels[tier] || tier}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {models.map((m: string) => (
                    <span key={m} className="text-[10px] font-mono text-muted bg-surface-2 rounded px-1.5 py-0.5">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_SHORTCUTS = [
  { action: 'new-session', label: 'Nova Sessão', keys: 'Ctrl+N' },
  { action: 'search', label: 'Buscar', keys: 'Ctrl+K' },
  { action: 'settings', label: 'Configurações', keys: 'Ctrl+,' },
  { action: 'toggle-theme', label: 'Alternar Tema', keys: 'Ctrl+Shift+D' },
  { action: 'send-message', label: 'Enviar Mensagem', keys: 'Enter' },
  { action: 'new-line', label: 'Nova Linha', keys: 'Shift+Enter' },
  { action: 'voice-input', label: 'Input por Voz', keys: 'Ctrl+Shift+V' },
  { action: 'close-session', label: 'Fechar Sessão', keys: 'Ctrl+W' },
  { action: 'next-session', label: 'Próxima Sessão', keys: 'Ctrl+Tab' },
  { action: 'prev-session', label: 'Sessão Anterior', keys: 'Ctrl+Shift+Tab' },
];

// #4 Editable keybindings
function ShortcutsSection() {
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [capturedKeys, setCapturedKeys] = useState('');
  const [conflict, setConflict] = useState('');

  useEffect(() => {
    const loadShortcuts = async () => {
      const saved = await ados.db.getSetting?.('custom_shortcuts');
      if (saved) {
        try { setShortcuts(JSON.parse(saved)); } catch {}
      }
    };
    loadShortcuts();
  }, []);

  const handleStartEdit = (action: string) => {
    setEditingAction(action);
    setCapturedKeys('');
    setConflict('');
  };

  const handleKeyCapture = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    const combo = parts.join('+');
    setCapturedKeys(combo);
    // Feature 8: Check conflicts immediately
    const conflicting = shortcuts.find(s => s.keys === combo && s.action !== editingAction);
    setConflict(conflicting ? `Conflito com: ${conflicting.label}` : '');
  };

  const handleSaveShortcut = async () => {
    if (!capturedKeys || conflict) return;
    const updated = shortcuts.map(s => s.action === editingAction ? { ...s, keys: capturedKeys } : s);
    setShortcuts(updated);
    setEditingAction(null);
    setCapturedKeys('');
    await ados.db.setSetting?.('custom_shortcuts', JSON.stringify(updated));
  };

  const handleResetAll = async () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    await ados.db.setSetting?.('custom_shortcuts', JSON.stringify(DEFAULT_SHORTCUTS));
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-primary mb-1">Atalhos de Teclado</h1>
          <p className="text-sm text-muted">Clique em um atalho para editar. Pressione a nova combinação de teclas.</p>
        </div>
        <button onClick={handleResetAll} className="text-xs text-muted hover:text-secondary px-3 py-1.5 rounded-lg hover:bg-surface-2">
          Restaurar padrões
        </button>
      </div>
      <div className="space-y-1">
        {shortcuts.map(s => (
          <div key={s.action} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-surface-1 transition-colors">
            <span className="text-sm text-primary">{s.label}</span>
            {editingAction === s.action ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    readOnly
                    value={capturedKeys || 'Pressione teclas...'}
                    onKeyDown={handleKeyCapture}
                    className={`bg-surface-0 border rounded-lg px-2.5 py-1 text-xs font-mono text-primary outline-none w-40 text-center ${conflict ? 'border-red-500' : 'border-brand-500'}`}
                  />
                  <button onClick={handleSaveShortcut} disabled={!capturedKeys || !!conflict} className="text-xs text-brand-500 disabled:text-muted font-medium">OK</button>
                  <button onClick={() => setEditingAction(null)} className="text-xs text-muted">X</button>
                </div>
                {conflict && <span className="text-[10px] text-red-500 font-medium">{conflict}</span>}
              </div>
            ) : (
              <button onClick={() => handleStartEdit(s.action)} className="group">
                <kbd className="px-2.5 py-1 bg-surface-2 border border-default rounded-lg text-xs font-mono text-secondary group-hover:border-brand-500/50 transition-colors">
                  {s.keys}
                </kbd>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AuditLogEntry {
  timestamp: string;
  action: 'add' | 'change' | 'delete';
  permissionId: string;
  pattern: string;
  detail: string;
}

function PermissionsSection() {
  const [permissions, setPermissions] = useState<Array<{ id: string; pattern: string; type: string; access: string; comment: string }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ pattern: '', type: 'bash', access: 'ask', comment: '' });
  const [regexError, setRegexError] = useState('');
  // #9 Audit log
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showAuditLog, setShowAuditLog] = useState(false);
  // Feature 5: Audit pagination & filters
  const [auditPage, setAuditPage] = useState(0);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('all');
  const [auditFilterDateFrom, setAuditFilterDateFrom] = useState('');
  const [auditFilterDateTo, setAuditFilterDateTo] = useState('');
  // NEW Feature 3: Category filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => { loadPerms(); loadAuditLog(); }, []);

  const loadAuditLog = async () => {
    const saved = await ados.db.getSetting?.('permissions_audit_log');
    if (saved) { try { setAuditLog(JSON.parse(saved)); } catch {} }
  };

  const addAuditEntry = async (entry: Omit<AuditLogEntry, 'timestamp'>) => {
    const newEntry = { ...entry, timestamp: new Date().toISOString() };
    const updated = [newEntry, ...auditLog].slice(0, 50);
    setAuditLog(updated);
    await ados.db.setSetting?.('permissions_audit_log', JSON.stringify(updated));
  };

  const loadPerms = async () => {
    const rows = await ados.db.getPermissions();
    setPermissions(rows);
  };

  const handlePatternChange = (value: string) => {
    setForm({ ...form, pattern: value });
    if (!value) { setRegexError(''); return; }
    try { new RegExp(value); setRegexError(''); }
    catch (e: any) { setRegexError(e.message || 'Regex inválida'); }
  };

  const handleAdd = async () => {
    if (regexError) return;
    const id = crypto.randomUUID();
    await ados.db.addPermission(id, form.pattern, form.type, form.access, form.comment);
    // #9 Audit log
    await addAuditEntry({ action: 'add', permissionId: id, pattern: form.pattern, detail: `type=${form.type}, access=${form.access}, comment="${form.comment}"` });
    setForm({ pattern: '', type: 'bash', access: 'ask', comment: '' });
    setRegexError('');
    setShowAdd(false);
    loadPerms();
  };

  const handleChangeAccess = async (id: string, access: string) => {
    const perm = permissions.find(p => p.id === id);
    await ados.db.updatePermission(id, access);
    // #9 Audit log
    await addAuditEntry({ action: 'change', permissionId: id, pattern: perm?.pattern || '', detail: `access: ${perm?.access} -> ${access}` });
    loadPerms();
  };

  const handleDelete = async (id: string) => {
    const perm = permissions.find(p => p.id === id);
    await ados.db.deletePermission(id);
    // #9 Audit log
    await addAuditEntry({ action: 'delete', permissionId: id, pattern: perm?.pattern || '', detail: `Removida: ${perm?.type}/${perm?.access}` });
    loadPerms();
  };

  const accessColors: Record<string, string> = {
    allow: 'bg-green-500/10 text-green-500',
    ask: 'bg-yellow-500/10 text-yellow-600',
    block: 'bg-red-500/10 text-red-500',
  };

  const accessLabels: Record<string, string> = { allow: 'Permitido', ask: 'Perguntar', block: 'Bloqueado' };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-primary mb-1">Permissões</h1>
          <p className="text-sm text-muted">Controle o que a IA pode executar sem perguntar.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium">+ Regra</button>
      </div>

      {showAdd && (
        <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-5 mb-4 shadow-card">
          <div className="space-y-3">
            {regexError && <p className="text-xs text-red-500">{regexError}</p>}
            <div className="flex gap-3">
              <input placeholder="Pattern (regex)" value={form.pattern} onChange={(e) => handlePatternChange(e.target.value)} className={`flex-1 bg-surface-0 border rounded-xl px-3 py-2 text-sm text-primary placeholder-muted outline-none ${regexError ? 'border-red-500/50' : 'border-default focus:border-brand-500/50'}`} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary outline-none">
                <option value="bash">Bash</option>
                <option value="mcp">MCP</option>
                <option value="tool">Tool</option>
                <option value="file">File</option>
              </select>
              <select value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value })} className="bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary outline-none">
                <option value="allow">Permitido</option>
                <option value="ask">Perguntar</option>
                <option value="block">Bloqueado</option>
              </select>
            </div>
            <input placeholder="Comentário (opcional)" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} className="w-full bg-surface-0 border border-default rounded-xl px-3 py-2 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button onClick={handleAdd} disabled={!form.pattern || !!regexError} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 3: Category filter */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button onClick={() => setCategoryFilter('all')} className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${categoryFilter === 'all' ? 'bg-brand-600/10 text-brand-500' : 'bg-surface-2 text-muted hover:text-secondary'}`}>Todas</button>
        {Object.entries(PERMISSION_CATEGORIES).map(([key, cat]) => (
          <button key={key} onClick={() => setCategoryFilter(key)} className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${categoryFilter === key ? 'bg-brand-600/10 text-brand-500' : 'bg-surface-2 text-muted hover:text-secondary'}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {permissions.length === 0 && !showAdd && (
        <div className="bg-surface-1 border border-default rounded-2xl p-8 text-center">
          <p className="text-sm text-muted">Nenhuma regra de permissão configurada.</p>
          <p className="text-xs text-muted mt-1">Clique em "+ Regra" para definir o que a IA pode fazer automaticamente.</p>
        </div>
      )}

      <div className="space-y-2">
        {permissions.filter(perm => {
          if (categoryFilter === 'all') return true;
          const cat = PERMISSION_CATEGORIES[categoryFilter];
          return cat ? cat.types.includes(perm.type) : true;
        }).map((perm) => (
          <div key={perm.id} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-2 rounded text-muted uppercase">{perm.type}</span>
            <span className="text-sm font-mono text-primary flex-1 truncate">{perm.pattern}</span>
            {perm.comment && <span className="text-[10px] text-muted truncate max-w-32">{perm.comment}</span>}
            <select
              value={perm.access}
              onChange={(e) => handleChangeAccess(perm.id, e.target.value)}
              className={`text-[10px] font-medium px-2 py-1 rounded-lg outline-none ${accessColors[perm.access]}`}
            >
              <option value="allow">{accessLabels.allow}</option>
              <option value="ask">{accessLabels.ask}</option>
              <option value="block">{accessLabels.block}</option>
            </select>
            <button onClick={() => handleDelete(perm.id)} className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg">X</button>
          </div>
        ))}
      </div>

      {/* #9 Audit Log — Feature 5: Paginated */}
      {auditLog.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowAuditLog(!showAuditLog)} className="text-xs text-muted hover:text-secondary">
            {showAuditLog ? '▼' : '▶'} Audit Log ({auditLog.length} entradas)
          </button>
          {showAuditLog && (() => {
            const filtered = auditLog.filter(e => {
              if (auditFilterAction !== 'all' && e.action !== auditFilterAction) return false;
              if (auditFilterDateFrom && new Date(e.timestamp) < new Date(auditFilterDateFrom)) return false;
              if (auditFilterDateTo && new Date(e.timestamp) > new Date(auditFilterDateTo + 'T23:59:59')) return false;
              return true;
            });
            const totalPages = Math.ceil(filtered.length / 10);
            const paged = filtered.slice(auditPage * 10, (auditPage + 1) * 10);
            const exportCsv = () => {
              const header = 'timestamp,action,pattern,detail';
              const rows = filtered.map(e => `"${e.timestamp}","${e.action}","${e.pattern}","${e.detail.replace(/"/g, '""')}"`);
              navigator.clipboard.writeText([header, ...rows].join('\n'));
            };
            return (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <select value={auditFilterAction} onChange={(e) => { setAuditFilterAction(e.target.value); setAuditPage(0); }} className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-[10px] text-primary outline-none">
                    <option value="all">Todas ações</option>
                    <option value="add">add</option>
                    <option value="change">change</option>
                    <option value="delete">delete</option>
                  </select>
                  <input type="date" value={auditFilterDateFrom} onChange={(e) => { setAuditFilterDateFrom(e.target.value); setAuditPage(0); }} className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-[10px] text-primary outline-none" />
                  <input type="date" value={auditFilterDateTo} onChange={(e) => { setAuditFilterDateTo(e.target.value); setAuditPage(0); }} className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-[10px] text-primary outline-none" />
                  <button onClick={exportCsv} className="ml-auto text-[10px] text-brand-500 hover:text-brand-400 font-medium">Exportar CSV</button>
                </div>
                <div className="space-y-1.5">
                  {paged.map((entry, i) => (
                    <div key={i} className="bg-surface-1 border border-default rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        entry.action === 'add' ? 'bg-green-500/10 text-green-500' :
                        entry.action === 'change' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>{entry.action}</span>
                      <span className="text-[10px] font-mono text-primary truncate flex-1">{entry.pattern}</span>
                      <span className="text-[9px] text-muted truncate max-w-40">{entry.detail}</span>
                      <span className="text-[9px] text-muted whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-3">
                    <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0} className="text-[10px] text-secondary disabled:text-muted px-2 py-1 rounded hover:bg-surface-2">Prev</button>
                    <span className="text-[10px] text-muted">{auditPage + 1}/{totalPages}</span>
                    <button onClick={() => setAuditPage(p => Math.min(totalPages - 1, p + 1))} disabled={auditPage >= totalPages - 1} className="text-[10px] text-secondary disabled:text-muted px-2 py-1 rounded hover:bg-surface-2">Next</button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
