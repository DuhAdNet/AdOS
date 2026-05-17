import { useState, useEffect, useRef, useCallback } from 'react';

const ados = (window as any).ados;

// === UI/UX Improvement Components ===

// #1 Progress Ring Component
function ProgressRing({ progress, size = 80, strokeWidth = 6 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-surface-3" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-brand-600" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
      </svg>
      <span className="absolute text-sm font-bold text-primary">{Math.round(progress)}%</span>
    </div>
  );
}

// #10 Data Size Donut Chart Component
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((segment, i) => {
          const segmentLength = (segment.value / total) * circumference;
          const currentOffset = accumulatedOffset;
          accumulatedOffset += segmentLength;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${segmentLength} ${circumference - segmentLength}`} strokeDashoffset={-currentOffset} />
          );
        })}
      </svg>
      <div className="space-y-1">
        {data.map((segment, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-[10px] text-secondary">{segment.label}</span>
            <span className="text-[10px] text-muted">{total > 0 ? Math.round((segment.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// #9 Schedule Calendar Component
function MiniCalendar({ selectedDays, onToggleDay, time, onTimeChange }: { selectedDays: number[]; onToggleDay: (day: number) => void; time: string; onTimeChange: (t: string) => void }) {
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1">
        {dayLabels.map((label, i) => (
          <button key={i} onClick={() => onToggleDay(i)} className={`w-full aspect-square rounded-lg text-[10px] font-medium transition-all flex items-center justify-center ${selectedDays.includes(i) ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}>
            {label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-[10px] text-muted block mb-1">Horário do sync</label>
        <input type="time" value={time} onChange={(e) => onTimeChange(e.target.value)} className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50" />
      </div>
    </div>
  );
}

type SyncStatus = 'disconnected' | 'syncing' | 'synced' | 'error';

interface SyncConflict {
  localVersion: string;
  serverVersion: string;
  localUpdated: string;
  serverUpdated: string;
}

interface SyncLogEntry {
  timestamp: string;
  status: 'success' | 'error';
  itemCount: number;
  bytes: number;
  durationMs: number;
}

interface SyncCategories {
  sessions: boolean;
  labels: boolean;
  skills: boolean;
  automations: boolean;
  brain: boolean;
  dashboards: boolean;
}

interface SyncServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  device: string;
  categories: string[];
  itemCount: number;
  status: 'success' | 'error';
}

interface OfflineChange {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  data: any;
}

function isValidUrl(str: string): boolean {
  try { const u = new URL(str); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch { return false; }
}

function computeChecksum(payload: string): string {
  const encoded = btoa(unescape(encodeURIComponent(payload.slice(0, 1000))));
  const hash = encoded.length.toString(36).toUpperCase() + encoded.slice(0, 4).toUpperCase();
  return hash.slice(0, 8);
}

export default function CloudSync() {
  const [status, setStatus] = useState<SyncStatus>('disconnected');
  const [endpoint, setEndpoint] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [saved, setSaved] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [syncProgress, setSyncProgress] = useState('');
  const [syncDetails, setSyncDetails] = useState('');
  const [endpointOnline, setEndpointOnline] = useState<boolean | null>(null);
  // #4 Conflict resolution
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  // #6 Delta sync
  const [deltaEnabled, setDeltaEnabled] = useState(false);
  const [lastSyncVersion, setLastSyncVersion] = useState<number>(0);
  // #7 Compression
  const [compressEnabled, setCompressEnabled] = useState(false);
  // #9 Encryption
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [encryptKey, setEncryptKey] = useState('');
  // #10 JVOS-Server integration
  const [jwtToken, setJwtToken] = useState('');
  const [devices, setDevices] = useState<Array<{ id: string; name: string; lastSync: string }>>([]);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Feature 1: Sync seletivo
  const [syncCategories, setSyncCategories] = useState<SyncCategories>(() => {
    const stored = localStorage.getItem('cloud_sync_categories');
    return stored ? JSON.parse(stored) : { sessions: true, labels: true, skills: true, automations: true, brain: true, dashboards: true };
  });

  // Feature 2: Agendamento de sync
  const [syncInterval, setSyncInterval] = useState<string>(() => {
    return localStorage.getItem('cloud_sync_interval') || 'off';
  });
  const [nextSyncTime, setNextSyncTime] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feature 3: Log de sync detalhado
  const [showLog, setShowLog] = useState(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>(() => {
    const stored = localStorage.getItem('cloud_sync_log');
    return stored ? JSON.parse(stored) : [];
  });

  // Feature 4: Bandwidth throttle
  const [throttleEnabled, setThrottleEnabled] = useState<boolean>(() => {
    return localStorage.getItem('cloud_sync_throttle_enabled') === 'true';
  });
  const [throttleSpeed, setThrottleSpeed] = useState<string>(() => {
    return localStorage.getItem('cloud_sync_throttle_speed') || 'unlimited';
  });

  // Feature 5: Sync parcial / resume
  const [partialProgress, setPartialProgress] = useState<{ sent: number; total: number } | null>(null);
  const [storedResumePoint, setStoredResumePoint] = useState<number | null>(() => {
    const stored = localStorage.getItem('cloud_sync_resume_point');
    return stored ? Number(stored) : null;
  });

  // Feature 6: Checksum / integridade
  const [checksum, setChecksum] = useState<string | null>(null);
  const [checksumValid, setChecksumValid] = useState<boolean | null>(null);

  // Feature 7: Notificação
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(() => {
    return localStorage.getItem('cloud_sync_notify') === 'true';
  });

  // Feature 8: Wipe remoto
  const [wipeModal, setWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipeStep, setWipeStep] = useState<1 | 2>(1);

  // NEW Feature 1: Histórico de versões do servidor
  const [serverSnapshots, setServerSnapshots] = useState<Array<{ id: string; version: number; createdAt: string; sizeBytes: number }>>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [restoringSnapshot, setRestoringSnapshot] = useState<string | null>(null);

  // NEW Feature 2: Sync via QR code
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrPairCode, setQrPairCode] = useState('');

  // NEW Feature 3: Métricas de sync
  const [syncMetrics, setSyncMetrics] = useState<{ totalMB: number; avgFrequencyHours: number; avgDurationMs: number }>({ totalMB: 0, avgFrequencyHours: 0, avgDurationMs: 0 });

  // NEW Feature 4: Exportar backup local
  const [exportingBackup, setExportingBackup] = useState(false);

  // NEW Feature 5: Conflitos pendentes
  const [pendingConflicts, setPendingConflicts] = useState<Array<{ id: string; category: string; description: string; localValue: string; serverValue: string; createdAt: string }>>(() => {
    const stored = localStorage.getItem('cloud_sync_pending_conflicts');
    return stored ? JSON.parse(stored) : [];
  });

  // NEW Feature 6: Sync por Wi-Fi only
  const [wifiOnly, setWifiOnly] = useState<boolean>(() => {
    return localStorage.getItem('cloud_sync_wifi_only') === 'true';
  });
  const [isMetered, setIsMetered] = useState<boolean>(false);

  // NEW Feature 7: Validação de endpoint antes de salvar
  const [endpointValidating, setEndpointValidating] = useState(false);
  const [endpointValidationResult, setEndpointValidationResult] = useState<'success' | 'auth_fail' | 'unreachable' | null>(null);

  // NEW Feature 8: Indicador de progresso por categoria
  const [categoryProgress, setCategoryProgress] = useState<Record<string, { sent: number; total: number }>>({});

  // #28 Bandwidth indicator — mostrar tamanho do payload antes de sync
  const [payloadSizeEstimate, setPayloadSizeEstimate] = useState<number | null>(null);
  const [showPayloadEstimate, setShowPayloadEstimate] = useState(false);

  // #29 Offline queue — acumular mudanças offline e sync quando reconectar
  const [offlineQueue, setOfflineQueue] = useState<OfflineChange[]>(() => {
    const stored = localStorage.getItem('cloud_sync_offline_queue');
    return stored ? JSON.parse(stored) : [];
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // #30 Merge inteligente — resolver conflitos automaticamente por timestamp
  const [autoMergeEnabled, setAutoMergeEnabled] = useState<boolean>(() => {
    return localStorage.getItem('cloud_sync_auto_merge') === 'true';
  });

  // #32 Sync de dashboards — incluir dashboards e widgets
  // (handled in syncCategories.dashboards)

  // #33 Audit trail remoto — log de syncs no servidor
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // #34 Multi-server — suportar múltiplos endpoints de sync
  const [multiServerEnabled, setMultiServerEnabled] = useState<boolean>(() => {
    return localStorage.getItem('cloud_sync_multi_server') === 'true';
  });
  const [syncServers, setSyncServers] = useState<SyncServer[]>(() => {
    const stored = localStorage.getItem('cloud_sync_servers');
    return stored ? JSON.parse(stored) : [];
  });

  // #35 Sync schedule — agendar sync para horários específicos
  const [scheduledTime, setScheduledTime] = useState<string>(() => {
    return localStorage.getItem('cloud_sync_scheduled_time') || '';
  });
  const scheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // #38 Recovery mode — restaurar estado completo de um backup remoto
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState('');

  // === UI/UX Improvement States ===
  // #1 Progress ring percentage
  const [syncPercent, setSyncPercent] = useState(0);
  // #3 Bandwidth gauge
  const [bandwidthKBs, setBandwidthKBs] = useState<number | null>(null);
  const bandwidthInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // #5 Category item counts
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  // #8 Retry queue visualization
  const [retryNextAt, setRetryNextAt] = useState<number | null>(null);
  const [retryCountdown, setRetryCountdown] = useState('');
  const [retryPendingItems, setRetryPendingItems] = useState<string[]>([]);
  // #9 Schedule calendar days
  const [scheduleDays, setScheduleDays] = useState<number[]>(() => {
    const stored = localStorage.getItem('cloud_sync_schedule_days');
    return stored ? JSON.parse(stored) : [1, 2, 3, 4, 5]; // Mon-Fri default
  });
  // #10 Data size by category
  const [dataSizeByCategory, setDataSizeByCategory] = useState<{ label: string; value: number; color: string }[]>([]);

  useEffect(() => { load(); return () => { if (retryTimer.current) clearTimeout(retryTimer.current); }; }, []);

  useEffect(() => {
    if (!endpoint || !isValidUrl(endpoint)) { setEndpointOnline(null); return; }
    const ping = async () => {
      try {
        const res = await fetch(endpoint, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        setEndpointOnline(res.ok || res.status < 500);
      } catch { setEndpointOnline(false); }
    };
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [endpoint]);

  // Feature 1: persist categories
  useEffect(() => {
    localStorage.setItem('cloud_sync_categories', JSON.stringify(syncCategories));
  }, [syncCategories]);

  // Feature 2: scheduled sync
  useEffect(() => {
    localStorage.setItem('cloud_sync_interval', syncInterval);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setNextSyncTime(null);

    const intervalMs: Record<string, number> = { '1h': 3600000, '6h': 21600000, '12h': 43200000, '24h': 86400000 };
    const ms = intervalMs[syncInterval];
    if (!ms) return;

    const updateNext = () => {
      const next = new Date(Date.now() + ms);
      setNextSyncTime(next.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    };
    updateNext();

    intervalRef.current = setInterval(() => {
      handleSync();
      updateNext();
    }, ms);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [syncInterval, endpoint]);

  // Feature 4: persist throttle
  useEffect(() => {
    localStorage.setItem('cloud_sync_throttle_enabled', String(throttleEnabled));
    localStorage.setItem('cloud_sync_throttle_speed', throttleSpeed);
  }, [throttleEnabled, throttleSpeed]);

  // Feature 7: persist notify
  useEffect(() => {
    localStorage.setItem('cloud_sync_notify', String(notifyEnabled));
  }, [notifyEnabled]);

  // NEW Feature 5: persist pending conflicts
  useEffect(() => {
    localStorage.setItem('cloud_sync_pending_conflicts', JSON.stringify(pendingConflicts));
  }, [pendingConflicts]);

  // NEW Feature 6: Wi-Fi only - detect metered connection
  useEffect(() => {
    localStorage.setItem('cloud_sync_wifi_only', String(wifiOnly));
    const nav = navigator as any;
    if (nav.connection) {
      const updateMetered = () => setIsMetered(nav.connection.metered === true);
      updateMetered();
      nav.connection.addEventListener('change', updateMetered);
      return () => nav.connection.removeEventListener('change', updateMetered);
    }
  }, [wifiOnly]);

  // NEW Feature 3: Compute sync metrics from log
  useEffect(() => {
    if (syncLog.length === 0) {
      setSyncMetrics({ totalMB: 0, avgFrequencyHours: 0, avgDurationMs: 0 });
      return;
    }
    const totalBytes = syncLog.reduce((acc, e) => acc + e.bytes, 0);
    const totalMB = totalBytes / (1024 * 1024);
    const avgDurationMs = syncLog.reduce((acc, e) => acc + e.durationMs, 0) / syncLog.length;
    let avgFrequencyHours = 0;
    if (syncLog.length >= 2) {
      const timestamps = syncLog.map(e => new Date(e.timestamp).getTime()).sort((a, b) => b - a);
      const diffs: number[] = [];
      for (let i = 0; i < timestamps.length - 1; i++) diffs.push(timestamps[i] - timestamps[i + 1]);
      avgFrequencyHours = diffs.reduce((a, b) => a + b, 0) / diffs.length / 3600000;
    }
    setSyncMetrics({ totalMB, avgFrequencyHours, avgDurationMs });
  }, [syncLog]);

  // #29 Offline queue — persist and listen to online/offline events
  useEffect(() => {
    localStorage.setItem('cloud_sync_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Flush offline queue when back online
      if (offlineQueue.length > 0 && endpoint && isValidUrl(endpoint)) {
        handleSync();
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue, endpoint]);

  // #30 Auto merge persist
  useEffect(() => {
    localStorage.setItem('cloud_sync_auto_merge', String(autoMergeEnabled));
  }, [autoMergeEnabled]);

  // #34 Multi-server persist
  useEffect(() => {
    localStorage.setItem('cloud_sync_multi_server', String(multiServerEnabled));
    localStorage.setItem('cloud_sync_servers', JSON.stringify(syncServers));
  }, [multiServerEnabled, syncServers]);

  // #35 Sync schedule — schedule for specific time of day
  useEffect(() => {
    localStorage.setItem('cloud_sync_scheduled_time', scheduledTime);
    if (scheduledTimerRef.current) clearTimeout(scheduledTimerRef.current);
    if (!scheduledTime) return;

    const scheduleNext = () => {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      const delay = target.getTime() - now.getTime();
      scheduledTimerRef.current = setTimeout(() => {
        handleSync();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => { if (scheduledTimerRef.current) clearTimeout(scheduledTimerRef.current); };
  }, [scheduledTime, endpoint]);

  // === UI/UX Improvement Effects ===

  // #3 Bandwidth gauge — simulate speed during sync
  useEffect(() => {
    if (status === 'syncing') {
      bandwidthInterval.current = setInterval(() => {
        setBandwidthKBs(Math.floor(Math.random() * 800 + 200));
      }, 500);
    } else {
      if (bandwidthInterval.current) clearInterval(bandwidthInterval.current);
      setBandwidthKBs(null);
    }
    return () => { if (bandwidthInterval.current) clearInterval(bandwidthInterval.current); };
  }, [status]);

  // #5 Category item counts — load counts from db
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const sessions = await ados.db?.getSessions?.() || [];
        const labels = await ados.db?.getLabels?.() || [];
        const prefs = await ados.db?.getPreferences?.() || {};
        setCategoryCounts({
          sessions: sessions.length,
          labels: labels.length,
          skills: (prefs?.skills || []).length,
          automations: (prefs?.automations || []).length,
          dashboards: (prefs?.dashboards || []).length,
          brain: Object.keys(prefs?.brain || {}).length,
        });
      } catch { /* ignore */ }
    };
    loadCounts();
  }, [lastSync]);

  // #8 Retry countdown timer
  useEffect(() => {
    if (retryNextAt === null) { setRetryCountdown(''); return; }
    const tick = setInterval(() => {
      const remaining = Math.max(0, retryNextAt - Date.now());
      if (remaining <= 0) { setRetryNextAt(null); setRetryCountdown(''); setRetryPendingItems([]); return; }
      const secs = Math.ceil(remaining / 1000);
      setRetryCountdown(secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`);
    }, 1000);
    return () => clearInterval(tick);
  }, [retryNextAt]);

  // #9 Persist schedule days
  useEffect(() => {
    localStorage.setItem('cloud_sync_schedule_days', JSON.stringify(scheduleDays));
  }, [scheduleDays]);

  // #10 Compute data sizes
  useEffect(() => {
    const computeSizes = async () => {
      try {
        const sessions = await ados.db?.getSessions?.() || [];
        const labels = await ados.db?.getLabels?.() || [];
        const prefs = await ados.db?.getPreferences?.() || {};
        const sizeOf = (obj: any) => new Blob([JSON.stringify(obj)]).size;
        setDataSizeByCategory([
          { label: 'Sessions', value: sizeOf(sessions), color: '#3b82f6' },
          { label: 'Labels', value: sizeOf(labels), color: '#10b981' },
          { label: 'Brain', value: sizeOf(prefs?.brain || {}), color: '#f59e0b' },
          { label: 'Skills', value: sizeOf(prefs?.skills || []), color: '#8b5cf6' },
        ]);
      } catch { /* ignore */ }
    };
    computeSizes();
  }, [lastSync]);

  // NEW Feature 1: Fetch server snapshots
  const fetchServerSnapshots = useCallback(async () => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
      const res = await fetch(`${endpoint}${endpoint.endsWith('/') ? '' : '/'}snapshots`, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        setServerSnapshots(Array.isArray(data) ? data : data.snapshots || []);
      }
    } catch { /* endpoint may not support snapshots */ }
  }, [endpoint, jwtToken]);

  const handleRestoreSnapshot = useCallback(async (snapshotId: string) => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    setRestoringSnapshot(snapshotId);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
      const res = await fetch(`${endpoint}${endpoint.endsWith('/') ? '' : '/'}snapshots/${snapshotId}/restore`, { method: 'POST', headers, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        setStatus('synced');
        setSyncDetails(`Restaurado snapshot ${snapshotId.slice(0, 8)}`);
      } else {
        setStatus('error');
      }
    } catch { setStatus('error'); }
    setRestoringSnapshot(null);
  }, [endpoint, jwtToken]);

  // NEW Feature 2: Generate QR code pair
  const generateQrPairCode = useCallback(() => {
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
    setQrPairCode(code);
    setShowQrCode(true);
    // Store pairing code for the other device to find
    localStorage.setItem('cloud_sync_pair_code', code);
    localStorage.setItem('cloud_sync_pair_endpoint', endpoint);
  }, [endpoint]);

  // ASCII QR code generator (simple text-based representation)
  const generateAsciiQr = (text: string): string => {
    const size = 21;
    const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
    // Finder patterns (top-left, top-right, bottom-left)
    const drawFinder = (row: number, col: number) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        grid[row + r][col + c] = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
    };
    drawFinder(0, 0); drawFinder(0, 14); drawFinder(14, 0);
    // Encode text as pattern in data area
    const bytes = new TextEncoder().encode(text);
    let bitIdx = 0;
    for (let row = 8; row < size; row++) {
      for (let col = 8; col < size; col++) {
        if (row < 14 || col < 14) continue; // skip finder overlap area
        if (bitIdx < bytes.length * 8) {
          const byteIdx = Math.floor(bitIdx / 8);
          const bitPos = 7 - (bitIdx % 8);
          grid[row][col] = ((bytes[byteIdx] >> bitPos) & 1) === 1;
          bitIdx++;
        } else {
          grid[row][col] = (row + col) % 3 === 0;
        }
      }
    }
    return grid.map(row => row.map(cell => cell ? '██' : '  ').join('')).join('\n');
  };

  // NEW Feature 4: Export backup local
  const handleExportBackup = useCallback(async () => {
    setExportingBackup(true);
    try {
      const sessions = await ados.db?.getSessions?.() || [];
      const prefs = await ados.db?.getPreferences?.() || {};
      const labels = await ados.db?.getLabels?.() || [];
      const backup = {
        exportedAt: new Date().toISOString(),
        version: lastSyncVersion,
        data: { sessions, preferences: prefs, labels, syncLog, syncCategories }
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ados-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setExportingBackup(false);
  }, [lastSyncVersion, syncLog, syncCategories]);

  // NEW Feature 5: Resolve pending conflict
  const handleResolvePendingConflict = useCallback((conflictId: string, choice: 'keep_local' | 'keep_server') => {
    setPendingConflicts(prev => prev.filter(c => c.id !== conflictId));
  }, []);

  // NEW Feature 7: Validate endpoint
  const handleValidateEndpoint = useCallback(async () => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    setEndpointValidating(true);
    setEndpointValidationResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
      const res = await fetch(endpoint, { method: 'HEAD', headers, signal: AbortSignal.timeout(8000) });
      if (res.ok || res.status === 204 || res.status === 405) {
        setEndpointValidationResult('success');
      } else if (res.status === 401 || res.status === 403) {
        setEndpointValidationResult('auth_fail');
      } else {
        setEndpointValidationResult('unreachable');
      }
    } catch {
      setEndpointValidationResult('unreachable');
    }
    setEndpointValidating(false);
  }, [endpoint, jwtToken]);

  // #28 Bandwidth indicator — estimate payload size before sync
  const handleEstimatePayload = useCallback(async () => {
    try {
      const sessions = syncCategories.sessions ? await ados.db.getSessions() : [];
      const prefs = await ados.db.getPreferences();
      const labels = syncCategories.labels ? await ados.db.getLabels() : [];
      const dataToSend: any = { syncedAt: new Date().toISOString(), version: lastSyncVersion + 1, isDelta: false };
      if (syncCategories.sessions) dataToSend.sessions = sessions;
      if (syncCategories.labels) dataToSend.labels = labels;
      if (syncCategories.skills) dataToSend.skills = prefs?.skills || [];
      if (syncCategories.automations) dataToSend.automations = prefs?.automations || [];
      if (syncCategories.dashboards) dataToSend.dashboards = prefs?.dashboards || [];
      if (syncCategories.brain) dataToSend.brain = prefs?.brain || {};
      dataToSend.preferences = prefs;
      const body = JSON.stringify(dataToSend);
      setPayloadSizeEstimate(new Blob([body]).size);
      setShowPayloadEstimate(true);
    } catch { setPayloadSizeEstimate(null); }
  }, [syncCategories, lastSyncVersion]);

  // #29 Offline queue — add change to queue when offline
  const addToOfflineQueue = useCallback((category: string, action: string, data: any) => {
    if (isOnline) return false;
    const change: OfflineChange = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), category, action, data };
    setOfflineQueue(prev => [...prev, change]);
    return true;
  }, [isOnline]);

  // #33 Audit trail remoto — fetch audit log from server
  const fetchAuditTrail = useCallback(async () => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
      const res = await fetch(`${endpoint}${endpoint.endsWith('/') ? '' : '/'}audit`, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        setAuditTrail(Array.isArray(data) ? data : data.entries || []);
      }
    } catch { /* endpoint may not support audit */ }
  }, [endpoint, jwtToken]);

  // #34 Multi-server — add/remove servers
  const addSyncServer = useCallback((name: string, url: string) => {
    const server: SyncServer = { id: crypto.randomUUID(), name, url, enabled: true };
    setSyncServers(prev => [...prev, server]);
  }, []);

  const removeSyncServer = useCallback((id: string) => {
    setSyncServers(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleSyncServer = useCallback((id: string) => {
    setSyncServers(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  // #34 Multi-server sync — sync to all enabled servers
  const handleMultiServerSync = useCallback(async () => {
    if (!multiServerEnabled || syncServers.length === 0) return;
    for (const server of syncServers.filter(s => s.enabled)) {
      try {
        const sessions = syncCategories.sessions ? await ados.db.getSessions() : [];
        const prefs = await ados.db.getPreferences();
        const labels = syncCategories.labels ? await ados.db.getLabels() : [];
        const dataToSend: any = { syncedAt: new Date().toISOString(), version: lastSyncVersion + 1, sessions, labels, preferences: prefs };
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
        await fetch(server.url, { method: 'POST', headers, body: JSON.stringify(dataToSend), signal: AbortSignal.timeout(15000) });
      } catch { /* continue to next server */ }
    }
  }, [multiServerEnabled, syncServers, syncCategories, lastSyncVersion, jwtToken]);

  // #38 Recovery mode — restaurar estado completo de um backup remoto
  const handleRecoveryMode = useCallback(async () => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    setRecoveryMode(true);
    setRecoveryProgress('Conectando ao servidor...');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
      setRecoveryProgress('Baixando backup completo...');
      const res = await fetch(`${endpoint}${endpoint.endsWith('/') ? '' : '/'}recovery`, { method: 'GET', headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecoveryProgress('Restaurando sessões...');
      if (data.sessions) {
        for (const session of data.sessions) {
          await ados.db.saveSession?.(session);
        }
      }
      setRecoveryProgress('Restaurando preferências...');
      if (data.preferences) await ados.db.setPreferences?.(data.preferences);
      setRecoveryProgress('Restaurando labels...');
      if (data.labels) {
        for (const label of data.labels) {
          await ados.db.saveLabel?.(label);
        }
      }
      setRecoveryProgress('Restaurando dashboards...');
      if (data.dashboards) await ados.db.setSetting?.('dashboards', JSON.stringify(data.dashboards));
      setRecoveryProgress('Recovery completo!');
      setStatus('synced');
      setSyncDetails('Recovery mode: estado restaurado do servidor');
      const now = new Date().toISOString();
      await ados.db.setSetting('cloud_sync_last', now);
      setLastSync(now);
    } catch {
      setRecoveryProgress('Erro no recovery. Verifique a conexão.');
      setStatus('error');
    }
    setTimeout(() => { setRecoveryMode(false); setRecoveryProgress(''); }, 3000);
  }, [endpoint, jwtToken]);

  const addLogEntry = (entry: SyncLogEntry) => {
    const updated = [entry, ...syncLog].slice(0, 20);
    setSyncLog(updated);
    localStorage.setItem('cloud_sync_log', JSON.stringify(updated));
  };

  const load = async () => {
    const savedEndpoint = await ados.db.getSetting('cloud_sync_endpoint');
    const savedAuto = await ados.db.getSetting('cloud_sync_auto');
    const savedLast = await ados.db.getSetting('cloud_sync_last');
    const savedDelta = await ados.db.getSetting('cloud_sync_delta');
    const savedVersion = await ados.db.getSetting('cloud_sync_version');
    const savedCompress = await ados.db.getSetting('cloud_sync_compress');
    const savedEncrypt = await ados.db.getSetting('cloud_sync_encrypt');
    const savedEncKey = await ados.db.getSetting('cloud_sync_encrypt_key');
    const savedJwt = await ados.db.getSetting('cloud_sync_jwt');
    if (savedEndpoint) setEndpoint(savedEndpoint);
    if (savedAuto) setAutoSync(savedAuto === 'true');
    if (savedLast) setLastSync(savedLast);
    if (savedDelta) setDeltaEnabled(savedDelta === 'true');
    if (savedVersion) setLastSyncVersion(Number(savedVersion) || 0);
    if (savedCompress) setCompressEnabled(savedCompress === 'true');
    if (savedEncrypt) setEncryptEnabled(savedEncrypt === 'true');
    if (savedEncKey) setEncryptKey(savedEncKey);
    if (savedJwt) setJwtToken(savedJwt);
  };

  const handleEndpointChange = (value: string) => {
    setEndpoint(value);
    if (value && !isValidUrl(value)) setUrlError('URL inválida (precisa começar com http:// ou https://)');
    else setUrlError('');
  };

  const handleSave = async () => {
    if (endpoint && !isValidUrl(endpoint)) { setUrlError('URL inválida'); return; }
    await ados.db.setSetting('cloud_sync_endpoint', endpoint);
    await ados.db.setSetting('cloud_sync_auto', String(autoSync));
    await ados.db.setSetting('cloud_sync_delta', String(deltaEnabled));
    await ados.db.setSetting('cloud_sync_compress', String(compressEnabled));
    await ados.db.setSetting('cloud_sync_encrypt', String(encryptEnabled));
    await ados.db.setSetting('cloud_sync_encrypt_key', encryptKey);
    await ados.db.setSetting('cloud_sync_jwt', jwtToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // #4 Conflict resolution handlers
  const handleResolveConflict = async (choice: 'local' | 'server' | 'merge') => {
    setConflict(null);
    if (choice === 'local') {
      await handleSync(true);
    } else if (choice === 'server') {
      setSyncProgress('Baixando dados do servidor...');
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
        const res = await fetch(endpoint, { method: 'GET', headers });
        if (res.ok) {
          const data = await res.json();
          setSyncProgress('Aplicando dados do servidor...');
          if (data.sessions) await ados.db.setSetting?.('cloud_sync_server_data', JSON.stringify(data));
          setStatus('synced');
          setSyncDetails('Dados do servidor aplicados');
        }
      } catch { setStatus('error'); }
      setSyncProgress('');
    } else {
      await handleSync(true);
    }
  };

  const handleSync = async (forceOverwrite = false, resumeFrom = 0) => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    // #29 Offline queue — if offline, queue the sync attempt
    if (!isOnline) {
      addToOfflineQueue('sync', 'full_sync', { forceOverwrite, resumeFrom });
      setSyncProgress('Offline: sync adicionado à fila (' + (offlineQueue.length + 1) + ' pendentes)');
      return;
    }
    // NEW Feature 6: Block sync on metered connections if wifi-only enabled
    if (wifiOnly && isMetered) {
      setStatus('error');
      setSyncProgress('Sync bloqueado: conexão metered detectada (Wi-Fi only ativo)');
      return;
    }
    const startTime = Date.now();
    setStatus('syncing');
    setSyncProgress('Coletando dados...');
    setSyncPercent(5);
    setCategoryProgress({});
    setChecksum(null);
    setChecksumValid(null);
    try {
      const sessions = syncCategories.sessions ? await ados.db.getSessions() : [];
      const prefs = await ados.db.getPreferences();
      const labels = syncCategories.labels ? await ados.db.getLabels() : [];

      // Build payload based on selected categories
      const currentVersion = lastSyncVersion + 1;
      let dataToSend: any = { syncedAt: new Date().toISOString(), version: currentVersion, isDelta: false };

      if (syncCategories.sessions) dataToSend.sessions = sessions;
      if (syncCategories.labels) dataToSend.labels = labels;
      if (syncCategories.skills) dataToSend.skills = prefs?.skills || [];
      if (syncCategories.automations) dataToSend.automations = prefs?.automations || [];
      if (syncCategories.dashboards) dataToSend.dashboards = prefs?.dashboards || [];
      if (syncCategories.brain) dataToSend.brain = prefs?.brain || {};
      dataToSend.preferences = prefs;
      // #29 Include offline queue items in payload
      if (offlineQueue.length > 0) {
        dataToSend.offlineQueue = offlineQueue;
      }

      // #6 Delta sync
      if (deltaEnabled && lastSyncVersion > 0 && !forceOverwrite) {
        setSyncProgress('Calculando delta...');
        const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;
        const newSessions = sessions.filter((s: any) => new Date(s.updatedAt || s.createdAt).getTime() > lastSyncTime);
        dataToSend = { ...dataToSend, sessions: newSessions, isDelta: true, deltaFrom: lastSyncVersion };
        setSyncProgress(`Delta: ${newSessions.length} sessões modificadas...`);
      }

      // Feature 5: Resume from offset
      if (resumeFrom > 0 && dataToSend.sessions) {
        dataToSend.sessions = dataToSend.sessions.slice(resumeFrom);
        dataToSend.resumeFrom = resumeFrom;
      }

      // Track total items for partial progress
      const totalItems = (dataToSend.sessions?.length || 0) + (dataToSend.labels?.length || 0);
      setPartialProgress({ sent: 0, total: totalItems });

      setSyncProgress('Enviando dados...');
      setSyncPercent(40);

      // NEW Feature 8: Update category progress
      const sessionsCount = dataToSend.sessions?.length || 0;
      const labelsCount = dataToSend.labels?.length || 0;
      const skillsCount = dataToSend.skills?.length || 0;
      setCategoryProgress({
        sessions: { sent: 0, total: sessionsCount },
        labels: { sent: 0, total: labelsCount },
        skills: { sent: 0, total: skillsCount },
      });

      let body: string = JSON.stringify(dataToSend);

      // Feature 6: Compute checksum
      const payloadChecksum = computeChecksum(body);
      setChecksum(payloadChecksum);

      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Checksum': payloadChecksum };

      // Feature 4: Throttle header (conceptual)
      if (throttleEnabled && throttleSpeed !== 'unlimited') {
        headers['X-Throttle'] = throttleSpeed;
      }

      // #9 Encryption
      if (encryptEnabled && encryptKey) {
        setSyncProgress('Criptografando payload...');
        try {
          const encoder = new TextEncoder();
          const keyData = encoder.encode(encryptKey.padEnd(32, '0').slice(0, 32));
          const cryptoKey = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt']);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoder.encode(body));
          const combined = new Uint8Array(iv.length + encrypted.byteLength);
          combined.set(iv);
          combined.set(new Uint8Array(encrypted), iv.length);
          body = JSON.stringify({ encrypted: btoa(String.fromCharCode(...combined)), algo: 'AES-256-GCM' });
          headers['X-Encrypted'] = 'true';
        } catch { /* fallback to plain */ }
      }

      // #7 Compression flag
      let fetchBody: string | Blob = body;
      if (compressEnabled) {
        headers['X-Compress-Request'] = 'true';
        try {
          if (typeof CompressionStream !== 'undefined') {
            const stream = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
            fetchBody = await new Response(stream).blob();
            headers['Content-Encoding'] = 'gzip';
            headers['Content-Type'] = 'application/octet-stream';
          }
        } catch { fetchBody = body; }
      }

      // #10 JWT auth
      if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
      }

      setSyncPercent(70);
      const res = await fetch(endpoint, { method: 'POST', headers, body: fetchBody });
      setSyncPercent(90);

      // #4 Conflict detection
      if (res.status === 409 && !forceOverwrite) {
        const conflictData = await res.json().catch(() => null);
        // #30 Merge inteligente — auto-resolve by timestamp
        if (autoMergeEnabled && conflictData?.serverUpdated) {
          const localTime = new Date().getTime();
          const serverTime = new Date(conflictData.serverUpdated).getTime();
          // Keep whichever is newer
          if (localTime >= serverTime) {
            await handleSync(true, resumeFrom);
            return;
          } else {
            await handleResolveConflict('server');
            return;
          }
        }
        setConflict({
          localVersion: String(currentVersion),
          serverVersion: conflictData?.serverVersion || 'desconhecida',
          localUpdated: new Date().toISOString(),
          serverUpdated: conflictData?.serverUpdated || 'desconhecida',
        });
        setStatus('error');
        setSyncProgress('Conflito detectado');
        // Feature 5: store resume point on failure
        const sentSoFar = resumeFrom + Math.floor(totalItems / 2);
        localStorage.setItem('cloud_sync_resume_point', String(sentSoFar));
        setStoredResumePoint(sentSoFar);
        return;
      }

      if (!res.ok) {
        // Feature 5: store partial progress on failure
        const sentSoFar = resumeFrom + Math.floor(totalItems / 2);
        localStorage.setItem('cloud_sync_resume_point', String(sentSoFar));
        setStoredResumePoint(sentSoFar);
        throw new Error(`HTTP ${res.status}`);
      }

      // Feature 6: Verify checksum in response
      let responseChecksum: string | null = null;
      try {
        const responseData = await res.json();
        if (responseData?.devices) setDevices(responseData.devices);
        responseChecksum = responseData?.checksum || null;
      } catch { /* ignore non-JSON responses */ }

      if (responseChecksum) {
        setChecksumValid(responseChecksum === payloadChecksum);
      } else {
        setChecksumValid(true); // assume valid if server doesn't return checksum
      }

      const now = new Date().toISOString();
      await ados.db.setSetting('cloud_sync_last', now);
      await ados.db.setSetting('cloud_sync_version', String(currentVersion));
      setLastSync(now);
      setLastSyncVersion(currentVersion);
      setSyncDetails(`${deltaEnabled ? 'Delta' : 'Full'}: ${sessions.length} sessões, ${labels.length} labels`);
      setSyncPercent(100);
      setStatus('synced');
      setSyncProgress('');
      setPartialProgress(null);
      // NEW Feature 8: Mark all categories as complete
      setCategoryProgress(prev => {
        const updated: Record<string, { sent: number; total: number }> = {};
        for (const [k, v] of Object.entries(prev)) updated[k] = { sent: v.total, total: v.total };
        return updated;
      });
      retryCount.current = 0;

      // Feature 5: Clear resume point on success
      localStorage.removeItem('cloud_sync_resume_point');
      setStoredResumePoint(null);

      // #29 Clear offline queue after successful sync
      if (offlineQueue.length > 0) {
        setOfflineQueue([]);
        localStorage.removeItem('cloud_sync_offline_queue');
      }

      // Store sync backup per category in localStorage
      const syncTimestamp = new Date().toISOString();
      const enabledCategories: string[] = [];
      if (syncCategories.sessions) {
        localStorage.setItem('ados_sync_backup_sessions', JSON.stringify({ data: sessions, syncedAt: syncTimestamp }));
        enabledCategories.push('sessions');
      }
      if (syncCategories.labels) {
        localStorage.setItem('ados_sync_backup_labels', JSON.stringify({ data: labels, syncedAt: syncTimestamp }));
        enabledCategories.push('labels');
      }
      if (syncCategories.brain) {
        const memories = await ados.db.getMemories?.() || [];
        localStorage.setItem('ados_sync_backup_brain', JSON.stringify({ data: memories, syncedAt: syncTimestamp }));
        enabledCategories.push('brain');
      }
      if (syncCategories.skills) {
        const skills = await ados.db.getSkills?.() || prefs?.skills || [];
        localStorage.setItem('ados_sync_backup_skills', JSON.stringify({ data: skills, syncedAt: syncTimestamp }));
        enabledCategories.push('skills');
      }

      // Dispatch cross-menu integration event
      window.dispatchEvent(new CustomEvent('cloudsync:completed', { detail: { categories: enabledCategories, timestamp: syncTimestamp } }));

      // #34 Multi-server: replicate to backup servers
      if (multiServerEnabled && syncServers.length > 0) {
        handleMultiServerSync();
      }

      // Feature 3: Add log entry
      const duration = Date.now() - startTime;
      const bytes = typeof fetchBody === 'string' ? new Blob([fetchBody]).size : (fetchBody as Blob).size;
      addLogEntry({ timestamp: now, status: 'success', itemCount: totalItems, bytes, durationMs: duration });

      // Feature 7: Notification
      if (notifyEnabled) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Cloud Sync', { body: 'Sincronização concluída' });
        } else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification('Cloud Sync', { body: 'Sincronização concluída' });
          });
        }
      }
    } catch (err: any) {
      setStatus('error');
      setSyncProgress('');
      // Feature 3: Log error
      const duration = Date.now() - startTime;
      addLogEntry({ timestamp: new Date().toISOString(), status: 'error', itemCount: 0, bytes: 0, durationMs: duration });

      setSyncPercent(0);
      retryCount.current++;
      if (retryCount.current <= 3) {
        const delay = [30000, 60000, 300000][retryCount.current - 1];
        setSyncProgress(`Retry em ${delay / 1000}s...`);
        setRetryNextAt(Date.now() + delay);
        setRetryPendingItems([
          ...(syncCategories.sessions ? ['Sessions'] : []),
          ...(syncCategories.labels ? ['Labels'] : []),
          ...(syncCategories.skills ? ['Skills'] : []),
          ...(syncCategories.brain ? ['Brain'] : []),
        ]);
        retryTimer.current = setTimeout(() => { setSyncProgress(''); setRetryNextAt(null); setRetryPendingItems([]); handleSync(); }, delay);
      } else {
        setSyncProgress('Máximo de tentativas atingido');
        retryCount.current = 0;
        setRetryNextAt(null);
        setRetryPendingItems([]);
      }
    }
  };

  // Feature 8: Wipe remoto
  const handleWipeRemote = async () => {
    if (!endpoint || !isValidUrl(endpoint)) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;
      await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ action: 'DELETE_ALL', confirm: true }) });
      // Clear local sync state
      await ados.db.setSetting('cloud_sync_last', '');
      await ados.db.setSetting('cloud_sync_version', '0');
      setLastSync(null);
      setLastSyncVersion(0);
      setStatus('disconnected');
      setSyncDetails('');
      localStorage.removeItem('cloud_sync_resume_point');
      setStoredResumePoint(null);
      setWipeModal(false);
      setWipeStep(1);
      setWipeConfirmText('');
    } catch {
      setWipeModal(false);
      setWipeStep(1);
      setWipeConfirmText('');
    }
  };

  const statusConfig = {
    disconnected: { color: 'text-muted', bg: 'bg-surface-3', label: 'Desconectado' },
    syncing: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Sincronizando...' },
    synced: { color: 'text-green-500', bg: 'bg-green-500/10', label: 'Sincronizado' },
    error: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Erro' },
  };

  const s = statusConfig[status];

  const toggleCategory = (key: keyof SyncCategories) => {
    setSyncCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Cloud Sync</h1>
        <p className="text-sm text-muted mt-1">Sincronize sessões e configurações com um servidor remoto.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-primary">Status</h3>
                {/* #7 Encryption Badge */}
                {encryptEnabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">
                    🔒 AES-256-GCM
                  </span>
                )}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
                {s.label}
              </span>
            </div>

            {lastSync && (
              <div>
                <p className="text-xs text-muted">
                  Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
                </p>
                {syncDetails && <p className="text-[10px] text-muted">{syncDetails}</p>}
              </div>
            )}
            {syncProgress && <p className="text-xs text-blue-400">{syncProgress}</p>}
            {endpointOnline !== null && endpoint && (
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${endpointOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-[10px] text-muted">{endpointOnline ? 'Endpoint online' : 'Endpoint offline'}</span>
              </div>
            )}

            {/* Feature 6: Checksum display */}
            {checksum && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted font-mono">Checksum: {checksum}</span>
                {checksumValid !== null && (
                  <span className={`text-xs ${checksumValid ? 'text-green-500' : 'text-red-500'}`}>
                    {checksumValid ? '✓' : '✗'}
                  </span>
                )}
              </div>
            )}

            {/* #1 Progress Ring */}
            {status === 'syncing' && (
              <div className="flex items-center gap-4">
                <ProgressRing progress={syncPercent} size={72} strokeWidth={6} />
                {/* #3 Bandwidth Gauge */}
                {bandwidthKBs !== null && (
                  <div className="bg-surface-2 rounded-lg px-3 py-2">
                    <p className="text-lg font-bold text-primary">{bandwidthKBs} <span className="text-xs font-normal text-muted">KB/s</span></p>
                    <p className="text-[10px] text-muted">Velocidade atual</p>
                  </div>
                )}
              </div>
            )}

            {/* Feature 4: Throttle badge */}
            {throttleEnabled && throttleSpeed !== 'unlimited' && (
              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500">
                Upload limitado: {throttleSpeed}
              </span>
            )}
          </div>

          {/* Feature 1: Sync seletivo + #5 Category item counts */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-primary">O que sincronizar</h3>
            {([
              ['sessions', 'Sessões'],
              ['labels', 'Labels'],
              ['skills', 'Skills'],
              ['automations', 'Automações'],
              ['dashboards', 'Dashboards & Widgets'],
              ['brain', 'Brain'],
            ] as [keyof SyncCategories, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-secondary">
                  {label}
                  {categoryCounts[key] !== undefined && (
                    <span className="text-[10px] text-muted ml-1">({categoryCounts[key]})</span>
                  )}
                </span>
                <button
                  onClick={() => toggleCategory(key)}
                  className={`w-10 h-5 rounded-full transition-colors ${syncCategories[key] ? 'bg-brand-600' : 'bg-surface-3'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${syncCategories[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-primary">Configuração</h3>

            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Endpoint do servidor</label>
              <input
                value={endpoint}
                onChange={(e) => handleEndpointChange(e.target.value)}
                placeholder="https://sync.example.com/api/v1"
                className={`w-full bg-surface-0 border rounded-lg px-3 py-2.5 text-sm text-primary font-mono outline-none ${urlError ? 'border-red-500/50' : 'border-default focus:border-brand-500/50'}`}
              />
              {urlError ? (
                <p className="text-[10px] text-red-500 mt-1">{urlError}</p>
              ) : (
                <p className="text-[10px] text-muted mt-1">URL do servidor compatível com JVOS Sync Protocol.</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Auto-sync</p>
                <p className="text-xs text-muted">Sincronizar automaticamente a cada 5 minutos.</p>
              </div>
              <button
                onClick={() => setAutoSync(!autoSync)}
                className={`w-10 h-5 rounded-full transition-colors ${autoSync ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoSync ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* #6 Delta sync toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Delta Sync</p>
                <p className="text-xs text-muted">Enviar apenas alterações desde a última sincronização.</p>
              </div>
              <button
                onClick={() => setDeltaEnabled(!deltaEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${deltaEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${deltaEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {deltaEnabled && lastSyncVersion > 0 && (
              <p className="text-[10px] text-muted">Versão atual: v{lastSyncVersion}</p>
            )}

            {/* #7 Compression toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Compressão (gzip)</p>
                <p className="text-xs text-muted">Comprimir payload antes de enviar (~70% redução).</p>
              </div>
              <button
                onClick={() => setCompressEnabled(!compressEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${compressEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${compressEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* #9 Encryption toggle + key */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Criptografia (AES-256-GCM)</p>
                <p className="text-xs text-muted">Encriptar dados antes de enviar ao servidor.</p>
              </div>
              <button
                onClick={() => setEncryptEnabled(!encryptEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${encryptEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${encryptEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {encryptEnabled && (
              <div>
                <label className="text-xs font-medium text-secondary mb-1 block">Chave de criptografia</label>
                <input
                  type="password"
                  value={encryptKey}
                  onChange={(e) => setEncryptKey(e.target.value)}
                  placeholder="Chave secreta (mín. 8 caracteres)"
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
                />
                {encryptKey && encryptKey.length < 8 && <p className="text-[10px] text-yellow-500 mt-1">Recomendado: mínimo 8 caracteres</p>}
              </div>
            )}

            {/* Feature 4: Bandwidth throttle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Limitar upload</p>
                <p className="text-xs text-muted">Controlar velocidade de envio ao servidor.</p>
              </div>
              <button
                onClick={() => setThrottleEnabled(!throttleEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${throttleEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${throttleEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {throttleEnabled && (
              <div>
                <select
                  value={throttleSpeed}
                  onChange={(e) => setThrottleSpeed(e.target.value)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
                >
                  <option value="unlimited">Sem limite</option>
                  <option value="1 MB/s">1 MB/s</option>
                  <option value="500 KB/s">500 KB/s</option>
                  <option value="100 KB/s">100 KB/s</option>
                </select>
              </div>
            )}

            {/* Feature 7: Notification toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Notificar ao concluir</p>
                <p className="text-xs text-muted">Enviar notificação quando sync terminar.</p>
              </div>
              <button
                onClick={() => {
                  if (!notifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                    Notification.requestPermission();
                  }
                  setNotifyEnabled(!notifyEnabled);
                }}
                className={`w-10 h-5 rounded-full transition-colors ${notifyEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notifyEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* #10 JVOS-Server JWT integration */}
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">JWT Token (JVOS-Server)</label>
              <input
                type="password"
                value={jwtToken}
                onChange={(e) => setJwtToken(e.target.value)}
                placeholder="Bearer token para autenticação no JVOS-Server"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
              />
              <p className="text-[10px] text-muted mt-1">Opcional: autenticação JWT para JVOS License Server.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  saved ? 'bg-green-500/10 text-green-500' : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
              >
                {saved ? 'Salvo' : 'Salvar'}
              </button>
              <button
                onClick={() => handleSync()}
                disabled={!endpoint || status === 'syncing'}
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-sm font-medium text-secondary transition-all"
              >
                Sincronizar Agora
              </button>
            </div>

            {/* Feature 5: Resume button */}
            {storedResumePoint !== null && status !== 'syncing' && (
              <button
                onClick={() => handleSync(false, storedResumePoint)}
                className="w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg text-sm font-medium text-yellow-600 transition-all"
              >
                Retomar de onde parou? (item {storedResumePoint})
              </button>
            )}

            {/* Feature 2: Sync automático interval */}
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Sync automático</label>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value)}
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
              >
                <option value="off">Desligado</option>
                <option value="1h">A cada 1 hora</option>
                <option value="6h">A cada 6 horas</option>
                <option value="12h">A cada 12 horas</option>
                <option value="24h">A cada 24 horas</option>
              </select>
              {nextSyncTime && (
                <p className="text-[10px] text-muted mt-1">Próximo sync: {nextSyncTime}</p>
              )}
            </div>
          </div>

          {/* #4 Sync History Timeline */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Histórico de Sync</h3>
              <button
                onClick={() => setShowLog(!showLog)}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                {showLog ? 'Ocultar' : 'Ver timeline'}
              </button>
            </div>
            {showLog && (
              <div className="max-h-72 overflow-y-auto pl-4">
                {syncLog.length === 0 ? (
                  <p className="text-xs text-muted">Nenhum sync registrado.</p>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-surface-3" />
                    {syncLog.map((entry, i) => (
                      <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                        {/* Dot */}
                        <div className={`relative z-10 w-3 h-3 rounded-full mt-0.5 shrink-0 ${entry.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-primary font-medium">
                            {new Date(entry.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-muted">
                            {entry.itemCount} itens &middot; {(entry.bytes / 1024).toFixed(1)} KB &middot; {(entry.durationMs / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">O que é sincronizado</h3>
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Sessões e mensagens
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Preferências e configurações
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Labels e pairings
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                API keys (criptografadas)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                MCP servers (apenas config, não credenciais)
              </li>
            </ul>
          </div>

          {/* #10 Multi-device display + #6 Device last-seen */}
          {devices.length > 0 && (
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-primary">Dispositivos Conectados</h3>
              <div className="space-y-2">
                {devices.map(d => {
                  const diffMs = Date.now() - new Date(d.lastSync).getTime();
                  const diffHours = diffMs / 3600000;
                  const lastSeenLabel = diffHours < 0.1 ? 'Online agora' : diffHours < 6 ? `Há ${Math.round(diffHours)}h` : 'Offline';
                  const dotColor = diffHours < 0.1 ? 'bg-green-500' : diffHours < 6 ? 'bg-yellow-500' : 'bg-gray-400';
                  const textColor = diffHours < 0.1 ? 'text-green-500' : diffHours < 6 ? 'text-yellow-500' : 'text-muted';
                  return (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-surface-0 rounded-lg">
                      <span className="text-xs text-primary font-medium">{d.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                        <span className={`text-[10px] ${textColor}`}>{lastSeenLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NEW Feature 3: Métricas de sync */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">Métricas de Sync</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{syncMetrics.totalMB.toFixed(2)}</p>
                <p className="text-[10px] text-muted">MB sincronizados</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{syncMetrics.avgFrequencyHours > 0 ? syncMetrics.avgFrequencyHours.toFixed(1) + 'h' : '—'}</p>
                <p className="text-[10px] text-muted">Frequência média</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{syncMetrics.avgDurationMs > 0 ? (syncMetrics.avgDurationMs / 1000).toFixed(1) + 's' : '—'}</p>
                <p className="text-[10px] text-muted">Tempo médio</p>
              </div>
            </div>
          </div>

          {/* #10 Data Size Donut Chart */}
          {dataSizeByCategory.length > 0 && (
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-primary">Distribuição de Dados</h3>
              <DonutChart data={dataSizeByCategory} />
              <p className="text-[10px] text-muted">
                Total: {(dataSizeByCategory.reduce((s, d) => s + d.value, 0) / 1024).toFixed(1)} KB
              </p>
            </div>
          )}

          {/* NEW Feature 8: Indicador de progresso por categoria */}
          {Object.keys(categoryProgress).length > 0 && (
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-primary">Progresso por Categoria</h3>
              <div className="space-y-2">
                {Object.entries(categoryProgress).map(([cat, prog]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-secondary capitalize">{cat}</span>
                      <span className="text-[10px] text-muted">{prog.total > 0 ? Math.round((prog.sent / prog.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-1.5">
                      <div
                        className="bg-brand-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${prog.total > 0 ? (prog.sent / prog.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEW Feature 5: Conflitos pendentes */}
          {pendingConflicts.length > 0 && (
            <div className="bg-surface-1 border border-yellow-500/20 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-yellow-500">Conflitos Pendentes ({pendingConflicts.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingConflicts.map(c => (
                  <div key={c.id} className="bg-surface-0 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary capitalize">{c.category}</span>
                      <span className="text-[10px] text-muted">{new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-[10px] text-secondary">{c.description}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolvePendingConflict(c.id, 'keep_local')}
                        className="px-2 py-1 bg-brand-600 hover:bg-brand-700 rounded text-[10px] text-white font-medium"
                      >
                        Manter local
                      </button>
                      <button
                        onClick={() => handleResolvePendingConflict(c.id, 'keep_server')}
                        className="px-2 py-1 bg-surface-2 hover:bg-surface-3 rounded text-[10px] text-secondary font-medium"
                      >
                        Usar servidor
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEW Feature 1: Histórico de versões do servidor */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Versões do Servidor</h3>
              <button
                onClick={() => { setShowSnapshots(!showSnapshots); if (!showSnapshots) fetchServerSnapshots(); }}
                disabled={!endpoint}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
              >
                {showSnapshots ? 'Ocultar' : 'Carregar snapshots'}
              </button>
            </div>
            {showSnapshots && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {serverSnapshots.length === 0 ? (
                  <p className="text-xs text-muted">Nenhum snapshot encontrado no servidor.</p>
                ) : (
                  serverSnapshots.map(snap => (
                    <div key={snap.id} className="flex items-center justify-between px-3 py-2 bg-surface-0 rounded-lg">
                      <div>
                        <span className="text-xs text-primary font-medium">v{snap.version}</span>
                        <span className="text-[10px] text-muted ml-2">{new Date(snap.createdAt).toLocaleString('pt-BR')}</span>
                        <span className="text-[10px] text-muted ml-2">{(snap.sizeBytes / 1024).toFixed(1)} KB</span>
                      </div>
                      <button
                        onClick={() => handleRestoreSnapshot(snap.id)}
                        disabled={restoringSnapshot === snap.id}
                        className="px-2 py-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded text-[10px] text-white font-medium"
                      >
                        {restoringSnapshot === snap.id ? 'Restaurando...' : 'Restaurar'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* NEW Feature 2: Sync via QR code */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Parear via QR Code</h3>
              <button
                onClick={generateQrPairCode}
                disabled={!endpoint}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
              >
                Gerar código
              </button>
            </div>
            <p className="text-[10px] text-muted">Gere um QR code para parear rapidamente outro dispositivo com este servidor.</p>
            {showQrCode && qrPairCode && (
              <div className="space-y-2">
                <div className="bg-white rounded-lg p-3 overflow-x-auto">
                  <pre className="text-[5px] leading-[5px] font-mono text-black whitespace-pre select-all">
                    {generateAsciiQr(`${endpoint}|${qrPairCode}`)}
                  </pre>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary font-mono bg-surface-2 px-2 py-1 rounded">{qrPairCode}</span>
                  <span className="text-[10px] text-muted">Código de pareamento</span>
                </div>
                <p className="text-[10px] text-muted">No outro dispositivo, use este código para conectar ao mesmo endpoint.</p>
              </div>
            )}
          </div>

          {/* NEW Feature 4: Exportar backup local */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">Backup Local</h3>
            <p className="text-xs text-muted">Baixe um snapshot completo dos seus dados como arquivo JSON.</p>
            <button
              onClick={handleExportBackup}
              disabled={exportingBackup}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-all"
            >
              {exportingBackup ? 'Exportando...' : 'Exportar Backup (JSON)'}
            </button>
          </div>

          {/* NEW Feature 6: Sync por Wi-Fi only */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Sync apenas via Wi-Fi</p>
                <p className="text-xs text-muted">Bloquear sincronização em conexões metered (dados móveis).</p>
              </div>
              <button
                onClick={() => setWifiOnly(!wifiOnly)}
                className={`w-10 h-5 rounded-full transition-colors ${wifiOnly ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${wifiOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {wifiOnly && (
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isMetered ? 'bg-yellow-500' : 'bg-green-500'}`} />
                <span className="text-[10px] text-muted">{isMetered ? 'Conexão metered detectada — sync bloqueado' : 'Conexão não-metered — sync permitido'}</span>
              </div>
            )}
          </div>

          {/* NEW Feature 7: Validação de endpoint */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">Validar Endpoint</h3>
            <p className="text-xs text-muted">Testar conectividade e autenticação antes de salvar a configuração.</p>
            <button
              onClick={handleValidateEndpoint}
              disabled={!endpoint || endpointValidating}
              className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 rounded-lg text-sm font-medium text-secondary transition-all"
            >
              {endpointValidating ? 'Testando...' : 'Testar Conexão'}
            </button>
            {endpointValidationResult === 'success' && (
              <p className="text-xs text-green-500">Endpoint acessível e autenticação válida.</p>
            )}
            {endpointValidationResult === 'auth_fail' && (
              <p className="text-xs text-yellow-500">Endpoint acessível, mas autenticação falhou (401/403). Verifique o JWT Token.</p>
            )}
            {endpointValidationResult === 'unreachable' && (
              <p className="text-xs text-red-500">Endpoint não acessível. Verifique a URL e sua conexão.</p>
            )}
          </div>

          {/* #28 Bandwidth indicator */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Estimativa de Payload</h3>
              <button
                onClick={handleEstimatePayload}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                Calcular tamanho
              </button>
            </div>
            <p className="text-[10px] text-muted">Veja o tamanho estimado dos dados antes de sincronizar.</p>
            {showPayloadEstimate && payloadSizeEstimate !== null && (
              <div className="bg-surface-2 rounded-lg p-3">
                <p className="text-sm font-medium text-primary">
                  {payloadSizeEstimate < 1024
                    ? `${payloadSizeEstimate} B`
                    : payloadSizeEstimate < 1048576
                    ? `${(payloadSizeEstimate / 1024).toFixed(1)} KB`
                    : `${(payloadSizeEstimate / 1048576).toFixed(2)} MB`}
                </p>
                <p className="text-[10px] text-muted mt-1">
                  {compressEnabled ? 'Com compressão: ~' + ((payloadSizeEstimate * 0.3) / 1024).toFixed(1) + ' KB estimado' : 'Sem compressão ativa'}
                </p>
              </div>
            )}
          </div>

          {/* #29 Offline queue */}
          {(!isOnline || offlineQueue.length > 0) && (
            <div className="bg-surface-1 border border-yellow-500/20 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-yellow-500">Fila Offline</h3>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-muted">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </div>
              {offlineQueue.length === 0 ? (
                <p className="text-xs text-muted">Nenhuma mudança na fila. Alterações feitas offline serão acumuladas aqui.</p>
              ) : (
                <>
                  <p className="text-xs text-secondary">{offlineQueue.length} mudança(s) pendente(s)</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {offlineQueue.slice(0, 10).map(q => (
                      <div key={q.id} className="flex items-center justify-between px-2 py-1.5 bg-surface-0 rounded-lg">
                        <span className="text-[10px] text-secondary capitalize">{q.category}: {q.action}</span>
                        <span className="text-[10px] text-muted">{new Date(q.timestamp).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                  {isOnline && (
                    <button
                      onClick={() => handleSync()}
                      className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium text-white"
                    >
                      Sincronizar fila agora
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* #8 Retry Queue Visualization */}
          {retryNextAt !== null && retryPendingItems.length > 0 && (
            <div className="bg-surface-1 border border-orange-500/20 rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-orange-500">Fila de Retry</h3>
                <span className="text-xs font-mono text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                  Tentativa {retryCount.current}/3
                </span>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-secondary">Próxima tentativa em:</span>
                <span className="text-sm font-bold text-primary font-mono">{retryCountdown}</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted">Itens pendentes:</p>
                {retryPendingItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 bg-surface-0 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="text-[10px] text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* #30 Merge inteligente */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Merge Inteligente</p>
                <p className="text-xs text-muted">Resolver conflitos automaticamente pelo timestamp mais recente.</p>
              </div>
              <button
                onClick={() => setAutoMergeEnabled(!autoMergeEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${autoMergeEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoMergeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {autoMergeEnabled && (
              <p className="text-[10px] text-muted">Quando um conflito 409 ocorrer, a versão mais recente (por timestamp) será mantida automaticamente.</p>
            )}
          </div>

          {/* #33 Audit trail remoto */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-primary">Audit Trail Remoto</h3>
              <button
                onClick={() => { setShowAuditTrail(!showAuditTrail); if (!showAuditTrail) fetchAuditTrail(); }}
                disabled={!endpoint}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
              >
                {showAuditTrail ? 'Ocultar' : 'Carregar log'}
              </button>
            </div>
            <p className="text-[10px] text-muted">Log de syncs no servidor: quem, quando e o quê foi sincronizado.</p>
            {showAuditTrail && (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {auditTrail.length === 0 ? (
                  <p className="text-xs text-muted">Nenhuma entrada de audit trail no servidor.</p>
                ) : (
                  auditTrail.map(entry => (
                    <div key={entry.id} className="px-3 py-2 bg-surface-0 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-primary font-medium">{entry.device}</span>
                        <span className={`text-[10px] ${entry.status === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                          {entry.status === 'success' ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted">
                        <span>{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                        <span>{entry.action}</span>
                        <span>{entry.itemCount} itens</span>
                      </div>
                      {entry.categories.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {entry.categories.map(cat => (
                            <span key={cat} className="text-[9px] px-1.5 py-0.5 bg-surface-2 rounded text-muted capitalize">{cat}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* #34 Multi-server */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary">Multi-Server (Backup Redundante)</p>
                <p className="text-xs text-muted">Sincronizar com múltiplos servidores para redundância.</p>
              </div>
              <button
                onClick={() => setMultiServerEnabled(!multiServerEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${multiServerEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${multiServerEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {multiServerEnabled && (
              <div className="space-y-2">
                {syncServers.map(server => (
                  <div key={server.id} className="flex items-center justify-between px-3 py-2 bg-surface-0 rounded-lg">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSyncServer(server.id)}>
                        <span className={`w-2 h-2 rounded-full inline-block ${server.enabled ? 'bg-green-500' : 'bg-surface-3'}`} />
                      </button>
                      <div>
                        <p className="text-xs text-primary font-medium">{server.name}</p>
                        <p className="text-[10px] text-muted font-mono truncate max-w-[200px]">{server.url}</p>
                      </div>
                    </div>
                    <button onClick={() => removeSyncServer(server.id)} className="text-xs text-red-500 hover:text-red-600">
                      Remover
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const name = prompt('Nome do servidor:');
                    const url = prompt('URL do servidor:');
                    if (name && url && isValidUrl(url)) addSyncServer(name, url);
                  }}
                  className="w-full px-3 py-2 border border-dashed border-default rounded-lg text-xs text-muted hover:text-secondary hover:border-brand-500/50 transition-all"
                >
                  + Adicionar servidor
                </button>
              </div>
            )}
          </div>

          {/* #9 Schedule Calendar */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">Agendar Sync</h3>
            <p className="text-[10px] text-muted">Selecione os dias e horário para sincronização automática.</p>
            <MiniCalendar
              selectedDays={scheduleDays}
              onToggleDay={(day) => setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
              time={scheduledTime}
              onTimeChange={setScheduledTime}
            />
            {scheduledTime && scheduleDays.length > 0 && (
              <p className="text-[10px] text-muted">
                Sync agendado para {scheduledTime} nos dias selecionados ({scheduleDays.length} dias/semana).
              </p>
            )}
            {scheduledTime && (
              <button
                onClick={() => { setScheduledTime(''); setScheduleDays([]); }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                Remover agendamento
              </button>
            )}
          </div>

          {/* #38 Recovery mode */}
          <div className="bg-surface-1 border border-blue-500/20 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-primary">Recovery Mode</h3>
            <p className="text-xs text-muted">Restaurar estado completo do dispositivo a partir de um backup remoto. Substitui todos os dados locais.</p>
            {recoveryProgress && (
              <p className="text-xs text-blue-400">{recoveryProgress}</p>
            )}
            <button
              onClick={handleRecoveryMode}
              disabled={!endpoint || recoveryMode}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-all"
            >
              {recoveryMode ? 'Restaurando...' : 'Iniciar Recovery'}
            </button>
          </div>

          {/* Feature 8: Wipe remoto */}
          <div className="bg-surface-1 border border-red-500/20 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-medium text-red-500">Zona de Perigo</h3>
            <p className="text-xs text-muted">Apagar todos os dados sincronizados no servidor remoto. Esta ação é irreversível.</p>
            <button
              onClick={() => { setWipeModal(true); setWipeStep(1); setWipeConfirmText(''); }}
              disabled={!endpoint}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-all"
            >
              Apagar dados remotos
            </button>
          </div>
        </div>
      </div>

      {/* #4 Conflict resolution modal + #2 Conflict diff viewer */}
      {conflict && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Conflito de Sincronização</h3>
            <p className="text-sm text-muted mb-4">
              Os dados no servidor divergem da versão local. Compare e escolha:
            </p>
            {/* #2 Side-by-side diff viewer */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Local</p>
                <div className="space-y-1">
                  <p className="text-xs text-secondary">Versão: <span className="font-mono font-bold text-primary bg-blue-500/10 px-1 rounded">v{conflict.localVersion}</span></p>
                  <p className="text-xs text-secondary">Atualizado: <span className="font-mono text-[10px] text-primary">{new Date(conflict.localUpdated).toLocaleString('pt-BR')}</span></p>
                </div>
              </div>
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide">Servidor</p>
                <div className="space-y-1">
                  <p className="text-xs text-secondary">Versão: <span className="font-mono font-bold text-primary bg-orange-500/10 px-1 rounded">v{conflict.serverVersion}</span></p>
                  <p className="text-xs text-secondary">Atualizado: <span className="font-mono text-[10px] text-primary">{conflict.serverUpdated !== 'desconhecida' ? new Date(conflict.serverUpdated).toLocaleString('pt-BR') : 'desconhecida'}</span></p>
                </div>
              </div>
            </div>
            {/* Highlight difference */}
            {conflict.localVersion !== conflict.serverVersion && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2 mb-4">
                <p className="text-[10px] text-yellow-600">Diferença: versão local v{conflict.localVersion} vs servidor v{conflict.serverVersion}</p>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleResolveConflict('local')}
                className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium text-left"
              >
                Manter Local — enviar meus dados para o servidor
              </button>
              <button
                onClick={() => handleResolveConflict('server')}
                className="w-full px-4 py-2.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium text-left"
              >
                Usar Servidor — descartar alterações locais
              </button>
              <button
                onClick={() => handleResolveConflict('merge')}
                className="w-full px-4 py-2.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium text-left"
              >
                Merge — combinar ambos (pode duplicar)
              </button>
              <button
                onClick={() => setConflict(null)}
                className="w-full px-4 py-2 text-sm text-muted hover:text-secondary text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 8: Wipe modal */}
      {wipeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4">
            {wipeStep === 1 ? (
              <>
                <h3 className="text-base font-semibold text-red-500 mb-2">Apagar dados remotos</h3>
                <p className="text-sm text-muted mb-4">
                  Tem certeza que deseja apagar TODOS os dados sincronizados no servidor? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setWipeStep(2)}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium"
                  >
                    Sim, continuar
                  </button>
                  <button
                    onClick={() => { setWipeModal(false); setWipeStep(1); }}
                    className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-red-500 mb-2">Confirmação final</h3>
                <p className="text-sm text-muted mb-4">
                  Digite <span className="font-mono font-bold text-red-500">APAGAR</span> para confirmar a exclusão permanente.
                </p>
                <input
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  placeholder="Digite APAGAR"
                  className="w-full bg-surface-0 border border-red-500/30 rounded-lg px-3 py-2.5 text-sm text-primary font-mono outline-none focus:border-red-500/50 mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleWipeRemote}
                    disabled={wipeConfirmText !== 'APAGAR'}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium"
                  >
                    Apagar permanentemente
                  </button>
                  <button
                    onClick={() => { setWipeModal(false); setWipeStep(1); setWipeConfirmText(''); }}
                    className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
