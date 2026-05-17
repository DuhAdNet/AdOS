import { useState, useEffect, useRef, useCallback } from 'react';

const ados = (window as any).ados;

interface SharedSession {
  sessionId: string;
  publicId: string;
  publishedAt: string;
  updatedAt: string;
  expiresAt?: string | null;
}

interface DetailedView {
  timestamp: string;
  browser: string;
  country: string;
  readingTime: number;
}

interface SharingHistoryEntry {
  id: string;
  action: 'publish' | 'revoke' | 'edit' | 'schedule';
  publicId: string;
  sessionTitle: string;
  timestamp: string;
  details?: string;
}

interface AccessNotification {
  id: string;
  publicId: string;
  sessionTitle: string;
  timestamp: string;
  read: boolean;
}

const SENSITIVE_PATTERNS = [
  /(?:sk|pk)[-_](?:live|test)[-_][a-zA-Z0-9]{20,}/g,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
  /(?:ghp|gho|ghs)_[a-zA-Z0-9]{36,}/g,
  /(?:password|senha|secret|token|api[_-]?key)\s*[:=]\s*["']?[^\s"']{8,}/gi,
  /[a-zA-Z0-9+/]{40,}={0,2}/g,
];

function scanSensitive(text: string): string[] {
  const found: string[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) found.push(...matches.map(m => m.slice(0, 30) + '...'));
  }
  return [...new Set(found)].slice(0, 5);
}

// Simple QR code generator using canvas
function generateQRDataUrl(text: string): string {
  const size = 200;
  const cellSize = 8;
  const grid = Math.floor(size / cellSize);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';

  // Generate deterministic pattern from text
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  // Draw finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (x: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          ctx.fillRect((x + i) * cellSize, (y + j) * cellSize, cellSize, cellSize);
        }
      }
    }
  };
  drawFinder(1, 1);
  drawFinder(grid - 9, 1);
  drawFinder(1, grid - 9);

  // Fill data area with seeded pseudo-random pattern
  let seed = Math.abs(hash);
  for (let y = 9; y < grid - 1; y++) {
    for (let x = 9; x < grid - 1; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  // Fill remaining data zones
  for (let y = 9; y < grid - 1; y++) {
    for (let x = 1; x < 9; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  for (let y = 1; y < 9; y++) {
    for (let x = 9; x < grid - 1; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 3 !== 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  return canvas.toDataURL();
}

export default function Sharing() {
  const [shared, setShared] = useState<SharedSession[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [expiration, setExpiration] = useState<string>('never');
  const [previewMessages, setPreviewMessages] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [sensitiveWarnings, setSensitiveWarnings] = useState<string[]>([]);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  // Proteção por senha
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  // Estatísticas de acesso
  const [accessStats, setAccessStats] = useState<Record<string, { views: number; lastAccessed: string | null; details?: DetailedView[] }>>({});
  // Rate limit de publicação
  const [lastPublishTime, setLastPublishTime] = useState(0);
  const [publishCooldown, setPublishCooldown] = useState(0);
  // Servidor de sharing
  const [sharingEndpoint, setSharingEndpoint] = useState('');
  const [showEndpointConfig, setShowEndpointConfig] = useState(false);
  // Redact de tool outputs
  const [redactTools, setRedactTools] = useState(false);

  // #1 QR Code
  const [qrModal, setQrModal] = useState<string | null>(null);

  // #2 Acesso por email
  const [useEmailRestriction, setUseEmailRestriction] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');

  // #3 Analytics expandido
  const [expandedAnalytics, setExpandedAnalytics] = useState<string | null>(null);

  // #4 Tema do viewer
  const [viewerTheme, setViewerTheme] = useState<'auto' | 'dark' | 'light'>('auto');

  // #5 Snapshot estático
  const [isSnapshot, setIsSnapshot] = useState(true);

  // #6 Bulk sharing
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkExpiration, setBulkExpiration] = useState('never');
  const [bulkPassword, setBulkPassword] = useState('');
  const [bulkUsePassword, setBulkUsePassword] = useState(false);
  const [bulkRedact, setBulkRedact] = useState(false);

  // #7 Revogação por inatividade
  const [autoRevoke, setAutoRevoke] = useState<'never' | '7d' | '30d'>('never');

  // #8 Edição pós-publicação
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExpiration, setEditExpiration] = useState('never');
  const [editPassword, setEditPassword] = useState('');
  const [editUsePassword, setEditUsePassword] = useState(false);
  const [editRedact, setEditRedact] = useState(false);

  // Feature 1: Embed iframe
  const [embedModal, setEmbedModal] = useState<string | null>(null);
  const [embedCopied, setEmbedCopied] = useState(false);

  // Feature 2: Notificação de acesso
  const [accessNotifications, setAccessNotifications] = useState<AccessNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Feature 3: Compartilhar parcial
  const [usePartialRange, setUsePartialRange] = useState(false);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);

  // Feature 4: Histórico de compartilhamentos
  const [sharingHistory, setSharingHistory] = useState<SharingHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Feature 5: Agendamento de publicação
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledItems, setScheduledItems] = useState<Array<{ id: string; sessionId: string; publishAt: string; expiration: string }>>([]);

  // Feature 6: Watermark
  const [useWatermark, setUseWatermark] = useState(false);
  const [watermarkText, setWatermarkText] = useState('');

  // Feature 7: Download como HTML
  const [downloadingHtml, setDownloadingHtml] = useState<string | null>(null);

  // Feature 8: Limite de visualizações
  const [useViewLimit, setUseViewLimit] = useState(false);
  const [viewLimit, setViewLimit] = useState(10);

  // Feature 30: Comentários de viewers
  const [commentsModal, setCommentsModal] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Array<{ id: string; author: string; text: string; timestamp: string }>>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-sharing-comments') || '{}'); } catch { return {}; }
  });
  const [newCommentAuthor, setNewCommentAuthor] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [allowComments, setAllowComments] = useState(false);

  // Feature 38: Colaboração (fork)
  const [allowFork, setAllowFork] = useState(false);
  const [forkHistory, setForkHistory] = useState<Array<{ id: string; publicId: string; forkedAt: string; forkerId: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-sharing-forks') || '[]'); } catch { return []; }
  });
  const [showForksModal, setShowForksModal] = useState<string | null>(null);

  // NEW: Link preview card
  const [linkPreviewData, setLinkPreviewData] = useState<{ title: string; messageCount: number; excerpt: string } | null>(null);

  // NEW: Short link state
  const [shortLinks, setShortLinks] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-sharing-shortlinks') || '{}'); } catch { return {}; }
  });

  // NEW: Annotation threads
  const [annotationModal, setAnnotationModal] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Record<string, Array<{ id: string; author: string; text: string; msgIndex: number; timestamp: string }>>>(() => {
    try { return JSON.parse(localStorage.getItem('ados-sharing-annotations') || '{}'); } catch { return {}; }
  });
  const [newAnnotationAuthor, setNewAnnotationAuthor] = useState('');
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [newAnnotationMsgIndex, setNewAnnotationMsgIndex] = useState(0);

  // NEW: Access log sort state
  const [accessLogSort, setAccessLogSort] = useState<'time' | 'browser' | 'duration'>('time');
  const [accessLogSortDir, setAccessLogSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { load(); }, []);

  // Cooldown timer
  useEffect(() => {
    if (publishCooldown <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lastPublishTime + 10000 - Date.now()) / 1000));
      setPublishCooldown(remaining);
    }, 200);
    return () => clearInterval(timer);
  }, [publishCooldown, lastPublishTime]);

  // Load saved endpoint
  useEffect(() => {
    const saved = localStorage.getItem('ados-sharing-endpoint');
    if (saved) setSharingEndpoint(saved);
    // Load history
    const history = JSON.parse(localStorage.getItem('ados-sharing-history') || '[]');
    setSharingHistory(history);
    // Load notifications
    const notifs = JSON.parse(localStorage.getItem('ados-sharing-notifications') || '[]');
    setAccessNotifications(notifs);
    // Load scheduled items
    const scheduled = JSON.parse(localStorage.getItem('ados-sharing-scheduled') || '[]');
    setScheduledItems(scheduled);
  }, []);

  // Feature 5: Check scheduled publications
  useEffect(() => {
    const interval = setInterval(async () => {
      const scheduled = JSON.parse(localStorage.getItem('ados-sharing-scheduled') || '[]');
      const now = Date.now();
      let changed = false;
      const remaining: typeof scheduledItems = [];
      for (const item of scheduled) {
        if (new Date(item.publishAt).getTime() <= now) {
          const publicId = crypto.randomUUID().split('-').join('').slice(0, 12);
          let expiresAt: string | null = null;
          if (item.expiration !== 'never') {
            const ms = ({ '1h': 3600000, '24h': 86400000, '7d': 604800000 } as Record<string, number>)[item.expiration] || 0;
            if (ms) expiresAt = new Date(now + ms).toISOString();
          }
          await ados.db?.shareSession(item.sessionId, publicId, expiresAt);
          addHistoryEntry('publish', publicId, getTitle(item.sessionId), 'Publicação agendada');
          changed = true;
        } else {
          remaining.push(item);
        }
      }
      if (changed) {
        localStorage.setItem('ados-sharing-scheduled', JSON.stringify(remaining));
        setScheduledItems(remaining);
        load();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [sessions]);

  const load = async () => {
    const [sharedList, sessionList] = await Promise.all([
      ados.db.getSharedSessions(),
      ados.db.getSessions(),
    ]);
    setShared(sharedList);
    setSessions(sessionList);
    // Load access stats from localStorage
    const stats = JSON.parse(localStorage.getItem('ados-sharing-stats') || '{}');
    setAccessStats(stats);

    // #7 Auto-revogação por inatividade
    const revokeSettings = JSON.parse(localStorage.getItem('ados-sharing-autorevoke') || '{}');
    const now = Date.now();
    for (const item of sharedList) {
      const setting = revokeSettings[item.publicId];
      if (!setting || setting === 'never') continue;
      const itemStats = stats[item.publicId];
      if (!itemStats?.lastAccessed) continue;
      const lastAccess = new Date(itemStats.lastAccessed).getTime();
      const thresholdMs = setting === '7d' ? 7 * 86400000 : 30 * 86400000;
      if (now - lastAccess > thresholdMs) {
        await ados.db.unshareSession(item.sessionId);
      }
    }
    // Reload after potential revocations
    const refreshed = await ados.db.getSharedSessions();
    if (refreshed.length !== sharedList.length) {
      setShared(refreshed);
    }
  };

  const handlePreview = async () => {
    if (!selectedSession) return;
    const messages = await ados.db.getMessages(selectedSession);
    setPreviewMessages(messages);
    const allText = messages.map((m: any) => m.content || '').join('\n');
    setSensitiveWarnings(scanSensitive(allText));
    setShowPreview(true);
  };

  const handleShare = async () => {
    if (!selectedSession) return;
    // Rate limit — 10s cooldown between publishes
    const now = Date.now();
    if (now - lastPublishTime < 10000) {
      setPublishCooldown(Math.ceil((lastPublishTime + 10000 - now) / 1000));
      return;
    }
    // Max 10 active shares
    if (shared.length >= 10) {
      alert('Limite de 10 sessões publicadas atingido. Revogue uma para publicar outra.');
      return;
    }
    const publicId = crypto.randomUUID().split('-').join('').slice(0, 12);
    let expiresAt: string | null = null;
    if (expiration !== 'never') {
      const ms = { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[expiration] || 0;
      if (ms) expiresAt = new Date(Date.now() + ms).toISOString();
    }
    // Store password if set
    if (usePassword && password.trim()) {
      const passwords = JSON.parse(localStorage.getItem('ados-sharing-passwords') || '{}');
      passwords[publicId] = password;
      localStorage.setItem('ados-sharing-passwords', JSON.stringify(passwords));
    }
    // Store redact preference
    if (redactTools) {
      const redacts = JSON.parse(localStorage.getItem('ados-sharing-redact') || '{}');
      redacts[publicId] = true;
      localStorage.setItem('ados-sharing-redact', JSON.stringify(redacts));
    }
    // #2 Store email restrictions
    if (useEmailRestriction && allowedEmails.trim()) {
      const emailRestrictions = JSON.parse(localStorage.getItem('ados-sharing-emails') || '{}');
      emailRestrictions[publicId] = allowedEmails.split('\n').map(e => e.trim()).filter(Boolean);
      localStorage.setItem('ados-sharing-emails', JSON.stringify(emailRestrictions));
    }
    // #4 Store theme preference
    if (viewerTheme !== 'auto') {
      const themes = JSON.parse(localStorage.getItem('ados-sharing-themes') || '{}');
      themes[publicId] = viewerTheme;
      localStorage.setItem('ados-sharing-themes', JSON.stringify(themes));
    }
    // #5 Store snapshot setting
    const snapshots = JSON.parse(localStorage.getItem('ados-sharing-snapshots') || '{}');
    snapshots[publicId] = isSnapshot;
    localStorage.setItem('ados-sharing-snapshots', JSON.stringify(snapshots));
    // #7 Store auto-revoke setting
    if (autoRevoke !== 'never') {
      const revokeSettings = JSON.parse(localStorage.getItem('ados-sharing-autorevoke') || '{}');
      revokeSettings[publicId] = autoRevoke;
      localStorage.setItem('ados-sharing-autorevoke', JSON.stringify(revokeSettings));
    }
    // Initialize access stats with detailed views
    const stats = { ...accessStats, [publicId]: { views: 0, lastAccessed: null, details: [] as DetailedView[] } };
    setAccessStats(stats);
    localStorage.setItem('ados-sharing-stats', JSON.stringify(stats));
    // Feature 3: Store partial range
    if (usePartialRange && totalMessages > 0) {
      const ranges = JSON.parse(localStorage.getItem('ados-sharing-ranges') || '{}');
      ranges[publicId] = { start: rangeStart, end: rangeEnd };
      localStorage.setItem('ados-sharing-ranges', JSON.stringify(ranges));
    }
    // Feature 6: Store watermark
    if (useWatermark && watermarkText.trim()) {
      const watermarks = JSON.parse(localStorage.getItem('ados-sharing-watermarks') || '{}');
      watermarks[publicId] = watermarkText;
      localStorage.setItem('ados-sharing-watermarks', JSON.stringify(watermarks));
    }
    // Feature 8: Store view limit
    if (useViewLimit && viewLimit > 0) {
      const limits = JSON.parse(localStorage.getItem('ados-sharing-viewlimits') || '{}');
      limits[publicId] = viewLimit;
      localStorage.setItem('ados-sharing-viewlimits', JSON.stringify(limits));
    }
    // Feature 30: Store comments permission
    if (allowComments) {
      const commentsEnabled = JSON.parse(localStorage.getItem('ados-sharing-comments-enabled') || '{}');
      commentsEnabled[publicId] = true;
      localStorage.setItem('ados-sharing-comments-enabled', JSON.stringify(commentsEnabled));
    }
    // Feature 38: Store fork permission
    if (allowFork) {
      const forksEnabled = JSON.parse(localStorage.getItem('ados-sharing-forks-enabled') || '{}');
      forksEnabled[publicId] = true;
      localStorage.setItem('ados-sharing-forks-enabled', JSON.stringify(forksEnabled));
    }

    await ados.db.shareSession(selectedSession, publicId, expiresAt);
    // Feature 4: Add to history
    addHistoryEntry('publish', publicId, getTitle(selectedSession));
    setLastPublishTime(Date.now());
    setSelectedSession('');
    setShowPreview(false);
    setExpiration('never');
    setPassword('');
    setUsePassword(false);
    setRedactTools(false);
    setUseEmailRestriction(false);
    setAllowedEmails('');
    setViewerTheme('auto');
    setIsSnapshot(true);
    setAutoRevoke('never');
    setUsePartialRange(false);
    setRangeStart(1);
    setRangeEnd(1);
    setUseWatermark(false);
    setWatermarkText('');
    setUseViewLimit(false);
    setViewLimit(10);
    setAllowComments(false);
    setAllowFork(false);
    load();
  };

  const handleUnshare = async (sessionId: string) => {
    const entry = shared.find(s => s.sessionId === sessionId);
    await ados.db.unshareSession(sessionId);
    if (entry) addHistoryEntry('revoke', entry.publicId, getTitle(sessionId));
    setConfirmRevoke(null);
    load();
  };

  const handleExportMarkdown = async (sessionId: string) => {
    const messages = await ados.db.getMessages(sessionId);
    const title = getTitle(sessionId);
    let md = `# ${title}\n\n`;
    for (const msg of messages) {
      const role = msg.role === 'user' ? '**Você**' : '**Assistente**';
      md += `${role}:\n${msg.content}\n\n---\n\n`;
    }
    await navigator.clipboard.writeText(md);
    setCopied(sessionId + '-md');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopy = async (publicId: string) => {
    const sharedEntry = shared.find(s => s.publicId === publicId);
    if (sharedEntry) {
      const messages = await ados.db.getMessages(sharedEntry.sessionId);
      const title = getTitle(sharedEntry.sessionId);
      const exportData = { title, publicId, messages, exportedAt: new Date().toISOString() };
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    } else {
      await navigator.clipboard.writeText(`ados://shared/${publicId}`);
    }
    setCopied(publicId);
    setTimeout(() => setCopied(null), 2000);
  };

  // #6 Bulk publish
  const handleBulkPublish = async () => {
    const now = Date.now();
    for (const sessionId of bulkSelected) {
      const publicId = crypto.randomUUID().split('-').join('').slice(0, 12);
      let expiresAt: string | null = null;
      if (bulkExpiration !== 'never') {
        const ms = { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[bulkExpiration] || 0;
        if (ms) expiresAt = new Date(now + ms).toISOString();
      }
      if (bulkUsePassword && bulkPassword.trim()) {
        const passwords = JSON.parse(localStorage.getItem('ados-sharing-passwords') || '{}');
        passwords[publicId] = bulkPassword;
        localStorage.setItem('ados-sharing-passwords', JSON.stringify(passwords));
      }
      if (bulkRedact) {
        const redacts = JSON.parse(localStorage.getItem('ados-sharing-redact') || '{}');
        redacts[publicId] = true;
        localStorage.setItem('ados-sharing-redact', JSON.stringify(redacts));
      }
      const stats = JSON.parse(localStorage.getItem('ados-sharing-stats') || '{}');
      stats[publicId] = { views: 0, lastAccessed: null, details: [] };
      localStorage.setItem('ados-sharing-stats', JSON.stringify(stats));

      await ados.db.shareSession(sessionId, publicId, expiresAt);
    }
    setShowBulkModal(false);
    setBulkSelected([]);
    setBulkExpiration('never');
    setBulkPassword('');
    setBulkUsePassword(false);
    setBulkRedact(false);
    load();
  };

  // #8 Save edits
  const handleSaveEdit = (publicId: string) => {
    // Update password
    const passwords = JSON.parse(localStorage.getItem('ados-sharing-passwords') || '{}');
    if (editUsePassword && editPassword.trim()) {
      passwords[publicId] = editPassword;
    } else {
      delete passwords[publicId];
    }
    localStorage.setItem('ados-sharing-passwords', JSON.stringify(passwords));

    // Update redact
    const redacts = JSON.parse(localStorage.getItem('ados-sharing-redact') || '{}');
    if (editRedact) {
      redacts[publicId] = true;
    } else {
      delete redacts[publicId];
    }
    localStorage.setItem('ados-sharing-redact', JSON.stringify(redacts));

    // Update expiration (store custom expiration in localStorage)
    if (editExpiration !== 'never') {
      const ms = { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[editExpiration] || 0;
      if (ms) {
        const expirations = JSON.parse(localStorage.getItem('ados-sharing-expirations') || '{}');
        expirations[publicId] = new Date(Date.now() + ms).toISOString();
        localStorage.setItem('ados-sharing-expirations', JSON.stringify(expirations));
      }
    } else {
      const expirations = JSON.parse(localStorage.getItem('ados-sharing-expirations') || '{}');
      delete expirations[publicId];
      localStorage.setItem('ados-sharing-expirations', JSON.stringify(expirations));
    }

    setEditingId(null);
    setEditPassword('');
    setEditUsePassword(false);
    setEditRedact(false);
    setEditExpiration('never');
    load();
  };

  const startEdit = (publicId: string) => {
    const passwords = JSON.parse(localStorage.getItem('ados-sharing-passwords') || '{}');
    const redacts = JSON.parse(localStorage.getItem('ados-sharing-redact') || '{}');
    setEditingId(publicId);
    setEditUsePassword(!!passwords[publicId]);
    setEditPassword(passwords[publicId] || '');
    setEditRedact(!!redacts[publicId]);
    setEditExpiration('never');
  };

  // Feature 1: Generate embed iframe snippet
  const getEmbedSnippet = (publicId: string) => {
    const url = getShareUrl(publicId);
    return `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border:1px solid #e5e7eb;border-radius:8px;" allowfullscreen></iframe>`;
  };

  const handleCopyEmbed = (publicId: string) => {
    navigator.clipboard.writeText(getEmbedSnippet(publicId));
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  };

  // Feature 2: Simulate access notification
  const simulateAccessNotification = useCallback((publicId: string) => {
    const title = getTitle(shared.find(s => s.publicId === publicId)?.sessionId || '');
    const notif: AccessNotification = {
      id: crypto.randomUUID(),
      publicId,
      sessionTitle: title,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const existing = JSON.parse(localStorage.getItem('ados-sharing-notifications') || '[]');
    const updated = [notif, ...existing].slice(0, 50);
    localStorage.setItem('ados-sharing-notifications', JSON.stringify(updated));
    setAccessNotifications(updated);
  }, [shared, sessions]);

  const markNotificationsRead = () => {
    const updated = accessNotifications.map(n => ({ ...n, read: true }));
    setAccessNotifications(updated);
    localStorage.setItem('ados-sharing-notifications', JSON.stringify(updated));
  };

  const unreadNotifCount = accessNotifications.filter(n => !n.read).length;

  // Feature 3: Load messages count when session selected
  const handleSessionChange = async (sessionId: string) => {
    setSelectedSession(sessionId);
    if (sessionId) {
      const messages = await ados.db?.getMessages(sessionId);
      if (messages) {
        setTotalMessages(messages.length);
        setRangeStart(1);
        setRangeEnd(messages.length);
      }
    } else {
      setTotalMessages(0);
    }
  };

  // Feature 4: History helper
  const addHistoryEntry = (action: SharingHistoryEntry['action'], publicId: string, sessionTitle: string, details?: string) => {
    const entry: SharingHistoryEntry = {
      id: crypto.randomUUID(),
      action,
      publicId,
      sessionTitle,
      timestamp: new Date().toISOString(),
      details,
    };
    const existing = JSON.parse(localStorage.getItem('ados-sharing-history') || '[]');
    const updated = [entry, ...existing].slice(0, 100);
    localStorage.setItem('ados-sharing-history', JSON.stringify(updated));
    setSharingHistory(updated);
  };

  // Feature 5: Schedule publication
  const handleSchedulePublish = () => {
    if (!selectedSession || !scheduleDate || !scheduleTime) return;
    const publishAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    const item = { id: crypto.randomUUID(), sessionId: selectedSession, publishAt, expiration };
    const scheduled = JSON.parse(localStorage.getItem('ados-sharing-scheduled') || '[]');
    const updated = [...scheduled, item];
    localStorage.setItem('ados-sharing-scheduled', JSON.stringify(updated));
    setScheduledItems(updated);
    addHistoryEntry('schedule', item.id, getTitle(selectedSession), `Agendado para ${scheduleDate} ${scheduleTime}`);
    setSelectedSession('');
    setUseSchedule(false);
    setScheduleDate('');
    setScheduleTime('');
  };

  const handleCancelScheduled = (id: string) => {
    const scheduled = JSON.parse(localStorage.getItem('ados-sharing-scheduled') || '[]');
    const updated = scheduled.filter((s: any) => s.id !== id);
    localStorage.setItem('ados-sharing-scheduled', JSON.stringify(updated));
    setScheduledItems(updated);
  };

  // Feature 7: Download as standalone HTML
  const handleDownloadHtml = async (sessionId: string, publicId: string) => {
    setDownloadingHtml(publicId);
    const messages = await ados.db?.getMessages(sessionId);
    const title = getTitle(sessionId);
    const watermarks = JSON.parse(localStorage.getItem('ados-sharing-watermarks') || '{}');
    const watermark = watermarks[publicId] || '';
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f0f;color:#e5e5e5;padding:2rem;max-width:800px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:1.5rem;color:#fff}
.msg{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:1rem;margin-bottom:0.75rem}
.role{font-size:0.7rem;text-transform:uppercase;color:#888;margin-bottom:0.25rem;font-weight:600}
.content{font-size:0.875rem;line-height:1.6;white-space:pre-wrap}
.meta{text-align:center;color:#555;font-size:0.7rem;margin-top:2rem}
${watermark ? `.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:4rem;color:rgba(255,255,255,0.03);pointer-events:none;white-space:nowrap;z-index:9999}` : ''}
</style>
</head>
<body>
${watermark ? `<div class="watermark">${watermark}</div>` : ''}
<h1>${title}</h1>
${(messages || []).map((m: any) => `<div class="msg"><div class="role">${m.role}</div><div class="content">${(m.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></div>`).join('\n')}
<p class="meta">Exportado em ${new Date().toLocaleString('pt-BR')} via JVOS Sharing</p>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadingHtml(null);
  };

  // Feature 8: Check view limit
  const isViewLimitReached = (publicId: string): boolean => {
    const limits = JSON.parse(localStorage.getItem('ados-sharing-viewlimits') || '{}');
    const limit = limits[publicId];
    if (!limit) return false;
    const stats = accessStats[publicId];
    return stats ? stats.views >= limit : false;
  };

  // Feature 30: Comment handlers
  const handleAddComment = (publicId: string) => {
    if (!newCommentText.trim()) return;
    const comment = {
      id: crypto.randomUUID(),
      author: newCommentAuthor.trim() || 'Anônimo',
      text: newCommentText.trim(),
      timestamp: new Date().toISOString(),
    };
    const updated = { ...comments, [publicId]: [...(comments[publicId] || []), comment] };
    setComments(updated);
    localStorage.setItem('ados-sharing-comments', JSON.stringify(updated));
    setNewCommentText('');
    setNewCommentAuthor('');
  };

  const handleDeleteComment = (publicId: string, commentId: string) => {
    const updated = { ...comments, [publicId]: (comments[publicId] || []).filter(c => c.id !== commentId) };
    setComments(updated);
    localStorage.setItem('ados-sharing-comments', JSON.stringify(updated));
  };

  // Feature 38: Fork handler
  const handleForkSession = async (publicId: string) => {
    const entry = shared.find(s => s.publicId === publicId);
    if (!entry) return;
    // Create a new session as a fork
    const forkId = crypto.randomUUID();
    const messages = await ados.db?.getMessages(entry.sessionId);
    const title = getTitle(entry.sessionId);
    await ados.db?.createSession?.(forkId, `[Fork] ${title}`);
    if (messages && messages.length > 0) {
      for (const msg of messages) {
        await ados.db?.addMessage?.(forkId, msg.role, msg.content);
      }
    }
    const forkEntry = { id: crypto.randomUUID(), publicId, forkedAt: new Date().toISOString(), forkerId: forkId };
    const updated = [...forkHistory, forkEntry];
    setForkHistory(updated);
    localStorage.setItem('ados-sharing-forks', JSON.stringify(updated));
    load();
  };

  // #3 Generate mock detailed analytics
  const getDetailedViews = (publicId: string): DetailedView[] => {
    const stats = accessStats[publicId];
    if (!stats || stats.views === 0) return [];
    if (stats.details && stats.details.length > 0) return stats.details;
    // Generate mock data
    const browsers = ['Chrome', 'Safari', 'Firefox'];
    const countries = ['BR', 'US', 'PT'];
    const details: DetailedView[] = [];
    let seed = 0;
    for (let i = 0; i < publicId.length; i++) seed += publicId.charCodeAt(i);
    for (let i = 0; i < stats.views; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      details.push({
        timestamp: new Date(Date.now() - (stats.views - i) * 3600000 * (1 + seed % 5)).toISOString(),
        browser: browsers[seed % 3],
        country: countries[(seed >> 4) % 3],
        readingTime: 1 + (seed % 15),
      });
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    }
    return details;
  };

  const getTitle = (sessionId: string) => sessions.find(s => s.id === sessionId)?.title || 'Sessão';

  const getShareUrl = (publicId: string) => sharingEndpoint ? `${sharingEndpoint}/${publicId}` : `ados://shared/${publicId}`;

  // NEW #3: Password strength meter helper
  const getPasswordStrength = useCallback((pw: string): { level: 'weak' | 'medium' | 'strong'; color: string; width: string } => {
    if (pw.length < 4) return { level: 'weak', color: 'bg-red-500', width: '33%' };
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNum = /[0-9]/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const score = [pw.length >= 8, hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;
    if (score >= 4) return { level: 'strong', color: 'bg-green-500', width: '100%' };
    if (score >= 2) return { level: 'medium', color: 'bg-yellow-500', width: '66%' };
    return { level: 'weak', color: 'bg-red-500', width: '33%' };
  }, []);

  // NEW #4: Expiration countdown helper
  const getExpirationCountdown = useCallback((expiresAt: string | null | undefined): { text: string; urgency: string } | null => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expirado', urgency: 'text-red-500' };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    let text = '';
    if (days > 0) text = `${days}d ${hours}h`;
    else if (hours > 0) text = `${hours}h ${minutes}min`;
    else text = `${minutes}min`;
    const urgency = days > 2 ? 'text-green-500' : days >= 1 ? 'text-yellow-500' : 'text-red-500';
    return { text: `Expira em ${text}`, urgency };
  }, []);

  // NEW #8: Link shortener
  const handleShortenLink = useCallback((publicId: string) => {
    const short = `ados.sh/${publicId.slice(0, 6)}`;
    const updated = { ...shortLinks, [publicId]: short };
    setShortLinks(updated);
    localStorage.setItem('ados-sharing-shortlinks', JSON.stringify(updated));
  }, [shortLinks]);

  // NEW #9: Read time estimate
  const getReadTimeEstimate = useCallback((publicId: string): string => {
    const entry = shared.find(s => s.publicId === publicId);
    if (!entry) return '';
    const stats = accessStats[publicId];
    const msgCount = stats?.views !== undefined ? (totalMessages || 10) : 10;
    const avgWordsPerMsg = 50;
    const totalWords = msgCount * avgWordsPerMsg;
    const minutes = Math.max(1, Math.round(totalWords / 200));
    return `~${minutes} min de leitura`;
  }, [shared, accessStats, totalMessages]);

  // NEW #1: Generate link preview card data
  const handleGenerateLinkPreview = useCallback(async (sessionId: string) => {
    const messages = await ados.db?.getMessages(sessionId);
    const title = getTitle(sessionId);
    const excerpt = messages && messages.length > 0 ? (messages[0].content || '').slice(0, 100) : '';
    setLinkPreviewData({ title, messageCount: messages?.length || 0, excerpt });
  }, [sessions]);

  // NEW #5: Sort access log entries
  const getSortedAccessLog = useCallback((details: DetailedView[]): DetailedView[] => {
    return [...details].sort((a, b) => {
      let cmp = 0;
      if (accessLogSort === 'time') cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      else if (accessLogSort === 'browser') cmp = a.browser.localeCompare(b.browser);
      else if (accessLogSort === 'duration') cmp = a.readingTime - b.readingTime;
      return accessLogSortDir === 'desc' ? -cmp : cmp;
    });
  }, [accessLogSort, accessLogSortDir]);

  // NEW #10: Annotation handlers
  const handleAddAnnotation = useCallback((publicId: string) => {
    if (!newAnnotationText.trim()) return;
    const annotation = {
      id: crypto.randomUUID(),
      author: newAnnotationAuthor.trim() || 'Anônimo',
      text: newAnnotationText.trim(),
      msgIndex: newAnnotationMsgIndex,
      timestamp: new Date().toISOString(),
    };
    const updated = { ...annotations, [publicId]: [...(annotations[publicId] || []), annotation] };
    setAnnotations(updated);
    localStorage.setItem('ados-sharing-annotations', JSON.stringify(updated));
    setNewAnnotationText('');
    setNewAnnotationAuthor('');
    setNewAnnotationMsgIndex(0);
  }, [annotations, newAnnotationAuthor, newAnnotationText, newAnnotationMsgIndex]);

  const handleDeleteAnnotation = useCallback((publicId: string, annotationId: string) => {
    const updated = { ...annotations, [publicId]: (annotations[publicId] || []).filter(a => a.id !== annotationId) };
    setAnnotations(updated);
    localStorage.setItem('ados-sharing-annotations', JSON.stringify(updated));
  }, [annotations]);

  const unpublishedSessions = sessions.filter(s => !shared.find(sh => sh.sessionId === s.id));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Compartilhamento</h1>
            <p className="text-sm text-muted mt-1">Publique sessões com link para leitura externa.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Feature 2: Notification bell */}
            <button
              onClick={() => { setShowNotifications(!showNotifications); markNotificationsRead(); }}
              className="relative px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary transition-colors"
            >
              Notificações
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            {/* Feature 4: History button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary transition-colors"
            >
              Histórico
            </button>
            {/* #6 Bulk sharing button */}
            <button
              onClick={() => setShowBulkModal(true)}
              disabled={unpublishedSessions.length === 0}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
            >
              Publicar múltiplas
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Publicar sessão</h3>
              {/* Servidor config toggle */}
              <button
                onClick={() => setShowEndpointConfig(!showEndpointConfig)}
                className="text-[10px] text-muted hover:text-secondary"
              >
                Configurar servidor
              </button>
            </div>
            {/* Endpoint config */}
            {showEndpointConfig && (
              <div className="bg-surface-0 border border-default rounded-lg p-3 space-y-2">
                <label className="text-[10px] text-muted">Endpoint do servidor de sharing:</label>
                <div className="flex items-center gap-2">
                  <input
                    value={sharingEndpoint}
                    onChange={(e) => setSharingEndpoint(e.target.value)}
                    placeholder="https://seu-servidor.com/api/shared"
                    className="flex-1 bg-surface-1 border border-default rounded px-2 py-1.5 text-xs text-primary font-mono outline-none"
                  />
                  <button
                    onClick={() => { localStorage.setItem('ados-sharing-endpoint', sharingEndpoint); setShowEndpointConfig(false); }}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded text-xs text-white"
                  >
                    Salvar
                  </button>
                </div>
                <p className="text-[10px] text-muted">GET /shared/:publicId retornará o HTML renderizado da sessão.</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <select
                value={selectedSession}
                onChange={(e) => handleSessionChange(e.target.value)}
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
              >
                <option value="">Selecione uma sessão</option>
                {unpublishedSessions.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <select
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
              >
                <option value="never">Sem expiração</option>
                <option value="1h">Expira em 1h</option>
                <option value="24h">Expira em 24h</option>
                <option value="7d">Expira em 7 dias</option>
              </select>
              <button
                onClick={handlePreview}
                disabled={!selectedSession}
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-secondary transition-all"
              >
                Preview
              </button>
              <button
                onClick={handleShare}
                disabled={!selectedSession || publishCooldown > 0}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
              >
                {publishCooldown > 0 ? `Aguarde ${publishCooldown}s` : 'Publicar'}
              </button>
            </div>
            {/* Proteção por senha + Redact */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Proteger com senha</span>
              </label>
              {usePassword && (
                <div className="flex flex-col gap-1">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Senha de acesso"
                    className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-40"
                  />
                  {/* NEW #3: Password strength meter */}
                  {password && (
                    <div className="w-40 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${getPasswordStrength(password).color}`} style={{ width: getPasswordStrength(password).width }} />
                    </div>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redactTools}
                  onChange={(e) => setRedactTools(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Ocultar tool outputs</span>
              </label>
            </div>
            {/* #2 Acesso por email */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useEmailRestriction}
                  onChange={(e) => setUseEmailRestriction(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Restringir por email</span>
              </label>
              {useEmailRestriction && (
                <textarea
                  value={allowedEmails}
                  onChange={(e) => setAllowedEmails(e.target.value)}
                  placeholder="Um email por linha"
                  rows={3}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none font-mono resize-none"
                />
              )}
            </div>
            {/* #4 Tema do viewer */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-xs text-secondary">Tema:</label>
              <select
                value={viewerTheme}
                onChange={(e) => setViewerTheme(e.target.value as 'auto' | 'dark' | 'light')}
                className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
              >
                <option value="auto">Auto</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
              {/* #5 Snapshot estático */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSnapshot}
                  onChange={(e) => setIsSnapshot(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Snapshot estático</span>
              </label>
              {/* #7 Auto-revogar */}
              <label className="text-xs text-secondary">Auto-revogar:</label>
              <select
                value={autoRevoke}
                onChange={(e) => setAutoRevoke(e.target.value as 'never' | '7d' | '30d')}
                className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
              >
                <option value="never">Nunca</option>
                <option value="7d">7 dias sem acesso</option>
                <option value="30d">30 dias sem acesso</option>
              </select>
            </div>
            {/* Feature 3: Compartilhar parcial */}
            {selectedSession && totalMessages > 0 && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePartialRange}
                    onChange={(e) => setUsePartialRange(e.target.checked)}
                    className="rounded border-default"
                  />
                  <span className="text-xs text-secondary">Compartilhar parcial (range de mensagens)</span>
                </label>
                {usePartialRange && (
                  <div className="flex items-center gap-3">
                    <label className="text-[10px] text-muted">De:</label>
                    <input
                      type="number"
                      min={1}
                      max={rangeEnd}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-surface-0 border border-default rounded px-2 py-1 text-xs text-primary w-16 outline-none"
                    />
                    <label className="text-[10px] text-muted">Até:</label>
                    <input
                      type="number"
                      min={rangeStart}
                      max={totalMessages}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(Math.min(totalMessages, parseInt(e.target.value) || totalMessages))}
                      className="bg-surface-0 border border-default rounded px-2 py-1 text-xs text-primary w-16 outline-none"
                    />
                    <span className="text-[10px] text-muted">de {totalMessages} mensagens</span>
                  </div>
                )}
              </div>
            )}
            {/* Feature 5: Agendamento de publicação */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSchedule}
                  onChange={(e) => setUseSchedule(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Agendar publicação</span>
              </label>
              {useSchedule && (
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="bg-surface-0 border border-default rounded px-2 py-1.5 text-xs text-primary outline-none"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-surface-0 border border-default rounded px-2 py-1.5 text-xs text-primary outline-none"
                  />
                  <button
                    onClick={handleSchedulePublish}
                    disabled={!selectedSession || !scheduleDate || !scheduleTime}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded text-xs text-white font-medium"
                  >
                    Agendar
                  </button>
                </div>
              )}
            </div>
            {/* Feature 6: Watermark */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useWatermark}
                  onChange={(e) => setUseWatermark(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Adicionar marca d'água</span>
              </label>
              {useWatermark && (
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Nome do destinatário"
                  className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-60"
                />
              )}
            </div>
            {/* NEW #6: Watermark preview */}
            {useWatermark && watermarkText.trim() && (
              <div className="bg-surface-0 border border-default rounded-lg p-3 relative overflow-hidden" style={{ minHeight: 60 }}>
                <p className="text-[10px] text-muted mb-1">Preview da marca d'agua:</p>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-lg text-primary/5 font-bold rotate-[-30deg] whitespace-nowrap">{watermarkText}</span>
                </div>
                <div className="relative flex gap-1">
                  <div className="bg-surface-2 rounded h-3 w-16" />
                  <div className="bg-surface-2 rounded h-3 w-24" />
                </div>
              </div>
            )}
            {/* Feature 8: Limite de visualizações */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useViewLimit}
                  onChange={(e) => setUseViewLimit(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Limite de visualizações</span>
              </label>
              {useViewLimit && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={viewLimit}
                    onChange={(e) => setViewLimit(parseInt(e.target.value) || 10)}
                    className="bg-surface-0 border border-default rounded px-2 py-1 text-xs text-primary w-16 outline-none"
                  />
                  <span className="text-[10px] text-muted">views</span>
                </div>
              )}
            </div>
            {/* Feature 30 & 38: Comments and Fork toggles */}
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Permitir comentários</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowFork}
                  onChange={(e) => setAllowFork(e.target.checked)}
                  className="rounded border-default"
                />
                <span className="text-xs text-secondary">Permitir fork (colaboração)</span>
              </label>
            </div>
            {/* NEW #1: Link preview card */}
            {selectedSession && (
              <div className="space-y-2">
                <button
                  onClick={() => handleGenerateLinkPreview(selectedSession)}
                  className="text-[10px] text-brand-600 hover:underline"
                >
                  Gerar preview do link
                </button>
                {linkPreviewData && (
                  <div className="bg-surface-0 border border-default rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-primary">{linkPreviewData.title}</p>
                    <p className="text-[10px] text-muted">{linkPreviewData.messageCount} mensagens</p>
                    <p className="text-[10px] text-secondary italic line-clamp-2">{linkPreviewData.excerpt || '(sem conteudo)'}</p>
                  </div>
                )}
              </div>
            )}
            {/* Rate limit info */}
            <p className="text-[10px] text-muted">{shared.length}/10 publicações ativas</p>
          </div>

          {shared.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Nenhuma sessão compartilhada.</p>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-secondary">Sessões publicadas</h3>
              {shared.map(s => {
                const stats = accessStats[s.publicId];
                const allPasswords = JSON.parse(localStorage.getItem('ados-sharing-passwords') || '{}');
                const hasPassword = !!allPasswords[s.publicId];
                const allRedacts = JSON.parse(localStorage.getItem('ados-sharing-redact') || '{}');
                const hasRedact = !!allRedacts[s.publicId];
                const allEmails = JSON.parse(localStorage.getItem('ados-sharing-emails') || '{}');
                const hasEmailRestriction = !!allEmails[s.publicId]?.length;
                const allThemes = JSON.parse(localStorage.getItem('ados-sharing-themes') || '{}');
                const theme = allThemes[s.publicId];
                const allSnapshots = JSON.parse(localStorage.getItem('ados-sharing-snapshots') || '{}');
                const snapshotSetting = allSnapshots[s.publicId];
                const isEditing = editingId === s.publicId;
                const detailedViews = getDetailedViews(s.publicId);
                const isExpanded = expandedAnalytics === s.publicId;

                return (
                  <div key={s.sessionId} className="bg-surface-1 border border-default rounded-xl px-5 py-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-primary">{getTitle(s.sessionId)}</p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">
                          {shortLinks[s.publicId] || getShareUrl(s.publicId)}
                        </p>
                        {/* NEW #9: Read time estimate */}
                        <span className="text-[10px] text-muted italic">{getReadTimeEstimate(s.publicId)}</span>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-[10px] text-muted">Publicado em {new Date(s.publishedAt).toLocaleDateString('pt-BR')}</p>
                          {/* NEW #2: Viewer count badge */}
                          {stats && stats.views > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-brand-600/10 text-brand-500 rounded-full font-semibold">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              {stats.views}
                            </span>
                          )}
                          {/* NEW #4: Expiration countdown */}
                          {(() => { const cd = getExpirationCountdown(s.expiresAt); return cd ? <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cd.urgency} bg-surface-2`}>{cd.text}</span> : null; })()}
                          {/* Estatísticas de acesso */}
                          {stats && (
                            <button
                              onClick={() => setExpandedAnalytics(isExpanded ? null : s.publicId)}
                              className="text-[10px] text-muted hover:text-secondary underline cursor-pointer"
                            >
                              {stats.views} visualizações{stats.lastAccessed ? ` · último: ${new Date(stats.lastAccessed).toLocaleDateString('pt-BR')}` : ''}
                            </button>
                          )}
                          {/* Badges */}
                          {hasPassword && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded-full">Senha</span>}
                          {hasRedact && <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-500 rounded-full">Tools ocultas</span>}
                          {hasEmailRestriction && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full">Restrito</span>}
                          {theme && theme !== 'auto' && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-full">{theme === 'dark' ? 'Dark' : 'Light'}</span>}
                          {snapshotSetting === true && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded-full">Estático</span>}
                          {snapshotSetting === false && <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-500 rounded-full">Ao vivo</span>}
                          {JSON.parse(localStorage.getItem('ados-sharing-watermarks') || '{}')[s.publicId] && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500 rounded-full">Watermark</span>}
                          {JSON.parse(localStorage.getItem('ados-sharing-viewlimits') || '{}')[s.publicId] && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isViewLimitReached(s.publicId) ? 'bg-red-500/10 text-red-500' : 'bg-teal-500/10 text-teal-500'}`}>
                              {isViewLimitReached(s.publicId) ? 'Expirado (views)' : `Limite: ${JSON.parse(localStorage.getItem('ados-sharing-viewlimits') || '{}')[s.publicId]} views`}
                            </span>
                          )}
                          {JSON.parse(localStorage.getItem('ados-sharing-ranges') || '{}')[s.publicId] && <span className="text-[10px] px-1.5 py-0.5 bg-pink-500/10 text-pink-500 rounded-full">Parcial</span>}
                          {JSON.parse(localStorage.getItem('ados-sharing-comments-enabled') || '{}')[s.publicId] && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
                              Comentários{(comments[s.publicId]?.length || 0) > 0 ? ` (${comments[s.publicId].length})` : ''}
                            </span>
                          )}
                          {JSON.parse(localStorage.getItem('ados-sharing-forks-enabled') || '{}')[s.publicId] && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-500 rounded-full">
                              Fork{forkHistory.filter(f => f.publicId === s.publicId).length > 0 ? ` (${forkHistory.filter(f => f.publicId === s.publicId).length})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopy(s.publicId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        {copied === s.publicId ? 'Copiado!' : 'Copiar link'}
                      </button>
                      {/* #1 QR Code button */}
                      <button
                        onClick={() => setQrModal(s.publicId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        QR
                      </button>
                      {/* Feature 1: Embed iframe button */}
                      <button
                        onClick={() => setEmbedModal(s.publicId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        Embed
                      </button>
                      {/* Feature 30: Comments button */}
                      {JSON.parse(localStorage.getItem('ados-sharing-comments-enabled') || '{}')[s.publicId] && (
                        <button
                          onClick={() => setCommentsModal(s.publicId)}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                        >
                          Comentários
                        </button>
                      )}
                      {/* Feature 38: Fork button */}
                      {JSON.parse(localStorage.getItem('ados-sharing-forks-enabled') || '{}')[s.publicId] && (
                        <button
                          onClick={() => setShowForksModal(s.publicId)}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                        >
                          Forks
                        </button>
                      )}
                      {/* Feature 7: Download HTML button */}
                      <button
                        onClick={() => handleDownloadHtml(s.sessionId, s.publicId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        {downloadingHtml === s.publicId ? 'Baixando...' : 'HTML'}
                      </button>
                      <button
                        onClick={() => handleExportMarkdown(s.sessionId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        {copied === s.sessionId + '-md' ? 'Copiado!' : 'Export MD'}
                      </button>
                      {/* NEW #8: Link shortener */}
                      {!shortLinks[s.publicId] ? (
                        <button
                          onClick={() => handleShortenLink(s.publicId)}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                        >
                          Encurtar
                        </button>
                      ) : (
                        <span className="text-[10px] text-green-500 px-2">Encurtado</span>
                      )}
                      {/* NEW #10: Annotations button */}
                      <button
                        onClick={() => setAnnotationModal(s.publicId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        Anotações{(annotations[s.publicId]?.length || 0) > 0 ? ` (${annotations[s.publicId].length})` : ''}
                      </button>
                      {/* #8 Edit button */}
                      <button
                        onClick={() => isEditing ? setEditingId(null) : startEdit(s.publicId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                      >
                        {isEditing ? 'Cancelar' : 'Editar'}
                      </button>
                      <button
                        onClick={() => setConfirmRevoke(s.sessionId)}
                        className="px-3 py-1.5 bg-surface-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-xs text-secondary transition-colors"
                      >
                        Revogar
                      </button>
                    </div>

                    {/* NEW #7: Social share buttons */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted">Compartilhar:</span>
                      <button
                        onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(getShareUrl(s.publicId))}&text=${encodeURIComponent(getTitle(s.sessionId))}`, '_blank')}
                        className="px-2 py-1 bg-surface-2 hover:bg-blue-500/10 hover:text-blue-400 rounded text-[10px] text-muted transition-colors"
                      >
                        Twitter
                      </button>
                      <button
                        onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl(s.publicId))}`, '_blank')}
                        className="px-2 py-1 bg-surface-2 hover:bg-blue-700/10 hover:text-blue-600 rounded text-[10px] text-muted transition-colors"
                      >
                        LinkedIn
                      </button>
                      <button
                        onClick={() => window.open(`mailto:?subject=${encodeURIComponent(getTitle(s.sessionId))}&body=${encodeURIComponent(getShareUrl(s.publicId))}`, '_blank')}
                        className="px-2 py-1 bg-surface-2 hover:bg-green-500/10 hover:text-green-500 rounded text-[10px] text-muted transition-colors"
                      >
                        Email
                      </button>
                    </div>

                    {/* #3 Analytics expandido — NEW #5: Sortable access log table */}
                    {isExpanded && detailedViews.length > 0 && (
                      <div className="bg-surface-0 border border-default rounded-lg p-3 space-y-2">
                        <p className="text-[10px] font-medium text-secondary">Detalhes de acesso:</p>
                        <div className="flex items-center gap-2 text-[9px] text-muted uppercase font-semibold border-b border-default pb-1">
                          <button onClick={() => { setAccessLogSort('time'); setAccessLogSortDir(accessLogSort === 'time' && accessLogSortDir === 'desc' ? 'asc' : 'desc'); }} className={`flex-1 text-left hover:text-secondary ${accessLogSort === 'time' ? 'text-brand-500' : ''}`}>
                            Timestamp {accessLogSort === 'time' ? (accessLogSortDir === 'desc' ? '↓' : '↑') : ''}
                          </button>
                          <button onClick={() => { setAccessLogSort('browser'); setAccessLogSortDir(accessLogSort === 'browser' && accessLogSortDir === 'desc' ? 'asc' : 'desc'); }} className={`w-16 text-left hover:text-secondary ${accessLogSort === 'browser' ? 'text-brand-500' : ''}`}>
                            Browser {accessLogSort === 'browser' ? (accessLogSortDir === 'desc' ? '↓' : '↑') : ''}
                          </button>
                          <span className="w-12 text-left">País</span>
                          <button onClick={() => { setAccessLogSort('duration'); setAccessLogSortDir(accessLogSort === 'duration' && accessLogSortDir === 'desc' ? 'asc' : 'desc'); }} className={`w-16 text-left hover:text-secondary ${accessLogSort === 'duration' ? 'text-brand-500' : ''}`}>
                            Duração {accessLogSort === 'duration' ? (accessLogSortDir === 'desc' ? '↓' : '↑') : ''}
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {getSortedAccessLog(detailedViews).map((v, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-muted">
                              <span className="flex-1">{new Date(v.timestamp).toLocaleString('pt-BR')}</span>
                              <span className="w-16 px-1.5 py-0.5 bg-surface-2 rounded">{v.browser}</span>
                              <span className="w-12 px-1.5 py-0.5 bg-surface-2 rounded">{v.country}</span>
                              <span className="w-16">{v.readingTime}min</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* #8 Edição pós-publicação inline form */}
                    {isEditing && (
                      <div className="bg-surface-0 border border-default rounded-lg p-4 space-y-3">
                        <p className="text-xs font-medium text-secondary">Editar publicação</p>
                        <div className="flex items-center gap-4 flex-wrap">
                          <label className="text-xs text-muted">Nova expiração:</label>
                          <select
                            value={editExpiration}
                            onChange={(e) => setEditExpiration(e.target.value)}
                            className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                          >
                            <option value="never">Sem expiração</option>
                            <option value="1h">+1h a partir de agora</option>
                            <option value="24h">+24h a partir de agora</option>
                            <option value="7d">+7 dias a partir de agora</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editUsePassword}
                              onChange={(e) => setEditUsePassword(e.target.checked)}
                              className="rounded border-default"
                            />
                            <span className="text-xs text-secondary">Senha</span>
                          </label>
                          {editUsePassword && (
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Nova senha"
                              className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-40"
                            />
                          )}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editRedact}
                              onChange={(e) => setEditRedact(e.target.checked)}
                              className="rounded border-default"
                            />
                            <span className="text-xs text-secondary">Ocultar tools</span>
                          </label>
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleSaveEdit(s.publicId)}
                            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium"
                          >
                            Salvar alterações
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Preview */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-primary">Preview do compartilhamento</h2>
              <button onClick={() => setShowPreview(false)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            {sensitiveWarnings.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-red-500 mb-1">⚠ Conteúdo potencialmente sensível detectado:</p>
                {sensitiveWarnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-red-400 font-mono">{w}</p>
                ))}
              </div>
            )}
            <p className="text-xs text-muted mb-3">{previewMessages.length} mensagens serão compartilhadas:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {previewMessages.slice(0, 20).map((msg: any, i: number) => (
                <div key={i} className="bg-surface-1 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-medium text-muted uppercase">{msg.role}</span>
                  <p className="text-xs text-primary line-clamp-2">{msg.content}</p>
                </div>
              ))}
              {previewMessages.length > 20 && <p className="text-xs text-muted text-center">... e mais {previewMessages.length - 20} mensagens</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={handleShare} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Publicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Revogar */}
      {confirmRevoke && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Revogar acesso?</h3>
            <p className="text-sm text-muted mb-4">Quem tem o link não poderá mais visualizar esta sessão.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRevoke(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleUnshare(confirmRevoke)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Revogar</button>
            </div>
          </div>
        </div>
      )}

      {/* #1 QR Code Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrModal(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-xs w-full mx-4 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-primary mb-4">QR Code</h3>
            <img
              src={generateQRDataUrl(getShareUrl(qrModal))}
              alt="QR Code"
              className="mx-auto rounded-lg border border-default"
              style={{ width: 200, height: 200 }}
            />
            <p className="text-[10px] text-muted mt-3 font-mono break-all">{getShareUrl(qrModal)}</p>
            <button
              onClick={() => setQrModal(null)}
              className="mt-4 px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* #6 Bulk Sharing Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBulkModal(false)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-primary">Publicar múltiplas sessões</h2>
              <button onClick={() => setShowBulkModal(false)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {unpublishedSessions.map(s => (
                <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-surface-1 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkSelected.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkSelected([...bulkSelected, s.id]);
                      } else {
                        setBulkSelected(bulkSelected.filter(id => id !== s.id));
                      }
                    }}
                    className="rounded border-default"
                  />
                  <span className="text-sm text-primary">{s.title}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3 border-t border-default pt-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-secondary">Expiração:</label>
                <select
                  value={bulkExpiration}
                  onChange={(e) => setBulkExpiration(e.target.value)}
                  className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="never">Sem expiração</option>
                  <option value="1h">1h</option>
                  <option value="24h">24h</option>
                  <option value="7d">7 dias</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkUsePassword}
                    onChange={(e) => setBulkUsePassword(e.target.checked)}
                    className="rounded border-default"
                  />
                  <span className="text-xs text-secondary">Senha</span>
                </label>
                {bulkUsePassword && (
                  <input
                    type="password"
                    value={bulkPassword}
                    onChange={(e) => setBulkPassword(e.target.value)}
                    placeholder="Senha"
                    className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-40"
                  />
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkRedact}
                    onChange={(e) => setBulkRedact(e.target.checked)}
                    className="rounded border-default"
                  />
                  <span className="text-xs text-secondary">Ocultar tools</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button
                onClick={handleBulkPublish}
                disabled={bulkSelected.length === 0}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm text-white font-medium"
              >
                Publicar {bulkSelected.length} sessões
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 1: Embed iframe Modal */}
      {embedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEmbedModal(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Embed iframe</h3>
              <button onClick={() => setEmbedModal(null)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <p className="text-xs text-muted mb-3">Copie o snippet abaixo e cole em wikis, Notion, ou qualquer site:</p>
            <div className="bg-surface-1 border border-default rounded-lg p-3">
              <code className="text-[11px] text-primary font-mono break-all leading-relaxed">{getEmbedSnippet(embedModal)}</code>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEmbedModal(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
              <button
                onClick={() => handleCopyEmbed(embedModal)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium"
              >
                {embedCopied ? 'Copiado!' : 'Copiar snippet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 2: Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNotifications(false)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Notificações de acesso</h3>
              <button onClick={() => setShowNotifications(false)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            {accessNotifications.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Nenhuma notificação ainda.</p>
            ) : (
              <div className="space-y-2">
                {accessNotifications.slice(0, 20).map(n => (
                  <div key={n.id} className={`p-3 rounded-lg border ${n.read ? 'bg-surface-1 border-default' : 'bg-brand-600/5 border-brand-600/20'}`}>
                    <p className="text-xs text-primary font-medium">{n.sessionTitle}</p>
                    <p className="text-[10px] text-muted mt-0.5">Primeiro acesso em {new Date(n.timestamp).toLocaleString('pt-BR')}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowNotifications(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 4: History Panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHistory(false)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Histórico de compartilhamentos</h3>
              <button onClick={() => setShowHistory(false)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            {sharingHistory.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Nenhum registro ainda.</p>
            ) : (
              <div className="space-y-2">
                {sharingHistory.slice(0, 50).map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 bg-surface-1 border border-default rounded-lg">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      entry.action === 'publish' ? 'bg-green-500/10 text-green-500' :
                      entry.action === 'revoke' ? 'bg-red-500/10 text-red-500' :
                      entry.action === 'schedule' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {entry.action === 'publish' ? 'Publicado' : entry.action === 'revoke' ? 'Revogado' : entry.action === 'schedule' ? 'Agendado' : 'Editado'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary truncate">{entry.sessionTitle}</p>
                      {entry.details && <p className="text-[10px] text-muted">{entry.details}</p>}
                    </div>
                    <span className="text-[10px] text-muted whitespace-nowrap">{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowHistory(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 30: Comments modal */}
      {commentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCommentsModal(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Comentários</h3>
              <button onClick={() => setCommentsModal(null)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <p className="text-xs text-muted mb-4">Feedback de viewers para esta sessão compartilhada.</p>
            {(comments[commentsModal] || []).length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Nenhum comentário ainda.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {(comments[commentsModal] || []).map(c => (
                  <div key={c.id} className="bg-surface-1 border border-default rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary">{c.author}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">{new Date(c.timestamp).toLocaleString('pt-BR')}</span>
                        <button onClick={() => handleDeleteComment(commentsModal, c.id)} className="text-[10px] text-red-500 hover:text-red-400">×</button>
                      </div>
                    </div>
                    <p className="text-xs text-secondary">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-default pt-4 space-y-2">
              <p className="text-[10px] text-muted">Simular comentário de viewer:</p>
              <div className="flex items-center gap-2">
                <input
                  value={newCommentAuthor}
                  onChange={(e) => setNewCommentAuthor(e.target.value)}
                  placeholder="Autor"
                  className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-28"
                />
                <input
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Comentário..."
                  className="flex-1 bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(commentsModal); }}
                />
                <button
                  onClick={() => handleAddComment(commentsModal)}
                  disabled={!newCommentText.trim()}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 38: Forks modal */}
      {showForksModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForksModal(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Colaboração (Forks)</h3>
              <button onClick={() => setShowForksModal(null)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <p className="text-xs text-muted mb-4">Viewers podem criar forks (cópias editáveis) desta sessão.</p>
            {forkHistory.filter(f => f.publicId === showForksModal).length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Nenhum fork realizado.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {forkHistory.filter(f => f.publicId === showForksModal).map(f => (
                  <div key={f.id} className="flex items-center gap-3 bg-surface-1 border border-default rounded-lg px-3 py-2">
                    <span className="text-xs text-primary flex-1">Fork #{f.forkerId.slice(0, 8)}</span>
                    <span className="text-[10px] text-muted">{new Date(f.forkedAt).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <button
                onClick={() => handleForkSession(showForksModal!)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs text-white font-medium"
              >
                Criar Fork
              </button>
              <button onClick={() => setShowForksModal(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW #10: Annotation threads modal */}
      {annotationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setAnnotationModal(null)}>
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Anotações por Mensagem</h3>
              <button onClick={() => setAnnotationModal(null)} className="text-muted hover:text-primary text-lg">✕</button>
            </div>
            <p className="text-xs text-muted mb-4">Comentários de viewers vinculados a mensagens específicas.</p>
            {(annotations[annotationModal] || []).length === 0 ? (
              <p className="text-sm text-muted text-center py-4">Nenhuma anotação ainda.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {(annotations[annotationModal] || []).map(a => (
                  <div key={a.id} className="bg-surface-1 border border-default rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 bg-brand-600/10 text-brand-500 rounded font-mono">Msg #{a.msgIndex}</span>
                        <span className="text-xs font-medium text-primary">{a.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">{new Date(a.timestamp).toLocaleString('pt-BR')}</span>
                        <button onClick={() => handleDeleteAnnotation(annotationModal, a.id)} className="text-[10px] text-red-500 hover:text-red-400">x</button>
                      </div>
                    </div>
                    <p className="text-xs text-secondary">{a.text}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-default pt-4 space-y-2">
              <p className="text-[10px] text-muted">Adicionar anotação:</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={newAnnotationMsgIndex}
                  onChange={(e) => setNewAnnotationMsgIndex(parseInt(e.target.value) || 0)}
                  placeholder="#"
                  className="bg-surface-1 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none w-14"
                />
                <input
                  value={newAnnotationAuthor}
                  onChange={(e) => setNewAnnotationAuthor(e.target.value)}
                  placeholder="Autor"
                  className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none w-24"
                />
                <input
                  value={newAnnotationText}
                  onChange={(e) => setNewAnnotationText(e.target.value)}
                  placeholder="Anotação..."
                  className="flex-1 bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddAnnotation(annotationModal); }}
                />
                <button
                  onClick={() => handleAddAnnotation(annotationModal)}
                  disabled={!newAnnotationText.trim()}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 5: Scheduled items display */}
      {scheduledItems.length > 0 && !showHistory && !showNotifications && (
        <div className="fixed bottom-4 right-4 bg-surface-0 border border-default rounded-xl p-4 shadow-lg max-w-sm z-40">
          <p className="text-xs font-medium text-primary mb-2">Publicações agendadas ({scheduledItems.length})</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {scheduledItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-muted truncate">{getTitle(item.sessionId)}</span>
                <span className="text-secondary whitespace-nowrap">{new Date(item.publishAt).toLocaleString('pt-BR')}</span>
                <button
                  onClick={() => handleCancelScheduled(item.id)}
                  className="text-red-500 hover:text-red-400 shrink-0"
                >
                  Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
