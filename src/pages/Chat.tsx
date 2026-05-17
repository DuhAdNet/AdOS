import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from '../components/MessageBubble';
import ToolSteps from '../components/ToolSteps';
import AutocompletePopup from '../components/AutocompletePopup';
import VoiceInput from '../components/VoiceInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  steps?: Array<{ name: string; timestamp: number }>;
  createdAt?: number;
}

interface SubAgent {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  startTime: number;
  task: string;
}

type EffortLevel = 'low' | 'medium' | 'high';

interface UnifiedMode {
  id: EffortLevel;
  label: string;
  description: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const UNIFIED_MODES: UnifiedMode[] = [
  { id: 'low', label: 'Fast', description: 'Prioriza velocidade para tarefas simples', model: 'gpt-4.1-nano', maxTokens: 512, temperature: 0.3 },
  { id: 'medium', label: 'Balanced', description: 'Modelo equilibrado para o dia a dia', model: 'gpt-4.1-mini', maxTokens: 2048, temperature: 0.5 },
  { id: 'high', label: 'Smart', description: 'Ideal para ações complexas, mas um pouco lento', model: 'gpt-4.1', maxTokens: 4096, temperature: 0.7 },
];

const COMPLEXITY_SIGNALS = /(?:analise|compare|implemente|refatore|explique detalhadamente|crie um sistema|escreva um|planej[ae]|otimize|architect|implement|refactor|analyze|design)/i;

const EFFORT_CONFIG: Record<EffortLevel, { maxTokens: number; temperature: number; label: string }> = {
  low: { maxTokens: 512, temperature: 0.3, label: 'Fast' },
  medium: { maxTokens: 2048, temperature: 0.5, label: 'Balanced' },
  high: { maxTokens: 16000, temperature: 0.7, label: 'Smart' },
};

interface ChatProps {
  sessionId: string;
  onUpdateTitle: (title: string) => void;
}

interface ModelTier {
  id: string;
  name: string;
  description: string;
  modelMatch: string[];
  defaultModel: string;
}

const MODEL_TIERS: ModelTier[] = [
  { id: 'smart', name: 'Smart', description: 'Ideal para ações complexas, mais lento', modelMatch: ['gpt-5.5', 'gpt-4.1', 'gpt-4o', 'claude-sonnet'], defaultModel: 'gpt-5.5' },
  { id: 'balanced', name: 'Balanced', description: 'Modelo equilibrado para o dia a dia', modelMatch: ['gpt-4.1-mini', 'gpt-4o-mini', 'claude-haiku'], defaultModel: 'gpt-4.1-mini' },
  { id: 'fast', name: 'Fast', description: 'Prioriza velocidade para tarefas simples', modelMatch: ['gpt-4.1-nano', 'gpt-3.5-turbo'], defaultModel: 'gpt-4.1-nano' },
];

const REASONING_LEVELS = [
  { id: 'none', name: 'Sem raciocínio', description: 'Respostas mais rápidas, sem raciocínio estendido', model: '' },
  { id: 'medium', name: 'Raciocínio', description: 'Equilíbrio entre velocidade e raciocínio', model: 'o4-mini' },
  { id: 'max', name: 'Raciocínio máximo', description: 'Raciocínio mais profundo para tarefas complexas', model: 'o3' },
];

const SUGGESTIONS = [
  { title: 'Preparar reunião 1:1', subtitle: 'Criar pauta com pontos-chave', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { title: 'Plano estratégico', subtitle: 'Estruturar objetivos e metas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { title: 'Analisar métricas', subtitle: 'Entender dados e tendências', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

const ados = (window as any).ados;

export default function Chat({ sessionId, onUpdateTitle }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [lastErrorMsg, setLastErrorMsg] = useState<string | null>(null);
  const [streamContent, setStreamContent] = useState('');
  const [toolSteps, setToolSteps] = useState<Array<{ name: string; timestamp: number }>>([]);
  const toolStepsRef = useRef<Array<{ name: string; timestamp: number }>>([]);
  const [toolStartTime, setToolStartTime] = useState(0);
  const [autocomplete, setAutocomplete] = useState<{ trigger: '/' | '@'; query: string } | null>(null);
  const [acItems, setAcItems] = useState<Array<{ slug: string; name: string; description: string; type: 'skill' | 'workflow' }>>([]);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [routingEnabled, setRoutingEnabled] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);
  const [reasoningLevel, setReasoningLevel] = useState('none');
  const [connectedTools, setConnectedTools] = useState<Array<{ name: string; status: string }>>([]);
  const [attachments, setAttachments] = useState<Array<{ name: string; content: string; type?: 'text' | 'image'; mimeType?: string }>>([]);
  const [attachProgress, setAttachProgress] = useState<{ name: string; progress: number } | null>(null);
  const [tokenEstimate, setTokenEstimate] = useState<{ tokens: number; cost: number; contextTokens: number }>({ tokens: 0, cost: 0, contextTokens: 0 });
  const [reviewResult, setReviewResult] = useState<Array<{ agent: string; findings: string[] }> | null>(null);
  const [reviewRunning, setReviewRunning] = useState(false);
  const [reviewCollapsed, setReviewCollapsed] = useState<Record<string, boolean>>({});
  // Feature 1: Sub-agents
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const subAgentCounter = useRef(0);
  // Message queue: messages sent while LLM is busy
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [editingQueueIdx, setEditingQueueIdx] = useState<number | null>(null);
  const editingQueueOriginal = useRef<string>('');
  const messageQueueRef = useRef<string[]>([]);
  const sendMessageRef = useRef<((content?: string, fromQueue?: boolean) => void) | undefined>(undefined);
  const processingQueueRef = useRef(false);
  // Feature 2: Conversation compaction
  const [compactionStatus, setCompactionStatus] = useState<'idle' | 'compacting'>('idle');
  const [compactionNotice, setCompactionNotice] = useState<string | null>(null);
  const [compactionCount, setCompactionCount] = useState(0);
  const [contextWarning, setContextWarning] = useState(false);
  const [showContextBreakdown, setShowContextBreakdown] = useState(false);
  const [lastReasoningUsed, setLastReasoningUsed] = useState<string | null>(null);
  const [compactionBackup, setCompactionBackup] = useState<string | null>(null);
  const [showCompactPreview, setShowCompactPreview] = useState(false);
  const [compactPreviewContent, setCompactPreviewContent] = useState('');
  const [showAgentPopup, setShowAgentPopup] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string; model: string }>>([]);
  const [outputTokens, setOutputTokens] = useState(0);
  // Feature 3: Session recap
  const [showRecap, setShowRecap] = useState(false);
  const [recapContent, setRecapContent] = useState('');
  const recapShownRef = useRef(false);
  // Feature 4: Effort level
  const [effortLevel, setEffortLevel] = useState<EffortLevel>('high');
  const [planMode, setPlanMode] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Array<{ step: string; status: 'pending' | 'running' | 'done' }> | null>(null);
  const [activeGoal, setActiveGoal] = useState<{ text: string; turns: number; startTime: number } | null>(null);
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalElapsed, setGoalElapsed] = useState('0s');
  // Feature 30: Quote reply
  const [quotedMessage, setQuotedMessage] = useState<{ id: string; content: string } | null>(null);
  // Feature 32: Search in history
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  // Feature 35: Branching
  const [branches, setBranches] = useState<Record<string, Message[]>>({});
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  // Feature 36: Smart auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  // Feature 38: Token counter live
  const [liveTokenCount, setLiveTokenCount] = useState(0);
  // Feature 39: Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<string[]>([]);
  // Feature 40: Follow-up suggestions
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  // Feature 41: Diff view
  const [showDiff, setShowDiff] = useState<Record<string, boolean>>({});
  // UI/UX Improvement 1: Message Selection & Bulk Actions
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  // UI/UX Improvement 4: Toast on Copy
  const [copyToast, setCopyToast] = useState(false);
  // UI/UX Improvement 5: Keyboard Shortcut Modal
  const [showShortcuts, setShowShortcuts] = useState(false);
  // UI/UX Improvement 6: Enhanced Welcome Tips
  const [showTips, setShowTips] = useState(false);
  // UI/UX Improvement 10: Onboarding Tooltips
  const [onboardingDone, setOnboardingDone] = useState(() => localStorage.getItem('ados_onboarding_done') === 'true');
  // Cross-menu integrations
  const [sessionLabels, setSessionLabels] = useState<string[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [allLabels, setAllLabels] = useState<any[]>([]);
  const [brainToast, setBrainToast] = useState(false);
  const [userPrefs, setUserPrefs] = useState<{ name: string; role: string; notes: string }>({ name: '', role: '', notes: '' });
  const [isSessionShared, setIsSessionShared] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const isFirstMessage = useRef(true);
  const modelSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenersRegistered = useRef(false);
  const MAX_STREAM_CHARS = 200000;

  useEffect(() => {
    if (listenersRegistered.current) {
      ados.llm.removeStreamListeners();
      listenersRegistered.current = false;
    }
    setTokenEstimate({ tokens: 0, cost: 0, contextTokens: 0 });
    compactedContextRef.current = null;
    loadMessages(); loadSessionModel();
    // Load persisted queue
    ados.db.getSessionSetting(sessionId, 'message_queue').then((q: string | null) => {
      if (q) { try { const parsed = JSON.parse(q); if (Array.isArray(parsed) && parsed.length > 0) { setMessageQueue(parsed); messageQueueRef.current = parsed; } } catch {} }
    });
    return () => { ados.llm.removeStreamListeners(); listenersRegistered.current = false; };
  }, [sessionId]);
  useEffect(() => { loadAcItems(); loadModels(); loadRoutingState(); loadConnectedTools(); }, []);

  useEffect(() => {
    if (autoScroll) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent, autoScroll]);

  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
    setShowScrollBottom(!atBottom);
  }, []);

  // Feature 38: Live token counter
  useEffect(() => {
    setLiveTokenCount(Math.ceil(input.length / 4));
  }, [input]);

  // Feature 32: Search in history
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(messages.filter(m => m.content.toLowerCase().includes(q)).map(m => m.id));
  }, [searchQuery, messages]);

  useEffect(() => {
    if (!activeGoal) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - activeGoal.startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setGoalElapsed(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeGoal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Persist queue to DB
  useEffect(() => {
    ados.db.setSessionSetting(sessionId, 'message_queue', JSON.stringify(messageQueue)).catch(() => {});
  }, [messageQueue, sessionId]);

  // Process queue when loading transitions to false (safety net)
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !loading && messageQueueRef.current.length > 0) {
      const queue = messageQueueRef.current;
      if (queue.length > 0 && !processingQueueRef.current) {
        processingQueueRef.current = true;
        const next = queue[0];
        const remaining = queue.slice(1);
        messageQueueRef.current = remaining;
        setMessageQueue(remaining);
        setTimeout(() => {
          processingQueueRef.current = false;
          sendMessageRef.current?.(next, true);
        }, 300);
      }
    }
    prevLoadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const handleKeyShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && loading) {
        handleStop();
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.key === '1') { e.preventDefault(); setEffortLevel('low'); setSelectedModel('gpt-4.1-nano'); ados.db.setSessionSetting(sessionId, 'effort', 'low'); ados.db.setSessionSetting(sessionId, 'model', 'gpt-4.1-nano'); }
        if (e.key === '2') { e.preventDefault(); setEffortLevel('medium'); setSelectedModel('gpt-4.1-mini'); ados.db.setSessionSetting(sessionId, 'effort', 'medium'); ados.db.setSessionSetting(sessionId, 'model', 'gpt-4.1-mini'); }
        if (e.key === '3') { e.preventDefault(); setEffortLevel('high'); setSelectedModel('gpt-4.1'); ados.db.setSessionSetting(sessionId, 'effort', 'high'); ados.db.setSessionSetting(sessionId, 'model', 'gpt-4.1'); }
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          setReasoningLevel(prev => {
            const next = prev === 'none' ? 'medium' : prev === 'medium' ? 'max' : 'none';
            const rl = REASONING_LEVELS.find(r => r.id === next);
            const model = rl?.model || 'gpt-4.1-mini';
            setSelectedModel(model);
            debouncedModelSave(model, next);
            return next;
          });
        }
        if (e.key === 'e' || e.key === 'E') {
          if (messageQueueRef.current.length > 0) {
            e.preventDefault();
            const lastIdx = messageQueueRef.current.length - 1;
            editingQueueOriginal.current = messageQueueRef.current[lastIdx];
            setEditingQueueIdx(lastIdx);
          }
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          setShowSearch(prev => !prev);
        }
        if (e.key === '/' || e.key === '?') {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
        }
      }
    };
    document.addEventListener('keydown', handleKeyShortcuts);
    return () => document.removeEventListener('keydown', handleKeyShortcuts);
  }, [loading, sessionId]);

  // UI/UX Improvement 10: Dismiss onboarding
  const dismissOnboarding = useCallback(() => {
    setOnboardingDone(true);
    localStorage.setItem('ados_onboarding_done', 'true');
  }, []);

  // UI/UX Improvement 4: Copy toast helper
  const showCopyToast = useCallback(() => {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  }, []);

  // Cross-menu: Save to Brain
  const saveToBrain = useCallback(async (content: string) => {
    await ados.db.addMemory({ content, category: 'chat', tags: ['from-chat'] });
    setBrainToast(true);
    setTimeout(() => setBrainToast(false), 2000);
  }, []);

  // Cross-menu: Share session
  const shareSession = useCallback(async () => {
    await ados.db.addPublished({ sessionId, messages, publishedAt: Date.now() });
    setIsSessionShared(true);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 3000);
  }, [sessionId, messages]);

  // Cross-menu: Forward to Telegram
  const forwardToTelegram = useCallback(async (content: string) => {
    if (ados.telegram?.sendMessage && telegramChatId) {
      await ados.telegram.sendMessage(telegramChatId, content);
    }
  }, [telegramChatId]);

  // Cross-menu: Load labels, preferences, telegram on mount
  useEffect(() => {
    (async () => {
      // Labels
      try {
        const labels = await ados.db.getLabels();
        setAllLabels(labels || []);
        const session = await ados.db.getSession(sessionId);
        setSessionLabels(session?.labels || []);
      } catch {}
      // Preferences
      try {
        const name = await ados.db.getSetting('user_name') || '';
        const role = await ados.db.getSetting('user_role') || '';
        const notes = await ados.db.getSetting('user_notes') || '';
        setUserPrefs({ name, role, notes });
      } catch {}
      // Telegram
      try {
        const token = await ados.db.getSetting('telegram_token');
        setTelegramConfigured(!!token);
        const chatId = await ados.db.getSetting('telegram_chat_id');
        setTelegramChatId(chatId || '');
      } catch {}
    })();
  }, [sessionId]);

  const loadRoutingState = async () => {
    const r = await ados.agents.getRouting();
    let enabled = r?.routingEnabled ?? false;
    try {
      const agents = await ados.agents.list();
      setAvailableAgents((agents || []).map((a: any) => ({ id: a.id, name: a.name, model: a.model })));
      // C6: Auto-disable if no agents configured
      if (enabled && (!agents || agents.length === 0)) {
        enabled = false;
        await ados.agents.setRouting(false);
      }
    } catch {}
    setRoutingEnabled(enabled);
  };

  const loadModels = async () => {
    const modelsList = await ados.providers.listModels();
    setModels(modelsList || []);
  };

  const loadSessionModel = async () => {
    const sessionModel = await ados.db.getSessionSetting(sessionId, 'model');
    if (sessionModel) {
      setSelectedModel(sessionModel);
    } else {
      const defaultModel = await ados.providers.getDefaultModel();
      setSelectedModel(defaultModel || 'gpt-4.1-mini');
    }
    const sessionReasoning = await ados.db.getSessionSetting(sessionId, 'reasoning');
    setReasoningLevel(sessionReasoning || 'none');
    const sessionEffort = await ados.db.getSessionSetting(sessionId, 'effort');
    if (sessionEffort && ['low', 'medium', 'high'].includes(sessionEffort)) {
      setEffortLevel(sessionEffort as EffortLevel);
    }
  };

  const loadConnectedTools = async () => {
    try {
      const servers = await ados.mcp.listServers();
      const connected = (servers || []).filter((s: any) => s.status === 'connected');
      setConnectedTools(connected.map((s: any) => ({ name: s.name, status: s.status })));
    } catch { setConnectedTools([]); }
  };

  const loadAcItems = async () => {
    const [skills, workflows] = await Promise.all([
      ados.db.getSkills(),
      ados.db.getWorkflows(),
    ]);
    setAcItems([
      ...skills.map((s: any) => ({ slug: s.slug, name: s.name, description: s.description, type: 'skill' as const })),
      ...workflows.map((w: any) => ({ slug: w.slug, name: w.name, description: w.description, type: 'workflow' as const })),
    ]);
  };

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const rows = await ados.db.getMessages(sessionId);
      const msgs: Message[] = [];
      for (const r of rows) {
        let steps: Array<{ name: string; timestamp: number }> | undefined;
        if (r.role === 'assistant') {
          try {
            const stepsJson = await ados.db.getSessionSetting(sessionId, `steps_${r.id}`);
            if (stepsJson) steps = JSON.parse(stepsJson);
          } catch {}
        }
        msgs.push({ id: r.id, role: r.role, content: r.content, steps });
      }
      setMessages(msgs);
      isFirstMessage.current = rows.length === 0;
      const contextTokens = msgs.reduce((sum, m) => sum + Math.ceil((typeof m.content === 'string' ? m.content.length : 100) / 4), 0);
      setTokenEstimate(prev => ({ ...prev, contextTokens }));
      // Feature 3: Auto-trigger recap if session has >10 messages and was idle >1h
      if (rows.length > 10 && !recapShownRef.current) {
        const lastMsg = rows[rows.length - 1];
        const lastTime = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : 0;
        if (lastTime && (Date.now() - lastTime) > 3600000) {
          recapShownRef.current = true;
          generateRecap(rows.slice(-20).map((r: any) => ({ role: r.role, content: r.content })));
        }
      }
    } catch { setMessages([]); }
    setLoadingMessages(false);
  };

  const debouncedModelSave = (model: string, reasoning: string) => {
    if (modelSaveTimer.current) clearTimeout(modelSaveTimer.current);
    modelSaveTimer.current = setTimeout(async () => {
      await ados.db.setSessionSetting(sessionId, 'model', model);
      await ados.db.setSessionSetting(sessionId, 'reasoning', reasoning);
    }, 300);
  };

  const handleTierSelect = (tier: ModelTier) => {
    setSelectedModel(tier.defaultModel);
    setReasoningLevel('none');
    debouncedModelSave(tier.defaultModel, 'none');
    setShowModelSelector(false);
  };

  const handleReasoningSelect = (level: typeof REASONING_LEVELS[0]) => {
    setReasoningLevel(level.id);
    const model = level.model || 'gpt-4.1-mini';
    setSelectedModel(model);
    debouncedModelSave(model, level.id);
    setShowReasoningMenu(false);
    setShowModelSelector(false);
  };

  const getSelectedTier = (): string => {
    if (reasoningLevel !== 'none') {
      const rl = REASONING_LEVELS.find(r => r.id === reasoningLevel);
      return rl?.name || 'Raciocínio';
    }
    let bestTier = 'Balanced';
    let bestLen = 0;
    for (const tier of MODEL_TIERS) {
      const match = tier.modelMatch.find(m => selectedModel === m || selectedModel.startsWith(m + '-'));
      if (match && match.length > bestLen) { bestTier = tier.name; bestLen = match.length; }
    }
    return bestTier;
  };

  // Feature 3: Generate recap
  const generateRecap = useCallback(async (recentMessages: Array<{ role: string; content: string }>) => {
    try {
      const recapMessages = [
        { role: 'system', content: 'Gere um resumo breve (3-5 bullet points) do que foi discutido nesta conversa. Foque em decisões, tarefas pendentes e contexto importante:' },
        { role: 'user', content: recentMessages.map(m => `${m.role}: ${m.content}`).join('\n') },
      ];
      const modelToUse = selectedModel || await ados.providers.getDefaultModel();
      const result = await ados.llm.invoke?.(recapMessages, modelToUse);
      if (result?.content) {
        setRecapContent(result.content);
        setShowRecap(true);
      }
    } catch { /* silently fail */ }
  }, [selectedModel]);

  // Feature 1: Run sub-agent
  const runSubAgent = useCallback(async (task: string) => {
    subAgentCounter.current += 1;
    const agentId = crypto.randomUUID();
    const agentName = `Agent-${subAgentCounter.current}`;
    const newAgent: SubAgent = { id: agentId, name: agentName, status: 'running', startTime: Date.now(), task };
    setSubAgents(prev => [...prev, newAgent]);
    setShowAgentPanel(true);

    try {
      const agentMessages = [
        { role: 'system', content: `Você é um sub-agente com a tarefa: ${task}. Complete a tarefa e retorne o resultado.` },
        { role: 'user', content: task },
      ];
      const modelToUse = selectedModel || await ados.providers.getDefaultModel();
      const result = await ados.llm.invoke?.(agentMessages, modelToUse);
      const content = result?.content || '';
      setSubAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'done', result: content } : a));
      // Add result as a collapsible message
      const agentResultMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: `[${agentName}] ✓ Tarefa concluída: ${task}\n\n${content}` };
      setMessages(prev => [...prev, agentResultMsg]);
      await ados.db.addMessage(agentResultMsg.id, sessionId, 'assistant', agentResultMsg.content);
    } catch (err: any) {
      setSubAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'error', result: err?.message || 'Erro desconhecido' } : a));
    }
  }, [selectedModel, sessionId]);

  // Feature 2: Compact messages
  const compactedContextRef = useRef<string | null>(null);

  const compactMessages = useCallback(async (skipPreview?: boolean) => {
    if (messages.length < 40 || compactionStatus === 'compacting') return;
    setCompactionStatus('compacting');
    try {
      const toCompact = messages.slice(0, messages.length - 10);
      const compactPrompt = [
        { role: 'system', content: 'Resuma a conversa abaixo em um parágrafo conciso, mantendo informações-chave, decisões e contexto importante:' },
        { role: 'user', content: toCompact.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[multimodal]'}`).join('\n') },
      ];
      const modelToUse = selectedModel || await ados.providers.getDefaultModel();
      const result = await ados.llm.invoke?.(compactPrompt, modelToUse);
      const summary = result?.content || '';
      if (summary) {
        if (!skipPreview && !compactedContextRef.current) {
          setCompactPreviewContent(summary);
          setShowCompactPreview(true);
          setCompactionStatus('idle');
          return;
        }
        setCompactionBackup(compactedContextRef.current);
        compactedContextRef.current = summary;
        const freed = toCompact.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 100), 0);
        const freedTokens = Math.ceil(freed / 4);
        setCompactionNotice(`Contexto compactado (~${freedTokens > 1000 ? `${(freedTokens / 1000).toFixed(1)}K` : freedTokens} tokens liberados)`);
        setCompactionCount(prev => prev + 1);
        setTimeout(() => setCompactionNotice(null), 4000);
      }
    } catch { /* silently fail */ }
    setCompactionStatus('idle');
  }, [messages, selectedModel, compactionStatus]);

  const confirmCompaction = useCallback(() => {
    if (compactPreviewContent) {
      setCompactionBackup(compactedContextRef.current);
      compactedContextRef.current = compactPreviewContent;
      setCompactionCount(prev => prev + 1);
      setCompactionNotice('Contexto compactado com sucesso');
      setTimeout(() => setCompactionNotice(null), 4000);
    }
    setShowCompactPreview(false);
    setCompactPreviewContent('');
  }, [compactPreviewContent]);

  const undoCompaction = useCallback(() => {
    if (compactionBackup !== null) {
      compactedContextRef.current = compactionBackup;
      setCompactionBackup(null);
      setCompactionNotice('Compactação desfeita');
      setTimeout(() => setCompactionNotice(null), 3000);
    }
  }, [compactionBackup]);

  const inputRef = useRef(input);
  inputRef.current = input;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const processQueue = useCallback(() => {
    console.log('[Queue Debug] processQueue called | processing:', processingQueueRef.current, '| queue:', messageQueueRef.current.length);
    if (processingQueueRef.current) return;
    const queue = messageQueueRef.current;
    if (queue.length > 0) {
      processingQueueRef.current = true;
      const next = queue[0];
      const remaining = queue.slice(1);
      messageQueueRef.current = remaining;
      setMessageQueue(remaining);
      console.log('[Queue Debug] Sending from queue:', next.slice(0, 30), '| remaining:', remaining.length);
      setTimeout(() => {
        processingQueueRef.current = false;
        sendMessageRef.current?.(next, true);
      }, 300);
    }
  }, []);

  const sendMessage = useCallback(async (overrideContent?: string, fromQueue?: boolean) => {
    const msgText = overrideContent || inputRef.current.trim();
    if (!msgText) return;

    // If loading and not being called from queue processing, enqueue
    if (loadingRef.current && !fromQueue) {
      setMessageQueue(prev => {
        const next = [...prev, msgText];
        messageQueueRef.current = next;
        return next;
      });
      setInput('');
      return;
    }

    // Feature 9: Estimate context tokens before send
    const contextTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0) + Math.ceil(msgText.length / 4);
    setTokenEstimate(prev => ({ ...prev, contextTokens }));

    // Feature 10: Detect /review command
    if (msgText.trim() === '/review') {
      setInput('');
      runUltraReview();
      return;
    }

    // Feature 1: Detect /agent command
    if (msgText.trim().startsWith('/agent ')) {
      const agentTask = msgText.trim().slice(7).trim();
      if (agentTask) {
        setInput('');
        runSubAgent(agentTask);
      }
      return;
    }

    // C4: Force specific agent via @agent prefix
    if (msgText.trim().startsWith('@') && routingEnabled) {
      const match = msgText.trim().match(/^@(\S+)\s+(.*)/s);
      if (match) {
        const agentName = match[1];
        const agent = availableAgents.find(a => a.name.toLowerCase() === agentName.toLowerCase());
        if (agent) {
          setInput('');
          setActiveAgent(agent.name);
          // Override routing to use this specific agent
          const overrideMsg = match[2];
          sendMessage(overrideMsg);
          return;
        }
      }
    }

    // Feature 1: Detect /agents command
    if (msgText.trim() === '/agents') {
      setInput('');
      setShowAgentPanel(true);
      return;
    }

    // Feature 3: Detect /recap command
    if (msgText.trim() === '/recap') {
      setInput('');
      const recent = messages.slice(-20).map(m => ({ role: m.role, content: m.content }));
      generateRecap(recent);
      return;
    }

    // Feature 6: Detect /goal command
    if (msgText.trim().startsWith('/goal ')) {
      const goalText = msgText.trim().slice(6).trim();
      if (goalText) {
        setActiveGoal({ text: goalText, turns: 0, startTime: Date.now() });
        setInput('');
        const goalMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: `Meta definida: ${goalText}` };
        setMessages((prev) => [...prev, goalMsg]);
        await ados.db.addMessage(goalMsg.id, sessionId, 'assistant', goalMsg.content);
      }
      return;
    }

    // Feature 30: Handle quoted message
    let finalMsgText = msgText;
    if (quotedMessage) {
      finalMsgText = `> ${quotedMessage.content.slice(0, 200)}\n\n${msgText}`;
      setQuotedMessage(null);
    }

    // Feature 32: Search command
    if (msgText.trim() === '/search' || msgText.trim().startsWith('/search ')) {
      setInput('');
      setShowSearch(true);
      const q = msgText.trim().slice(8).trim();
      if (q) setSearchQuery(q);
      return;
    }

    // Feature 35: Branch command
    if (msgText.trim().startsWith('/branch ')) {
      const msgId = msgText.trim().slice(8).trim();
      const idx = messages.findIndex(m => m.id === msgId);
      if (idx >= 0) {
        const branchId = crypto.randomUUID();
        setBranches(prev => ({ ...prev, [branchId]: messages.slice(0, idx + 1) }));
        setActiveBranch(branchId);
      }
      setInput('');
      return;
    }

    // Feature 5: Plan mode — generate plan instead of executing
    if (planMode && !currentPlan) {
      setInput('');
      setLoading(true);
      const planPrompt = [
        { role: 'system', content: 'Crie um plano passo-a-passo para: ' + msgText + '. Retorne apenas os passos numerados, um por linha.' },
        { role: 'user', content: msgText },
      ];
      const modelToUse = selectedModel || await ados.providers.getDefaultModel();
      try {
        const result = await ados.llm.invoke?.(planPrompt, modelToUse);
        const text = result?.content || '';
        const steps = text.split('\n')
          .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter((l: string) => l.length > 0)
          .map((step: string) => ({ step, status: 'pending' as const }));
        setCurrentPlan(steps.length > 0 ? steps : [{ step: msgText, status: 'pending' }]);
      } catch {
        setCurrentPlan([{ step: msgText, status: 'pending' }]);
      }
      setLoading(false);
      return;
    }

    // A5: Auto-switch to Smart if complex message detected
    if (effortLevel === 'low' && msgText.length > 200 && COMPLEXITY_SIGNALS.test(msgText)) {
      setEffortLevel('high');
      setSelectedModel('gpt-4.1');
      ados.db.setSessionSetting(sessionId, 'effort', 'high');
      ados.db.setSessionSetting(sessionId, 'model', 'gpt-4.1');
    }

    let msgContent: any = msgText;
    let displayContent = msgText;
    if (attachments.length > 0) {
      const hasImages = attachments.some(a => a.type === 'image');
      if (hasImages) {
        const contentBlocks: any[] = [];
        for (const att of attachments) {
          if (att.type === 'image') {
            contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: att.mimeType, data: att.content } });
          } else {
            contentBlocks.push({ type: 'text', text: `--- Anexo: ${att.name} ---\n${att.content}` });
          }
        }
        contentBlocks.push({ type: 'text', text: msgText });
        msgContent = contentBlocks;
      } else {
        const attText = attachments.map(a => `--- Anexo: ${a.name} ---\n${a.content}`).join('\n\n');
        msgContent = `${msgText}\n\n${attText}`;
      }
      displayContent = msgText + '\n\n' + attachments.map(a => a.type === 'image' ? `![${a.name}](data:${a.mimeType || 'image/png'};base64,${a.content})` : `📎 ${a.name}`).join('\n');
      setAttachments([]);
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: displayContent, createdAt: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamContent('');
    setLastErrorMsg(null);

    await ados.db.addMessage(userMsg.id, sessionId, 'user', userMsg.content);

    if (isFirstMessage.current) {
      const title = userMsg.content.slice(0, 50) + (userMsg.content.length > 50 ? '...' : '');
      onUpdateTitle(title);
      isFirstMessage.current = false;
    }

    if (listenersRegistered.current) {
      await ados.llm.stop();
      await new Promise(r => setTimeout(r, 100));
    }
    ados.llm.removeStreamListeners();
    listenersRegistered.current = true;
    const initialSteps = [{ name: 'thinking', timestamp: Date.now() }];
    setToolSteps(initialSteps);
    toolStepsRef.current = initialSteps;
    setToolStartTime(Date.now());

    let accumulated = '';

    ados.llm.onToolCall((data: any) => {
      setToolSteps((prev) => {
        const next = [...prev, { name: data.name, timestamp: Date.now() }];
        toolStepsRef.current = next;
        ados.db.setSessionSetting?.(sessionId, 'partial_steps', JSON.stringify(next)).catch(() => {});
        return next;
      });
    });

    ados.llm.onStreamChunk((chunk: string) => {
      accumulated += chunk;
      if (accumulated.length > MAX_STREAM_CHARS) {
        accumulated = accumulated.slice(-MAX_STREAM_CHARS);
      }
      setStreamContent(accumulated);
      setToolSteps((prev) => {
        if (prev.length === 1 && prev[0].name === 'thinking') {
          return [];
        }
        return prev;
      });
    });

    ados.llm.onStreamEnd(async () => {
      const finalSteps = toolStepsRef.current;
      const hasToolCalls = finalSteps.filter(s => s.name !== 'thinking').length > 0;
      setLastReasoningUsed(reasoningLevel !== 'none' ? reasoningLevel : null);
      if (accumulated.trim() || hasToolCalls) {
        const content = accumulated.trim() || `[${finalSteps.map(s => s.name).filter(n => n !== 'thinking').join(' → ')}]`;
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content,
          steps: hasToolCalls ? [...finalSteps] : undefined,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await ados.db.addMessage(assistantMsg.id, sessionId, 'assistant', content);
        if (hasToolCalls) {
          ados.db.setSessionSetting?.(sessionId, `steps_${assistantMsg.id}`, JSON.stringify(finalSteps)).catch(() => {});
        }
      }
      const approxTokens = Math.ceil(accumulated.length / 4);
      setOutputTokens(prev => prev + approxTokens);
      setTokenEstimate(prev => ({ tokens: prev.tokens + approxTokens, cost: prev.cost + approxTokens * 0.000001, contextTokens: prev.contextTokens }));
      setStreamContent('');
      setToolSteps([]);
      toolStepsRef.current = [];
      setLoading(false);
      listenersRegistered.current = false;
      ados.llm.removeStreamListeners();
      ados.db.setSessionSetting?.(sessionId, 'partial_steps', '').catch(() => {});
      setActiveGoal(prev => prev ? { ...prev, turns: prev.turns + 1 } : null);
      // Auto-compaction: by message count OR context usage > 70%
      setMessages(currentMsgs => {
        const contextChars = currentMsgs.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 100), 0);
        const contextTokensEst = Math.ceil(contextChars / 4);
        const maxContext = selectedModel.includes('4.1') ? 1000000 : selectedModel.startsWith('o') ? 200000 : 128000;
        if (contextTokensEst > maxContext * 0.8) {
          setContextWarning(true);
        } else {
          setContextWarning(false);
        }
        if (currentMsgs.length > 40 || contextTokensEst > maxContext * 0.7) {
          setTimeout(() => compactMessages(true), 0);
        }
        return currentMsgs;
      });
      // Feature 31: Save partial response on crash recovery
      ados.db.setSessionSetting?.(sessionId, 'last_stream_content', accumulated.slice(0, 5000)).catch(() => {});
      // Feature 40: Generate follow-up suggestions
      if (accumulated.length > 100) {
        const lastLines = accumulated.slice(-500);
        const suggestions: string[] = [];
        if (/\d+[\.\)]\s/.test(lastLines)) suggestions.push('Detalhe o ponto mais importante');
        if (/código|function|class|import/.test(lastLines)) suggestions.push('Explique esse código');
        if (/alternativa|opção|possibilidade/.test(lastLines)) suggestions.push('Compare as alternativas');
        if (suggestions.length === 0) suggestions.push('Continue', 'Resuma em tópicos', 'Dê um exemplo prático');
        setFollowUpSuggestions(suggestions.slice(0, 3));
      }
      // Process next message in queue
      processQueue();
    });

    ados.llm.onStreamError(async (error: string) => {
      const agentLabel = activeAgent ? ` [${activeAgent}]` : '';
      const errorContent = `Erro${agentLabel}: ${error}`;
      const errorMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: errorContent };
      setMessages((prev) => [...prev, errorMsg]);
      setStreamContent('');
      setLoading(false);
      setLastErrorMsg(msgContent);
      setActiveAgent(null);
      await ados.db.addMessage(errorMsg.id, sessionId, 'assistant', errorContent);
      ados.llm.removeStreamListeners();
      processQueue();
    });

    const llmUserMsg = { ...userMsg, content: msgContent };
    const goalPrefix = activeGoal ? [{ role: 'system', content: `Seu objetivo é: ${activeGoal.text}. Continue trabalhando até completar.` }] : [];
    // Cross-menu 3: Inject user preferences into system prompt
    const prefsPrefix = userPrefs.name ? [{ role: 'system', content: `O usuario se chama ${userPrefs.name}${userPrefs.role ? `, cargo: ${userPrefs.role}` : ''}.${userPrefs.notes ? ` Contexto: ${userPrefs.notes}` : ''}` }] : [];
    let historyMessages: Array<{ role: string; content: any }>;
    if (compactedContextRef.current && messages.length > 10) {
      const recentMsgs = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      historyMessages = [{ role: 'system', content: `[Contexto anterior resumido]\n${compactedContextRef.current}` }, ...recentMsgs];
    } else {
      historyMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    }
    const allMessages = [...prefsPrefix, ...goalPrefix, ...historyMessages, { role: llmUserMsg.role, content: llmUserMsg.content }];
    let modelToUse = selectedModel || await ados.providers.getDefaultModel();

    if (routingEnabled) {
      try {
        const decision = await ados.agents.route(userMsg.content);
        if (decision.agentId && decision.agentId !== 'direct') {
          const agent = await ados.agents.get(decision.agentId);
          if (agent) {
            modelToUse = agent.model;
            setActiveAgent(agent.name);
            setToolSteps((prev) => {
              const next = [{ name: `delegated:${agent.name}`, timestamp: Date.now() }, ...prev.filter(s => s.name !== 'thinking')];
              toolStepsRef.current = next;
              return next;
            });
          }
        } else { setActiveAgent(null); }
      } catch { setActiveAgent(null); }
    } else { setActiveAgent(null); }

    // Validação: checar se provider do modelo tem API key
    const provider = modelToUse.startsWith('gpt-') || modelToUse.startsWith('o') ? 'openai'
      : modelToUse.startsWith('claude-') ? 'anthropic'
      : modelToUse.startsWith('gemini-') ? 'google' : 'openrouter';
    const hasKey = await ados.llm.testKey?.(provider).catch(() => false);
    if (hasKey === false) {
      const noKeyMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: `⚠️ API key não configurada para ${provider}. Vá em Configurações > Providers para adicionar.` };
      setMessages((prev) => [...prev, noKeyMsg]);
      await ados.db.addMessage(noKeyMsg.id, sessionId, 'assistant', noKeyMsg.content);
      setLoading(false);
      setToolSteps([]); toolStepsRef.current = [];
      ados.llm.removeStreamListeners();
      return;
    }

    const mcpTools = await ados.mcp.getAllTools();
    // Feature 4: Apply effort level settings
    const effortConfig = EFFORT_CONFIG[effortLevel];
    const streamOptions = { maxTokens: effortConfig.maxTokens, temperature: effortConfig.temperature };
    const result = await ados.llm.stream(allMessages, modelToUse, mcpTools.length > 0 ? mcpTools : undefined, streamOptions);

    if (result.error && !accumulated) {
      const errorMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: `Erro: ${result.error}` };
      setMessages((prev) => [...prev, errorMsg]);
      setLoading(false);
      await ados.db.addMessage(errorMsg.id, sessionId, 'assistant', `Erro: ${result.error}`);
    }
  }, [messages, sessionId, onUpdateTitle, routingEnabled, attachments, selectedModel, effortLevel, runSubAgent, generateRecap, compactMessages, userPrefs]);

  sendMessageRef.current = sendMessage;

  const handleStop = useCallback(async () => {
    await ados.llm.stop();
    setLoading(false);
    setToolSteps([]);
    toolStepsRef.current = [];
    ados.llm.removeStreamListeners();
  }, []);

  const runUltraReview = useCallback(async () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;
    setReviewRunning(true);
    setReviewResult(null);

    const agents = [
      { agent: 'Seguranca', systemPrompt: 'Voce e um especialista em seguranca de software. Analise o codigo abaixo e liste vulnerabilidades, riscos de seguranca e recomendacoes. Responda APENAS com bullet points curtos em portugues.' },
      { agent: 'Performance', systemPrompt: 'Voce e um especialista em performance de software. Analise o codigo abaixo e liste problemas de performance, gargalos e otimizacoes. Responda APENAS com bullet points curtos em portugues.' },
      { agent: 'Legibilidade', systemPrompt: 'Voce e um especialista em qualidade de codigo e legibilidade. Analise o codigo abaixo e liste problemas de legibilidade, naming, complexidade e sugestoes de refatoracao. Responda APENAS com bullet points curtos em portugues.' },
    ];

    const results: Array<{ agent: string; findings: string[] }> = [];

    for (const a of agents) {
      try {
        const reviewMessages = [
          { role: 'system', content: a.systemPrompt },
          { role: 'user', content: lastAssistant.content },
        ];
        const modelToUse = selectedModel || await ados.providers.getDefaultModel();
        // Use a simple non-streaming call if available, otherwise collect stream
        let response = '';
        const result = await ados.llm.invoke?.(reviewMessages, modelToUse);
        if (result?.content) {
          response = result.content;
        } else {
          // Fallback: use stream and collect
          response = await new Promise<string>((resolve) => {
            let acc = '';
            ados.llm.removeStreamListeners();
            ados.llm.onStreamChunk((chunk: string) => { acc += chunk; });
            ados.llm.onStreamEnd(() => { resolve(acc); ados.llm.removeStreamListeners(); });
            ados.llm.onStreamError(() => { resolve(acc || 'Erro ao analisar'); ados.llm.removeStreamListeners(); });
            ados.llm.stream(reviewMessages, modelToUse);
          });
        }
        const findings = response.split('\n').map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
        results.push({ agent: a.agent, findings });
      } catch {
        results.push({ agent: a.agent, findings: ['Erro ao executar review'] });
      }
    }

    setReviewResult(results);
    setReviewRunning(false);
  }, [messages, selectedModel]);

  const handleRetry = () => {
    if (!lastErrorMsg) return;
    setMessages((prev) => prev.slice(0, -1));
    const retryContent = lastErrorMsg;
    setLastErrorMsg(null);
    sendMessage(retryContent);
  };

  // Feature 34: Resend last user message
  const handleResend = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) sendMessage(lastUser.content);
  };

  // Feature 39: Pin/unpin message
  const handlePinMessage = (msgId: string) => {
    setPinnedMessages(prev => prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]);
  };

  // Feature 30: Quote message
  const handleQuoteMessage = (msg: Message) => {
    setQuotedMessage({ id: msg.id, content: msg.content.slice(0, 300) });
  };

  // Feature 35: Create branch from message
  const handleBranch = (msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx >= 0) {
      const branchId = crypto.randomUUID();
      setBranches(prev => ({ ...prev, [branchId]: [...messages.slice(0, idx + 1)] }));
      setActiveBranch(branchId);
    }
  };

  // Feature 36: Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setShowScrollBottom(false);
  };

  const executePlan = useCallback(async () => {
    if (!currentPlan) return;
    for (let i = 0; i < currentPlan.length; i++) {
      setCurrentPlan(prev => prev!.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));
      await sendMessage(currentPlan[i].step);
      await new Promise(r => {
        const check = setInterval(() => {
          if (!loading) { clearInterval(check); r(undefined); }
        }, 200);
      });
      setCurrentPlan(prev => prev!.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
    }
  }, [currentPlan, sendMessage, loading]);

  const handleInputChange = (value: string) => {
    setInput(value);
    const match = value.match(/(?:^|\s)([/@])(\S*)$/);
    if (match) {
      setAutocomplete({ trigger: match[1] as '/' | '@', query: match[2] });
    } else {
      setAutocomplete(null);
    }
  };

  const handleAutocompleteSelect = (item: { slug: string; name: string; type: 'skill' | 'workflow' }) => {
    const trigger = item.type === 'skill' ? '/' : '@';
    const replaced = input.replace(/(?:^|\s)([/@])\S*$/, (m) => {
      const prefix = m.startsWith(' ') ? ' ' : '';
      return `${prefix}${trigger}${item.slug} `;
    });
    setInput(replaced);
    setAutocomplete(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('[Queue Debug] Enter pressed | loading:', loadingRef.current, '| input:', input.trim().slice(0, 30), '| autocomplete:', !!autocomplete, '| queue:', messageQueueRef.current.length);
      if (autocomplete) { setAutocomplete(null); return; }
      if (!input.trim()) return;
      if (loadingRef.current) {
        const text = input.trim();
        messageQueueRef.current = [...messageQueueRef.current, text];
        setMessageQueue([...messageQueueRef.current]);
        setInput('');
        setAutocomplete(null);
        console.log('[Queue Debug] Enqueued:', text.slice(0, 30), '| queue now:', messageQueueRef.current.length);
      } else {
        sendMessage();
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        setAttachProgress({ name: file.name, progress: -1 });
        setTimeout(() => setAttachProgress(null), 3000);
        return;
      }
      if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
        setAttachProgress({ name: file.name, progress: 0 });
        const reader = new FileReader();
        reader.onprogress = (ev) => { if (ev.lengthComputable) setAttachProgress({ name: file.name, progress: Math.round((ev.loaded / ev.total) * 100) }); };
        reader.onload = () => { setAttachments(prev => [...prev, { name: file.name, content: reader.result as string }]); setAttachProgress(null); };
        reader.onerror = () => setAttachProgress(null);
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          setAttachments(prev => [...prev, { name: file.name, content: base64, type: 'image', mimeType: file.type }]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setAttachments(prev => [...prev, { name: `pasted-image.${file.type.split('/')[1]}`, content: base64, type: 'image', mimeType: file.type }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleSuggestionClick = (suggestion: typeof SUGGESTIONS[0]) => {
    setInput(suggestion.title);
    sendMessage(suggestion.title);
  };

  const showWelcome = messages.length === 0 && !loading;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-surface-0"
      data-session={sessionId}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Cross-menu 4: Share session button */}
      <div className="shrink-0 px-4 py-1.5 flex items-center justify-end gap-2 border-b border-default">
        <button
          onClick={shareSession}
          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg transition-colors ${isSessionShared ? 'text-green-400 bg-green-500/10' : 'text-muted hover:text-brand-400 hover:bg-surface-2'}`}
          title="Compartilhar sessão"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
          </svg>
          {isSessionShared ? 'Compartilhada' : 'Compartilhar'}
        </button>
      </div>
      {activeGoal && (
        <div className="shrink-0 px-4 py-2 bg-brand-600/10 border-b border-brand-500/20 flex items-center justify-between">
          <span className="text-xs font-medium text-brand-500">
            🎯 Meta: {activeGoal.text} — {activeGoal.turns} turnos, {goalElapsed}
          </span>
          <button
            onClick={() => setActiveGoal(null)}
            className="text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-lg hover:bg-green-500/20 transition-colors"
          >
            ✓ Meta concluída
          </button>
        </div>
      )}
      {/* Cross-menu 1: Label badges */}
      {sessionLabels.length > 0 && (
        <div className="shrink-0 px-4 py-1.5 bg-surface-1 border-b border-default flex items-center gap-1.5 flex-wrap relative">
          {sessionLabels.map((label, i) => (
            <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-brand-600/10 text-brand-400 rounded-full">{label}</span>
          ))}
          <button onClick={() => setShowLabelPicker(!showLabelPicker)} className="px-1.5 py-0.5 text-[10px] text-muted hover:text-brand-400 bg-surface-2 rounded-full transition-colors">+</button>
          {showLabelPicker && (
            <div className="absolute top-full left-4 mt-1 bg-surface-1 border border-default rounded-xl shadow-xl z-50 p-2 w-48">
              {allLabels.filter(l => !sessionLabels.includes(l.name || l)).map((l, i) => (
                <button
                  key={i}
                  onClick={async () => {
                    const labelName = l.name || l;
                    const updated = [...sessionLabels, labelName];
                    setSessionLabels(updated);
                    await ados.db.updateSession(sessionId, { labels: updated });
                    setShowLabelPicker(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-[11px] text-secondary hover:bg-surface-2 rounded-lg transition-colors"
                >{l.name || l}</button>
              ))}
              {allLabels.filter(l => !sessionLabels.includes(l.name || l)).length === 0 && (
                <span className="text-[10px] text-muted px-2">Nenhuma label disponivel</span>
              )}
            </div>
          )}
        </div>
      )}
      {/* Feature 32: Search overlay */}
      {showSearch && (
        <div className="shrink-0 px-4 py-2 bg-surface-1 border-b border-default flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }}
            placeholder="Buscar nas mensagens..."
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none"
          />
          <span className="text-[10px] text-muted">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</span>
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} className="text-muted hover:text-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}
      {/* Feature 39: Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <div className="shrink-0 px-4 py-1.5 bg-yellow-500/5 border-b border-yellow-500/20 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-yellow-500 shrink-0">
            <path d="M12 2v10l4.5 4.5M12 12L7.5 16.5"/>
          </svg>
          <span className="text-[10px] text-yellow-500 font-medium">{pinnedMessages.length} mensage{pinnedMessages.length !== 1 ? 'ns' : 'm'} fixada{pinnedMessages.length !== 1 ? 's' : ''}</span>
          <button onClick={() => setPinnedMessages([])} className="text-[10px] text-yellow-500/70 hover:text-yellow-400 ml-auto">Limpar</button>
        </div>
      )}
      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 relative" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
        {loading && (
          <div className="absolute top-0 left-0 right-0 z-10 h-0.5 bg-surface-2 overflow-hidden">
            <div className="h-full w-1/3 bg-brand-500 rounded-full" style={{ animation: 'progress-bar 1.2s ease-in-out infinite' }} />
          </div>
        )}
        {loadingMessages ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl ${i % 2 === 0 ? 'bg-brand-600/10 w-48' : 'bg-surface-2 w-64'} h-12`} />
              </div>
            ))}
          </div>
        ) : showWelcome ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-5 shadow-lg animate-pulse">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-primary mb-2">O que vamos fazer hoje?</h1>
              <p className="text-sm text-muted mb-8">Escolha uma sugestão ou digite o que precisar</p>

              <div className="grid grid-cols-1 gap-2.5 mt-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="flex items-center gap-3.5 px-4 py-3.5 bg-surface-1 border border-default rounded-xl text-left hover:border-brand-500/40 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-surface-2 border border-default flex items-center justify-center shrink-0 group-hover:border-brand-500/30 transition-colors">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted group-hover:text-brand-400 transition-colors">
                        <path d={s.icon}/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary">{s.title}</div>
                      <div className="text-xs text-muted">{s.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
              {/* UI/UX 6: Dicas rapidas collapsible */}
              <div className="mt-4">
                <button onClick={() => setShowTips(!showTips)} className="text-xs text-muted hover:text-secondary flex items-center gap-1 mx-auto">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={showTips ? '6 9 12 15 18 9' : '9 18 15 12 9 6'} /></svg>
                  Dicas rapidas
                </button>
                {showTips && (
                  <div className="mt-2 space-y-1.5 text-left bg-surface-1 border border-default rounded-xl p-3">
                    <p className="text-[11px] text-secondary">• Use <kbd className="px-1 py-0.5 bg-surface-2 rounded text-[10px]">Ctrl+R</kbd> para alternar raciocinio</p>
                    <p className="text-[11px] text-secondary">• Arraste arquivos para anexar ao chat</p>
                    <p className="text-[11px] text-secondary">• Use <kbd className="px-1 py-0.5 bg-surface-2 rounded text-[10px]">Ctrl+/</kbd> para ver todos os atalhos</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Feature 3: Recap card */}
            {showRecap && recapContent && (
              <div className="mb-4 mx-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-400">Resumo da sessão</span>
                  <button onClick={() => setShowRecap(false)} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">Fechar</button>
                </div>
                <div className="text-xs text-secondary whitespace-pre-wrap">{recapContent}</div>
              </div>
            )}
            {/* Context warning */}
            {contextWarning && compactionStatus !== 'compacting' && (
              <div className="mb-3 mx-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                <span className="text-[10px] text-red-400">Contexto quase cheio ({'>'}80%). Considere compactar para evitar erros.</span>
                <button onClick={() => compactMessages()} className="text-[10px] font-medium text-red-400 hover:text-red-300 underline ml-auto">Compactar</button>
              </div>
            )}
            {/* Compaction preview */}
            {showCompactPreview && compactPreviewContent && (
              <div className="mb-3 mx-2 bg-surface-1 border border-brand-500/20 rounded-xl p-3">
                <div className="text-[11px] font-semibold text-primary mb-1">Preview da compactação</div>
                <div className="text-[10px] text-secondary whitespace-pre-wrap max-h-32 overflow-y-auto mb-2">{compactPreviewContent}</div>
                <div className="flex gap-2">
                  <button onClick={confirmCompaction} className="px-2.5 py-1 text-[10px] font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700">Confirmar</button>
                  <button onClick={() => { setShowCompactPreview(false); setCompactPreviewContent(''); }} className="px-2.5 py-1 text-[10px] font-medium bg-surface-2 text-secondary rounded-lg hover:bg-surface-3">Cancelar</button>
                </div>
              </div>
            )}
            {/* Feature 2: Compaction notice */}
            {compactionNotice && (
              <div className="mb-3 mx-2 flex items-center gap-2 px-3 py-2 bg-surface-2 border border-default rounded-lg">
                <span className="text-[10px] text-muted">{compactionNotice}</span>
                {compactionBackup !== null && (
                  <button onClick={undoCompaction} className="text-[10px] text-brand-400 hover:text-brand-300 font-medium ml-auto">Desfazer</button>
                )}
              </div>
            )}
            {compactionStatus === 'compacting' && (
              <div className="mb-3 mx-2 px-3 py-2 bg-surface-2 border border-default rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] text-muted">Compactando contexto...</span>
                </div>
                <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full animate-[compactProgress_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                </div>
              </div>
            )}
            {messages.filter((msg) => msg.role !== 'system').map((msg, idx, arr) => (
              <div key={msg.id} className={`group/msg relative ${searchResults.includes(msg.id) ? 'ring-1 ring-brand-500/40 rounded-lg' : ''} ${pinnedMessages.includes(msg.id) ? 'border-l-2 border-yellow-500/50 pl-2' : ''}`} style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                {/* UI/UX 1: Selection checkbox */}
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedMsgIds.has(msg.id)}
                    onChange={() => setSelectedMsgIds(prev => { const next = new Set(prev); if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id); return next; })}
                    className="absolute left-0 top-3 z-20 w-4 h-4 accent-brand-500 cursor-pointer"
                  />
                )}
                {/* UI/UX 7: Timestamp on hover */}
                {msg.createdAt && (
                  <span className={`absolute top-2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-[9px] text-muted ${msg.role === 'user' ? 'right-14' : 'left-9'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="flex justify-start mb-2">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 shrink-0" />
                      <ToolSteps steps={msg.steps} isRunning={false} startTime={msg.steps[0]?.timestamp || 0} />
                    </div>
                  </div>
                )}
                {msg.role === 'assistant' && idx === arr.length - 1 && lastReasoningUsed && (
                  <div className="flex justify-start mb-1 ml-9">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-600/10 text-purple-400 text-[9px] font-medium rounded">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 5.5V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 13.5 5 11.5 5 9a7 7 0 0 1 7-7z"/></svg>
                      {lastReasoningUsed === 'max' ? 'Raciocínio máximo' : 'Raciocínio'}
                    </span>
                  </div>
                )}
                <MessageBubble role={msg.role as 'user' | 'assistant'} content={msg.content} />
                {/* Message action buttons */}
                <div className="absolute top-1 right-1 opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 bg-surface-1 border border-default rounded-lg px-1 py-0.5 shadow-sm z-10">
                  <button onClick={() => setQuotedMessage({ id: msg.id, content: msg.content })} className="p-1 text-muted hover:text-brand-400 transition-colors" title="Citar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20"/></svg>
                  </button>
                  <button onClick={() => setPinnedMessages(prev => prev.includes(msg.id) ? prev.filter(id => id !== msg.id) : [...prev, msg.id])} className={`p-1 transition-colors ${pinnedMessages.includes(msg.id) ? 'text-yellow-500' : 'text-muted hover:text-yellow-500'}`} title="Fixar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={pinnedMessages.includes(msg.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 17v5M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1V3H8v3h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/></svg>
                  </button>
                  {msg.role === 'user' && (
                    <button onClick={() => { setInput(msg.content); }} className="p-1 text-muted hover:text-brand-400 transition-colors" title="Reenviar">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    </button>
                  )}
                  {msg.role === 'assistant' && (
                    <button onClick={() => saveToBrain(msg.content)} className="p-1 text-muted hover:text-green-400 transition-colors" title="Salvar para Brain">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 5.5V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 13.5 5 11.5 5 9a7 7 0 0 1 7-7z"/><path d="M10 21h4"/></svg>
                    </button>
                  )}
                  {msg.role === 'assistant' && telegramConfigured && (
                    <button onClick={() => forwardToTelegram(msg.content)} className="p-1 text-muted hover:text-blue-400 transition-colors" title="Enviar para Telegram">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                    </button>
                  )}
                  <button onClick={() => { navigator.clipboard.writeText(msg.content); showCopyToast(); }} className="p-1 text-muted hover:text-brand-400 transition-colors" title="Copiar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
              </div>
            ))}
            {loading && toolSteps.length > 0 && (
              <div className="flex justify-start mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0">A</div>
                  <div className="max-w-[70%]">
                    <ToolSteps steps={toolSteps} isRunning={loading} startTime={toolStartTime} />
                  </div>
                </div>
              </div>
            )}
            {loading && toolSteps.length === 0 && (
              <div className="flex justify-start mb-4">
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0">A</div>
                  <div>
                    {activeAgent && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                        <span className="text-[10px] text-brand-400 font-medium">Roteado para {activeAgent}</span>
                        {subAgents.filter(a => a.status === 'done').length > 0 && (
                          <span className="text-[9px] bg-brand-600/10 text-brand-400 px-1 rounded">{subAgents.filter(a => a.status === 'done').length} sub-tarefas</span>
                        )}
                      </div>
                    )}
                    <div className="bg-surface-2 px-3 py-2 rounded-2xl rounded-tl-md">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot" />
                        <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot [animation-delay:0.2s]" />
                        <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Retry button after error */}
            {lastErrorMsg && !loading && messages.length > 0 && messages[messages.length - 1]?.content.startsWith('Erro:') && (
              <div className="flex justify-start mb-4 ml-9">
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-500 bg-brand-600/10 hover:bg-brand-600/20 rounded-lg transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Tentar novamente
                </button>
              </div>
            )}
            {/* UltraReview banner and results */}
            {(reviewRunning || reviewResult) && (
              <div className="mb-4 mx-2">
                <div className="rounded-2xl p-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 animate-gradient-x">
                  <div className="bg-surface-1 rounded-[14px] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-primary">UltraReview</span>
                      {reviewRunning && <span className="text-xs text-muted animate-pulse">Analisando...</span>}
                    </div>
                    {reviewResult && reviewResult.map((r) => {
                      const color = r.agent === 'Seguranca' ? 'red' : r.agent === 'Performance' ? 'yellow' : 'blue';
                      const isCollapsed = reviewCollapsed[r.agent] ?? false;
                      return (
                        <div key={r.agent} className="mb-2">
                          <button
                            onClick={() => setReviewCollapsed(prev => ({ ...prev, [r.agent]: !isCollapsed }))}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold ${
                              color === 'red' ? 'bg-red-500/10 text-red-400' :
                              color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400' :
                              'bg-blue-500/10 text-blue-400'
                            }`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points={isCollapsed ? '9 18 15 12 9 6' : '6 9 12 15 18 9'} />
                            </svg>
                            {r.agent}
                            <span className="text-[10px] font-normal opacity-75 ml-auto">{r.findings.length} achados</span>
                          </button>
                          {!isCollapsed && (
                            <ul className="mt-1 ml-4 space-y-0.5">
                              {r.findings.map((f, i) => (
                                <li key={i} className="text-xs text-secondary flex items-start gap-1.5">
                                  <span className="mt-1.5 w-1 h-1 rounded-full bg-muted shrink-0" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {/* Feature 1: Sub-agent panel */}
            {showAgentPanel && subAgents.length > 0 && (
              <div className="mb-4 mx-2 bg-surface-1 border border-default rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-primary">Sub-agentes</span>
                  <button onClick={() => setShowAgentPanel(false)} className="text-[10px] text-muted hover:text-secondary font-medium">Fechar</button>
                </div>
                <div className="space-y-2">
                  {subAgents.map(agent => {
                    const elapsed = Math.floor((Date.now() - agent.startTime) / 1000);
                    const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`;
                    return (
                      <div key={agent.id} className="bg-surface-2 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            agent.status === 'running' ? 'bg-yellow-500 animate-pulse' :
                            agent.status === 'done' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-xs font-medium text-primary">{agent.name}</span>
                          <span className="text-[10px] text-muted ml-auto">{elapsedStr}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            agent.status === 'running' ? 'bg-yellow-500/10 text-yellow-400' :
                            agent.status === 'done' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {agent.status === 'running' ? 'Executando' : agent.status === 'done' ? 'Concluído' : 'Erro'}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted mt-1 truncate">{agent.task}</div>
                        {agent.status !== 'running' && agent.result && (
                          <details className="mt-2">
                            <summary className="text-[10px] text-brand-400 cursor-pointer hover:text-brand-300">Ver resultado</summary>
                            <div className="text-xs text-secondary mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">{agent.result}</div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
        {/* Feature 36: Scroll to bottom button */}
        {showScrollBottom && (
          <button
            onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setAutoScroll(true); }}
            className="absolute bottom-4 right-6 p-2 bg-surface-1 border border-default rounded-full shadow-lg hover:bg-surface-2 transition-all z-10"
            title="Ir para o final"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </button>
        )}
      </div>

      {/* Feature 40: Follow-up suggestions */}
      {followUpSuggestions.length > 0 && !loading && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            {followUpSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setInput(s); setFollowUpSuggestions([]); }}
                className="shrink-0 px-3 py-1.5 text-xs text-secondary bg-surface-1 border border-default rounded-full hover:border-brand-500/40 hover:text-brand-400 transition-all"
              >
                {s}
              </button>
            ))}
            <button onClick={() => setFollowUpSuggestions([])} className="text-[10px] text-muted hover:text-secondary shrink-0">×</button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4 pt-2 relative">
        {currentPlan && (
          <div className="mb-3 bg-surface-1 border border-default rounded-xl p-4">
            <div className="text-xs font-semibold text-primary mb-2">Plano</div>
            <div className="space-y-1.5">
              {currentPlan.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {s.status === 'done' ? (
                    <span className="w-4 h-4 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[10px]">✓</span>
                  ) : s.status === 'running' ? (
                    <span className="w-4 h-4 rounded-full bg-brand-500/20 border border-brand-500 animate-pulse" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-default" />
                  )}
                  <span className={`${s.status === 'done' ? 'text-muted line-through' : 'text-secondary'}`}>{s.step}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={executePlan}
                disabled={loading}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white transition-colors"
              >
                Executar plano
              </button>
              <button
                onClick={() => setCurrentPlan(null)}
                className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-medium text-secondary transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* B5: Suggest reasoning for complex input */}
        {input.length > 100 && COMPLEXITY_SIGNALS.test(input) && reasoningLevel === 'none' && (
          <div className="mb-2 px-3 py-1.5 bg-purple-600/5 border border-purple-500/20 rounded-lg flex items-center justify-between">
            <span className="text-[10px] text-purple-400">Pergunta complexa detectada — ativar raciocínio?</span>
            <button
              onClick={() => { const rl = REASONING_LEVELS[1]; handleReasoningSelect(rl); }}
              className="text-[10px] font-medium text-purple-400 hover:text-purple-300 underline"
            >
              Ativar
            </button>
          </div>
        )}
        {/* B6: Warning reasoning + context almost full */}
        {reasoningLevel !== 'none' && tokenEstimate.contextTokens > 0 && (() => {
          const maxCtx = selectedModel.includes('4.1') ? 1000000 : selectedModel.startsWith('o') ? 200000 : 128000;
          return tokenEstimate.contextTokens / maxCtx > 0.7;
        })() && (
          <div className="mb-2 px-3 py-1.5 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            <span className="text-[10px] text-yellow-400">Raciocínio ativo com contexto {'>'}70% — pode causar truncamento. Considere compactar ou desativar raciocínio.</span>
          </div>
        )}

        {autocomplete && (
          <AutocompletePopup
            trigger={autocomplete.trigger}
            query={autocomplete.query}
            items={acItems}
            onSelect={handleAutocompleteSelect}
            onClose={() => setAutocomplete(null)}
          />
        )}

        {attachProgress && (
          <div className="flex items-center gap-2 mb-2 px-1">
            {attachProgress.progress === -1 ? (
              <span className="text-xs text-red-400">⚠️ {attachProgress.name} excede 10MB — não anexado</span>
            ) : (
              <>
                <span className="text-xs text-muted">{attachProgress.name}</span>
                <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden max-w-[200px]">
                  <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${attachProgress.progress}%` }} />
                </div>
                <span className="text-[10px] text-muted">{attachProgress.progress}%</span>
              </>
            )}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-surface-2 border border-default rounded-lg px-2.5 py-1.5 text-xs text-secondary">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="truncate max-w-[120px]">{att.name}</span>
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-500 ml-1">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Mode selector popup */}
        {showModelSelector && (
          <div ref={modelSelectorRef} className="absolute bottom-full left-4 mb-2 bg-surface-1 border border-default rounded-xl shadow-xl z-50 overflow-hidden w-64">
            <div className="py-2">
              {UNIFIED_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={async () => {
                    setEffortLevel(mode.id);
                    setSelectedModel(mode.model);
                    setShowModelSelector(false);
                    await ados.db.setSessionSetting(sessionId, 'effort', mode.id);
                    await ados.db.setSessionSetting(sessionId, 'model', mode.model);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-primary">{mode.label}</span>
                      <span className="text-[10px] text-muted">{mode.id === 'low' ? '$' : mode.id === 'medium' ? '$$' : '$$$'}</span>
                      <span className="text-[9px] text-muted">{mode.id === 'low' ? '~1s' : mode.id === 'medium' ? '~3s' : '~8s'}</span>
                      {mode.id === 'medium' && <span className="text-[8px] font-semibold bg-brand-600/10 text-brand-400 px-1 rounded">recomendado</span>}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{mode.description}</div>
                  </div>
                  {effortLevel === mode.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary shrink-0 ml-3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Queue indicator */}
        {messageQueue.length > 0 && (
          <div className="mb-2 bg-brand-600/10 border border-brand-500/20 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand-500">
                  <path d="M3 6h18M3 12h18M3 18h18"/>
                </svg>
                <span className="text-[11px] font-medium text-brand-500">Fila: {messageQueue.length} {messageQueue.length === 1 ? 'mensagem' : 'mensagens'}</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {messageQueue.length > 1 && (
                  <button
                    onClick={() => {
                      const merged = messageQueue.join('\n\n');
                      setMessageQueue([merged]);
                      messageQueueRef.current = [merged];
                    }}
                    className="text-[10px] text-muted hover:text-brand-400 transition-colors"
                    title="Juntar todas em uma mensagem"
                  >
                    merge
                  </button>
                )}
                {messageQueue.length > 0 && (
                  <span className="text-[9px] text-muted">~{messageQueue.length * 5}s</span>
                )}
                {!loading && messageQueue.length > 0 && (
                  <button
                    onClick={() => {
                      const burst = messageQueue.join('\n\n---\n\n');
                      setMessageQueue([]);
                      messageQueueRef.current = [];
                      sendMessage(burst);
                    }}
                    className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors"
                    title="Enviar todas como contexto único"
                  >
                    burst
                  </button>
                )}
                {loading && (
                  <button
                    onClick={async () => {
                      await handleStop();
                      setTimeout(() => processQueue(), 100);
                    }}
                    className="text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors"
                    title="Parar atual e enviar próxima"
                  >
                    pular
                  </button>
                )}
                <button
                  onClick={() => { setMessageQueue([]); messageQueueRef.current = []; }}
                  className="text-[10px] text-muted hover:text-red-400 transition-colors"
                  title="Limpar fila"
                >
                  limpar
                </button>
              </div>
            </div>
            <div className="px-3 pb-2 space-y-1">
              {messageQueue.map((msg, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData('text/plain'));
                    if (isNaN(from) || from === i) return;
                    const updated = [...messageQueue];
                    const [item] = updated.splice(from, 1);
                    updated.splice(i, 0, item);
                    setMessageQueue(updated);
                    messageQueueRef.current = updated;
                  }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing ${editingQueueIdx === i ? 'bg-brand-600/10 border border-brand-500/30' : 'bg-surface-2/50'}`}>
                  <span className="text-[10px] text-muted w-4 shrink-0">{i + 1}</span>
                  {editingQueueIdx === i ? (
                    <input
                      type="text"
                      autoFocus
                      value={msg}
                      onChange={(e) => {
                        const updated = [...messageQueue];
                        updated[i] = e.target.value;
                        setMessageQueue(updated);
                        messageQueueRef.current = updated;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingQueueIdx(null);
                        if (e.key === 'Escape') {
                          const updated = [...messageQueue];
                          updated[i] = editingQueueOriginal.current;
                          setMessageQueue(updated);
                          messageQueueRef.current = updated;
                          setEditingQueueIdx(null);
                        }
                      }}
                      className="text-[11px] text-secondary bg-transparent border-none focus:outline-none flex-1 min-w-0"
                    />
                  ) : (
                    <span className="text-[11px] text-secondary truncate flex-1 min-w-0">{msg}</span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {editingQueueIdx === i ? (
                      <>
                        <button
                          onClick={() => setEditingQueueIdx(null)}
                          className="p-0.5 text-green-400 hover:text-green-300 transition-colors"
                          title="Confirmar edição"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...messageQueue];
                            updated[i] = editingQueueOriginal.current;
                            setMessageQueue(updated);
                            messageQueueRef.current = updated;
                            setEditingQueueIdx(null);
                          }}
                          className="p-0.5 text-red-400 hover:text-red-300 transition-colors"
                          title="Cancelar edição"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6L18 18"/></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            const item = messageQueue[i];
                            const updated = messageQueue.filter((_, idx) => idx !== i);
                            setMessageQueue(updated);
                            messageQueueRef.current = updated;
                            setInput(item);
                          }}
                          className="p-0.5 text-muted hover:text-brand-400 transition-colors"
                          title="Enviar agora"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            if (i === 0) return;
                            const updated = [...messageQueue];
                            [updated[i - 1], updated[i]] = [updated[i], updated[i - 1]];
                            setMessageQueue(updated);
                            messageQueueRef.current = updated;
                          }}
                          className={`p-0.5 transition-colors ${i === 0 ? 'text-surface-3 cursor-not-allowed' : 'text-muted hover:text-brand-400'}`}
                          title="Mover para cima"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12L12 5L19 12"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            if (i === messageQueue.length - 1) return;
                            const updated = [...messageQueue];
                            [updated[i], updated[i + 1]] = [updated[i + 1], updated[i]];
                            setMessageQueue(updated);
                            messageQueueRef.current = updated;
                          }}
                          className={`p-0.5 transition-colors ${i === messageQueue.length - 1 ? 'text-surface-3 cursor-not-allowed' : 'text-muted hover:text-brand-400'}`}
                          title="Mover para baixo"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5V19"/><path d="M19 12L12 19L5 12"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            editingQueueOriginal.current = msg;
                            setEditingQueueIdx(i);
                          }}
                          className="p-0.5 text-muted hover:text-brand-400 transition-colors"
                          title="Editar"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            const updated = messageQueue.filter((_, idx) => idx !== i);
                            setMessageQueue(updated);
                            messageQueueRef.current = updated;
                          }}
                          className="p-0.5 text-muted hover:text-red-400 transition-colors"
                          title="Remover"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6L18 18"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Feature 30: Quote preview */}
        {quotedMessage && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-surface-2 border-l-2 border-brand-500 rounded-lg">
            <span className="text-[10px] text-muted">Respondendo:</span>
            <span className="text-xs text-secondary truncate flex-1">{quotedMessage.content.slice(0, 80)}{quotedMessage.content.length > 80 ? '...' : ''}</span>
            <button onClick={() => setQuotedMessage(null)} className="text-muted hover:text-red-400 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-end gap-2 bg-surface-1 border border-default rounded-2xl px-4 py-3 shadow-card focus-within:shadow-card-hover focus-within:border-brand-500/50 transition-all">
          {/* Attachment button */}
          <button
            className="p-1.5 text-muted hover:text-secondary rounded-lg hover:bg-surface-2 transition-colors shrink-0"
            title="Anexar arquivo"
            onClick={() => {
              const inp = document.createElement('input');
              inp.type = 'file';
              inp.multiple = true;
              inp.accept = '.txt,.json,.csv,.md,.js,.ts,.py,.html,.css';
              inp.onchange = (e: any) => {
                Array.from(e.target.files || []).forEach((file: any) => {
                  const reader = new FileReader();
                  reader.onload = () => { setAttachments(prev => [...prev, { name: file.name, content: reader.result as string }]); };
                  reader.readAsText(file);
                });
              };
              inp.click();
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={loading ? "Digite para enfileirar (Enter para adicionar à fila)..." : "Digite sua mensagem..."}
            rows={1}
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted resize-none outline-none max-h-32 leading-relaxed"
          />

          <VoiceInput onTranscript={(text) => setInput(prev => prev + text)} disabled={loading} />

          {/* Feature 38: Live token counter */}
          {liveTokenCount > 0 && (
            <span className="text-[9px] text-muted shrink-0 tabular-nums">~{liveTokenCount}t</span>
          )}

          <button
            onClick={() => setPlanMode(!planMode)}
            className={`relative p-1.5 rounded-lg transition-colors shrink-0 ${planMode ? 'text-brand-500 bg-brand-600/10' : 'text-muted hover:text-secondary hover:bg-surface-2'}`}
            title="Modo plano"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><path d="M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path d="M9 14l2 2 4-4"/>
            </svg>
            {planMode && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-blue-500" />}
          </button>

          {loading && (
            <button
              onClick={handleStop}
              className="p-2 bg-red-600 hover:bg-red-700 rounded-xl text-white transition-all shrink-0"
              title="Parar geração"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => {
              if (!input.trim()) return;
              if (loadingRef.current) {
                const text = input.trim();
                messageQueueRef.current = [...messageQueueRef.current, text];
                setMessageQueue([...messageQueueRef.current]);
                setInput('');
              } else {
                sendMessage();
              }
            }}
            disabled={!input.trim()}
            className={`p-2 ${loading ? 'bg-brand-600/60 hover:bg-brand-600' : 'bg-brand-600 hover:bg-brand-700'} disabled:bg-surface-3 disabled:text-muted rounded-xl text-white transition-all shrink-0`}
            title={loading ? 'Adicionar à fila' : 'Enviar'}
          >
            {loading && input.trim() ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Bottom bar: workspace + model + tools */}
        <div className="flex items-center justify-between mt-2.5 px-1">
          <div className="flex items-center gap-3">
            {/* Unified mode trigger */}
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              <span className="font-medium">{UNIFIED_MODES.find(m => m.id === effortLevel)?.label || 'Balanced'}</span>
              <span className="text-[10px] text-muted">{selectedModel}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {/* Reasoning toggle */}
            <div className="relative">
              <button
                onClick={(e) => {
                  if (e.shiftKey) {
                    setShowReasoningMenu(!showReasoningMenu);
                  } else {
                    const next = reasoningLevel === 'none' ? 'medium' : reasoningLevel === 'medium' ? 'max' : 'none';
                    const rl = REASONING_LEVELS.find(r => r.id === next);
                    handleReasoningSelect(rl || REASONING_LEVELS[0]);
                  }
                }}
                onContextMenu={(e) => { e.preventDefault(); setShowReasoningMenu(!showReasoningMenu); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  reasoningLevel !== 'none' ? 'bg-purple-600/10 text-purple-400' : 'text-muted hover:text-secondary'
                }`}
                title="Click: alternar raciocínio | Shift+Click ou direito: menu"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={reasoningLevel !== 'none' ? 'drop-shadow-[0_0_3px_rgba(168,85,247,0.6)]' : ''}>
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.5 4.5-3 5.5V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.5C6.5 13.5 5 11.5 5 9a7 7 0 0 1 7-7z"/><path d="M10 21h4"/>
                </svg>
                {reasoningLevel !== 'none' ? REASONING_LEVELS.find(r => r.id === reasoningLevel)?.name || 'Raciocínio' : 'Raciocínio'}
              </button>
              {showReasoningMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-surface-1 border border-default rounded-xl shadow-xl z-50 overflow-hidden w-64">
                  <div className="py-2">
                    {REASONING_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => handleReasoningSelect(level)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-primary">{level.name}</div>
                          <div className="text-[11px] text-muted mt-0.5">{level.description}</div>
                        </div>
                        {reasoningLevel === level.id && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary shrink-0 ml-3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Multi-agent toggle */}
            <div className="relative">
              <button
                onClick={async () => { const v = !routingEnabled; setRoutingEnabled(v); await ados.agents.setRouting(v); }}
                onContextMenu={(e) => { e.preventDefault(); setShowAgentPopup(!showAgentPopup); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                  routingEnabled ? 'bg-brand-600/10 text-brand-500' : 'text-muted hover:text-secondary'
                }`}
                title="Click: toggle | Direito: ver agentes"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Multi-Agent
              </button>
              {showAgentPopup && (
                <div className="absolute bottom-full left-0 mb-2 bg-surface-1 border border-default rounded-xl shadow-xl z-50 p-3 w-56">
                  <div className="text-[11px] font-semibold text-primary mb-2">Agentes disponíveis</div>
                  {availableAgents.length === 0 ? (
                    <div className="text-[10px] text-muted">Nenhum agente configurado</div>
                  ) : (
                    <div className="space-y-1.5">
                      {availableAgents.map(a => (
                        <div key={a.id} className="flex items-center justify-between text-[10px]">
                          <span className="text-secondary font-medium">{a.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted">{a.model}</span>
                            <span className="text-[9px] text-muted">{a.model.startsWith('gpt-4.1-nano') ? '~1s' : a.model.startsWith('gpt-4.1-mini') ? '~3s' : a.model.startsWith('o') ? '~15s' : '~5s'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowAgentPopup(false)} className="mt-2 text-[10px] text-muted hover:text-secondary">Fechar</button>
                </div>
              )}
            </div>

            {/* Feature 2: Compact now button */}
            {messages.length > 20 && (
              <button
                onClick={() => compactMessages()}
                disabled={compactionStatus === 'compacting'}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-muted hover:text-secondary transition-colors disabled:opacity-50"
                title="Compactar contexto agora"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 14h6v6H4zM14 4h6v6h-6zM4 4h6v6H4zM14 14h6v6h-6z"/>
                </svg>
                Compactar
                {compactionCount > 0 && (
                  <span className="ml-0.5 px-1 py-0 bg-surface-3 text-muted rounded text-[9px]">{compactionCount}</span>
                )}
              </button>
            )}
          </div>

          {/* Connected tools + token/context estimate */}
          <div className="flex items-center gap-2">
            {tokenEstimate.contextTokens > 0 && (() => {
              const MODEL_CONTEXTS: Record<string, number> = { 'gpt-4.1': 1000000, 'gpt-4.1-mini': 1000000, 'gpt-4.1-nano': 1000000, 'gpt-5.5': 1000000, 'o3': 200000, 'o4-mini': 200000, 'claude-sonnet-4-5': 200000, 'claude-haiku-4-5': 200000 };
              const MAX_CONTEXT = MODEL_CONTEXTS[selectedModel] || 128000;
              const maxLabel = MAX_CONTEXT >= 1000000 ? '1M' : `${MAX_CONTEXT / 1000}K`;
              const pct = Math.min((tokenEstimate.contextTokens / MAX_CONTEXT) * 100, 100);
              const strokeColor = pct > 75 ? '#ef4444' : pct > 50 ? '#eab308' : '#22c55e';
              const textColor = pct > 75 ? '#ef4444' : pct > 50 ? '#eab308' : '#22c55e';
              const radius = 12;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (pct / 100) * circumference;
              return (
                <div className="relative flex items-center gap-1">
                  <button
                    onClick={() => setShowContextBreakdown(!showContextBreakdown)}
                    className="flex items-center"
                    title={pct > 75 ? `Contexto quase cheio — considere compactar (${Math.round(pct)}%)` : `${Math.round(pct)}% do contexto usado (${tokenEstimate.contextTokens > 1000 ? `${(tokenEstimate.contextTokens / 1000).toFixed(1)}K` : tokenEstimate.contextTokens} / ${maxLabel} tokens) | Custo sessão: $${tokenEstimate.cost.toFixed(4)}`}
                  >
                    <svg width="28" height="28" className={`shrink-0 transition-transform duration-300 ${pct > 75 ? 'animate-pulse' : ''} ${compactionStatus === 'compacting' ? 'scale-75 opacity-50' : ''}`}>
                      <circle cx="14" cy="14" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface-3" />
                      <circle cx="14" cy="14" r={radius} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        transform="rotate(-90 14 14)" className="transition-all duration-500" />
                      <text x="14" y="14" textAnchor="middle" dominantBaseline="central" fill={textColor} fontSize="7" fontWeight="600">
                        {Math.round(pct)}%
                      </text>
                    </svg>
                  </button>
                  {showContextBreakdown && (() => {
                    const avgTokensPerMsg = messages.length > 0 ? tokenEstimate.contextTokens / messages.length : 500;
                    const remaining = MAX_CONTEXT - tokenEstimate.contextTokens;
                    const msgsUntilFull = avgTokensPerMsg > 0 ? Math.floor(remaining / avgTokensPerMsg) : 999;
                    return (
                      <div className="absolute bottom-full right-0 mb-2 bg-surface-1 border border-default rounded-xl shadow-xl z-50 p-3 w-56">
                        <div className="text-[11px] font-semibold text-primary mb-2">Breakdown do Contexto</div>
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex justify-between"><span className="text-muted">Mensagens</span><span className="text-secondary">{messages.length}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Input tokens</span><span className="text-secondary">{tokenEstimate.contextTokens > 1000 ? `${(tokenEstimate.contextTokens / 1000).toFixed(1)}K` : tokenEstimate.contextTokens}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Output tokens</span><span className="text-secondary">{outputTokens > 1000 ? `${(outputTokens / 1000).toFixed(1)}K` : outputTokens}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Max contexto</span><span className="text-secondary">{maxLabel}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Projeção</span><span className="text-secondary">~{msgsUntilFull} msgs até 100%</span></div>
                          <div className="flex justify-between"><span className="text-muted">Compactado</span><span className="text-secondary">{compactedContextRef.current ? 'Sim' : 'Não'}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Compactações</span><span className="text-secondary">{compactionCount}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Custo sessão</span><span className="text-secondary">${tokenEstimate.cost.toFixed(4)}</span></div>
                          <div className="flex justify-between"><span className="text-muted">Modelo</span><span className="text-secondary">{selectedModel}</span></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
            {tokenEstimate.cost > 0 && (
              <span className="text-[10px] text-muted">
                ${tokenEstimate.cost.toFixed(4)} sessao
              </span>
            )}
            {connectedTools.length > 0 && (
              <span className="text-[10px] text-muted">
                {connectedTools.length} ferramenta{connectedTools.length !== 1 ? 's' : ''} conectada{connectedTools.length !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-[10px] text-muted">
              JVOS · Enter para enviar
            </span>
            {/* UI/UX 9: Export conversation */}
            <button
              onClick={() => {
                const md = messages.map(m => `**${m.role === 'user' ? 'Voce' : 'Assistente'}:**\n${m.content}`).join('\n\n---\n\n');
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `conversa-${sessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.md`;
                a.click(); URL.revokeObjectURL(url);
              }}
              className="p-0.5 text-muted hover:text-brand-400 transition-colors"
              title="Exportar conversa como Markdown"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            {/* UI/UX 1: Select mode toggle */}
            <button
              onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedMsgIds(new Set()); }}
              className={`p-0.5 transition-colors ${selectMode ? 'text-brand-500' : 'text-muted hover:text-brand-400'}`}
              title="Selecionar mensagens"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            </button>
            <button
              onClick={() => ados.browser.open('https://google.com', sessionId)}
              className="p-0.5 text-muted hover:text-brand-400 transition-colors"
              title="Abrir navegador integrado"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* UI/UX 2: Keyframes for animated entrance */}
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* UI/UX 1: Floating bulk actions toolbar */}
      {selectMode && selectedMsgIds.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-1 border border-default rounded-xl px-4 py-2 shadow-xl z-50">
          <span className="text-xs text-muted mr-2">{selectedMsgIds.size} selecionada{selectedMsgIds.size !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { setMessages(prev => prev.filter(m => !selectedMsgIds.has(m.id))); setSelectedMsgIds(new Set()); }}
            className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
          >Deletar</button>
          <button
            onClick={() => {
              const selected = messages.filter(m => selectedMsgIds.has(m.id));
              const md = selected.map(m => `**${m.role}:** ${m.content}`).join('\n\n');
              const blob = new Blob([md], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `selecionadas-${Date.now()}.md`; a.click(); URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 text-xs font-medium text-brand-400 bg-brand-600/10 rounded-lg hover:bg-brand-600/20 transition-colors"
          >Exportar</button>
          <button
            onClick={() => { setPinnedMessages(prev => [...new Set([...prev, ...Array.from(selectedMsgIds)])]); setSelectedMsgIds(new Set()); }}
            className="px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-500/10 rounded-lg hover:bg-yellow-500/20 transition-colors"
          >Fixar</button>
        </div>
      )}

      {/* UI/UX 4: Copy toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg shadow-xl z-[100] animate-[fadeSlideIn_0.2s_ease-out]">
          ✓ Copiado!
        </div>
      )}
      {/* Cross-menu 2: Brain toast */}
      {brainToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg shadow-xl z-[100] animate-[fadeSlideIn_0.2s_ease-out]">
          Salvo no Brain
        </div>
      )}
      {/* Cross-menu 4: Share toast */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg shadow-xl z-[100] animate-[fadeSlideIn_0.2s_ease-out]">
          Sessão compartilhada com sucesso
        </div>
      )}

      {/* UI/UX 5: Keyboard shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowShortcuts(false)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 w-96 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-primary">Atalhos de Teclado</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-muted hover:text-secondary"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <span className="text-muted">Ctrl+F</span><span className="text-secondary">Buscar</span>
              <span className="text-muted">Ctrl+R</span><span className="text-secondary">Alternar raciocinio</span>
              <span className="text-muted">Ctrl+1</span><span className="text-secondary">Modo Fast</span>
              <span className="text-muted">Ctrl+2</span><span className="text-secondary">Modo Balanced</span>
              <span className="text-muted">Ctrl+3</span><span className="text-secondary">Modo Smart</span>
              <span className="text-muted">Ctrl+E</span><span className="text-secondary">Editar ultima na fila</span>
              <span className="text-muted">Ctrl+/</span><span className="text-secondary">Este painel</span>
              <span className="text-muted">Escape</span><span className="text-secondary">Parar geracao</span>
              <span className="text-muted">Enter</span><span className="text-secondary">Enviar / Enfileirar</span>
              <span className="text-muted">Shift+Enter</span><span className="text-secondary">Nova linha</span>
            </div>
          </div>
        </div>
      )}

      {/* UI/UX 10: Onboarding tooltips */}
      {!onboardingDone && messages.length === 0 && !loading && (
        <div className="fixed inset-0 pointer-events-none z-[90]">
          <div className="absolute bottom-[72px] left-[200px] pointer-events-auto">
            <div className="bg-brand-600 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg max-w-[180px]">
              Use o seletor de raciocinio para respostas mais profundas
              <button onClick={dismissOnboarding} className="block mt-1 text-[9px] underline opacity-80">Entendi</button>
            </div>
          </div>
          <div className="absolute bottom-[72px] left-[380px] pointer-events-auto">
            <div className="bg-brand-600 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg max-w-[180px]">
              Mensagens enviadas durante processamento entram na fila
              <button onClick={dismissOnboarding} className="block mt-1 text-[9px] underline opacity-80">Entendi</button>
            </div>
          </div>
          <div className="absolute bottom-[72px] right-[120px] pointer-events-auto">
            <div className="bg-brand-600 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg max-w-[180px]">
              O circulo mostra uso do contexto — compacte quando ficar vermelho
              <button onClick={dismissOnboarding} className="block mt-1 text-[9px] underline opacity-80">Entendi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
