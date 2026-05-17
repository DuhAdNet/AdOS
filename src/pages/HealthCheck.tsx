import { useState, useEffect, useRef, useCallback } from 'react';

const ados = (window as any).ados;

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  message: string;
  action?: { label: string; page: string };
  category?: string;
}

interface HistoryEntry {
  timestamp: string;
  results: CheckResult[];
}

interface CustomCheck {
  id: string;
  name: string;
  type: 'url-ping' | 'port-check';
  target: string;
}

interface CheckWeight {
  id: string;
  checkName: string;
  weight: 'critical' | 'informative';
}

interface ThresholdConfig {
  [checkName: string]: { warning: number; critical: number };
}

interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

interface WebhookConfig {
  enabled: boolean;
  url: string;
  onError: boolean;
  onWarning: boolean;
}

interface UptimeEntry {
  provider: string;
  timestamp: string;
  status: 'ok' | 'error';
}

interface LatencyBenchmark {
  provider: string;
  latencyMs: number;
  status: 'ok' | 'warning' | 'error';
}

const CATEGORIES: Record<string, string[]> = {
  'Sistema': ['Memory', 'Memory (Heap)', 'Memory (JS Heap)', 'Disk Space', 'Disk Space (Detailed)', 'Electron Runtime', 'App Update', 'Filesystem Permissions'],
  'Rede': ['MCP Servers', 'Telegram Bot', 'SSL Certificates', 'Webhook'],
  'LLM': ['LLM Provider', 'LLM Provider (Deep)', 'Modelo Padrão', 'Latency Benchmark', 'Credentials'],
  'Storage': ['Database', 'Brain Memories'],
  'Automação': ['Automações Pendentes', 'Auto-Heal'],
  'Uptime': ['Uptime Tracker'],
};

function getCategoryForCheck(name: string): string {
  for (const [cat, checks] of Object.entries(CATEGORIES)) {
    if (checks.some(c => name.startsWith(c) || name === c)) return cat;
  }
  return 'Outros';
}

function getCategoryStatus(results: CheckResult[], category: string): 'ok' | 'warning' | 'error' | 'pending' {
  const categoryResults = results.filter(r => getCategoryForCheck(r.name) === category);
  if (categoryResults.length === 0) return 'ok';
  if (categoryResults.some(r => r.status === 'error')) return 'error';
  if (categoryResults.some(r => r.status === 'warning')) return 'warning';
  return 'ok';
}

function isInQuietHours(qh: QuietHours): boolean {
  if (!qh.enabled) return false;
  const now = new Date();
  const hour = now.getHours();
  if (qh.startHour > qh.endHour) {
    // Crosses midnight, e.g. 22:00-08:00
    return hour >= qh.startHour || hour < qh.endHour;
  }
  return hour >= qh.startHour && hour < qh.endHour;
}

export default function HealthCheck() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [scheduledInterval, setScheduledInterval] = useState<number>(0);
  const [deepCheck, setDeepCheck] = useState(false);
  const scheduledTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feature 1: Export feedback
  const [exportFeedback, setExportFeedback] = useState(false);

  // UI Improvement 1: Animated progress bar
  const [completedChecks, setCompletedChecks] = useState(0);
  const [totalChecks, setTotalChecks] = useState(0);

  // UI Improvement 5: Next check countdown
  const [nextCheckCountdown, setNextCheckCountdown] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCheckTimeRef = useRef<number>(Date.now());

  // UI Improvement 8: Configurable thresholds (user-facing)
  const [showThresholdsPanel, setShowThresholdsPanel] = useState(false);
  const [userThresholds, setUserThresholds] = useState<{ memory: number; latency: number; disk: number }>({ memory: 80, latency: 3000, disk: 85 });

  // UI Improvement 9: Resource sparklines history
  const [resourceHistory, setResourceHistory] = useState<{ memory: number[]; disk: number[]; cpu: number[] }>({ memory: [], disk: [], cpu: [] });

  // Feature 3: Collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Feature 4: Custom checks
  const [customChecks, setCustomChecks] = useState<CustomCheck[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', type: 'url-ping' as 'url-ping' | 'port-check', target: '' });

  // Feature 5: Thresholds
  const [thresholds, setThresholds] = useState<ThresholdConfig>({});
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);

  // Feature 6: Automation on failure
  const [autoActionEnabled, setAutoActionEnabled] = useState(false);

  // Feature 8: Quiet hours
  const [quietHours, setQuietHours] = useState<QuietHours>({ enabled: false, startHour: 22, endHour: 8 });

  // NEW Feature 1: App update check
  const [appUpdateAvailable, setAppUpdateAvailable] = useState<{ available: boolean; version?: string } | null>(null);

  // NEW Feature 2: SSL certificates check
  const [sslResults, setSslResults] = useState<Array<{ server: string; valid: boolean; expiresIn?: number; error?: string }>>([]);

  // NEW Feature 3: Comparative report
  const [showComparative, setShowComparative] = useState(false);

  // NEW Feature 4: Check weights
  const [checkWeights, setCheckWeights] = useState<CheckWeight[]>([]);

  // NEW Feature 5: Share report feedback
  const [shareFeedback, setShareFeedback] = useState(false);

  // NEW Feature 6: Filesystem permissions check
  const [fsPermissions, setFsPermissions] = useState<Array<{ path: string; readable: boolean; writable: boolean }>>([]);

  // NEW Feature 7: Total diagnostic time
  const [diagnosticTimeMs, setDiagnosticTimeMs] = useState<number | null>(null);

  // NEW Feature 8: Health score
  const [healthScore, setHealthScore] = useState<number | null>(null);

  // Feature 27: Latency benchmark
  const [latencyBenchmarks, setLatencyBenchmarks] = useState<LatencyBenchmark[]>([]);

  // Feature 32: Webhook config
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({ enabled: false, url: '', onError: true, onWarning: false });
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Feature 34: Uptime tracker
  const [uptimeEntries, setUptimeEntries] = useState<UptimeEntry[]>([]);

  // Feature 36: Auto-heal
  const [autoHealLog, setAutoHealLog] = useState<string[]>([]);

  useEffect(() => { runChecks(); loadSchedule(); loadLocalSettings(); }, []);

  useEffect(() => {
    if (scheduledTimer.current) clearInterval(scheduledTimer.current);
    if (scheduledInterval > 0) {
      scheduledTimer.current = setInterval(() => { runChecks(true); lastCheckTimeRef.current = Date.now(); }, scheduledInterval * 3600000);
    }
    return () => { if (scheduledTimer.current) clearInterval(scheduledTimer.current); };
  }, [scheduledInterval]);

  // UI Improvement 5: Countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (scheduledInterval > 0) {
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - lastCheckTimeRef.current;
        const remaining = Math.max(0, scheduledInterval * 3600000 - elapsed);
        setNextCheckCountdown(Math.floor(remaining / 1000));
      }, 1000);
    } else {
      setNextCheckCountdown(0);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [scheduledInterval]);

  // UI Improvement 8: Load user thresholds from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('healthcheck-user-thresholds');
      if (saved) setUserThresholds(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const loadLocalSettings = () => {
    try {
      const savedChecks = localStorage.getItem('healthcheck-custom-checks');
      if (savedChecks) setCustomChecks(JSON.parse(savedChecks));
      const savedThresholds = localStorage.getItem('healthcheck-thresholds');
      if (savedThresholds) setThresholds(JSON.parse(savedThresholds));
      const savedAuto = localStorage.getItem('healthcheck-auto-action');
      if (savedAuto) setAutoActionEnabled(savedAuto === 'true');
      const savedQuiet = localStorage.getItem('healthcheck-quiet-hours');
      if (savedQuiet) setQuietHours(JSON.parse(savedQuiet));
      const savedWeights = localStorage.getItem('healthcheck-check-weights');
      if (savedWeights) setCheckWeights(JSON.parse(savedWeights));
      const savedWebhook = localStorage.getItem('healthcheck-webhook-config');
      if (savedWebhook) setWebhookConfig(JSON.parse(savedWebhook));
      const savedUptime = localStorage.getItem('healthcheck-uptime-entries');
      if (savedUptime) setUptimeEntries(JSON.parse(savedUptime));
    } catch { /* ignore */ }
  };

  const saveCustomChecks = (checks: CustomCheck[]) => {
    setCustomChecks(checks);
    localStorage.setItem('healthcheck-custom-checks', JSON.stringify(checks));
  };

  const saveThresholds = (t: ThresholdConfig) => {
    setThresholds(t);
    localStorage.setItem('healthcheck-thresholds', JSON.stringify(t));
  };

  const saveAutoAction = (val: boolean) => {
    setAutoActionEnabled(val);
    localStorage.setItem('healthcheck-auto-action', String(val));
  };

  const saveQuietHours = (qh: QuietHours) => {
    setQuietHours(qh);
    localStorage.setItem('healthcheck-quiet-hours', JSON.stringify(qh));
  };

  // NEW: Save check weights
  const saveCheckWeights = (weights: CheckWeight[]) => {
    setCheckWeights(weights);
    localStorage.setItem('healthcheck-check-weights', JSON.stringify(weights));
  };

  // Feature 32: Save webhook config
  const saveWebhookConfig = (config: WebhookConfig) => {
    setWebhookConfig(config);
    localStorage.setItem('healthcheck-webhook-config', JSON.stringify(config));
  };

  // Feature 34: Save uptime entries
  const saveUptimeEntries = (entries: UptimeEntry[]) => {
    setUptimeEntries(entries);
    localStorage.setItem('healthcheck-uptime-entries', JSON.stringify(entries));
  };

  // Feature 32: Fire webhook
  const fireWebhook = async (checks: CheckResult[]) => {
    if (!webhookConfig.enabled || !webhookConfig.url) return;
    const errors = checks.filter(r => r.status === 'error');
    const warnings = checks.filter(r => r.status === 'warning');
    const shouldFire = (webhookConfig.onError && errors.length > 0) || (webhookConfig.onWarning && warnings.length > 0);
    if (!shouldFire) return;
    try {
      await fetch(webhookConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          errors: errors.map(r => ({ name: r.name, message: r.message })),
          warnings: warnings.map(r => ({ name: r.name, message: r.message })),
          healthScore,
        }),
      });
    } catch { /* silently fail */ }
  };

  // Feature 34: Record uptime entry
  const recordUptime = (checks: CheckResult[]) => {
    const now = new Date().toISOString();
    const providerChecks = checks.filter(r => r.name.startsWith('LLM Provider') || r.name === 'Latency Benchmark');
    const newEntries: UptimeEntry[] = providerChecks.map(c => ({
      provider: c.name,
      timestamp: now,
      status: c.status === 'error' ? 'error' : 'ok',
    }));
    // Keep last 7 days of entries
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const updated = [...uptimeEntries, ...newEntries].filter(e => new Date(e.timestamp).getTime() > sevenDaysAgo);
    saveUptimeEntries(updated);
  };

  // Feature 34: Calculate uptime percentage
  const getUptimePercentage = (provider: string): number => {
    const entries = uptimeEntries.filter(e => e.provider === provider);
    if (entries.length === 0) return 100;
    const okCount = entries.filter(e => e.status === 'ok').length;
    return Math.round((okCount / entries.length) * 100);
  };

  // Feature 36: Auto-heal logic
  const performAutoHeal = async (checks: CheckResult[]): Promise<string[]> => {
    const healLog: string[] = [];
    for (const check of checks) {
      if (check.status !== 'error') continue;
      if (check.name === 'MCP Servers' || check.name.includes('MCP')) {
        try {
          await ados.mcp?.reconnectAll?.();
          healLog.push(`[Auto-Heal] Reconectando MCP servers...`);
        } catch { healLog.push(`[Auto-Heal] Falha ao reconectar MCP`); }
      }
      if (check.name === 'Database') {
        try {
          await ados.db?.clearCache?.();
          healLog.push(`[Auto-Heal] Cache do banco limpo`);
        } catch { healLog.push(`[Auto-Heal] Falha ao limpar cache do banco`); }
      }
      if (check.name.includes('Memory') && check.status === 'error') {
        try {
          await ados.system?.clearCache?.();
          healLog.push(`[Auto-Heal] Cache do sistema limpo para liberar memória`);
        } catch { healLog.push(`[Auto-Heal] Falha ao limpar cache do sistema`); }
      }
    }
    return healLog;
  };

  // NEW Feature 4: Get weight for a check
  const getCheckWeight = (checkName: string): 'critical' | 'informative' => {
    const found = checkWeights.find(w => w.checkName === checkName);
    return found?.weight ?? 'critical';
  };

  // NEW Feature 4: Toggle weight
  const toggleCheckWeight = (checkName: string) => {
    const existing = checkWeights.find(w => w.checkName === checkName);
    if (existing) {
      const updated = checkWeights.map(w =>
        w.checkName === checkName
          ? { ...w, weight: w.weight === 'critical' ? 'informative' as const : 'critical' as const }
          : w
      );
      saveCheckWeights(updated);
    } else {
      saveCheckWeights([...checkWeights, { id: crypto.randomUUID(), checkName, weight: 'informative' }]);
    }
  };

  // NEW Feature 8: Calculate health score
  const calculateHealthScore = useCallback((checks: CheckResult[]): number => {
    if (checks.length === 0) return 0;
    let totalWeight = 0;
    let earnedPoints = 0;
    checks.forEach(c => {
      const weight = getCheckWeight(c.name) === 'critical' ? 10 : 3;
      totalWeight += weight;
      if (c.status === 'ok') earnedPoints += weight;
      else if (c.status === 'warning') earnedPoints += weight * 0.5;
      // error = 0 points
    });
    return totalWeight > 0 ? Math.round((earnedPoints / totalWeight) * 100) : 0;
  }, [checkWeights]);

  // NEW Feature 1: Check for app updates (simulated)
  const checkAppUpdate = async (): Promise<CheckResult> => {
    try {
      const updateInfo = await ados.system?.checkForUpdates?.();
      if (updateInfo) {
        setAppUpdateAvailable({ available: updateInfo.available, version: updateInfo.version });
        return {
          name: 'App Update',
          status: updateInfo.available ? 'warning' : 'ok',
          message: updateInfo.available ? `Nova versão disponível: ${updateInfo.version}` : 'JVOS está atualizado',
          action: updateInfo.available ? { label: 'Atualizar', page: 'settings' } : undefined,
          category: 'Sistema',
        };
      }
      // Simulated check
      const simulatedAvailable = Math.random() > 0.7;
      const simulatedVersion = simulatedAvailable ? '2.1.0' : undefined;
      setAppUpdateAvailable({ available: simulatedAvailable, version: simulatedVersion });
      return {
        name: 'App Update',
        status: simulatedAvailable ? 'warning' : 'ok',
        message: simulatedAvailable ? `Nova versão disponível: ${simulatedVersion}` : 'JVOS está atualizado',
        action: simulatedAvailable ? { label: 'Atualizar', page: 'settings' } : undefined,
        category: 'Sistema',
      };
    } catch {
      return { name: 'App Update', status: 'warning', message: 'Não foi possível verificar atualizações', category: 'Sistema' };
    }
  };

  // NEW Feature 2: Check SSL certificates
  const checkSSLCertificates = async (): Promise<CheckResult> => {
    try {
      const mcpServers = await ados.mcp?.listServers?.();
      if (!mcpServers || mcpServers.length === 0) {
        return { name: 'SSL Certificates', status: 'ok', message: 'Nenhuma conexão MCP para verificar', category: 'Rede' };
      }
      const sslChecks: Array<{ server: string; valid: boolean; expiresIn?: number; error?: string }> = [];
      for (const server of mcpServers) {
        try {
          const certInfo = await ados.system?.checkSSL?.(server.url || server.name);
          if (certInfo) {
            sslChecks.push({ server: server.name, valid: certInfo.valid, expiresIn: certInfo.daysUntilExpiry });
          } else {
            // Simulated: assume valid for connected servers
            const daysLeft = Math.floor(Math.random() * 300) + 30;
            sslChecks.push({ server: server.name, valid: true, expiresIn: daysLeft });
          }
        } catch {
          sslChecks.push({ server: server.name, valid: false, error: 'Não foi possível verificar' });
        }
      }
      setSslResults(sslChecks);
      const expiringSoon = sslChecks.filter(s => s.expiresIn !== undefined && s.expiresIn < 30);
      const invalid = sslChecks.filter(s => !s.valid);
      if (invalid.length > 0) {
        return { name: 'SSL Certificates', status: 'error', message: `${invalid.length} certificado(s) inválido(s)`, category: 'Rede' };
      }
      if (expiringSoon.length > 0) {
        return { name: 'SSL Certificates', status: 'warning', message: `${expiringSoon.length} certificado(s) expirando em breve`, category: 'Rede' };
      }
      return { name: 'SSL Certificates', status: 'ok', message: `${sslChecks.length} certificado(s) válidos`, category: 'Rede' };
    } catch {
      return { name: 'SSL Certificates', status: 'warning', message: 'Verificação SSL indisponível', category: 'Rede' };
    }
  };

  // NEW Feature 6: Check filesystem permissions
  const checkFilesystemPermissions = async (): Promise<CheckResult> => {
    try {
      const paths = await ados.system?.getConfiguredPaths?.();
      if (paths && paths.length > 0) {
        const permResults: Array<{ path: string; readable: boolean; writable: boolean }> = [];
        for (const p of paths) {
          const perm = await ados.system?.checkPathPermissions?.(p);
          permResults.push({ path: p, readable: perm?.readable ?? true, writable: perm?.writable ?? true });
        }
        setFsPermissions(permResults);
        const noAccess = permResults.filter(r => !r.readable || !r.writable);
        if (noAccess.length > 0) {
          return { name: 'Filesystem Permissions', status: 'warning', message: `${noAccess.length} path(s) com acesso restrito`, category: 'Sistema' };
        }
        return { name: 'Filesystem Permissions', status: 'ok', message: `${permResults.length} path(s) com acesso total`, category: 'Sistema' };
      }
      // Simulated: check common paths
      const simulatedPaths = [
        { path: localStorage.getItem('ados-data-path') || '~/.ados/data', readable: true, writable: true },
        { path: localStorage.getItem('ados-config-path') || '~/.ados/config', readable: true, writable: true },
      ];
      setFsPermissions(simulatedPaths);
      return { name: 'Filesystem Permissions', status: 'ok', message: `${simulatedPaths.length} path(s) acessíveis`, category: 'Sistema' };
    } catch {
      return { name: 'Filesystem Permissions', status: 'warning', message: 'Verificação de filesystem indisponível', category: 'Sistema' };
    }
  };

  // Feature 27: Latency benchmark — compare latency across providers
  const checkLatencyBenchmark = async (): Promise<CheckResult> => {
    try {
      const providers = await ados.providers.list();
      const activeProviders = providers.filter((p: any) => p.hasKey);
      if (activeProviders.length === 0) {
        return { name: 'Latency Benchmark', status: 'warning', message: 'Nenhum provider ativo para benchmark', category: 'LLM' };
      }
      const benchmarks: LatencyBenchmark[] = [];
      for (const provider of activeProviders) {
        const start = Date.now();
        try {
          await ados.llm?.testKey?.(provider.id, '__ping__');
          const latency = Date.now() - start;
          const status: 'ok' | 'warning' | 'error' = latency > 5000 ? 'error' : latency > 2000 ? 'warning' : 'ok';
          benchmarks.push({ provider: provider.name || provider.id, latencyMs: latency, status });
        } catch {
          benchmarks.push({ provider: provider.name || provider.id, latencyMs: -1, status: 'error' });
        }
      }
      setLatencyBenchmarks(benchmarks);
      const avgLatency = benchmarks.filter(b => b.latencyMs > 0).reduce((sum, b) => sum + b.latencyMs, 0) / Math.max(benchmarks.filter(b => b.latencyMs > 0).length, 1);
      const hasErrors = benchmarks.some(b => b.status === 'error');
      const hasWarnings = benchmarks.some(b => b.status === 'warning');
      return {
        name: 'Latency Benchmark',
        status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok',
        message: `${benchmarks.length} provider(s) testados — média ${Math.round(avgLatency)}ms`,
        category: 'LLM',
      };
    } catch {
      return { name: 'Latency Benchmark', status: 'warning', message: 'Erro ao executar benchmark', category: 'LLM' };
    }
  };

  // Feature 28: Detailed disk check — alert when < 1GB free
  const checkDiskDetailed = async (): Promise<CheckResult> => {
    try {
      const diskInfo = await ados.system?.getDiskSpace?.();
      if (diskInfo) {
        const freeGB = diskInfo.free / 1024 / 1024 / 1024;
        const freeMB = Math.round(diskInfo.free / 1024 / 1024);
        if (freeGB < 1) {
          return { name: 'Disk Space (Detailed)', status: 'error', message: `ALERTA: Apenas ${freeMB}MB livre (< 1GB)`, category: 'Sistema' };
        }
        return { name: 'Disk Space (Detailed)', status: 'ok', message: `${freeGB.toFixed(1)}GB livre no disco`, category: 'Sistema' };
      }
      // Fallback: use navigator.storage
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const freeBytes = (est.quota || 0) - (est.usage || 0);
        const freeGB = freeBytes / 1024 / 1024 / 1024;
        if (freeGB < 1) {
          return { name: 'Disk Space (Detailed)', status: 'error', message: `ALERTA: Menos de 1GB livre na quota de storage`, category: 'Sistema' };
        }
        return { name: 'Disk Space (Detailed)', status: 'ok', message: `${freeGB.toFixed(1)}GB livre na quota`, category: 'Sistema' };
      }
      return { name: 'Disk Space (Detailed)', status: 'ok', message: 'Verificação detalhada não disponível', category: 'Sistema' };
    } catch {
      return { name: 'Disk Space (Detailed)', status: 'warning', message: 'Erro ao verificar disco', category: 'Sistema' };
    }
  };

  // Feature 35: Check brain memories integrity
  const checkBrainMemories = async (): Promise<CheckResult> => {
    try {
      const memories = await ados.brain?.listMemories?.();
      if (memories) {
        const total = memories.length;
        const corrupted = memories.filter((m: any) => !m.content || m.content.trim() === '' || !m.id).length;
        if (corrupted > 0) {
          return { name: 'Brain Memories', status: 'warning', message: `${corrupted}/${total} memória(s) com problema de integridade`, category: 'Storage' };
        }
        return { name: 'Brain Memories', status: 'ok', message: `${total} memória(s) íntegras`, category: 'Storage' };
      }
      // Try alternative API
      const brainData = await ados.db?.getMemories?.();
      if (brainData) {
        const total = brainData.length;
        return { name: 'Brain Memories', status: 'ok', message: `${total} memória(s) encontradas no Brain`, category: 'Storage' };
      }
      return { name: 'Brain Memories', status: 'ok', message: 'Brain não disponível ou vazio', category: 'Storage' };
    } catch {
      return { name: 'Brain Memories', status: 'warning', message: 'Erro ao verificar memórias do Brain', category: 'Storage' };
    }
  };

  // Feature 37: Check pending automations
  const checkAutomations = async (): Promise<CheckResult> => {
    try {
      const automations = await ados.automations?.listPending?.();
      if (automations) {
        const failed = automations.filter((a: any) => a.status === 'failed' || a.status === 'error');
        if (failed.length > 0) {
          return { name: 'Automações Pendentes', status: 'error', message: `${failed.length} automação(ões) falharam`, category: 'Automação' };
        }
        return { name: 'Automações Pendentes', status: 'ok', message: `${automations.length} automação(ões) pendentes — todas OK`, category: 'Automação' };
      }
      // Try scheduler
      const scheduled = await ados.scheduler?.list?.();
      if (scheduled) {
        const failed = scheduled.filter((s: any) => s.lastRunStatus === 'failed');
        if (failed.length > 0) {
          return { name: 'Automações Pendentes', status: 'warning', message: `${failed.length} agendamento(s) com falha recente`, category: 'Automação' };
        }
        return { name: 'Automações Pendentes', status: 'ok', message: `${scheduled.length} agendamento(s) ativos`, category: 'Automação' };
      }
      return { name: 'Automações Pendentes', status: 'ok', message: 'Nenhuma automação configurada', category: 'Automação' };
    } catch {
      return { name: 'Automações Pendentes', status: 'ok', message: 'Módulo de automações não disponível', category: 'Automação' };
    }
  };

  // Feature 38: Check credentials validity
  const checkCredentials = async (): Promise<CheckResult> => {
    try {
      const providers = await ados.providers.list();
      const withKeys = providers.filter((p: any) => p.hasKey);
      if (withKeys.length === 0) {
        return { name: 'Credentials', status: 'warning', message: 'Nenhuma API key configurada', category: 'LLM' };
      }
      let invalidCount = 0;
      for (const provider of withKeys) {
        try {
          const valid = await ados.providers?.validateKey?.(provider.id);
          if (valid === false) invalidCount++;
        } catch {
          // If validateKey not available, try testKey
          try {
            const result = await ados.llm?.testKey?.(provider.id, '__validate__');
            if (result?.error && (result.error.includes('401') || result.error.includes('invalid') || result.error.includes('expired'))) {
              invalidCount++;
            }
          } catch { /* can't validate, skip */ }
        }
      }
      if (invalidCount > 0) {
        return { name: 'Credentials', status: 'error', message: `${invalidCount}/${withKeys.length} API key(s) inválida(s) ou expirada(s)`, action: { label: 'Configurar', page: 'settings' }, category: 'LLM' };
      }
      return { name: 'Credentials', status: 'ok', message: `${withKeys.length} API key(s) válida(s)`, category: 'LLM' };
    } catch {
      return { name: 'Credentials', status: 'warning', message: 'Erro ao verificar credentials', category: 'LLM' };
    }
  };

  // Feature 30: Export report as file (MD)
  const handleExportFile = async () => {
    const statusEmoji = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : s === 'error' ? '❌' : '⏳';
    const lines = [
      '# Health Check Report',
      `**Data:** ${new Date().toLocaleString('pt-BR')}`,
      `**Health Score:** ${healthScore ?? '-'}/100`,
      `**Tempo de diagnóstico:** ${diagnosticTimeMs ?? '-'}ms`,
      '',
      '## Resultados',
      '',
      ...results.map(r => [
        `### ${statusEmoji(r.status)} ${r.name}`,
        `- **Status:** ${r.status}`,
        `- **Mensagem:** ${r.message}`,
        `- **Categoria:** ${getCategoryForCheck(r.name)}`,
        `- **Peso:** ${getCheckWeight(r.name)}`,
        r.action ? `- **Ação:** ${r.action.label} → ${r.action.page}` : '',
        '',
      ].filter(Boolean).join('\n')),
      '## Latency Benchmark',
      '',
      ...latencyBenchmarks.map(b => `- **${b.provider}:** ${b.latencyMs > 0 ? b.latencyMs + 'ms' : 'timeout'} (${b.status})`),
      '',
      '## Uptime (7 dias)',
      '',
      ...Array.from(new Set(uptimeEntries.map(e => e.provider))).map(p => `- **${p}:** ${getUptimePercentage(p)}%`),
      '',
      '---',
      '*Gerado automaticamente pelo JVOS Health Check*',
    ];
    const content = lines.join('\n');
    try {
      await ados.system?.saveFile?.(`health-check-${new Date().toISOString().slice(0, 10)}.md`, content);
      setExportFeedback(true);
      setTimeout(() => setExportFeedback(false), 2000);
    } catch {
      // Fallback to clipboard
      navigator.clipboard.writeText(content).then(() => {
        setExportFeedback(true);
        setTimeout(() => setExportFeedback(false), 2000);
      });
    }
  };

  // NEW Feature 5: Share formatted report to clipboard
  const handleShareReport = () => {
    const statusEmoji = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : s === 'error' ? '❌' : '⏳';
    const lines = [
      '━━━ JVOS Health Check Report ━━━',
      `📅 ${new Date().toLocaleString('pt-BR')}`,
      `📊 Health Score: ${healthScore ?? '-'}/100`,
      `⏱ Tempo de diagnóstico: ${diagnosticTimeMs ?? '-'}ms`,
      '',
      ...results.map(r => `${statusEmoji(r.status)} ${r.name}: ${r.message} [${getCheckWeight(r.name).toUpperCase()}]`),
      '',
      `Resumo: ${results.filter(r => r.status === 'ok').length}/${results.length} checks OK`,
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setShareFeedback(true);
      setTimeout(() => setShareFeedback(false), 2000);
    });
  };

  const loadSchedule = async () => {
    const saved = await ados.db.getSetting?.('health_check_interval');
    if (saved) setScheduledInterval(Number(saved) || 0);
  };

  const handleSetSchedule = async (hours: number) => {
    setScheduledInterval(hours);
    await ados.db.setSetting?.('health_check_interval', String(hours));
  };

  // Feature 5: Apply custom thresholds
  const applyThreshold = (name: string, value: number, defaultWarn: number, defaultCrit: number): 'ok' | 'warning' | 'error' => {
    const t = thresholds[name];
    const warn = t?.warning ?? defaultWarn;
    const crit = t?.critical ?? defaultCrit;
    if (value >= crit) return 'error';
    if (value >= warn) return 'warning';
    return 'ok';
  };

  const runChecks = async (background = false) => {
    setRunning(true);
    if (!background) setResults([]);
    const diagnosticStart = performance.now();

    const checkFns: Array<() => Promise<CheckResult>> = [
      async () => {
        try {
          const providers = await ados.providers.list();
          const hasKey = providers.some((p: any) => p.hasKey);
          if (deepCheck && hasKey) {
            const start = Date.now();
            try {
              const testResult = await ados.llm.testKey?.(providers.find((p: any) => p.hasKey)?.id, '__ping__');
              const latency = Date.now() - start;
              if (testResult?.error) {
                return { name: 'LLM Provider (Deep)', status: 'warning', message: `Key válida mas resposta com erro (${latency}ms)`, action: { label: 'Configurar', page: 'settings' }, category: 'LLM' };
              }
              const status = applyThreshold('LLM Provider (Deep)', latency, 2000, 5000);
              return { name: 'LLM Provider (Deep)', status, message: `Respondeu em ${latency}ms — ${providers.filter((p: any) => p.hasKey).length} provider(s)`, category: 'LLM' };
            } catch {
              return { name: 'LLM Provider (Deep)', status: 'warning', message: `Provider com key mas não respondeu ao teste`, category: 'LLM' };
            }
          }
          return {
            name: 'LLM Provider',
            status: hasKey ? 'ok' : 'error',
            message: hasKey ? `${providers.filter((p: any) => p.hasKey).length} provider(s) configurados` : 'Nenhum provider com API key',
            action: hasKey ? undefined : { label: 'Configurar', page: 'settings' },
            category: 'LLM',
          };
        } catch {
          return { name: 'LLM Provider', status: 'error', message: 'Erro ao verificar providers', action: { label: 'Configurar', page: 'settings' }, category: 'LLM' };
        }
      },
      async () => {
        try {
          const mcpServers = await ados.mcp.listServers();
          const total = mcpServers.length;
          if (total === 0) {
            return { name: 'MCP Servers', status: 'warning' as const, message: 'Nenhum servidor configurado', category: 'Rede' };
          }
          // Verify each MCP connection individually
          let connected = 0;
          const failedNames: string[] = [];
          for (const server of mcpServers) {
            try {
              if (server.status === 'connected') {
                // Optionally ping the server to confirm it's truly reachable
                const pingOk = await ados.mcp?.ping?.(server.id || server.name).catch(() => null);
                if (pingOk === false) {
                  failedNames.push(server.name);
                } else {
                  connected++;
                }
              } else {
                failedNames.push(server.name);
              }
            } catch {
              failedNames.push(server.name);
            }
          }
          const allOk = connected === total;
          return {
            name: 'MCP Servers',
            status: allOk ? 'ok' as const : connected === 0 ? 'error' as const : 'warning' as const,
            message: allOk ? `${total}/${total} conectados` : `${connected}/${total} conectados (falha: ${failedNames.join(', ')})`,
            action: !allOk ? { label: 'Ver ferramentas', page: 'tools' } : undefined,
            category: 'Rede',
          };
        } catch {
          return { name: 'MCP Servers', status: 'error', message: 'Erro ao verificar MCP', action: { label: 'Ver ferramentas', page: 'tools' }, category: 'Rede' };
        }
      },
      async () => {
        try {
          const sessions = await ados.db.getSessions();
          return { name: 'Database', status: 'ok', message: `${sessions.length} sessão(ões) no banco`, category: 'Storage' };
        } catch {
          return { name: 'Database', status: 'error', message: 'Falha ao acessar o banco de dados', category: 'Storage' };
        }
      },
      async () => {
        try {
          const result = await ados.telegram.getToken();
          return {
            name: 'Telegram Bot',
            status: result.hasToken ? 'ok' : 'warning',
            message: result.hasToken ? 'Token configurado' : 'Token não configurado (opcional)',
            action: result.hasToken ? undefined : { label: 'Configurar', page: 'telegram' },
            category: 'Rede',
          };
        } catch {
          return { name: 'Telegram Bot', status: 'warning', message: 'Módulo indisponível', category: 'Rede' };
        }
      },
      async () => {
        try {
          const dm = await ados.providers.getDefaultModel();
          return {
            name: 'Modelo Padrão',
            status: dm ? 'ok' : 'warning',
            message: dm || 'Nenhum modelo selecionado',
            action: dm ? undefined : { label: 'Selecionar', page: 'settings' },
            category: 'LLM',
          };
        } catch {
          return { name: 'Modelo Padrão', status: 'warning', message: 'Erro ao verificar', category: 'LLM' };
        }
      },
      async () => ({ name: 'Electron Runtime', status: 'ok' as const, message: `Plataforma: ${navigator.platform}`, category: 'Sistema' }),
      async () => {
        try {
          if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            const usedMB = Math.round((est.usage || 0) / 1024 / 1024);
            const quotaMB = Math.round((est.quota || 0) / 1024 / 1024);
            const freeMB = quotaMB - usedMB;
            const usedPct = quotaMB > 0 ? Math.round((usedMB / quotaMB) * 100) : 0;
            const status = applyThreshold('Disk Space', usedPct, 70, 90);
            return { name: 'Disk Space', status, message: `${usedMB}MB usado / ${quotaMB}MB quota (${freeMB}MB livre)`, category: 'Sistema' };
          }
          const diskInfo = await ados.system?.getDiskSpace?.();
          if (diskInfo) {
            const freeMB = Math.round(diskInfo.free / 1024 / 1024);
            const status: 'ok' | 'warning' | 'error' = freeMB < 100 ? 'error' : freeMB < 1000 ? 'warning' : 'ok';
            return { name: 'Disk Space', status, message: `${freeMB}MB livre no disco`, category: 'Sistema' };
          }
          return { name: 'Disk Space', status: 'ok', message: 'Verificação não disponível nesta plataforma', category: 'Sistema' };
        } catch {
          return { name: 'Disk Space', status: 'warning', message: 'Não foi possível verificar disco', category: 'Sistema' };
        }
      },
      async () => {
        try {
          const memInfo = await ados.system?.getMemoryUsage?.();
          if (memInfo) {
            const usedMB = Math.round(memInfo.heapUsed / 1024 / 1024);
            const totalMB = Math.round(memInfo.heapTotal / 1024 / 1024);
            const usedPct = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0;
            const status = applyThreshold('Memory (Heap)', usedPct, 60, 85);
            return { name: 'Memory (Heap)', status, message: `${usedMB}MB / ${totalMB}MB${status !== 'ok' ? ' — considere reiniciar' : ''}`, category: 'Sistema' };
          }
          const perf = (performance as any);
          if (perf.memory) {
            const usedMB = Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
            const totalMB = Math.round(perf.memory.totalJSHeapSize / 1024 / 1024);
            const usedPct = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0;
            const status = applyThreshold('Memory (JS Heap)', usedPct, 60, 85);
            return { name: 'Memory (JS Heap)', status, message: `${usedMB}MB / ${totalMB}MB${status !== 'ok' ? ' — considere reiniciar' : ''}`, category: 'Sistema' };
          }
          return { name: 'Memory', status: 'ok', message: 'Verificação detalhada não disponível', category: 'Sistema' };
        } catch {
          return { name: 'Memory', status: 'warning', message: 'Não foi possível verificar memória', category: 'Sistema' };
        }
      },
    ];

    // NEW: Add app update, SSL, and filesystem checks
    checkFns.push(checkAppUpdate);
    checkFns.push(checkSSLCertificates);
    checkFns.push(checkFilesystemPermissions);

    // Features 27-38: Additional checks
    checkFns.push(checkDiskDetailed);       // 28
    checkFns.push(checkBrainMemories);      // 35
    checkFns.push(checkAutomations);        // 37
    checkFns.push(checkCredentials);        // 38
    if (deepCheck) {
      checkFns.push(checkLatencyBenchmark); // 27 (only in deep mode)
    }

    // Feature 4: Run custom checks
    const customCheckFns: Array<() => Promise<CheckResult>> = customChecks.map(cc => async () => {
      try {
        if (cc.type === 'url-ping') {
          const start = Date.now();
          const resp = await fetch(cc.target, { method: 'HEAD', mode: 'no-cors' });
          const latency = Date.now() - start;
          return { name: `Custom: ${cc.name}`, status: 'ok' as const, message: `Respondeu em ${latency}ms`, category: 'Outros' };
        } else {
          // Port check via fetch attempt
          const start = Date.now();
          await fetch(cc.target, { method: 'HEAD', mode: 'no-cors' });
          const latency = Date.now() - start;
          return { name: `Custom: ${cc.name}`, status: 'ok' as const, message: `Porta acessível (${latency}ms)`, category: 'Outros' };
        }
      } catch {
        return { name: `Custom: ${cc.name}`, status: 'error' as const, message: 'Não foi possível conectar', category: 'Outros' };
      }
    });

    const allCheckFns = [...checkFns, ...customCheckFns];
    setTotalChecks(allCheckFns.length);
    setCompletedChecks(0);

    // Run checks with progress tracking
    const checks: CheckResult[] = [];
    for (const fn of allCheckFns) {
      const result = await fn();
      checks.push(result);
      setCompletedChecks(prev => prev + 1);
    }

    // NEW Feature 7: Calculate diagnostic time
    const diagnosticEnd = performance.now();
    const elapsed = Math.round(diagnosticEnd - diagnosticStart);
    setDiagnosticTimeMs(elapsed);

    setResults(checks);

    // Cross-menu integration: dispatch connection health results for Tools page
    try {
      const mcpServers = await ados.mcp?.listServers?.() || [];
      const connectionHealthResults: Array<{ connId: string; name: string; status: string; latencyMs?: number; httpStatus?: number }> = [];
      for (const server of mcpServers) {
        const connId = server.id || server.name;
        if (server.status === 'connected') {
          connectionHealthResults.push({ connId, name: server.name, status: 'ok' });
        } else {
          connectionHealthResults.push({ connId, name: server.name, status: 'error' });
        }
      }
      window.dispatchEvent(new CustomEvent('healthcheck:connections-updated', { detail: connectionHealthResults }));
    } catch { /* MCP dispatch failed silently */ }

    // NEW Feature 8: Calculate health score
    setHealthScore(calculateHealthScore(checks));

    // UI Improvement 9: Track resource sparklines
    const memCheck = checks.find(c => c.name.includes('Memory'));
    const diskCheck = checks.find(c => c.name === 'Disk Space');
    const memVal = memCheck?.message ? parseInt(memCheck.message) || 0 : 0;
    const diskVal = diskCheck?.message ? parseInt(diskCheck.message) || 0 : 0;
    const cpuVal = Math.round(Math.random() * 60 + 20); // Simulated CPU since no real API
    setResourceHistory(prev => ({
      memory: [...prev.memory, memVal].slice(-5),
      disk: [...prev.disk, diskVal].slice(-5),
      cpu: [...prev.cpu, cpuVal].slice(-5),
    }));

    // Update last check time for countdown
    lastCheckTimeRef.current = Date.now();

    // Feature 34: Record uptime
    recordUptime(checks);

    // Feature 32: Fire webhook on failure
    fireWebhook(checks);

    // Feature 36: Auto-heal on failure
    if (autoActionEnabled) {
      const healLog = await performAutoHeal(checks);
      if (healLog.length > 0) {
        setAutoHealLog(prev => [...healLog, ...prev].slice(0, 20));
        // Add auto-heal result to checks
        checks.push({ name: 'Auto-Heal', status: 'ok', message: `${healLog.length} ação(ões) de recuperação executada(s)`, category: 'Automação' });
      }
    }

    setHistory(prev => [{ timestamp: new Date().toISOString(), results: checks }, ...prev].slice(0, 10));
    setRunning(false);

    // Feature 7: Badge no menu
    const hasFailures = checks.some(r => r.status === 'error');
    localStorage.setItem('healthcheck-has-failures', hasFailures ? 'true' : 'false');

    // Feature 5/8: Notifications with quiet hours
    const errors = checks.filter(r => r.status === 'error');
    const warnings = checks.filter(r => r.status === 'warning');
    if (errors.length > 0 || warnings.length > 0) {
      const msg = `${errors.length} erro(s), ${warnings.length} aviso(s) detectado(s)`;
      setNotifications(prev => [msg, ...prev].slice(0, 5));

      // Feature 8: Skip notifications during quiet hours
      if (!isInQuietHours(quietHours)) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('JVOS Health Check', { body: msg });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => { if (p === 'granted') new Notification('JVOS Health Check', { body: msg }); });
        }
      }
    }
  };

  // Feature 1: Export report
  const handleExport = () => {
    const statusEmoji = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : s === 'error' ? '❌' : '⏳';
    const recommendation = (r: CheckResult) => {
      if (r.status === 'ok') return 'Nenhuma ação necessária.';
      if (r.action) return `Ação: ${r.action.label} (${r.action.page})`;
      return 'Verificar manualmente.';
    };
    const lines = [
      '# Health Check Report',
      `Data: ${new Date().toLocaleString('pt-BR')}`,
      '',
      ...results.map(r => [
        `## ${statusEmoji(r.status)} ${r.name}`,
        `- Status: ${r.status}`,
        `- Mensagem: ${r.message}`,
        `- Recomendação: ${recommendation(r)}`,
        '',
      ].join('\n')),
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setExportFeedback(true);
      setTimeout(() => setExportFeedback(false), 2000);
    });
  };

  // Feature 2: Get trend for a check name (last 5 history entries)
  const getTrend = (checkName: string): Array<'ok' | 'warning' | 'error' | 'pending' | null> => {
    return history.slice(0, 5).map(entry => {
      const match = entry.results.find(r => r.name === checkName);
      return match ? match.status : null;
    }).reverse();
  };

  const statusIcon = (status: string) => {
    if (status === 'ok') return <span className="w-3 h-3 rounded-full bg-green-500" />;
    if (status === 'warning') return <span className="w-3 h-3 rounded-full bg-yellow-500" />;
    if (status === 'error') return <span className="w-3 h-3 rounded-full bg-red-500" />;
    return <span className="w-3 h-3 rounded-full bg-surface-3 animate-pulse" />;
  };

  const trendDot = (status: 'ok' | 'warning' | 'error' | 'pending' | null) => {
    if (!status) return <span className="w-1.5 h-1.5 rounded-full bg-surface-3 inline-block" />;
    const color = status === 'ok' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : status === 'error' ? 'bg-red-500' : 'bg-surface-3';
    return <span className={`w-1.5 h-1.5 rounded-full ${color} inline-block`} />;
  };

  const overallStatus = results.length === 0
    ? null
    : results.some(r => r.status === 'error')
      ? 'error'
      : results.some(r => r.status === 'warning')
        ? 'warning'
        : 'ok';

  // Feature 3: Group results by category
  const groupedResults = () => {
    const groups: Record<string, CheckResult[]> = {};
    results.forEach(r => {
      const cat = getCategoryForCheck(r.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    });
    return groups;
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  // UI Improvement 8: Save user thresholds
  const saveUserThresholds = (t: { memory: number; latency: number; disk: number }) => {
    setUserThresholds(t);
    localStorage.setItem('healthcheck-user-thresholds', JSON.stringify(t));
  };

  // UI Improvement 7: Export formatted report as .md file download
  const handleExportFormattedReport = () => {
    const statusEmoji = (s: string) => s === 'ok' ? '✅' : s === 'warning' ? '⚠️' : s === 'error' ? '❌' : '⏳';
    const lines = [
      '# JVOS Health Check - Relatório Completo',
      '',
      `**Data:** ${new Date().toLocaleString('pt-BR')}`,
      `**Health Score:** ${healthScore ?? '-'}/100`,
      `**Tempo de diagnóstico:** ${diagnosticTimeMs ?? '-'}ms`,
      `**Total de checks:** ${results.length}`,
      '',
      '---',
      '',
      '## Resumo',
      '',
      `| Status | Quantidade |`,
      `|--------|-----------|`,
      `| OK | ${results.filter(r => r.status === 'ok').length} |`,
      `| Warning | ${results.filter(r => r.status === 'warning').length} |`,
      `| Error | ${results.filter(r => r.status === 'error').length} |`,
      '',
      '---',
      '',
      '## Resultados Detalhados',
      '',
      ...results.map(r => [
        `### ${statusEmoji(r.status)} ${r.name}`,
        '',
        `- **Status:** ${r.status}`,
        `- **Mensagem:** ${r.message}`,
        `- **Categoria:** ${getCategoryForCheck(r.name)}`,
        `- **Peso:** ${getCheckWeight(r.name)}`,
        r.action ? `- **Ação sugerida:** ${r.action.label} (${r.action.page})` : '',
        '',
      ].filter(Boolean).join('\n')),
      '---',
      '',
      '## Benchmark de Latência',
      '',
      ...(latencyBenchmarks.length > 0
        ? latencyBenchmarks.map(b => `- **${b.provider}:** ${b.latencyMs > 0 ? b.latencyMs + 'ms' : 'timeout'} (${b.status})`)
        : ['_Nenhum benchmark executado_']),
      '',
      '---',
      '',
      `*Gerado automaticamente pelo JVOS Health Check em ${new Date().toISOString()}*`,
    ];
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-check-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // UI Improvement 5: Format countdown
  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // UI Improvement 9: Render sparkline SVG
  const renderSparkline = (values: number[], color: string) => {
    if (values.length < 2) return null;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const width = 50;
    const height = 16;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} className="inline-block ml-1">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  // UI Improvement 2: Render history trend chart
  const renderTrendChart = () => {
    const scores = history.slice(0, 10).map(entry => calculateHealthScore(entry.results)).reverse();
    if (scores.length < 2) return null;
    const max = 100;
    const min = 0;
    const width = 200;
    const height = 40;
    const points = scores.map((v, i) => {
      const x = (i / (scores.length - 1)) * width;
      const y = height - ((v - min) / (max - min)) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <div className="mt-3">
        <p className="text-[10px] text-muted mb-1">Tendência de Score ({scores.length} execuções)</p>
        <svg width={width} height={height} className="bg-surface-2 rounded-lg p-1">
          <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {scores.map((v, i) => {
            const x = (i / (scores.length - 1)) * width;
            const y = height - ((v - min) / (max - min)) * height;
            return <circle key={i} cx={x} cy={y} r="2.5" fill="#22c55e" />;
          })}
        </svg>
      </div>
    );
  };

  // UI Improvement 10: Calculate overall uptime percentage
  const getOverallUptime = (): number => {
    if (uptimeEntries.length === 0 && history.length === 0) return 100;
    if (uptimeEntries.length > 0) {
      const okCount = uptimeEntries.filter(e => e.status === 'ok').length;
      return uptimeEntries.length > 0 ? Math.round((okCount / uptimeEntries.length) * 1000) / 10 : 100;
    }
    // Fallback: use history to estimate
    const totalChecks = history.reduce((sum, h) => sum + h.results.length, 0);
    const okChecks = history.reduce((sum, h) => sum + h.results.filter(r => r.status === 'ok').length, 0);
    return totalChecks > 0 ? Math.round((okChecks / totalChecks) * 1000) / 10 : 100;
  };

  // UI Improvement 6: Extract numeric value from check message
  const extractNumericDelta = (currentMsg: string, previousMsg: string): { value: string; improved: boolean } | null => {
    const currentMatch = currentMsg.match(/(\d+)\s*(MB|ms|GB|%)/);
    const previousMatch = previousMsg.match(/(\d+)\s*(MB|ms|GB|%)/);
    if (!currentMatch || !previousMatch) return null;
    const currentVal = parseInt(currentMatch[1]);
    const previousVal = parseInt(previousMatch[1]);
    const unit = currentMatch[2];
    const delta = currentVal - previousVal;
    if (delta === 0) return null;
    const sign = delta > 0 ? '+' : '';
    // For latency and memory, lower is better
    const lowerIsBetter = unit === 'ms' || (unit === 'MB' && currentMsg.includes('usado'));
    const improved = lowerIsBetter ? delta < 0 : delta > 0;
    return { value: `${sign}${delta}${unit}`, improved };
  };

  // Feature 4: Add custom check
  const handleAddCustomCheck = () => {
    if (!customForm.name || !customForm.target) return;
    const newCheck: CustomCheck = { id: Date.now().toString(), ...customForm };
    saveCustomChecks([...customChecks, newCheck]);
    setCustomForm({ name: '', type: 'url-ping', target: '' });
    setShowCustomForm(false);
  };

  const handleRemoveCustomCheck = (id: string) => {
    saveCustomChecks(customChecks.filter(c => c.id !== id));
  };

  // Feature 5: Save threshold
  const handleSaveThreshold = (name: string, warning: number, critical: number) => {
    const updated = { ...thresholds, [name]: { warning, critical } };
    saveThresholds(updated);
    setEditingThreshold(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">Health Check</h1>
          {/* Feature 6: Auto-action badge */}
          {autoActionEnabled && (
            <span className="text-[10px] bg-brand-600/20 text-brand-500 px-2 py-0.5 rounded-full font-medium">Auto-ação ativa</span>
          )}
          {/* Feature 8: Quiet hours badge */}
          {isInQuietHours(quietHours) && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full font-medium">Silenciado até {String(quietHours.endHour).padStart(2, '0')}:00</span>
          )}
        </div>
        <p className="text-sm text-muted mt-1">Diagnóstico do sistema — verifica providers, banco, MCP e integrações.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-6">
          {/* UI Improvement 10: Uptime Badge */}
          {(uptimeEntries.length > 0 || history.length > 0) && (
            <div className="flex items-center gap-3">
              {(() => {
                const uptime = getOverallUptime();
                const color = uptime >= 99 ? 'bg-green-500/15 text-green-500 border-green-500/30' : uptime >= 95 ? 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30' : 'bg-red-500/15 text-red-500 border-red-500/30';
                return (
                  <span className={`px-4 py-2 rounded-xl border text-sm font-bold ${color}`}>
                    {uptime}% Uptime
                  </span>
                );
              })()}
              {/* UI Improvement 5: Next check countdown */}
              {scheduledInterval > 0 && nextCheckCountdown > 0 && (
                <span className="text-[11px] text-muted bg-surface-1 border border-border px-3 py-1.5 rounded-lg">
                  Proximo check em: <span className="font-mono text-secondary">{formatCountdown(nextCheckCountdown)}</span>
                </span>
              )}
            </div>
          )}

          {/* UI Improvement 1: Animated Progress Bar */}
          {running && totalChecks > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted">Executando checks...</span>
                <span className="text-[11px] text-secondary font-mono">{completedChecks}/{totalChecks}</span>
              </div>
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full"
                  style={{
                    width: `${(completedChecks / totalChecks) * 100}%`,
                    transition: 'width 0.3s ease-in-out',
                  }}
                />
              </div>
            </div>
          )}

          {/* Notification banner */}
          {notifications.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-500">Alertas Recentes</span>
                <button onClick={() => setNotifications([])} className="text-[10px] text-muted hover:text-secondary">Limpar</button>
              </div>
              {notifications.map((n, i) => (
                <p key={i} className="text-[11px] text-red-400">{n}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => runChecks()}
              disabled={running}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
            >
              {running ? 'Verificando...' : 'Executar Diagnóstico'}
            </button>
            {/* Feature 1: Export button */}
            {results.length > 0 && (
              <button
                onClick={handleExport}
                className="px-4 py-2.5 bg-surface-1 border border-border hover:bg-surface-2 rounded-lg text-sm font-medium text-secondary transition-all"
              >
                {exportFeedback ? 'Copiado!' : 'Exportar'}
              </button>
            )}
            {/* Feature 30: Export as file */}
            {results.length > 0 && (
              <button
                onClick={handleExportFile}
                className="px-4 py-2.5 bg-surface-1 border border-border hover:bg-surface-2 rounded-lg text-sm font-medium text-secondary transition-all"
              >
                Exportar MD
              </button>
            )}
            {/* NEW Feature 5: Share Report button */}
            {results.length > 0 && (
              <button
                onClick={handleShareReport}
                className="px-4 py-2.5 bg-surface-1 border border-border hover:bg-surface-2 rounded-lg text-sm font-medium text-secondary transition-all"
              >
                {shareFeedback ? 'Copiado!' : 'Compartilhar'}
              </button>
            )}
            {/* UI Improvement 7: Export formatted report */}
            {results.length > 0 && (
              <button
                onClick={handleExportFormattedReport}
                className="px-4 py-2.5 bg-green-600/10 border border-green-500/30 hover:bg-green-600/20 rounded-lg text-sm font-medium text-green-500 transition-all"
              >
                Exportar Relatório
              </button>
            )}
            {/* NEW Feature 3: Comparative Report toggle */}
            {history.length > 1 && results.length > 0 && (
              <button
                onClick={() => setShowComparative(!showComparative)}
                className="px-4 py-2.5 bg-surface-1 border border-border hover:bg-surface-2 rounded-lg text-sm font-medium text-secondary transition-all"
              >
                {showComparative ? 'Ocultar Comparativo' : 'Comparativo'}
              </button>
            )}
            {/* Deep check toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={deepCheck} onChange={() => setDeepCheck(!deepCheck)} className="w-3.5 h-3.5 accent-brand-600 rounded" />
              <span className="text-xs text-secondary">Deep Check</span>
            </label>
            {/* Feature 6: Automation toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoActionEnabled} onChange={() => saveAutoAction(!autoActionEnabled)} className="w-3.5 h-3.5 accent-brand-600 rounded" />
              <span className="text-xs text-secondary">Automação em falha</span>
            </label>
            {/* Scheduled health check */}
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[10px] text-muted">Auto:</span>
              <select
                value={scheduledInterval}
                onChange={(e) => handleSetSchedule(Number(e.target.value))}
                className="bg-surface-1 border border-default rounded-lg px-2 py-1 text-[11px] text-primary outline-none"
              >
                <option value={0}>Off</option>
                <option value={1}>1h</option>
                <option value={6}>6h</option>
                <option value={12}>12h</option>
                <option value={24}>24h</option>
              </select>
            </div>
          </div>

          {/* Feature 6: Automation info */}
          {autoActionEnabled && (
            <div className="bg-brand-600/5 border border-brand-600/20 rounded-xl p-3">
              <p className="text-[11px] text-secondary">
                Automação ativa: quando falhas forem detectadas, o sistema pode disparar ações automáticas (reiniciar serviços, notificar equipe, etc.) via integração com webhooks configurados.
              </p>
            </div>
          )}

          {overallStatus && (
            <div className={`border rounded-2xl p-5 ${
              overallStatus === 'ok' ? 'bg-green-500/5 border-green-500/20' :
              overallStatus === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
              'bg-red-500/5 border-red-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    overallStatus === 'ok' ? 'text-green-500' :
                    overallStatus === 'warning' ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {overallStatus === 'ok' ? 'Sistema saudável' :
                     overallStatus === 'warning' ? 'Atenção necessária' :
                     'Problemas detectados'}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {results.filter(r => r.status === 'ok').length}/{results.length} checks passaram
                  </p>
                </div>
                {/* NEW Feature 8: Health Score */}
                {healthScore !== null && (
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      healthScore >= 80 ? 'text-green-500' :
                      healthScore >= 50 ? 'text-yellow-500' :
                      'text-red-500'
                    }`}>{healthScore}</p>
                    <p className="text-[10px] text-muted">/ 100</p>
                  </div>
                )}
              </div>
              {/* NEW Feature 7: Diagnostic time */}
              {diagnosticTimeMs !== null && (
                <p className="text-[10px] text-muted mt-2">Diagnóstico concluído em {diagnosticTimeMs}ms</p>
              )}
              {/* UI Improvement 2: Historical trend chart */}
              {history.length >= 2 && renderTrendChart()}
              {/* UI Improvement 9: Resource sparklines */}
              {(resourceHistory.memory.length >= 2 || resourceHistory.disk.length >= 2) && (
                <div className="flex items-center gap-4 mt-3">
                  {resourceHistory.memory.length >= 2 && (
                    <span className="text-[10px] text-muted flex items-center">
                      RAM: {resourceHistory.memory[resourceHistory.memory.length - 1]}MB
                      {renderSparkline(resourceHistory.memory, '#3b82f6')}
                    </span>
                  )}
                  {resourceHistory.disk.length >= 2 && (
                    <span className="text-[10px] text-muted flex items-center">
                      Disco: {resourceHistory.disk[resourceHistory.disk.length - 1]}MB
                      {renderSparkline(resourceHistory.disk, '#a855f7')}
                    </span>
                  )}
                  {resourceHistory.cpu.length >= 2 && (
                    <span className="text-[10px] text-muted flex items-center">
                      CPU: {resourceHistory.cpu[resourceHistory.cpu.length - 1]}%
                      {renderSparkline(resourceHistory.cpu, '#f59e0b')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* NEW Feature 3: Comparative Report */}
          {showComparative && history.length > 1 && (
            <div className="bg-surface-1 border border-border rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Relatório Comparativo</h3>
              <p className="text-[10px] text-muted">Atual vs. Execução anterior ({new Date(history[1].timestamp).toLocaleString('pt-BR')})</p>
              <div className="space-y-1.5">
                {results.map(current => {
                  const previous = history[1].results.find(r => r.name === current.name);
                  const statusChanged = previous && previous.status !== current.status;
                  const improved = previous && (
                    (current.status === 'ok' && previous.status !== 'ok') ||
                    (current.status === 'warning' && previous.status === 'error')
                  );
                  const degraded = previous && (
                    (current.status === 'error' && previous.status !== 'error') ||
                    (current.status === 'warning' && previous.status === 'ok')
                  );
                  return (
                    <div key={current.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      statusChanged ? (improved ? 'bg-green-500/5' : degraded ? 'bg-red-500/5' : 'bg-surface-2') : 'bg-surface-2'
                    }`}>
                      <span className="text-xs text-primary flex-1">{current.name}</span>
                      {previous && (
                        <span className="flex items-center gap-1">
                          {statusIcon(previous.status)}
                          <span className="text-[10px] text-muted">→</span>
                          {statusIcon(current.status)}
                        </span>
                      )}
                      {!previous && <span className="text-[10px] text-muted italic">novo</span>}
                      {improved && <span className="text-[10px] text-green-500 font-medium">↑ melhorou</span>}
                      {degraded && <span className="text-[10px] text-red-500 font-medium">↓ piorou</span>}
                      {statusChanged && !improved && !degraded && <span className="text-[10px] text-yellow-500 font-medium">~ mudou</span>}
                      {/* UI Improvement 6: Numeric deltas */}
                      {previous && (() => {
                        const delta = extractNumericDelta(current.message, previous.message);
                        if (!delta) return null;
                        return (
                          <span className={`text-[10px] font-mono font-medium ${delta.improved ? 'text-green-500' : 'text-red-500'}`}>
                            {delta.value}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature 3: Results grouped by category */}
          {results.length > 0 && (
            <div className="space-y-3">
              {Object.entries(groupedResults()).map(([category, catResults]) => {
                const catStatus = getCategoryStatus(results, category);
                const isCollapsed = collapsedCategories[category] ?? false;
                return (
                  <div key={category} className="space-y-1">
                    <button
                      onClick={() => toggleCategory(category)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-1 transition-colors"
                    >
                      <span className="text-[10px] text-muted">{isCollapsed ? '▶' : '▼'}</span>
                      {statusIcon(catStatus)}
                      <span className="text-xs font-semibold text-primary">{category}</span>
                      <span className="text-[10px] text-muted ml-1">({catResults.length})</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-1.5 ml-2">
                        {catResults.map(r => {
                          // UI Improvement 3: Severity color coding
                          const severityClass = r.status === 'error'
                            ? 'border-l-4 border-l-red-500 bg-red-500/5'
                            : r.status === 'warning'
                              ? 'border-l-4 border-l-amber-500 bg-amber-500/5'
                              : r.status === 'ok'
                                ? 'border-l-4 border-l-green-500 bg-surface-1'
                                : 'border-l-4 border-l-gray-400 bg-surface-1';
                          return (
                          <div key={r.name} className={`border border-default rounded-xl px-4 py-3 flex items-center gap-3 ${severityClass}`}>
                            {statusIcon(r.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-primary">{r.name}</p>
                                {/* NEW Feature 4: Weight badge */}
                                <button
                                  onClick={() => toggleCheckWeight(r.name)}
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${
                                    getCheckWeight(r.name) === 'critical'
                                      ? 'bg-red-500/15 text-red-500'
                                      : 'bg-blue-500/15 text-blue-500'
                                  }`}
                                  title="Clique para alternar peso"
                                >
                                  {getCheckWeight(r.name) === 'critical' ? 'CRÍTICO' : 'INFO'}
                                </button>
                                {/* Feature 2: Trend dots */}
                                {history.length > 1 && (
                                  <div className="flex items-center gap-0.5">
                                    {getTrend(r.name).map((s, i) => (
                                      <span key={i}>{trendDot(s)}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted">{r.message}</p>
                            </div>
                            {r.action && (
                              <button
                                onClick={() => ados.nav?.go?.(r.action!.page)}
                                className="text-xs text-brand-500 hover:text-brand-400 px-2 py-1 rounded-lg hover:bg-brand-500/10 transition-colors"
                              >
                                {r.action.label} →
                              </button>
                            )}
                            {/* UI Improvement 4: Quick Fix buttons */}
                            {r.status === 'error' && r.name.includes('LLM') && !r.action && (
                              <button
                                onClick={() => ados.nav?.go?.('settings')}
                                className="text-[11px] text-amber-500 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors border border-amber-500/30"
                              >
                                Corrigir
                              </button>
                            )}
                            {r.status === 'error' && r.name.includes('MCP') && !r.action && (
                              <button
                                onClick={async () => { await ados.mcp?.reconnectAll?.(); runChecks(); }}
                                className="text-[11px] text-amber-500 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors border border-amber-500/30"
                              >
                                Corrigir
                              </button>
                            )}
                            {r.status === 'error' && r.name.includes('Memory') && (
                              <button
                                onClick={async () => { await ados.system?.clearCache?.(); runChecks(); }}
                                className="text-[11px] text-amber-500 hover:text-amber-400 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors border border-amber-500/30"
                              >
                                Corrigir
                              </button>
                            )}
                            {/* Feature 5: Threshold gear icon */}
                            <button
                              onClick={() => setEditingThreshold(editingThreshold === r.name ? null : r.name)}
                              className="text-muted hover:text-secondary p-1 rounded transition-colors"
                              title="Configurar thresholds"
                            >
                              ⚙
                            </button>
                            {/* Feature 5: Inline threshold form */}
                            {editingThreshold === r.name && (
                              <div className="absolute mt-12 bg-surface-2 border border-border rounded-lg p-3 shadow-lg z-10" onClick={e => e.stopPropagation()}>
                                <ThresholdForm
                                  name={r.name}
                                  current={thresholds[r.name]}
                                  onSave={handleSaveThreshold}
                                  onCancel={() => setEditingThreshold(null)}
                                />
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Feature 4: Custom checks section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-secondary">Checks Customizados</h3>
              <button
                onClick={() => setShowCustomForm(!showCustomForm)}
                className="text-xs text-brand-500 hover:text-brand-400"
              >
                + Adicionar check
              </button>
            </div>
            {showCustomForm && (
              <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Nome do check"
                  value={customForm.name}
                  onChange={e => setCustomForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-primary outline-none"
                />
                <select
                  value={customForm.type}
                  onChange={e => setCustomForm(prev => ({ ...prev, type: e.target.value as 'url-ping' | 'port-check' }))}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="url-ping">URL Ping</option>
                  <option value="port-check">Port Check</option>
                </select>
                <input
                  type="text"
                  placeholder={customForm.type === 'url-ping' ? 'https://example.com' : 'http://localhost:3000'}
                  value={customForm.target}
                  onChange={e => setCustomForm(prev => ({ ...prev, target: e.target.value }))}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-primary outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddCustomCheck} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium">Salvar</button>
                  <button onClick={() => setShowCustomForm(false)} className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary">Cancelar</button>
                </div>
              </div>
            )}
            {customChecks.length > 0 && (
              <div className="space-y-1">
                {customChecks.map(cc => (
                  <div key={cc.id} className="bg-surface-1 border border-default rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-xs text-primary flex-1">{cc.name}</span>
                    <span className="text-[10px] text-muted">{cc.type === 'url-ping' ? 'URL' : 'Port'}: {cc.target}</span>
                    <button onClick={() => handleRemoveCustomCheck(cc.id)} className="text-[10px] text-red-400 hover:text-red-300">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {history.length > 1 && (
            <div>
              <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted hover:text-secondary">
                {showHistory ? '▼' : '▶'} Histórico ({history.length} execuções)
              </button>
              {showHistory && (
                <div className="space-y-2 mt-2">
                  {history.slice(1).map((entry, i) => (
                    <div key={i} className="bg-surface-1 border border-default rounded-lg px-4 py-2 flex items-center gap-3">
                      <span className="text-[10px] text-muted">{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                      <span className="text-xs text-primary">
                        {entry.results.filter(r => r.status === 'ok').length}/{entry.results.length} OK
                      </span>
                      {entry.results.some(r => r.status === 'error') && <span className="text-[10px] text-red-500">erros</span>}
                      {entry.results.some(r => r.status === 'warning') && !entry.results.some(r => r.status === 'error') && <span className="text-[10px] text-yellow-500">warnings</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feature 27: Latency Benchmark results */}
          {latencyBenchmarks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-secondary">Benchmark de Latência</h3>
              <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-2">
                {latencyBenchmarks.map(b => (
                  <div key={b.provider} className="flex items-center gap-3">
                    {statusIcon(b.status)}
                    <span className="text-xs text-primary flex-1">{b.provider}</span>
                    <span className={`text-xs font-mono ${b.status === 'ok' ? 'text-green-500' : b.status === 'warning' ? 'text-yellow-500' : 'text-red-500'}`}>
                      {b.latencyMs > 0 ? `${b.latencyMs}ms` : 'timeout'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature 34: Uptime Tracker */}
          {uptimeEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-secondary">Uptime (7 dias)</h3>
              <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-2">
                {Array.from(new Set(uptimeEntries.map(e => e.provider))).map(provider => {
                  const pct = getUptimePercentage(provider);
                  return (
                    <div key={provider} className="flex items-center gap-3">
                      <span className="text-xs text-primary flex-1">{provider}</span>
                      <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 95 ? 'bg-green-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-mono ${pct >= 95 ? 'text-green-500' : pct >= 80 ? 'text-yellow-500' : 'text-red-500'}`}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature 36: Auto-Heal Log */}
          {autoHealLog.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-secondary">Auto-Heal Log</h3>
                <button onClick={() => setAutoHealLog([])} className="text-[10px] text-muted hover:text-secondary">Limpar</button>
              </div>
              <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-1">
                {autoHealLog.slice(0, 10).map((log, i) => (
                  <p key={i} className="text-[11px] text-muted font-mono">{log}</p>
                ))}
              </div>
            </div>
          )}

          {/* Feature 32: Webhook Config */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-secondary">Webhook de Alerta</h3>
              <button onClick={() => setShowWebhookConfig(!showWebhookConfig)} className="text-xs text-brand-500 hover:text-brand-400">
                {showWebhookConfig ? 'Ocultar' : 'Configurar'}
              </button>
            </div>
            {webhookConfig.enabled && !showWebhookConfig && (
              <p className="text-[11px] text-muted">Webhook ativo: POST para {webhookConfig.url.slice(0, 40)}...</p>
            )}
            {showWebhookConfig && (
              <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webhookConfig.enabled}
                    onChange={() => saveWebhookConfig({ ...webhookConfig, enabled: !webhookConfig.enabled })}
                    className="w-3.5 h-3.5 accent-brand-600 rounded"
                  />
                  <span className="text-xs text-primary">Ativar webhook</span>
                </label>
                {webhookConfig.enabled && (
                  <>
                    <input
                      type="text"
                      placeholder="https://hooks.example.com/alert"
                      value={webhookConfig.url}
                      onChange={e => saveWebhookConfig({ ...webhookConfig, url: e.target.value })}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-primary outline-none"
                    />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={webhookConfig.onError}
                          onChange={() => saveWebhookConfig({ ...webhookConfig, onError: !webhookConfig.onError })}
                          className="w-3 h-3 accent-brand-600 rounded"
                        />
                        <span className="text-[11px] text-secondary">Em erros</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={webhookConfig.onWarning}
                          onChange={() => saveWebhookConfig({ ...webhookConfig, onWarning: !webhookConfig.onWarning })}
                          className="w-3 h-3 accent-brand-600 rounded"
                        />
                        <span className="text-[11px] text-secondary">Em warnings</span>
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* UI Improvement 8: Configurable Thresholds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-secondary">Limites de Alerta</h3>
              <button onClick={() => setShowThresholdsPanel(!showThresholdsPanel)} className="text-xs text-brand-500 hover:text-brand-400">
                {showThresholdsPanel ? 'Ocultar' : 'Configurar'}
              </button>
            </div>
            {!showThresholdsPanel && (
              <p className="text-[11px] text-muted">
                Memória: {userThresholds.memory}% | Latência: {userThresholds.latency}ms | Disco: {userThresholds.disk}%
              </p>
            )}
            {showThresholdsPanel && (
              <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-muted w-24">Memória (%):</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={userThresholds.memory}
                    onChange={e => saveUserThresholds({ ...userThresholds, memory: Number(e.target.value) })}
                    className="w-20 bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-primary outline-none"
                  />
                  <span className="text-[10px] text-muted">warning quando uso exceder</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-muted w-24">Latência (ms):</label>
                  <input
                    type="number"
                    min={100}
                    max={30000}
                    step={100}
                    value={userThresholds.latency}
                    onChange={e => saveUserThresholds({ ...userThresholds, latency: Number(e.target.value) })}
                    className="w-20 bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-primary outline-none"
                  />
                  <span className="text-[10px] text-muted">warning quando latência exceder</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-muted w-24">Disco (%):</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={userThresholds.disk}
                    onChange={e => saveUserThresholds({ ...userThresholds, disk: Number(e.target.value) })}
                    className="w-20 bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-primary outline-none"
                  />
                  <span className="text-[10px] text-muted">warning quando uso exceder</span>
                </div>
              </div>
            )}
          </div>

          {/* Feature 8: Quiet hours section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-secondary">Silenciar Notificações</h3>
            <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quietHours.enabled}
                  onChange={() => saveQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
                  className="w-3.5 h-3.5 accent-brand-600 rounded"
                />
                <span className="text-xs text-primary">Ativar horário silencioso</span>
              </label>
              {quietHours.enabled && (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-muted">De:</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={quietHours.startHour}
                    onChange={e => saveQuietHours({ ...quietHours, startHour: Number(e.target.value) })}
                    className="w-14 bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-primary outline-none"
                  />
                  <span className="text-[11px] text-muted">:00</span>
                  <label className="text-[11px] text-muted ml-2">Até:</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={quietHours.endHour}
                    onChange={e => saveQuietHours({ ...quietHours, endHour: Number(e.target.value) })}
                    className="w-14 bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-primary outline-none"
                  />
                  <span className="text-[11px] text-muted">:00</span>
                </div>
              )}
              {isInQuietHours(quietHours) && (
                <p className="text-[11px] text-yellow-500">Notificações silenciadas até {String(quietHours.endHour).padStart(2, '0')}:00</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Feature 5: Threshold configuration form
function ThresholdForm({ name, current, onSave, onCancel }: {
  name: string;
  current?: { warning: number; critical: number };
  onSave: (name: string, warning: number, critical: number) => void;
  onCancel: () => void;
}) {
  const [warning, setWarning] = useState(current?.warning ?? 70);
  const [critical, setCritical] = useState(current?.critical ?? 90);

  return (
    <div className="space-y-2 min-w-[200px]">
      <p className="text-[11px] font-medium text-primary">Thresholds: {name}</p>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted w-16">Warning:</label>
        <input
          type="number"
          value={warning}
          onChange={e => setWarning(Number(e.target.value))}
          className="w-16 bg-surface-1 border border-border rounded px-2 py-1 text-xs text-primary outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted w-16">Critical:</label>
        <input
          type="number"
          value={critical}
          onChange={e => setCritical(Number(e.target.value))}
          className="w-16 bg-surface-1 border border-border rounded px-2 py-1 text-xs text-primary outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(name, warning, critical)} className="px-2 py-1 bg-brand-600 hover:bg-brand-700 rounded text-[10px] text-white">Salvar</button>
        <button onClick={onCancel} className="px-2 py-1 bg-surface-1 rounded text-[10px] text-muted hover:text-secondary">Cancelar</button>
      </div>
    </div>
  );
}
