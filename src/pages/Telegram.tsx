import { useState, useEffect, useRef, useCallback } from 'react';

const ados = (window as any).ados;

interface TelegramChat {
  id: number;
  title: string;
  type: string;
  username?: string;
}

interface TelegramMessage {
  id: number;
  chatId: number;
  chatTitle: string;
  chatType: string;
  from: { id: number; name: string; username?: string } | null;
  text: string;
  date: number;
  // UI/UX improvements
  status?: 'sending' | 'delivered' | 'read' | 'failed';
  deliveredAt?: number;
  readAt?: number;
  reactions?: Record<string, number>;
  replyTo?: { text: string; from: string };
}

type Tab = 'inbox' | 'send' | 'pairings' | 'config';

interface Pairing {
  chatId: number;
  sessionId: string;
  direction: string;
  createdAt: string;
}

interface Session {
  id: string;
  title: string;
}

interface QuickReply {
  label: string;
  text: string;
}

interface ScheduledMessage {
  id: string;
  chatId: number;
  text: string;
  scheduledAt: number; // timestamp ms
  filePath?: string;
  caption?: string;
}

interface AutoReplyConfig {
  enabled: boolean;
  message: string;
  startHour: number;
  endHour: number;
  keywords: string[];
}

interface BotConfig {
  token: string;
  username: string;
  firstName: string;
}

interface PinnedMessage {
  id: string;
  messageKey: string;
  chatId: number;
  text: string;
  from: string;
  date: number;
  pinnedAt: number;
}

interface ConversationMetrics {
  totalSent: number;
  totalReceived: number;
  avgResponseTimeMs: number;
}

interface ConnectionStatus {
  connected: boolean;
  latencyMs: number | null;
  uptimeSeconds: number;
  lastError: string | null;
  lastErrorAt: number | null;
}

interface InlineCommand {
  command: string;
  description: string;
}

const INLINE_COMMANDS: InlineCommand[] = [
  { command: '/status', description: 'Mostra status da conexao' },
  { command: '/help', description: 'Lista comandos disponiveis' },
  { command: '/clear', description: 'Limpa mensagens da sessao atual' },
];

export default function Telegram() {
  const [tab, setTab] = useState<Tab>('config');
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [botInfo, setBotInfo] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'sent' | 'error' | ''>('');
  const [configStatus, setConfigStatus] = useState('');
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pairChat, setPairChat] = useState<number | null>(null);
  const [pairSession, setPairSession] = useState('');
  const [pairDirection, setPairDirection] = useState('both');
  const [inboxSearch, setInboxSearch] = useState('');
  const [confirmRemoveToken, setConfirmRemoveToken] = useState(false);
  const [confirmUnpair, setConfirmUnpair] = useState<{ chatId: number; sessionId: string } | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // #1 Notificação de nova mensagem
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadCountRef = useRef(0);
  // #2 Preview de markdown
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  // #6 Persistência de mensagens
  const [persistedMessages, setPersistedMessages] = useState<TelegramMessage[]>([]);
  // #7 Rate limiting
  const [lastSendTime, setLastSendTime] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  // #8 Reconexão automática
  const [reconnecting, setReconnecting] = useState(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // === NEW FEATURES STATE ===

  // Feature 1: Envio de mídia
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feature 2: Respostas rápidas
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-quick-replies');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Feature 3: Filtros no inbox
  const [inboxTimeFilter, setInboxTimeFilter] = useState<'today' | '7d' | '30d' | 'all'>('all');

  // Feature 4: Notificação desktop (permission state)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // Feature 5: Agendamento de mensagem
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-scheduled');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Feature 6: Auto-resposta
  const [autoReply, setAutoReply] = useState<AutoReplyConfig>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-auto-reply');
      return stored ? JSON.parse(stored) : { enabled: false, message: '', startHour: 0, endHour: 24, keywords: [] };
    } catch { return { enabled: false, message: '', startHour: 0, endHour: 24, keywords: [] }; }
  });
  const [autoReplyKeywordInput, setAutoReplyKeywordInput] = useState('');

  // Feature 7: Exportar conversa
  const [exportFeedback, setExportFeedback] = useState(false);

  // Feature 8: Multi-bot
  const [bots, setBots] = useState<BotConfig[]>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-bots');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [activeBotIndex, setActiveBotIndex] = useState(0);
  const [newBotTokenInput, setNewBotTokenInput] = useState('');
  const [addingBot, setAddingBot] = useState(false);

  // === NEW FEATURES (batch 2) STATE ===

  // Feature B1: Inline commands
  const [showCommandList, setShowCommandList] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Feature B2: Conversation metrics
  const [metrics, setMetrics] = useState<ConversationMetrics>({ totalSent: 0, totalReceived: 0, avgResponseTimeMs: 0 });

  // Feature B3: Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-pinned');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [showPinnedSection, setShowPinnedSection] = useState(true);

  // Feature B4: Formatting toolbar
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const sendTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Feature B5: Connection status detailed
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    latencyMs: null,
    uptimeSeconds: 0,
    lastError: null,
    lastErrorAt: null,
  });
  const pollingStartRef = useRef<number | null>(null);

  // Feature B6: Groups/Channels target type
  const [targetType, setTargetType] = useState<'all' | 'private' | 'group' | 'channel'>('all');

  // Feature B7: Paginated history
  const [historyPage, setHistoryPage] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const MESSAGES_PER_PAGE = 50;

  // Feature B8: Keyboard shortcuts (no extra state needed, handled via useEffect)

  // === Feature 30: Contact groups ===
  const [contactGroups, setContactGroups] = useState<Record<string, number[]>>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-contact-groups');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupManager, setShowGroupManager] = useState(false);

  // === Feature 33: Broadcast lists ===
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | string>('all');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState('');

  // === Feature 34: Bot commands manager ===
  const [botCommands, setBotCommands] = useState<Array<{ command: string; description: string }>>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-bot-commands');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newCommandInput, setNewCommandInput] = useState('');
  const [newCommandDesc, setNewCommandDesc] = useState('');

  // === Feature 35: Webhook integration ===
  const [webhooks, setWebhooks] = useState<Array<{ id: string; keyword: string; url: string; enabled: boolean }>>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-webhooks');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [newWebhookKeyword, setNewWebhookKeyword] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  // === Feature 37: Backup conversations ===
  const [showBackupRestore, setShowBackupRestore] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');

  // === UI/UX Improvements State ===

  // #1 Message status indicators + #3 Read receipts (handled via message.status field)
  // #2 Typing indicator
  const [isTyping, setIsTyping] = useState(false);

  // #5 Emoji reactions (stored in message.reactions field)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // #6 Quote/Reply threading
  const [replyingTo, setReplyingTo] = useState<{ text: string; from: string; msgKey: string } | null>(null);

  // #7 Search in conversations
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // #8 Contact avatars (computed, no state needed)

  // #9 Unread badges per chat
  const [lastReadPerChat, setLastReadPerChat] = useState<Record<number, number>>(() => {
    try {
      const stored = localStorage.getItem('ados-telegram-last-read');
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  // #10 Delivery status timeline (tooltip on hover, no extra state needed beyond message fields)

  // === Cross-menu integration: Forward to Chat + Brain context ===
  const [forwardToast, setForwardToast] = useState<string | null>(null);
  const [brainContextHints, setBrainContextHints] = useState<Record<string, boolean>>({});

  // Pair code modal
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [pairBotUsername, setPairBotUsername] = useState('');
  const [pairExpiry, setPairExpiry] = useState(0);
  const [pairCodeGenerating, setPairCodeGenerating] = useState(false);
  const [pairSuccess, setPairSuccess] = useState(false);
  const pairTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleGeneratePairCode = useCallback(async () => {
    if (!pairSession && sessions.length === 0) return;
    const targetSession = pairSession || sessions[0]?.id;
    if (!targetSession) return;
    setPairCodeGenerating(true);
    setPairSuccess(false);
    try {
      const result = await ados.telegram?.generatePairCode?.(targetSession);
      if (result?.success) {
        setPairCode(result.code);
        setPairBotUsername(result.botUsername);
        setPairExpiry(result.expiresIn);
        setShowPairModal(true);
        // Countdown timer
        if (pairTimerRef.current) clearInterval(pairTimerRef.current);
        let remaining = result.expiresIn;
        pairTimerRef.current = setInterval(() => {
          remaining--;
          setPairExpiry(remaining);
          if (remaining <= 0) {
            if (pairTimerRef.current) clearInterval(pairTimerRef.current);
            setPairCode('');
          }
        }, 1000);
      }
    } catch {}
    setPairCodeGenerating(false);
  }, [pairSession, sessions]);

  // Listen for pair success
  useEffect(() => {
    ados.telegram?.onPairSuccess?.((data: any) => {
      setPairSuccess(true);
      setPairCode('');
      if (pairTimerRef.current) clearInterval(pairTimerRef.current);
      // Reload pairings
      ados.db?.getTelegramPairings?.().then((p: any) => { if (p) setPairings(p); });
    });
    return () => { if (pairTimerRef.current) clearInterval(pairTimerRef.current); };
  }, []);

  useEffect(() => {
    checkToken();
    // #6 Load persisted messages from localStorage
    const stored = localStorage.getItem('ados-telegram-messages');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPersistedMessages(parsed);
        setMessages(parsed);
        parsed.forEach((m: TelegramMessage) => seenMessageIds.current.add(`${m.chatId}-${m.id}`));
      } catch {}
    }
    return () => { ados.telegram.removeListeners(); if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); };
  }, []);

  // Feature 35: Fire webhooks on incoming message (declared before useEffect that uses it)
  const fireWebhooks = useCallback((msg: TelegramMessage) => {
    webhooks.forEach(wh => {
      if (!wh.enabled) return;
      if (msg.text.toLowerCase().includes(wh.keyword.toLowerCase())) {
        fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: msg.chatId, from: msg.from, text: msg.text, date: msg.date }),
        }).catch(() => {});
      }
    });
  }, [webhooks]);

  useEffect(() => {
    if (hasToken) {
      loadBotInfo();
      loadChats();
      checkPolling();
      loadPairings();
      // Listen for pairing updates from bot commands
      ados.telegram.onPairingUpdated?.(() => {
        loadPairings();
        loadChats();
      });
    }
  }, [hasToken]);

  useEffect(() => {
    if (!hasToken) return;
    ados.telegram.onMessage((msg: TelegramMessage) => {
      const key = `${msg.chatId}-${msg.id}`;
      if (seenMessageIds.current.has(key)) return;
      seenMessageIds.current.add(key);
      setMessages(prev => {
        const updated = [...prev, msg];
        // #6 Persist to localStorage (keep last 500 messages, TTL 30 days)
        const cutoff = Date.now() / 1000 - 30 * 24 * 3600;
        const toStore = updated.filter(m => m.date > cutoff).slice(-500);
        localStorage.setItem('ados-telegram-messages', JSON.stringify(toStore));
        return updated;
      });
      // #1 Unread counter
      if (tab !== 'inbox') {
        setUnreadCount(prev => prev + 1);
      }
      // Feature 4: Desktop notification
      if (tab !== 'inbox' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Telegram', { body: msg.text.slice(0, 100) });
      }
      // Feature 6: Auto-reply
      handleAutoReply(msg);
      // Feature 35: Fire webhooks
      fireWebhooks(msg);

      if (!chats.find(c => c.id === msg.chatId)) {
        setChats(prev => [...prev, { id: msg.chatId, title: msg.chatTitle, type: msg.chatType }]);
      }
      // #8 Reset reconnect attempts on successful message
      reconnectAttemptRef.current = 0;
    });
    return () => { ados.telegram.removeListeners(); };
  }, [hasToken, chats, tab, autoReply, fireWebhooks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // #1 Reset unread when switching to inbox
  useEffect(() => {
    if (tab === 'inbox') setUnreadCount(0);
  }, [tab]);

  // #7 Rate limiting cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lastSendTime + 2000 - Date.now()) / 1000));
      setCooldownRemaining(remaining);
    }, 200);
    return () => clearInterval(timer);
  }, [cooldownRemaining, lastSendTime]);

  // Feature 5: Scheduled messages checker (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setScheduledMessages(prev => {
        const due = prev.filter(sm => sm.scheduledAt <= now);
        const remaining = prev.filter(sm => sm.scheduledAt > now);
        due.forEach(sm => {
          ados.telegram.send(sm.chatId, sm.text);
        });
        if (due.length > 0) {
          localStorage.setItem('ados-telegram-scheduled', JSON.stringify(remaining));
        }
        return remaining;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // #8 Reconexão automática
  const attemptReconnect = async () => {
    if (!hasToken) return;
    setReconnecting(true);
    const delays = [5000, 15000, 30000, 60000];
    const delay = delays[Math.min(reconnectAttemptRef.current, delays.length - 1)];
    reconnectTimerRef.current = setTimeout(async () => {
      try {
        const result = await ados.telegram.startPolling();
        if (result.success) {
          setPolling(true);
          setReconnecting(false);
          reconnectAttemptRef.current = 0;
        } else {
          reconnectAttemptRef.current++;
          attemptReconnect();
        }
      } catch {
        reconnectAttemptRef.current++;
        attemptReconnect();
      }
    }, delay);
  };

  // Feature 6: Auto-reply handler
  const handleAutoReply = (msg: TelegramMessage) => {
    if (!autoReply.enabled || !autoReply.message.trim()) return;
    if (!msg.from) return; // don't reply to our own messages
    const now = new Date();
    const hour = now.getHours();
    if (hour < autoReply.startHour || hour >= autoReply.endHour) return;
    if (autoReply.keywords.length > 0) {
      const msgLower = msg.text.toLowerCase();
      const hasKeyword = autoReply.keywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (!hasKeyword) return;
    }
    ados.telegram.send?.(msg.chatId, autoReply.message);
  };

  // === UI/UX Improvement helpers ===

  // #8 Contact avatars: generate color from name hash
  const getAvatarColor = useCallback((name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#E53935', '#8E24AA', '#5C6BC0', '#039BE5', '#00897B', '#43A047', '#F4511E', '#6D4C41', '#546E7A', '#D81B60'];
    return colors[Math.abs(hash) % colors.length];
  }, []);

  const getInitials = useCallback((name: string) => {
    return name.slice(0, 2).toUpperCase();
  }, []);

  // #9 Unread badges: get unread count per chat
  const getUnreadCountForChat = useCallback((chatId: number) => {
    const lastRead = lastReadPerChat[chatId] || 0;
    return messages.filter(m => m.chatId === chatId && m.date > lastRead && m.from).length;
  }, [messages, lastReadPerChat]);

  // #9 Mark chat as read
  const markChatAsRead = useCallback((chatId: number) => {
    const chatMsgs = messages.filter(m => m.chatId === chatId);
    if (chatMsgs.length === 0) return;
    const lastDate = chatMsgs[chatMsgs.length - 1].date;
    setLastReadPerChat(prev => {
      const updated = { ...prev, [chatId]: lastDate };
      localStorage.setItem('ados-telegram-last-read', JSON.stringify(updated));
      return updated;
    });
  }, [messages]);

  // #9 Mark chat as read when selected (useEffect AFTER markChatAsRead)
  useEffect(() => {
    if (selectedChat && tab === 'inbox') {
      markChatAsRead(selectedChat);
    }
  }, [selectedChat, tab, markChatAsRead]);

  // === Cross-menu: Forward to Chat handler ===
  const handleForwardToChat = useCallback(async (msg: TelegramMessage) => {
    try {
      const allSessions = await ados.db.getSessions();
      let targetSessionId: string;
      if (allSessions.length > 0) {
        // Use the most recent session
        const sorted = [...allSessions].sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
        targetSessionId = sorted[0].id;
      } else {
        // Create a new session
        targetSessionId = crypto.randomUUID();
        await ados.db.createSession?.(targetSessionId, 'Telegram Forward');
      }
      await ados.db.addMessage(targetSessionId, { role: 'user', content: '[Encaminhado do Telegram] ' + msg.text });
      setForwardToast('Encaminhado para sessao');
      setTimeout(() => setForwardToast(null), 3000);
    } catch {
      setForwardToast('Erro ao encaminhar');
      setTimeout(() => setForwardToast(null), 3000);
    }
  }, []);

  // === Cross-menu: Check Brain context for messages ===
  const checkBrainContext = useCallback(async (msg: TelegramMessage) => {
    try {
      const memories = await ados.db.getMemories();
      if (!memories || memories.length === 0) return false;
      const words = msg.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      const hasMatch = memories.some((mem: any) => {
        const memText = (mem.content || mem.text || mem.title || '').toLowerCase();
        return words.some((word: string) => memText.includes(word));
      });
      return hasMatch;
    } catch { return false; }
  }, []);

  // Check brain context for visible messages
  useEffect(() => {
    if (tab !== 'inbox' || messages.length === 0) return;
    const checkMessages = async () => {
      const hints: Record<string, boolean> = {};
      const recentMessages = messages.slice(-20);
      for (const msg of recentMessages) {
        if (msg.from && msg.text.length > 10) {
          const key = `${msg.chatId}-${msg.id}`;
          const hasContext = await checkBrainContext(msg);
          if (hasContext) hints[key] = true;
        }
      }
      setBrainContextHints(hints);
    };
    checkMessages();
  }, [messages, tab, checkBrainContext]);

  // #5 Emoji reactions
  const addReaction = useCallback((msgKey: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (`${m.chatId}-${m.id}` === msgKey) {
        const reactions = { ...(m.reactions || {}) };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        return { ...m, reactions };
      }
      return m;
    }));
    setHoveredMessageId(null);
  }, []);

  // #4 Media preview: detect image URLs
  const getImageUrl = useCallback((text: string): string | null => {
    const urlMatch = text.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|bmp|svg))/i);
    return urlMatch ? urlMatch[1] : null;
  }, []);

  // #7 Highlight search match in text
  const highlightText = useCallback((text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? `<mark class="bg-yellow-400/40 text-primary rounded px-0.5">${part}</mark>`
        : part
    ).join('');
  }, []);

  const checkToken = async () => {
    const result = await ados.telegram.getToken();
    setHasToken(result.hasToken);
    if (result.hasToken) setTab('inbox');
  };

  const loadBotInfo = async () => {
    const result = await ados.telegram.getMe();
    if (result.success) setBotInfo(result.bot);
  };

  const loadChats = async () => {
    const result = await ados.telegram.getChats();
    if (result.success) setChats(result.chats);
  };

  const checkPolling = async () => {
    const result = await ados.telegram.pollingStatus();
    setPolling(result.active);
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setConfigStatus('Validando...');
    const result = await ados.telegram.setToken(tokenInput.trim());
    if (result.success) {
      setHasToken(true);
      setBotInfo(result.bot);
      setConfigStatus('');
      // Feature 8: Save to bots array
      const newBot: BotConfig = { token: tokenInput.trim(), username: result.bot.username, firstName: result.bot.first_name };
      setBots(prev => {
        const updated = [...prev.filter(b => b.token !== newBot.token), newBot];
        localStorage.setItem('ados-telegram-bots', JSON.stringify(updated));
        setActiveBotIndex(updated.length - 1);
        return updated;
      });
      setTokenInput('');
      setTab('inbox');
    } else {
      setConfigStatus(result.error || 'Erro ao salvar token');
    }
  };

  const handleRemoveToken = async () => {
    await ados.telegram.removeToken();
    setHasToken(false);
    setBotInfo(null);
    setMessages([]);
    setChats([]);
    setPolling(false);
    setConfirmRemoveToken(false);
    setTab('config');
  };

  const handleTogglePolling = async () => {
    if (polling) {
      await ados.telegram.stopPolling();
      setPolling(false);
      setReconnecting(false);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    } else {
      const result = await ados.telegram.startPolling();
      if (result.success) {
        setPolling(true);
        setReconnecting(false);
      } else {
        // #8 Auto-reconnect on failure
        attemptReconnect();
      }
    }
  };

  const handleSend = async () => {
    if (!selectedChat || sending) return;
    // Allow send if there's text OR a media file
    if (!sendText.trim() && !mediaFile) return;
    // #7 Rate limiting — 2s cooldown
    const now = Date.now();
    if (now - lastSendTime < 2000) {
      setCooldownRemaining(Math.ceil((lastSendTime + 2000 - now) / 1000));
      return;
    }

    // Feature 5: Schedule instead of sending immediately
    if (scheduleEnabled && scheduleDateTime) {
      const scheduledAt = new Date(scheduleDateTime).getTime();
      if (scheduledAt > Date.now()) {
        const sm: ScheduledMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          chatId: selectedChat,
          text: sendText.trim(),
          scheduledAt,
        };
        setScheduledMessages(prev => {
          const updated = [...prev, sm];
          localStorage.setItem('ados-telegram-scheduled', JSON.stringify(updated));
          return updated;
        });
        setSendText('');
        setScheduleEnabled(false);
        setScheduleDateTime('');
        setSendStatus('sent');
        setTimeout(() => setSendStatus(''), 3000);
        return;
      }
    }

    setSending(true);
    setSendStatus('');

    // #6 Quote/Reply: prepend quoted text
    let finalText = sendText.trim();
    const currentReply = replyingTo;
    if (currentReply) {
      finalText = `> ${currentReply.text.slice(0, 100)}\n\n${finalText}`;
      setReplyingTo(null);
    }

    // #1 Add sending status message immediately
    const tempId = Date.now();
    const tempMsg: TelegramMessage = {
      id: tempId,
      chatId: selectedChat,
      chatTitle: chats.find(c => c.id === selectedChat)?.title || '',
      chatType: 'private',
      from: null,
      text: finalText,
      date: Math.floor(Date.now() / 1000),
      status: 'sending',
      replyTo: currentReply ? { text: currentReply.text, from: currentReply.from } : undefined,
    };
    setMessages(prev => [...prev, tempMsg]);

    // Feature 1: Send media if file selected
    if (mediaFile) {
      const filePath = (mediaFile as any).path || mediaFile.name;
      await ados.telegram.sendMedia?.(selectedChat, filePath, finalText || undefined);
      setMediaFile(null);
      setSendText('');
      // Update temp message status
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'delivered' as const, deliveredAt: Math.floor(Date.now() / 1000) } : m));
      setSendStatus('sent');
      setLastSendTime(Date.now());
      setTimeout(() => setSendStatus(''), 3000);
      setSending(false);
      return;
    }

    // #2 Typing indicator: simulate bot processing
    setIsTyping(true);

    const result = await ados.telegram.send(selectedChat, finalText);
    setIsTyping(false);

    if (result.success) {
      const key = `${selectedChat}-${result.messageId}`;
      seenMessageIds.current.add(key);
      // Update temp message with real ID and delivered status
      setMessages(prev => {
        const updated = prev.map(m => m.id === tempId ? {
          ...m,
          id: result.messageId,
          status: 'delivered' as const,
          deliveredAt: Math.floor(Date.now() / 1000),
        } : m);
        // #6 Persist
        const cutoff = Date.now() / 1000 - 30 * 24 * 3600;
        const toStore = updated.filter(m => m.date > cutoff).slice(-500);
        localStorage.setItem('ados-telegram-messages', JSON.stringify(toStore));
        return updated;
      });
      setSendText('');
      setSendStatus('sent');
      setLastSendTime(Date.now());
      setTimeout(() => setSendStatus(''), 3000);
      // #3 Simulate read receipt after 2 seconds
      setTimeout(() => {
        setMessages(prev => prev.map(m =>
          (m.id === result.messageId && m.chatId === selectedChat)
            ? { ...m, status: 'read' as const, readAt: Math.floor(Date.now() / 1000) }
            : m
        ));
      }, 2000);
    } else {
      // Update temp message as failed
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m));
      setSendStatus('error');
      // #8 If send fails, maybe connection dropped — attempt reconnect
      if (!polling) attemptReconnect();
    }
    setSending(false);
  };

  const loadPairings = async () => {
    const [pairs, sess] = await Promise.all([
      ados.db.getTelegramPairings(),
      ados.db.getSessions(),
    ]);
    setPairings(pairs);
    setSessions(sess);
  };

  const handlePair = async () => {
    if (!pairChat || !pairSession) return;
    await ados.db.pairTelegram(pairChat, pairSession, pairDirection);
    setPairChat(null);
    setPairSession('');
    loadPairings();
  };

  const handleUnpair = async (chatId: number, sessionId: string) => {
    await ados.db.unpairTelegram(chatId, sessionId);
    setConfirmUnpair(null);
    loadPairings();
  };

  // Feature 2: Quick replies helpers
  const addQuickReply = () => {
    if (!sendText.trim()) return;
    const label = sendText.trim().slice(0, 20);
    const newReply: QuickReply = { label, text: sendText.trim() };
    const updated = [...quickReplies, newReply];
    setQuickReplies(updated);
    localStorage.setItem('ados-telegram-quick-replies', JSON.stringify(updated));
  };

  const removeQuickReply = (index: number) => {
    const updated = quickReplies.filter((_, i) => i !== index);
    setQuickReplies(updated);
    localStorage.setItem('ados-telegram-quick-replies', JSON.stringify(updated));
  };

  // Feature 4: Request notification permission
  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  // Feature 7: Export conversation
  const handleExportChat = () => {
    if (!selectedChat) return;
    const chatMessages = messages.filter(m => m.chatId === selectedChat);
    const chatTitle = chats.find(c => c.id === selectedChat)?.title || `Chat ${selectedChat}`;
    const md = chatMessages.map(msg => {
      const ts = new Date(msg.date * 1000).toLocaleString('pt-BR');
      const sender = msg.from ? msg.from.name : 'Eu';
      return `**[${ts}] ${sender}:** ${msg.text}`;
    }).join('\n\n');
    const header = `# Conversa: ${chatTitle}\n\n`;
    navigator.clipboard.writeText(header + md);
    setExportFeedback(true);
    setTimeout(() => setExportFeedback(false), 2000);
  };

  // Feature 8: Switch active bot
  const handleSwitchBot = async (index: number) => {
    const bot = bots[index];
    if (!bot) return;
    setActiveBotIndex(index);
    await ados.telegram.setToken?.(bot.token);
    setHasToken(true);
    setBotInfo({ username: bot.username, first_name: bot.firstName });
    loadChats();
    checkPolling();
  };

  // Feature 8: Add another bot
  const handleAddBot = async () => {
    if (!newBotTokenInput.trim()) return;
    setAddingBot(true);
    const result = await ados.telegram.setToken(newBotTokenInput.trim());
    if (result.success) {
      const newBot: BotConfig = { token: newBotTokenInput.trim(), username: result.bot.username, firstName: result.bot.first_name };
      setBots(prev => {
        const updated = [...prev.filter(b => b.token !== newBot.token), newBot];
        localStorage.setItem('ados-telegram-bots', JSON.stringify(updated));
        setActiveBotIndex(updated.length - 1);
        return updated;
      });
      setHasToken(true);
      setBotInfo(result.bot);
      setNewBotTokenInput('');
    }
    setAddingBot(false);
  };

  // Feature 8: Remove a bot
  const handleRemoveBot = (index: number) => {
    setBots(prev => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem('ados-telegram-bots', JSON.stringify(updated));
      if (activeBotIndex >= updated.length) setActiveBotIndex(Math.max(0, updated.length - 1));
      return updated;
    });
  };

  // === Feature 30: Contact groups ===
  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name || contactGroups[name]) return;
    const updated = { ...contactGroups, [name]: [] };
    setContactGroups(updated);
    localStorage.setItem('ados-telegram-contact-groups', JSON.stringify(updated));
    setNewGroupName('');
  };

  const handleAddToGroup = (groupName: string, chatId: number) => {
    const group = contactGroups[groupName] || [];
    if (group.includes(chatId)) return;
    const updated = { ...contactGroups, [groupName]: [...group, chatId] };
    setContactGroups(updated);
    localStorage.setItem('ados-telegram-contact-groups', JSON.stringify(updated));
  };

  const handleRemoveFromGroup = (groupName: string, chatId: number) => {
    const group = contactGroups[groupName] || [];
    const updated = { ...contactGroups, [groupName]: group.filter(id => id !== chatId) };
    setContactGroups(updated);
    localStorage.setItem('ados-telegram-contact-groups', JSON.stringify(updated));
  };

  const handleDeleteGroup = (groupName: string) => {
    const updated = { ...contactGroups };
    delete updated[groupName];
    setContactGroups(updated);
    localStorage.setItem('ados-telegram-contact-groups', JSON.stringify(updated));
  };

  // === Feature 33: Broadcast ===
  const handleBroadcast = async () => {
    if (!broadcastText.trim()) return;
    setBroadcastSending(true);
    setBroadcastStatus('');
    let targets: number[] = [];
    if (broadcastTarget === 'all') {
      targets = chats.map(c => c.id);
    } else if (contactGroups[broadcastTarget]) {
      targets = contactGroups[broadcastTarget];
    }
    let sent = 0;
    for (const chatId of targets) {
      try {
        await ados.telegram.send(chatId, broadcastText.trim());
        sent++;
      } catch {}
    }
    setBroadcastStatus(`Enviado para ${sent}/${targets.length} chats`);
    setBroadcastSending(false);
    setBroadcastText('');
    setTimeout(() => setBroadcastStatus(''), 4000);
  };

  // === Feature 34: Bot commands manager ===
  const handleAddBotCommand = async () => {
    const cmd = newCommandInput.trim().replace(/^\//, '');
    const desc = newCommandDesc.trim();
    if (!cmd || !desc) return;
    const updated = [...botCommands, { command: cmd, description: desc }];
    setBotCommands(updated);
    localStorage.setItem('ados-telegram-bot-commands', JSON.stringify(updated));
    // Push to Telegram API if available
    await ados.telegram?.setMyCommands?.(updated);
    setNewCommandInput('');
    setNewCommandDesc('');
  };

  const handleRemoveBotCommand = async (index: number) => {
    const updated = botCommands.filter((_, i) => i !== index);
    setBotCommands(updated);
    localStorage.setItem('ados-telegram-bot-commands', JSON.stringify(updated));
    await ados.telegram?.setMyCommands?.(updated);
  };

  // === Feature 35: Webhook integration ===
  const handleAddWebhook = () => {
    if (!newWebhookKeyword.trim() || !newWebhookUrl.trim()) return;
    const wh = { id: crypto.randomUUID(), keyword: newWebhookKeyword.trim(), url: newWebhookUrl.trim(), enabled: true };
    const updated = [...webhooks, wh];
    setWebhooks(updated);
    localStorage.setItem('ados-telegram-webhooks', JSON.stringify(updated));
    setNewWebhookKeyword('');
    setNewWebhookUrl('');
  };

  const handleRemoveWebhook = (id: string) => {
    const updated = webhooks.filter(w => w.id !== id);
    setWebhooks(updated);
    localStorage.setItem('ados-telegram-webhooks', JSON.stringify(updated));
  };

  const handleToggleWebhook = (id: string) => {
    const updated = webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w);
    setWebhooks(updated);
    localStorage.setItem('ados-telegram-webhooks', JSON.stringify(updated));
  };

  // === Feature 37: Backup/restore conversations ===
  const handleBackupConversations = () => {
    const data = JSON.stringify({
      messages,
      chats,
      quickReplies,
      scheduledMessages,
      contactGroups,
      botCommands,
      webhooks,
      exportedAt: new Date().toISOString(),
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telegram-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus('Backup salvo!');
    setTimeout(() => setBackupStatus(''), 3000);
  };

  const handleRestoreConversations = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.messages) {
          setMessages(parsed.messages);
          localStorage.setItem('ados-telegram-messages', JSON.stringify(parsed.messages.slice(-500)));
        }
        if (parsed.quickReplies) {
          setQuickReplies(parsed.quickReplies);
          localStorage.setItem('ados-telegram-quick-replies', JSON.stringify(parsed.quickReplies));
        }
        if (parsed.scheduledMessages) {
          setScheduledMessages(parsed.scheduledMessages);
          localStorage.setItem('ados-telegram-scheduled', JSON.stringify(parsed.scheduledMessages));
        }
        if (parsed.contactGroups) {
          setContactGroups(parsed.contactGroups);
          localStorage.setItem('ados-telegram-contact-groups', JSON.stringify(parsed.contactGroups));
        }
        if (parsed.botCommands) {
          setBotCommands(parsed.botCommands);
          localStorage.setItem('ados-telegram-bot-commands', JSON.stringify(parsed.botCommands));
        }
        if (parsed.webhooks) {
          setWebhooks(parsed.webhooks);
          localStorage.setItem('ados-telegram-webhooks', JSON.stringify(parsed.webhooks));
        }
        setBackupStatus('Restaurado com sucesso!');
        setTimeout(() => setBackupStatus(''), 3000);
      } catch {
        setBackupStatus('Erro: arquivo invalido');
        setTimeout(() => setBackupStatus(''), 3000);
      }
    };
    reader.readAsText(file);
  };

  // === NEW FEATURES (batch 2) LOGIC ===

  // Feature B2: Update metrics whenever messages change
  useEffect(() => {
    const sent = messages.filter(m => !m.from).length;
    const received = messages.filter(m => m.from).length;
    // Calculate avg response time (time between received msg and next sent msg)
    let totalResponseTime = 0;
    let responseCount = 0;
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].from && !messages[i + 1].from) {
        const diff = (messages[i + 1].date - messages[i].date) * 1000;
        if (diff > 0 && diff < 3600000) { // ignore gaps > 1h
          totalResponseTime += diff;
          responseCount++;
        }
      }
    }
    setMetrics({
      totalSent: sent,
      totalReceived: received,
      avgResponseTimeMs: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
    });
  }, [messages]);

  // Feature B5: Connection status updater
  useEffect(() => {
    if (polling) {
      if (!pollingStartRef.current) pollingStartRef.current = Date.now();
      setConnectionStatus(prev => ({ ...prev, connected: true }));
      // Ping latency check every 30s
      const interval = setInterval(async () => {
        const start = Date.now();
        try {
          const result = await ados.telegram?.getMe?.();
          const latency = Date.now() - start;
          setConnectionStatus(prev => ({
            ...prev,
            connected: true,
            latencyMs: latency,
            uptimeSeconds: Math.floor((Date.now() - (pollingStartRef.current || Date.now())) / 1000),
          }));
        } catch (err: any) {
          setConnectionStatus(prev => ({
            ...prev,
            connected: false,
            latencyMs: null,
            lastError: err?.message || 'Erro desconhecido',
            lastErrorAt: Date.now(),
          }));
        }
      }, 30000);
      return () => clearInterval(interval);
    } else {
      pollingStartRef.current = null;
      setConnectionStatus(prev => ({ ...prev, connected: false, latencyMs: null, uptimeSeconds: 0 }));
    }
  }, [polling]);

  // Feature B8: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: send message
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
        if (tab === 'send' && selectedChat && sendText.trim()) {
          e.preventDefault();
          handleSend();
        }
      }
      // Ctrl+Shift+P: pin last message
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        const relevantMsgs = selectedChat ? messages.filter(m => m.chatId === selectedChat) : messages;
        const lastMsg = relevantMsgs[relevantMsgs.length - 1];
        if (lastMsg) handlePinMessage(lastMsg);
      }
      // Ctrl+/: show commands
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        if (tab === 'send') {
          setShowCommandList(prev => !prev);
          setCommandFilter('');
          setSelectedCommandIndex(0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab, selectedChat, sendText, messages]);

  // Feature B1: Handle inline command detection in input
  const handleSendTextChange = useCallback((value: string) => {
    setSendText(value);
    if (value.startsWith('/')) {
      setShowCommandList(true);
      setCommandFilter(value.slice(1));
      setSelectedCommandIndex(0);
    } else {
      setShowCommandList(false);
      setCommandFilter('');
    }
  }, []);

  // Feature B1: Execute inline command
  const executeCommand = useCallback((command: string) => {
    setShowCommandList(false);
    setSendText('');
    switch (command) {
      case '/status':
        const statusText = `Conexao: ${connectionStatus.connected ? 'Ativa' : 'Inativa'} | Latencia: ${connectionStatus.latencyMs ? connectionStatus.latencyMs + 'ms' : 'N/A'} | Uptime: ${Math.floor(connectionStatus.uptimeSeconds / 60)}min`;
        setMessages(prev => [...prev, {
          id: Date.now(),
          chatId: selectedChat || 0,
          chatTitle: 'Sistema',
          chatType: 'system',
          from: { id: 0, name: 'Sistema' },
          text: statusText,
          date: Math.floor(Date.now() / 1000),
        }]);
        break;
      case '/help':
        const helpText = INLINE_COMMANDS.map(c => `${c.command} - ${c.description}`).join('\n');
        setMessages(prev => [...prev, {
          id: Date.now(),
          chatId: selectedChat || 0,
          chatTitle: 'Sistema',
          chatType: 'system',
          from: { id: 0, name: 'Sistema' },
          text: helpText,
          date: Math.floor(Date.now() / 1000),
        }]);
        break;
      case '/clear':
        if (selectedChat) {
          setMessages(prev => prev.filter(m => m.chatId !== selectedChat));
        } else {
          setMessages([]);
        }
        break;
    }
  }, [connectionStatus, selectedChat]);

  // Feature B1: Handle command key navigation
  const handleCommandKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showCommandList) return;
    const filtered = INLINE_COMMANDS.filter(c => c.command.slice(1).includes(commandFilter.toLowerCase()));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCommandIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCommandIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      executeCommand(filtered[selectedCommandIndex].command);
    } else if (e.key === 'Escape') {
      setShowCommandList(false);
    }
  }, [showCommandList, commandFilter, selectedCommandIndex, executeCommand]);

  // Feature B3: Pin/unpin message
  const handlePinMessage = useCallback((msg: TelegramMessage) => {
    const msgKey = `${msg.chatId}-${msg.id}`;
    const existing = pinnedMessages.find(p => p.messageKey === msgKey);
    let updated: PinnedMessage[];
    if (existing) {
      updated = pinnedMessages.filter(p => p.messageKey !== msgKey);
    } else {
      const pinned: PinnedMessage = {
        id: crypto.randomUUID(),
        messageKey: msgKey,
        chatId: msg.chatId,
        text: msg.text,
        from: msg.from ? msg.from.name : 'Eu',
        date: msg.date,
        pinnedAt: Date.now(),
      };
      updated = [...pinnedMessages, pinned];
    }
    setPinnedMessages(updated);
    localStorage.setItem('ados-telegram-pinned', JSON.stringify(updated));
  }, [pinnedMessages]);

  // Feature B4: Formatting helpers
  const applyFormat = useCallback((format: 'bold' | 'italic' | 'code' | 'link') => {
    const textarea = sendTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = sendText.slice(start, end);
    let formatted: string;
    let cursorOffset: number;
    switch (format) {
      case 'bold':
        formatted = `*${selected || 'texto'}*`;
        cursorOffset = selected ? formatted.length : 1;
        break;
      case 'italic':
        formatted = `_${selected || 'texto'}_`;
        cursorOffset = selected ? formatted.length : 1;
        break;
      case 'code':
        formatted = `\`${selected || 'codigo'}\``;
        cursorOffset = selected ? formatted.length : 1;
        break;
      case 'link':
        formatted = `[${selected || 'texto'}](url)`;
        cursorOffset = selected ? formatted.length : 1;
        break;
    }
    const newText = sendText.slice(0, start) + formatted + sendText.slice(end);
    setSendText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + cursorOffset;
      textarea.selectionEnd = start + cursorOffset;
    }, 0);
  }, [sendText]);

  // Feature B7: Load more history
  const handleLoadMoreHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const nextPage = historyPage + 1;
      const result = await ados.telegram?.getHistory?.(selectedChat, nextPage, MESSAGES_PER_PAGE);
      if (result?.success && result.messages?.length > 0) {
        setMessages(prev => {
          const existingKeys = new Set(prev.map(m => `${m.chatId}-${m.id}`));
          const newMsgs = result.messages.filter((m: TelegramMessage) => !existingKeys.has(`${m.chatId}-${m.id}`));
          return [...newMsgs, ...prev];
        });
        setHistoryPage(nextPage);
      }
    } catch {}
    setLoadingHistory(false);
  }, [historyPage, selectedChat]);

  // Feature B6: Filter chats by target type
  const filteredChats = chats.filter(chat => {
    if (targetType === 'all') return true;
    if (targetType === 'private') return chat.type === 'private';
    if (targetType === 'group') return chat.type === 'group' || chat.type === 'supergroup';
    if (targetType === 'channel') return chat.type === 'channel';
    return true;
  });

  // Feature 3: Filtered messages with time filter
  const filteredMessages = messages.filter(m => {
    if (selectedChat && m.chatId !== selectedChat) return false;
    if (inboxSearch && !m.text.toLowerCase().includes(inboxSearch.toLowerCase())) return false;
    // Time filter
    if (inboxTimeFilter !== 'all') {
      const now = Date.now() / 1000;
      if (inboxTimeFilter === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        if (m.date < startOfDay.getTime() / 1000) return false;
      } else if (inboxTimeFilter === '7d') {
        if (m.date < now - 7 * 24 * 3600) return false;
      } else if (inboxTimeFilter === '30d') {
        if (m.date < now - 30 * 24 * 3600) return false;
      }
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Telegram</h1>
            <p className="text-sm text-muted mt-1">
              {botInfo ? `@${botInfo.username}` : 'Conecte seu bot para receber e enviar mensagens'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Feature 8: Bot selector dropdown */}
            {bots.length > 1 && (
              <select
                value={activeBotIndex}
                onChange={(e) => handleSwitchBot(Number(e.target.value))}
                className="bg-surface-1 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
              >
                {bots.map((bot, i) => (
                  <option key={i} value={i}>@{bot.username}</option>
                ))}
              </select>
            )}
            {hasToken && (
              <button
                onClick={handleTogglePolling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  polling ? 'bg-green-500/10 text-green-500' : 'bg-surface-2 text-muted hover:text-secondary'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${polling ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                {polling ? 'Escutando' : 'Parado'}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 bg-surface-1 rounded-xl p-1">
          {hasToken && (
            <>
              <button
                onClick={() => setTab('inbox')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                  tab === 'inbox' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
                }`}
              >
                Inbox
                {/* #1 Unread badge */}
                {unreadCount > 0 && tab !== 'inbox' && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 bg-red-500 text-white text-[9px] font-bold rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('send')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'send' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
                }`}
              >
                Enviar
              </button>
              <button
                onClick={() => setTab('pairings')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'pairings' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
                }`}
              >
                Pairings
              </button>
            </>
          )}
          <button
            onClick={() => setTab('config')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'config' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
            }`}
          >
            Configurar
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {tab === 'config' && (
          <div className="max-w-lg space-y-6 mt-4">
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Bot Token</h3>
              <p className="text-xs text-muted">
                Crie um bot com o <span className="text-primary font-mono">@BotFather</span> no Telegram e cole o token aqui.
              </p>

              {hasToken && botInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#2AABEE]/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2AABEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">{botInfo.first_name}</p>
                      <p className="text-xs text-muted">@{botInfo.username}</p>
                    </div>
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">Conectado</span>
                  </div>
                  <button
                    onClick={() => setConfirmRemoveToken(true)}
                    className="text-xs text-red-500 hover:text-red-400 transition-colors"
                  >
                    Desconectar bot
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
                  />
                  {configStatus && (
                    <p className="text-xs text-red-400">{configStatus}</p>
                  )}
                  <button
                    onClick={handleSaveToken}
                    disabled={!tokenInput.trim()}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
                  >
                    Conectar
                  </button>
                </div>
              )}
            </div>

            {/* Feature 8: Multi-bot management */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Multi-Bot</h3>
              <p className="text-xs text-muted">Gerencie multiplos bots. O bot ativo e usado para polling e envio.</p>
              {bots.length > 0 && (
                <div className="space-y-2">
                  {bots.map((bot, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${i === activeBotIndex ? 'bg-brand-600/10 border border-brand-500/30' : 'bg-surface-2'}`}>
                      <span className="text-sm text-primary font-medium">@{bot.username}</span>
                      <span className="text-xs text-muted">{bot.firstName}</span>
                      {i === activeBotIndex && <span className="text-[10px] px-2 py-0.5 bg-brand-600/20 text-brand-400 rounded-full ml-auto">Ativo</span>}
                      {i !== activeBotIndex && (
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => handleSwitchBot(i)} className="text-[10px] text-brand-400 hover:text-brand-300">Ativar</button>
                          <button onClick={() => handleRemoveBot(i)} className="text-[10px] text-red-500 hover:text-red-400">Remover</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newBotTokenInput}
                  onChange={(e) => setNewBotTokenInput(e.target.value)}
                  placeholder="Token de outro bot..."
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
                />
                <button
                  onClick={handleAddBot}
                  disabled={!newBotTokenInput.trim() || addingBot}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
                >
                  {addingBot ? '...' : 'Adicionar'}
                </button>
              </div>
            </div>

            {/* Feature 4: Notification permission */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Notificacoes Desktop</h3>
              <p className="text-xs text-muted">Receba notificacoes quando chegar uma mensagem e voce nao estiver na aba Inbox.</p>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${notifPermission === 'granted' ? 'bg-green-500/10 text-green-500' : notifPermission === 'denied' ? 'bg-red-500/10 text-red-500' : 'bg-surface-2 text-muted'}`}>
                  {notifPermission === 'granted' ? 'Permitido' : notifPermission === 'denied' ? 'Bloqueado' : 'Nao solicitado'}
                </span>
                {notifPermission !== 'granted' && notifPermission !== 'denied' && (
                  <button
                    onClick={requestNotifPermission}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs font-medium text-white transition-all"
                  >
                    Permitir notificacoes
                  </button>
                )}
              </div>
            </div>

            {/* Feature 6: Auto-reply config */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-primary">Auto-resposta</h3>
                <button
                  onClick={() => {
                    const updated = { ...autoReply, enabled: !autoReply.enabled };
                    setAutoReply(updated);
                    localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                  }}
                  className={`w-10 h-5 rounded-full transition-colors relative ${autoReply.enabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoReply.enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              {autoReply.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-secondary mb-1 block">Mensagem de resposta</label>
                    <textarea
                      value={autoReply.message}
                      onChange={(e) => {
                        const updated = { ...autoReply, message: e.target.value };
                        setAutoReply(updated);
                        localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                      }}
                      rows={3}
                      placeholder="Obrigado pela mensagem! Responderei em breve."
                      className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none resize-none focus:border-brand-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-secondary mb-1 block">Hora inicio</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={autoReply.startHour}
                        onChange={(e) => {
                          const updated = { ...autoReply, startHour: Number(e.target.value) };
                          setAutoReply(updated);
                          localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                        }}
                        className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-secondary mb-1 block">Hora fim</label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={autoReply.endHour}
                        onChange={(e) => {
                          const updated = { ...autoReply, endHour: Number(e.target.value) };
                          setAutoReply(updated);
                          localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                        }}
                        className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-secondary mb-1 block">Keywords (responde so se contem uma dessas palavras; vazio = responde a tudo)</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {autoReply.keywords.map((kw, i) => (
                        <span key={i} className="flex items-center gap-1 bg-surface-2 text-xs text-primary px-2 py-0.5 rounded-full">
                          {kw}
                          <button
                            onClick={() => {
                              const updated = { ...autoReply, keywords: autoReply.keywords.filter((_, idx) => idx !== i) };
                              setAutoReply(updated);
                              localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                            }}
                            className="text-muted hover:text-red-400"
                          >x</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={autoReplyKeywordInput}
                        onChange={(e) => setAutoReplyKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && autoReplyKeywordInput.trim()) {
                            const updated = { ...autoReply, keywords: [...autoReply.keywords, autoReplyKeywordInput.trim()] };
                            setAutoReply(updated);
                            localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                            setAutoReplyKeywordInput('');
                          }
                        }}
                        placeholder="Adicionar keyword..."
                        className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                      />
                      <button
                        onClick={() => {
                          if (!autoReplyKeywordInput.trim()) return;
                          const updated = { ...autoReply, keywords: [...autoReply.keywords, autoReplyKeywordInput.trim()] };
                          setAutoReply(updated);
                          localStorage.setItem('ados-telegram-auto-reply', JSON.stringify(updated));
                          setAutoReplyKeywordInput('');
                        }}
                        className="px-2 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary"
                      >+</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature 30: Contact groups */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-primary">Grupos de contato</h3>
                <button onClick={() => setShowGroupManager(!showGroupManager)} className="text-[10px] text-brand-400 hover:text-brand-300">
                  {showGroupManager ? 'Fechar' : 'Gerenciar'}
                </button>
              </div>
              <p className="text-xs text-muted">Organize chats em grupos para broadcasts e filtragem.</p>
              {showGroupManager && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                      placeholder="Nome do grupo..."
                      className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                    />
                    <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-xs text-white font-medium">Criar</button>
                  </div>
                  {Object.entries(contactGroups).map(([name, ids]) => (
                    <div key={name} className="bg-surface-2 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-primary">{name} ({ids.length})</span>
                        <button onClick={() => handleDeleteGroup(name)} className="text-[10px] text-red-500 hover:text-red-400">Excluir</button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {ids.map(id => {
                          const chat = chats.find(c => c.id === id);
                          return (
                            <span key={id} className="flex items-center gap-1 bg-surface-1 text-xs text-primary px-2 py-0.5 rounded-full">
                              {chat?.title || `Chat ${id}`}
                              <button onClick={() => handleRemoveFromGroup(name, id)} className="text-muted hover:text-red-400">x</button>
                            </span>
                          );
                        })}
                      </div>
                      {chats.filter(c => !ids.includes(c.id)).length > 0 && (
                        <select
                          onChange={(e) => { if (e.target.value) handleAddToGroup(name, Number(e.target.value)); e.target.value = ''; }}
                          className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-[10px] text-primary outline-none"
                          defaultValue=""
                        >
                          <option value="">+ Adicionar chat...</option>
                          {chats.filter(c => !ids.includes(c.id)).map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                  {Object.keys(contactGroups).length === 0 && <p className="text-[10px] text-muted">Nenhum grupo criado.</p>}
                </div>
              )}
            </div>

            {/* Feature 34: Bot commands manager */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Comandos do Bot</h3>
              <p className="text-xs text-muted">Defina os comandos que aparecem no menu do bot no Telegram.</p>
              {botCommands.length > 0 && (
                <div className="space-y-1">
                  {botCommands.map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                      <span className="text-xs font-mono text-brand-400">/{cmd.command}</span>
                      <span className="text-xs text-muted flex-1">{cmd.description}</span>
                      <button onClick={() => handleRemoveBotCommand(i)} className="text-[10px] text-red-500 hover:text-red-400">x</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newCommandInput}
                  onChange={(e) => setNewCommandInput(e.target.value)}
                  placeholder="/comando"
                  className="w-28 bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary font-mono outline-none"
                />
                <input
                  value={newCommandDesc}
                  onChange={(e) => setNewCommandDesc(e.target.value)}
                  placeholder="Descricao..."
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                />
                <button onClick={handleAddBotCommand} disabled={!newCommandInput.trim() || !newCommandDesc.trim()} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-xs text-white font-medium">+</button>
              </div>
            </div>

            {/* Feature 35: Webhook integration */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Webhooks</h3>
              <p className="text-xs text-muted">Dispare webhooks automaticamente quando mensagens contem keywords especificas.</p>
              {webhooks.length > 0 && (
                <div className="space-y-1">
                  {webhooks.map(wh => (
                    <div key={wh.id} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                      <button onClick={() => handleToggleWebhook(wh.id)} className={`w-3 h-3 rounded-full ${wh.enabled ? 'bg-green-500' : 'bg-muted'}`} title={wh.enabled ? 'Ativo' : 'Inativo'} />
                      <span className="text-xs font-medium text-primary">{wh.keyword}</span>
                      <span className="text-[10px] text-muted truncate flex-1">{wh.url}</span>
                      <button onClick={() => handleRemoveWebhook(wh.id)} className="text-[10px] text-red-500 hover:text-red-400">x</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newWebhookKeyword}
                  onChange={(e) => setNewWebhookKeyword(e.target.value)}
                  placeholder="Keyword..."
                  className="w-28 bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                />
                <input
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="URL do webhook..."
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                />
                <button onClick={handleAddWebhook} disabled={!newWebhookKeyword.trim() || !newWebhookUrl.trim()} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-xs text-white font-medium">+</button>
              </div>
            </div>

            {/* Feature 37: Backup/restore conversations */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Backup de conversas</h3>
              <p className="text-xs text-muted">Exporte ou importe todas as conversas, configuracoes e dados do Telegram.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackupConversations}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium"
                >
                  Exportar backup
                </button>
                <label className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium cursor-pointer">
                  Restaurar backup
                  <input type="file" accept=".json" onChange={handleRestoreConversations} className="hidden" />
                </label>
                {backupStatus && <span className="text-xs text-green-500">{backupStatus}</span>}
              </div>
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-primary">Como funciona</h3>
              <ol className="text-xs text-muted space-y-2 list-decimal list-inside">
                <li>Abra o Telegram e busque <span className="text-primary font-mono">@BotFather</span></li>
                <li>Envie <span className="text-primary font-mono">/newbot</span> e siga as instrucoes</li>
                <li>Copie o token HTTP API e cole acima</li>
                <li>Envie uma mensagem para seu bot no Telegram</li>
                <li>Ative o polling aqui para receber mensagens em tempo real</li>
              </ol>
            </div>
          </div>
        )}

        {tab === 'inbox' && (
          <div className="flex gap-4 mt-4 h-full">
            <div className="w-56 shrink-0 space-y-1">
              {/* Feature B2: Conversation metrics card */}
              <div className="bg-surface-1 border border-default rounded-lg p-2.5 mb-2 space-y-1">
                <h4 className="text-[10px] font-medium text-secondary uppercase tracking-wide">Metricas</h4>
                <div className="grid grid-cols-2 gap-1">
                  <div className="text-center">
                    <p className="text-xs font-bold text-primary">{metrics.totalReceived}</p>
                    <p className="text-[9px] text-muted">Recebidas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-primary">{metrics.totalSent}</p>
                    <p className="text-[9px] text-muted">Enviadas</p>
                  </div>
                </div>
                <div className="text-center border-t border-border pt-1">
                  <p className="text-[10px] text-muted">Resp. media: <span className="text-primary font-medium">{metrics.avgResponseTimeMs > 0 ? `${Math.round(metrics.avgResponseTimeMs / 1000)}s` : 'N/A'}</span></p>
                </div>
              </div>

              {/* Feature B5: Connection status detailed */}
              <div className="bg-surface-1 border border-default rounded-lg p-2.5 mb-2 space-y-1">
                <h4 className="text-[10px] font-medium text-secondary uppercase tracking-wide">Conexao</h4>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-[10px] text-primary">{connectionStatus.connected ? 'Conectado' : 'Desconectado'}</span>
                  </div>
                  {connectionStatus.latencyMs !== null && (
                    <p className="text-[9px] text-muted">Latencia: {connectionStatus.latencyMs}ms</p>
                  )}
                  {connectionStatus.uptimeSeconds > 0 && (
                    <p className="text-[9px] text-muted">Uptime: {Math.floor(connectionStatus.uptimeSeconds / 60)}m {connectionStatus.uptimeSeconds % 60}s</p>
                  )}
                  {connectionStatus.lastError && (
                    <p className="text-[9px] text-red-400 truncate" title={connectionStatus.lastError}>Erro: {connectionStatus.lastError}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 bg-surface-1 border border-default rounded-lg px-2 py-1.5 mb-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input placeholder="Buscar msgs..." value={inboxSearch} onChange={e => setInboxSearch(e.target.value)} className="bg-transparent text-xs text-primary placeholder-muted outline-none w-full" />
              </div>
              {/* Feature 3: Time filters */}
              <div className="flex flex-wrap gap-1 mb-2">
                {(['today', '7d', '30d', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setInboxTimeFilter(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      inboxTimeFilter === f ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-secondary'
                    }`}
                  >
                    {f === 'today' ? 'Hoje' : f === '7d' ? '7d' : f === '30d' ? '30d' : 'Todos'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectedChat(null)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                  !selectedChat ? 'bg-brand-600/10 text-brand-500 font-medium' : 'text-secondary hover:bg-surface-2'
                }`}
              >
                Todas ({messages.length})
              </button>
              {chats.map(chat => {
                const unread = getUnreadCountForChat(chat.id);
                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                      selectedChat === chat.id ? 'bg-brand-600/10 text-brand-500 font-medium' : 'text-secondary hover:bg-surface-2'
                    }`}
                  >
                    {/* #8 Contact avatar */}
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ backgroundColor: getAvatarColor(chat.title) }}
                    >
                      {getInitials(chat.title)}
                    </span>
                    <span className="truncate flex-1">{chat.title}</span>
                    <span className="text-[10px] text-muted">
                      {messages.filter(m => m.chatId === chat.id).length}
                    </span>
                    {/* #9 Unread badge */}
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[9px] font-bold rounded-full">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                );
              })}
              {chats.length === 0 && (
                <p className="text-xs text-muted px-3 py-2">
                  Nenhum chat ainda. Envie uma mensagem para o bot no Telegram.
                </p>
              )}
            </div>

            <div className="flex-1 bg-surface-1 border border-default rounded-2xl flex flex-col overflow-hidden">
              {/* Feature 7: Export button + #7 Search in chat header */}
              {selectedChat && (
                <div className="flex flex-col border-b border-default">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      {/* #8 Avatar in header */}
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: getAvatarColor(chats.find(c => c.id === selectedChat)?.title || '') }}
                      >
                        {getInitials(chats.find(c => c.id === selectedChat)?.title || '??')}
                      </span>
                      <span className="text-sm font-medium text-primary">
                        {chats.find(c => c.id === selectedChat)?.title || `Chat ${selectedChat}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* #7 Search icon */}
                      <button
                        onClick={() => { setShowChatSearch(!showChatSearch); setChatSearchQuery(''); }}
                        className={`p-1.5 rounded-lg transition-colors ${showChatSearch ? 'bg-brand-600/10 text-brand-400' : 'text-muted hover:text-secondary hover:bg-surface-2'}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                      </button>
                      <button
                        onClick={handleExportChat}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-secondary transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        {exportFeedback ? 'Copiado!' : 'Exportar'}
                      </button>
                    </div>
                  </div>
                  {/* #7 Search input */}
                  {showChatSearch && (
                    <div className="px-4 pb-2">
                      <input
                        value={chatSearchQuery}
                        onChange={(e) => setChatSearchQuery(e.target.value)}
                        placeholder="Buscar nesta conversa..."
                        autoFocus
                        className="w-full bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none focus:border-brand-500/50"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Feature B3: Pinned messages section */}
              {pinnedMessages.filter(p => !selectedChat || p.chatId === selectedChat).length > 0 && (
                <div className="border-b border-border">
                  <button
                    onClick={() => setShowPinnedSection(!showPinnedSection)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-secondary hover:bg-surface-2 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 17v5M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>
                    Fixadas ({pinnedMessages.filter(p => !selectedChat || p.chatId === selectedChat).length})
                    <span className="ml-auto text-[9px]">{showPinnedSection ? '▼' : '▶'}</span>
                  </button>
                  {showPinnedSection && (
                    <div className="px-4 pb-2 space-y-1.5">
                      {pinnedMessages.filter(p => !selectedChat || p.chatId === selectedChat).map(pin => (
                        <div key={pin.id} className="flex items-start gap-2 bg-surface-2 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted font-medium">{pin.from}</p>
                            <p className="text-xs text-primary truncate">{pin.text}</p>
                          </div>
                          <button
                            onClick={() => {
                              const updated = pinnedMessages.filter(p => p.id !== pin.id);
                              setPinnedMessages(updated);
                              localStorage.setItem('ados-telegram-pinned', JSON.stringify(updated));
                            }}
                            className="text-[9px] text-muted hover:text-red-400 shrink-0"
                          >desafixar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Feature B7: Load more history button */}
                {filteredMessages.length >= MESSAGES_PER_PAGE && (
                  <div className="flex justify-center pb-2">
                    <button
                      onClick={handleLoadMoreHistory}
                      disabled={loadingHistory}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-xs text-secondary transition-colors"
                    >
                      {loadingHistory ? 'Carregando...' : 'Carregar mais'}
                    </button>
                  </div>
                )}
                {filteredMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted">
                      {polling ? 'Aguardando mensagens...' : 'Ative o polling para receber mensagens'}
                    </p>
                  </div>
                ) : (
                  filteredMessages
                    .filter(msg => !chatSearchQuery || msg.text.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                    .map(msg => {
                      const msgKey = `${msg.chatId}-${msg.id}`;
                      const imageUrl = getImageUrl(msg.text);
                      return (
                    <div
                      key={msgKey}
                      className={`group flex ${msg.from ? 'justify-start' : 'justify-end'}`}
                      onMouseEnter={() => setHoveredMessageId(msgKey)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                    >
                      {/* #8 Avatar for received messages */}
                      {msg.from && (
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mr-1.5 mt-auto mb-1"
                          style={{ backgroundColor: getAvatarColor(msg.from.name) }}
                        >
                          {getInitials(msg.from.name)}
                        </span>
                      )}
                      <div className={`flex flex-col ${msg.from ? 'items-start' : 'items-end'} max-w-[70%]`}>
                        <div className={`relative px-3 py-2 rounded-2xl text-sm ${
                          msg.from
                            ? 'bg-surface-2 text-primary rounded-tl-md'
                            : 'bg-brand-600 text-white rounded-tr-md'
                        }`}>
                          {msg.from && (
                            <p className="text-[10px] text-muted font-medium mb-0.5">
                              {msg.from.name} {msg.chatType !== 'private' && `· ${msg.chatTitle}`}
                            </p>
                          )}
                          {/* #6 Reply quote */}
                          {msg.replyTo && (
                            <div className={`border-l-2 pl-2 mb-1 text-[10px] ${msg.from ? 'border-brand-400/50 text-muted' : 'border-white/40 text-white/70'}`}>
                              <span className="font-medium">{msg.replyTo.from}</span>
                              <p className="truncate">{msg.replyTo.text.slice(0, 60)}</p>
                            </div>
                          )}
                          {/* #7 Search highlight */}
                          {chatSearchQuery ? (
                            <p className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: highlightText(msg.text, chatSearchQuery) }} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          )}
                          {/* #4 Media preview thumbnail */}
                          {imageUrl && (
                            <div className="mt-1.5">
                              <img
                                src={imageUrl}
                                alt="preview"
                                className="max-w-[200px] max-h-[120px] rounded-lg object-cover border border-default"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <p className="text-[9px] text-muted">
                              {new Date(msg.date * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {/* #1 + #3 Message status indicators */}
                            {!msg.from && msg.status === 'sending' && (
                              <span className="text-[9px]" title="Enviando">&#8987;</span>
                            )}
                            {!msg.from && msg.status === 'delivered' && (
                              <span className={`text-[9px] ${msg.from ? 'text-muted' : 'text-white/70'}`} title="Entregue">&#10003;</span>
                            )}
                            {!msg.from && msg.status === 'read' && (
                              <span className="text-[9px] text-blue-400" title="Lido">&#10003;&#10003;</span>
                            )}
                            {!msg.from && msg.status === 'failed' && (
                              <span className="text-[9px] text-red-400" title="Falhou">&#10007;</span>
                            )}
                            {/* Feature B3: Pin button */}
                            <button
                              onClick={() => handlePinMessage(msg)}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1 ${
                                pinnedMessages.some(p => p.messageKey === msgKey)
                                  ? 'text-brand-400'
                                  : msg.from ? 'text-muted hover:text-primary' : 'text-white/50 hover:text-white'
                              }`}
                              title={pinnedMessages.some(p => p.messageKey === msgKey) ? 'Desafixar' : 'Fixar'}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill={pinnedMessages.some(p => p.messageKey === msgKey) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 17v5M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>
                            </button>
                            {/* #6 Reply button */}
                            <button
                              onClick={() => setReplyingTo({ text: msg.text, from: msg.from?.name || 'Eu', msgKey })}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 ${msg.from ? 'text-muted hover:text-primary' : 'text-white/50 hover:text-white'}`}
                              title="Responder"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                            </button>
                            {/* Cross-menu: Forward to Chat */}
                            {msg.from && (
                              <button
                                onClick={() => handleForwardToChat(msg)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted hover:text-brand-500"
                                title="Encaminhar para Chat"
                              >
                                <span className="text-[9px] font-medium">&rarr; Chat</span>
                              </button>
                            )}
                          </div>
                          {/* Cross-menu: Brain context hint */}
                          {msg.from && brainContextHints[msgKey] && (
                            <div className="mt-0.5 text-[9px] text-amber-500 flex items-center gap-0.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><path d="M10 21h4"/></svg>
                              <span>Brain tem contexto sobre isso</span>
                            </div>
                          )}
                          {/* #10 Delivery timeline tooltip on hover for own messages */}
                          {!msg.from && hoveredMessageId === msgKey && (msg.status === 'delivered' || msg.status === 'read') && (
                            <div className="absolute bottom-full right-0 mb-1 bg-surface-0 border border-default rounded-lg shadow-lg px-3 py-2 text-[9px] text-muted whitespace-nowrap z-20">
                              <span>Enviado {new Date(msg.date * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.deliveredAt && (
                                <span> → Entregue {new Date(msg.deliveredAt * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                              {msg.readAt && (
                                <span> → Lido {new Date(msg.readAt * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* #5 Emoji reactions bar on hover */}
                        {hoveredMessageId === msgKey && (
                          <div className="flex items-center gap-0.5 mt-0.5 bg-surface-0 border border-default rounded-full px-1.5 py-0.5 shadow-sm">
                            {['👍', '😂', '❤️', '👎'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(msgKey, emoji)}
                                className="text-xs hover:scale-125 transition-transform px-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* #5 Display reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {Object.entries(msg.reactions).map(([emoji, count]) => (
                              <span key={emoji} className="flex items-center gap-0.5 bg-surface-2 border border-default rounded-full px-1.5 py-0.5 text-[10px]">
                                {emoji} <span className="text-muted">{count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                      );
                    })
                )}
                {/* #2 Typing indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-surface-2 text-primary rounded-2xl rounded-tl-md px-3 py-2 text-sm">
                      <span className="typing-indicator text-muted text-xs">Digitando<span className="dot-animate">...</span></span>
                      <style>{`
                        .dot-animate {
                          display: inline-block;
                          animation: dotPulse 1.4s infinite;
                        }
                        @keyframes dotPulse {
                          0%, 20% { opacity: 0; }
                          50% { opacity: 1; }
                          100% { opacity: 0; }
                        }
                      `}</style>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}

        {tab === 'pairings' && (
          <div className="max-w-2xl space-y-6 mt-4">
            {/* Pair by Code */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Conectar ao Telegram</h3>
              <p className="text-xs text-muted">Gere um código e envie <code className="bg-surface-2 px-1 rounded">/pair CÓDIGO</code> para o bot pelo Telegram.</p>
              <div className="flex items-center gap-3">
                <select
                  value={pairSession}
                  onChange={(e) => setPairSession(e.target.value)}
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="">Selecione a sessão</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title || 'Sem título'}</option>)}
                </select>
                <button
                  onClick={handleGeneratePairCode}
                  disabled={pairCodeGenerating || (!pairSession && sessions.length === 0)}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Gerar código
                </button>
              </div>
              {pairCode && (
                <div className="bg-surface-2 border border-default rounded-xl p-5 text-center space-y-3">
                  {botInfo && <p className="text-xs text-muted">Envie para @{pairBotUsername || botInfo.username}</p>}
                  <div className="text-xs uppercase tracking-wider text-muted font-medium">Código de Pareamento</div>
                  <div className="flex justify-center gap-2">
                    {pairCode.split('').map((digit, i) => (
                      <span key={i} className="w-10 h-12 flex items-center justify-center bg-brand-600 text-white text-xl font-bold rounded-lg">{digit}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted">Envie <code className="bg-surface-1 px-1.5 py-0.5 rounded font-mono">/pair {pairCode}</code> para o bot no Telegram.</p>
                  <p className="text-xs text-muted">Expira em {Math.floor(pairExpiry / 60)}:{String(pairExpiry % 60).padStart(2, '0')}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`/pair ${pairCode}`); }}
                    className="px-3 py-1.5 bg-surface-1 border border-default rounded-lg text-xs text-secondary hover:text-primary"
                  >
                    Copiar comando
                  </button>
                </div>
              )}
              {pairSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                  <span className="text-green-400 text-sm font-medium">✓ Pareado com sucesso!</span>
                </div>
              )}
            </div>

            {/* Manual Pairing */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Pairing Manual</h3>
              <p className="text-xs text-muted">Vincule um chat do Telegram a uma sessao do JVOS para sincronizacao bidirecional.</p>
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={pairChat || ''}
                  onChange={(e) => setPairChat(Number(e.target.value) || null)}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="">Chat</option>
                  {chats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <select
                  value={pairSession}
                  onChange={(e) => setPairSession(e.target.value)}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="">Sessao</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <select
                  value={pairDirection}
                  onChange={(e) => setPairDirection(e.target.value)}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="both">Bidirecional</option>
                  <option value="tg-to-session">Telegram → Sessao</option>
                  <option value="session-to-tg">Sessao → Telegram</option>
                </select>
              </div>
              <button
                onClick={handlePair}
                disabled={!pairChat || !pairSession}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
              >
                Vincular
              </button>
            </div>

            {pairings.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">Nenhum pairing configurado.</p>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-secondary">Pairings ativos</h3>
                {pairings.map(p => (
                  <div key={`${p.chatId}-${p.sessionId}`} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-sm text-primary font-medium">{chats.find(c => c.id === p.chatId)?.title || `Chat ${p.chatId}`}</span>
                    <span className="text-xs text-muted">
                      {p.direction === 'both' ? '↔' : p.direction === 'tg-to-session' ? '→' : '←'}
                    </span>
                    <span className="text-sm text-primary">{sessions.find(s => s.id === p.sessionId)?.title || 'Sessao'}</span>
                    <span className="ml-auto text-[10px] text-muted">{p.direction}</span>
                    <button
                      onClick={() => setConfirmUnpair({ chatId: p.chatId, sessionId: p.sessionId })}
                      className="text-xs text-red-500 hover:text-red-400"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'send' && (
          <div className="max-w-lg space-y-4 mt-4">
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Destinatario</label>
                {/* Feature B6: Target type filter */}
                <div className="flex gap-1 mb-2">
                  {(['all', 'private', 'group', 'channel'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTargetType(t)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        targetType === t ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-secondary'
                      }`}
                    >
                      {t === 'all' ? 'Todos' : t === 'private' ? 'Privado' : t === 'group' ? 'Grupo' : 'Canal'}
                    </button>
                  ))}
                </div>
                <select
                  value={selectedChat || ''}
                  onChange={(e) => setSelectedChat(Number(e.target.value) || null)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50"
                >
                  <option value="">Selecione um chat</option>
                  {filteredChats.map(chat => (
                    <option key={chat.id} value={chat.id}>{chat.title} ({chat.type})</option>
                  ))}
                </select>
                {filteredChats.length === 0 && (
                  <p className="text-[10px] text-muted mt-1">
                    {chats.length === 0 ? 'Nenhum chat disponivel. Alguem precisa enviar uma mensagem para o bot primeiro.' : `Nenhum ${targetType === 'group' ? 'grupo' : targetType === 'channel' ? 'canal' : 'chat'} encontrado.`}
                  </p>
                )}
              </div>

              {/* #6 Reply quote above textarea */}
              {replyingTo && (
                <div className="flex items-center gap-2 bg-surface-2 border-l-2 border-brand-400 rounded-lg px-3 py-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-brand-400 font-medium">Respondendo a {replyingTo.from}</p>
                    <p className="text-xs text-muted truncate">{replyingTo.text.slice(0, 80)}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-xs text-muted hover:text-red-400 shrink-0">✕</button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-secondary">Mensagem</label>
                  <div className="flex items-center gap-2">
                    {/* Feature B4: Formatting toolbar toggle */}
                    <button
                      onClick={() => setShowFormattingToolbar(!showFormattingToolbar)}
                      className={`text-[10px] px-2 py-0.5 rounded ${showFormattingToolbar ? 'bg-brand-600/20 text-brand-400' : 'bg-surface-2 text-muted hover:text-secondary'}`}
                    >
                      Aa
                    </button>
                    {/* #2 Preview toggle */}
                    <button
                      onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                      className={`text-[10px] px-2 py-0.5 rounded ${showMarkdownPreview ? 'bg-brand-600/20 text-brand-400' : 'bg-surface-2 text-muted hover:text-secondary'}`}
                    >
                      {showMarkdownPreview ? 'Editar' : 'Preview'}
                    </button>
                  </div>
                </div>

                {/* Feature B4: Formatting toolbar */}
                {showFormattingToolbar && !showMarkdownPreview && (
                  <div className="flex items-center gap-1 mb-1.5 p-1.5 bg-surface-2 rounded-lg">
                    <button
                      onClick={() => applyFormat('bold')}
                      className="px-2 py-1 rounded text-xs font-bold text-secondary hover:bg-surface-3 hover:text-primary transition-colors"
                      title="Negrito (*texto*)"
                    >B</button>
                    <button
                      onClick={() => applyFormat('italic')}
                      className="px-2 py-1 rounded text-xs italic text-secondary hover:bg-surface-3 hover:text-primary transition-colors"
                      title="Italico (_texto_)"
                    >I</button>
                    <button
                      onClick={() => applyFormat('code')}
                      className="px-2 py-1 rounded text-xs font-mono text-secondary hover:bg-surface-3 hover:text-primary transition-colors"
                      title="Codigo (`codigo`)"
                    >&lt;/&gt;</button>
                    <button
                      onClick={() => applyFormat('link')}
                      className="px-2 py-1 rounded text-xs text-secondary hover:bg-surface-3 hover:text-primary transition-colors"
                      title="Link ([texto](url))"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>
                    <span className="text-[9px] text-muted ml-auto">Ctrl+Enter envia | Ctrl+/ comandos</span>
                  </div>
                )}

                {showMarkdownPreview ? (
                  <div className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary min-h-[100px] whitespace-pre-wrap">
                    {sendText.split('\n').map((line, i) => (
                      <p key={i} dangerouslySetInnerHTML={{ __html: line
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
                        .replace(/_(.+?)_/g, '<em>$1</em>')
                        .replace(/`(.+?)`/g, '<code class="bg-surface-2 px-1 rounded text-xs">$1</code>')
                        || '&nbsp;'
                      }} />
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <textarea
                      ref={sendTextareaRef}
                      value={sendText}
                      onChange={(e) => handleSendTextChange(e.target.value)}
                      onKeyDown={handleCommandKeyDown}
                      placeholder="Digite a mensagem... (/ para comandos)"
                      rows={4}
                      className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none resize-none focus:border-brand-500/50"
                    />
                    {/* Feature B1: Inline command autocomplete dropdown */}
                    {showCommandList && (
                      <div className="absolute bottom-full left-0 mb-1 w-full bg-surface-0 border border-default rounded-lg shadow-lg overflow-hidden z-10">
                        {INLINE_COMMANDS
                          .filter(c => c.command.slice(1).includes(commandFilter.toLowerCase()))
                          .map((cmd, i) => (
                            <button
                              key={cmd.command}
                              onClick={() => executeCommand(cmd.command)}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                                i === selectedCommandIndex ? 'bg-brand-600/10 text-brand-500' : 'text-secondary hover:bg-surface-2'
                              }`}
                            >
                              <span className="font-mono font-medium">{cmd.command}</span>
                              <span className="text-muted">{cmd.description}</span>
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-muted mt-1">Suporta Markdown: *bold*, _italic_, `code` | Ctrl+Enter envia | Ctrl+/ comandos | Ctrl+Shift+P fixa</p>
              </div>

              {/* Feature 1: Media file picker */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setMediaFile(file);
                  }}
                />
                {mediaFile && (
                  <div className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2 mb-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="text-xs text-primary truncate flex-1">{mediaFile.name}</span>
                    <button onClick={() => setMediaFile(null)} className="text-xs text-red-500 hover:text-red-400">x</button>
                  </div>
                )}
              </div>

              {/* Feature 5: Schedule toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-default"
                  />
                  <span className="text-xs text-secondary">Agendar</span>
                </label>
                {scheduleEnabled && (
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-xs text-primary outline-none focus:border-brand-500/50"
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Feature 1: Attach media button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary transition-colors"
                  title="Anexar midia"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                </button>
                <button
                  onClick={handleSend}
                  disabled={(!sendText.trim() && !mediaFile) || !selectedChat || sending || cooldownRemaining > 0}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
                >
                  {sending ? 'Enviando...' : cooldownRemaining > 0 ? `Aguarde ${cooldownRemaining}s` : scheduleEnabled ? 'Agendar' : 'Enviar'}
                </button>
                {sendStatus === 'sent' && <span className="text-xs text-green-500">✓ Enviado</span>}
                {sendStatus === 'error' && <span className="text-xs text-red-500">✗ Erro ao enviar</span>}
                {/* #8 Reconnecting indicator */}
                {reconnecting && <span className="text-xs text-yellow-500 animate-pulse">Reconectando...</span>}
              </div>

              {/* Feature 5: Scheduled messages list */}
              {scheduledMessages.length > 0 && (
                <div className="mt-3 space-y-2">
                  <h4 className="text-xs font-medium text-secondary">Mensagens agendadas</h4>
                  {scheduledMessages.map(sm => (
                    <div key={sm.id} className="flex items-center gap-2 bg-surface-2 rounded-lg px-3 py-2">
                      <span className="text-xs text-primary truncate flex-1">{sm.text.slice(0, 40)}{sm.text.length > 40 ? '...' : ''}</span>
                      <span className="text-[10px] text-muted">{new Date(sm.scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <button
                        onClick={() => {
                          const updated = scheduledMessages.filter(s => s.id !== sm.id);
                          setScheduledMessages(updated);
                          localStorage.setItem('ados-telegram-scheduled', JSON.stringify(updated));
                        }}
                        className="text-[10px] text-red-500 hover:text-red-400"
                      >x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature 2: Quick replies */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-secondary">Respostas rapidas</h3>
                <button
                  onClick={addQuickReply}
                  disabled={!sendText.trim()}
                  className="text-[10px] px-2 py-0.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded text-muted hover:text-secondary transition-colors"
                  title="Salvar texto atual como resposta rapida"
                >
                  + Salvar atual
                </button>
              </div>
              {quickReplies.length === 0 ? (
                <p className="text-[10px] text-muted">Nenhuma resposta rapida salva. Digite uma mensagem e clique "+" para salvar.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {quickReplies.map((qr, i) => (
                    <div key={i} className="group flex items-center gap-1">
                      <button
                        onClick={() => setSendText(qr.text)}
                        className="px-2.5 py-1 bg-surface-2 hover:bg-brand-600/10 hover:text-brand-400 rounded-full text-xs text-secondary transition-colors"
                        title={qr.text}
                      >
                        {qr.label}
                      </button>
                      <button
                        onClick={() => removeQuickReply(i)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-red-500 hover:text-red-400 transition-opacity"
                      >x</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature 33: Broadcast lists */}
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-xs font-medium text-secondary">Broadcast</h3>
              <p className="text-[10px] text-muted">Envie uma mensagem para multiplos chats de uma vez.</p>
              <select
                value={broadcastTarget}
                onChange={(e) => setBroadcastTarget(e.target.value)}
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none"
              >
                <option value="all">Todos os chats ({chats.length})</option>
                {Object.entries(contactGroups).map(([name, ids]) => (
                  <option key={name} value={name}>Grupo: {name} ({ids.length})</option>
                ))}
              </select>
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Mensagem do broadcast..."
                rows={3}
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none resize-none"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBroadcast}
                  disabled={!broadcastText.trim() || broadcastSending || chats.length === 0}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white transition-all"
                >
                  {broadcastSending ? 'Enviando...' : 'Enviar broadcast'}
                </button>
                {broadcastStatus && <span className="text-xs text-green-500">{broadcastStatus}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Confirmacao remover token */}
      {confirmRemoveToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Desconectar bot?</h3>
            <p className="text-sm text-muted mb-4">Isso desconecta o bot, para o polling e remove todas as mensagens da sessao.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRemoveToken(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={handleRemoveToken} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Desconectar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmacao remover pairing */}
      {confirmUnpair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Remover pairing?</h3>
            <p className="text-sm text-muted mb-4">A sincronizacao entre este chat e a sessao sera interrompida.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmUnpair(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleUnpair(confirmUnpair.chatId, confirmUnpair.sessionId)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-menu: Forward toast */}
      {forwardToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {forwardToast}
        </div>
      )}
    </div>
  );
}
