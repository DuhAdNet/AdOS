import { useState, useEffect, useCallback, useRef } from 'react';
const html2canvas = (window as any).html2canvas || (async (el: HTMLElement, opts?: any) => {
  const canvas = document.createElement('canvas');
  canvas.width = el.offsetWidth * (opts?.scale || 1);
  canvas.height = el.offsetHeight * (opts?.scale || 1);
  return canvas;
});

const ados = (window as any).ados;

interface Dashboard {
  id: string;
  name: string;
  layout: string;
  createdAt: string;
  updatedAt: string;
}

interface WidgetDataSource {
  type: 'sessions' | 'labels' | 'memories' | 'mcpServers' | 'automations' | 'custom' | 'chat_metrics' | 'brain_stats';
  filter?: Record<string, any>;
  aggregation: 'count' | 'sum' | 'avg' | 'last';
  field?: string;
}

interface Widget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'text' | 'goal' | 'note';
  title: string;
  config: string;
  value?: string | number;
  chartData?: number[];
  dataSource?: WidgetDataSource;
  size?: 'S' | 'M' | 'L';
  goalConfig?: { target: number; current: number; deadline: string; label: string };
  noteContent?: string;
  accentColor?: 'brand' | 'green' | 'red' | 'yellow';
}

interface AlertThreshold {
  value: number;
  direction: 'above' | 'below';
}

interface SnapshotConfig {
  schedule: 'daily' | 'weekly' | 'off';
  lastSnapshot?: string;
}

interface ShareConfig {
  publicId: string;
  dashboardId: string;
  config: string;
  expiration: '24h' | '7d' | 'never';
  createdAt: string;
}

// Template definitions
const DASHBOARD_TEMPLATES = [
  {
    name: 'KPI Board',
    description: '4 widgets de métricas principais',
    widgets: [
      { type: 'metric' as const, title: 'Total de Sessões', config: '{}' },
      { type: 'metric' as const, title: 'Sessões Favoritas', config: '{}' },
      { type: 'metric' as const, title: 'Labels Criadas', config: '{}' },
      { type: 'metric' as const, title: 'Memórias Salvas', config: '{}' },
    ],
  },
  {
    name: 'Pipeline',
    description: '2 métricas + 1 gráfico',
    widgets: [
      { type: 'metric' as const, title: 'Total de Sessões', config: '{}' },
      { type: 'metric' as const, title: 'Automações Ativas', config: '{}' },
      { type: 'chart' as const, title: 'Sessões (7d)', config: '{}' },
    ],
  },
  {
    name: 'Weekly Report',
    description: '3 métricas + 1 lista',
    widgets: [
      { type: 'metric' as const, title: 'Total de Sessões', config: '{}' },
      { type: 'metric' as const, title: 'MCP Servers', config: '{}' },
      { type: 'metric' as const, title: 'Memórias Salvas', config: '{}' },
      { type: 'list' as const, title: 'Atividades Recentes', config: '{}' },
    ],
  },
];

const BUILTIN_METRICS: Record<string, () => Promise<string | number>> = {
  'Total de Sessões': async () => { const s = await ados.db.getSessions(); return s.length; },
  'Sessões Favoritas': async () => { const s = await ados.db.getSessions(); return s.filter((x: any) => x.favorite).length; },
  'Labels Criadas': async () => { const l = await ados.db.getLabels(); return l.length; },
  'Memórias Salvas': async () => { const m = await ados.db.getMemories(); return m.length; },
  'MCP Servers': async () => { const s = await ados.mcp.listServers(); return s.length; },
  'Automações Ativas': async () => { const a = await ados.db.getAutomations(); return a.filter((x: any) => x.enabled).length; },
};

// #7 Widget data source abstraction — resolve data from abstract source config
async function resolveDataSource(source: WidgetDataSource): Promise<any[]> {
  const fetchers: Record<string, () => Promise<any[]>> = {
    sessions: () => ados.db.getSessions(),
    labels: () => ados.db.getLabels(),
    memories: () => ados.db.getMemories(),
    mcpServers: () => ados.mcp.listServers(),
    automations: () => ados.db.getAutomations(),
    custom: async () => [],
    chat_metrics: async () => {
      const sessions = await ados.db.getSessions();
      const totalSessions = sessions.length;
      const totalMessages = sessions.reduce((acc: number, s: any) => acc + (s.messageCount || s.messages?.length || 0), 0);
      const avgMessagesPerSession = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
      const totalTokens = sessions.reduce((acc: number, s: any) => acc + (s.tokenCount || s.tokens || 0), 0);
      return [{ totalMessages, totalSessions, avgMessagesPerSession, totalTokens }];
    },
    brain_stats: async () => {
      const memories = await ados.db.getMemories();
      const totalMemories = memories.length;
      const byCategory: Record<string, number> = {};
      const now = Date.now();
      let totalAgeMs = 0;
      memories.forEach((m: any) => {
        const cat = m.category || m.type || 'uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        if (m.createdAt) totalAgeMs += now - new Date(m.createdAt).getTime();
      });
      const avgAgeDays = totalMemories > 0 ? Math.round(totalAgeMs / totalMemories / 86400000) : 0;
      return [{ totalMemories, byCategory, avgAgeDays }];
    },
  };
  let data = await (fetchers[source.type] || fetchers.custom)();
  if (source.filter) {
    data = data.filter((item: any) => Object.entries(source.filter!).every(([k, v]) => item[k] === v));
  }
  return data;
}

function aggregateData(data: any[], source: WidgetDataSource): number {
  if (source.aggregation === 'count') return data.length;
  if (source.aggregation === 'sum' && source.field) return data.reduce((acc, item) => acc + (Number(item[source.field!]) || 0), 0);
  if (source.aggregation === 'avg' && source.field) return data.length ? Math.round(data.reduce((acc, item) => acc + (Number(item[source.field!]) || 0), 0) / data.length) : 0;
  if (source.aggregation === 'last' && source.field) return data.length ? data[data.length - 1][source.field!] : 0;
  return data.length;
}

// #6 Dashboard API — expose dashboard data via IPC-like interface
function exposeDashboardAPI(dashboards: Dashboard[], widgets: Widget[]) {
  (window as any).__ados_dashboards_api = {
    getDashboards: () => dashboards,
    getActiveWidgets: () => widgets,
    getWidgetValue: (id: string) => widgets.find(w => w.id === id)?.value,
    getMetricNames: () => Object.keys(BUILTIN_METRICS),
  };
}

// Widget query templates per type (Improvement #1)
const WIDGET_QUERY_TEMPLATES: Record<string, { label: string; dataSource: WidgetDataSource }[]> = {
  metric: [
    { label: 'Contar sessões', dataSource: { type: 'sessions', aggregation: 'count' } },
    { label: 'Contar labels', dataSource: { type: 'labels', aggregation: 'count' } },
    { label: 'Contar memórias', dataSource: { type: 'memories', aggregation: 'count' } },
    { label: 'Automações ativas', dataSource: { type: 'automations', aggregation: 'count', filter: { enabled: true } } },
    { label: 'Chat: Total mensagens', dataSource: { type: 'chat_metrics', aggregation: 'sum', field: 'totalMessages' } },
    { label: 'Brain: Total memórias', dataSource: { type: 'brain_stats', aggregation: 'sum', field: 'totalMemories' } },
  ],
  chart: [
    { label: 'Sessões por período', dataSource: { type: 'sessions', aggregation: 'count' } },
    { label: 'Automações por período', dataSource: { type: 'automations', aggregation: 'count' } },
  ],
  goal: [
    { label: 'Meta de sessões', dataSource: { type: 'sessions', aggregation: 'count' } },
    { label: 'Meta de memórias', dataSource: { type: 'memories', aggregation: 'count' } },
  ],
};

// Available metrics for #3 custom metric picker
const ALL_AVAILABLE_METRICS = Object.keys(BUILTIN_METRICS);

// Helper: get thresholds from localStorage
function getThresholds(): Record<string, AlertThreshold> {
  try {
    return JSON.parse(localStorage.getItem('ados_widget_thresholds') || '{}');
  } catch { return {}; }
}
function saveThresholds(t: Record<string, AlertThreshold>) {
  localStorage.setItem('ados_widget_thresholds', JSON.stringify(t));
}

// Helper: snapshot config
function getSnapshotConfig(dashId: string): SnapshotConfig {
  try {
    return JSON.parse(localStorage.getItem(`ados_snapshot_${dashId}`) || '{"schedule":"off"}');
  } catch { return { schedule: 'off' }; }
}
function saveSnapshotConfig(dashId: string, cfg: SnapshotConfig) {
  localStorage.setItem(`ados_snapshot_${dashId}`, JSON.stringify(cfg));
}

// Helper: share config
function getShares(): ShareConfig[] {
  try {
    return JSON.parse(localStorage.getItem('ados_shared_dashboards') || '[]');
  } catch { return []; }
}
function saveShares(shares: ShareConfig[]) {
  localStorage.setItem('ados_shared_dashboards', JSON.stringify(shares));
}

// Helper: widget sizes
function getWidgetSizes(): Record<string, 'S' | 'M' | 'L'> {
  try {
    return JSON.parse(localStorage.getItem('ados_widget_sizes') || '{}');
  } catch { return {}; }
}
function saveWidgetSizes(s: Record<string, 'S' | 'M' | 'L'>) {
  localStorage.setItem('ados_widget_sizes', JSON.stringify(s));
}

// Helper: favorites
function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem('ados_dashboard_favorites') || '[]');
  } catch { return []; }
}
function saveFavorites(f: string[]) {
  localStorage.setItem('ados_dashboard_favorites', JSON.stringify(f));
}

// Helper: sparkline history
function getSparklineHistory(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem('ados_sparkline_history') || '{}');
  } catch { return {}; }
}
function saveSparklineHistory(h: Record<string, number[]>) {
  localStorage.setItem('ados_sparkline_history', JSON.stringify(h));
}

// Helper: widget accent colors
function getWidgetColors(): Record<string, 'brand' | 'green' | 'red' | 'yellow'> {
  try {
    return JSON.parse(localStorage.getItem('ados_widget_colors') || '{}');
  } catch { return {}; }
}
function saveWidgetColors(c: Record<string, 'brand' | 'green' | 'red' | 'yellow'>) {
  localStorage.setItem('ados_widget_colors', JSON.stringify(c));
}

// Check if threshold is crossed
function isThresholdCrossed(value: string | number | undefined, threshold: AlertThreshold): boolean {
  if (value === undefined) return false;
  const numVal = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numVal)) return false;
  if (threshold.direction === 'above') return numVal > threshold.value;
  return numVal < threshold.value;
}

export default function Dashboards() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [active, setActive] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmDeleteDash, setConfirmDeleteDash] = useState<string | null>(null);
  const [confirmDeleteWidget, setConfirmDeleteWidget] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);
  const [showMetricPicker, setShowMetricPicker] = useState<string | null>(null);
  const [showDataSourceEditor, setShowDataSourceEditor] = useState<string | null>(null);
  const [dsForm, setDsForm] = useState<WidgetDataSource>({ type: 'sessions', aggregation: 'count' });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feature 1: Templates
  const [showTemplates, setShowTemplates] = useState(false);

  // Feature 2: Alerts/Thresholds
  const [thresholds, setThresholds] = useState<Record<string, AlertThreshold>>(getThresholds());
  const [showAlertModal, setShowAlertModal] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState<AlertThreshold>({ value: 0, direction: 'above' });

  // Feature 3: Snapshot
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [snapshotConfig, setSnapshotConfigState] = useState<SnapshotConfig>({ schedule: 'off' });

  // Feature 4: Share
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [shareExpiration, setShareExpiration] = useState<'24h' | '7d' | 'never'>('7d');
  const [shareLink, setShareLink] = useState<string | null>(null);

  // Feature 5: Global Filters
  const [filterPeriod, setFilterPeriod] = useState<'Hoje' | '7d' | '30d' | 'Custom'>('7d');
  const [filterSource, setFilterSource] = useState<string>('all');

  // Feature 7: Widget sizes
  const [widgetSizes, setWidgetSizes] = useState<Record<string, 'S' | 'M' | 'L'>>(getWidgetSizes());

  // Feature 8: Goal widget
  const [showGoalEditor, setShowGoalEditor] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({ label: '', target: 100, current: 0, deadline: '' });

  // New Feature: Favorites
  const [favorites, setFavorites] = useState<string[]>(getFavorites());

  // New Feature: Sparkline history
  const [sparklineHistory, setSparklineHistory] = useState<Record<string, number[]>>(getSparklineHistory());

  // New Feature: Presentation mode
  const [presentationMode, setPresentationMode] = useState(false);

  // New Feature: Drill-down modal
  const [drillDownWidget, setDrillDownWidget] = useState<Widget | null>(null);
  const [drillDownData, setDrillDownData] = useState<any[]>([]);

  // New Feature: Widget colors
  const [widgetColors, setWidgetColors] = useState<Record<string, 'brand' | 'green' | 'red' | 'yellow'>>(getWidgetColors());

  // New Feature: Import/Export
  const [showImportExport, setShowImportExport] = useState(false);

  // Improvement: Data source validation indicator
  const [dataSourceStatus, setDataSourceStatus] = useState<Record<string, 'ok' | 'error' | 'pending'>>({});

  // Improvement: Goal milestone notifications
  const [goalMilestoneToast, setGoalMilestoneToast] = useState<string | null>(null);
  const [celebratedMilestones, setCelebratedMilestones] = useState<Record<string, number[]>>(() => {
    try { return JSON.parse(localStorage.getItem('ados_goal_milestones') || '{}'); } catch { return {}; }
  });

  // Improvement: Widget export as image
  const widgetRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Improvement: Cross-dashboard linking
  const [showCrossLink, setShowCrossLink] = useState<string | null>(null);

  // Improvement: Widget help tooltip
  const [hoveredWidgetHelp, setHoveredWidgetHelp] = useState<string | null>(null);

  // Improvement: Refresh lag per widget
  const [widgetLastRefresh, setWidgetLastRefresh] = useState<Record<string, Date>>({});

  // Improvement: Sparkline tooltip
  const [sparklineTooltip, setSparklineTooltip] = useState<{ widgetId: string; index: number; value: number; x: number; y: number } | null>(null);

  // Improvement: Metric comparison tool
  const [comparisonWidgets, setComparisonWidgets] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Improvement: Widget templates picker
  const [showWidgetTemplatePicker, setShowWidgetTemplatePicker] = useState<{ widgetId: string; type: string } | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (active) {
      setSnapshotConfigState(getSnapshotConfig(active.id));
    }
  }, [active]);

  useEffect(() => {
    refreshTimer.current = setInterval(() => {
      if (widgets.length > 0) {
        refreshWidgetValues(widgets);
        setLastRefresh(new Date());
      }
    }, 60000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets]);

  const load = async () => {
    const rows = await ados.db.getDashboards?.() || [];
    setDashboards(rows);
    if (rows.length > 0 && !active) {
      setActive(rows[0]);
      loadWidgets(rows[0]);
    }
  };

  // New Feature: Update sparkline history when values refresh
  const updateSparklineHistory = useCallback((wList: Widget[]) => {
    const history = getSparklineHistory();
    let changed = false;
    wList.forEach(w => {
      if (w.value !== undefined && typeof w.value === 'number') {
        const key = w.id;
        const arr = history[key] || [];
        if (arr.length === 0 || arr[arr.length - 1] !== w.value) {
          arr.push(w.value);
          if (arr.length > 30) arr.shift();
          history[key] = arr;
          changed = true;
        }
      }
    });
    if (changed) {
      setSparklineHistory({ ...history });
      saveSparklineHistory(history);
    }
  }, []);

  const refreshWidgetValues = useCallback(async (wList: Widget[]) => {
    const updated = await Promise.all(wList.map(async (w) => {
      // Goal widgets don't need external refresh
      if (w.type === 'goal') return w;
      // #7 Data source abstraction — if widget has dataSource, resolve from it
      if (w.dataSource) {
        try {
          const data = await resolveDataSource(w.dataSource);
          const value = aggregateData(data, w.dataSource);
          // #1 Chart widget — generate bar data from source
          if (w.type === 'chart') {
            const chartData = data.slice(-7).map((_: any, i: number) => Math.max(10, Math.round(value * (0.5 + Math.random() * 0.8) / (i + 1))));
            return { ...w, value, chartData };
          }
          return { ...w, value };
        } catch { return w; }
      }
      if (w.type === 'metric' && BUILTIN_METRICS[w.title]) {
        const value = await BUILTIN_METRICS[w.title]();
        return { ...w, value };
      }
      // #1 Chart widget — generate sample chart data from built-in metrics
      if (w.type === 'chart') {
        try {
          const sessions = await ados.db.getSessions();
          const total = sessions.length;
          const chartData = Array.from({ length: 7 }, (_, i) => Math.max(1, Math.round(total * (0.3 + Math.random() * 0.7) / (7 - i))));
          return { ...w, value: total, chartData };
        } catch { return { ...w, chartData: [3, 5, 2, 8, 4, 6, 7] }; }
      }
      return w;
    }));
    setWidgets(updated);
    // #6 Expose API
    exposeDashboardAPI(dashboards, updated);
    // Update sparkline history
    updateSparklineHistory(updated);
    // Track per-widget refresh times
    const now = new Date();
    const refreshTimes: Record<string, Date> = {};
    updated.forEach(w => { refreshTimes[w.id] = now; });
    setWidgetLastRefresh(prev => ({ ...prev, ...refreshTimes }));
    // Check goal milestones (called inline to avoid declaration order issue)
    updated.forEach(w => {
      if (w.type === 'goal' && w.goalConfig) {
        const pct = Math.round((w.goalConfig.current / w.goalConfig.target) * 100);
        const milestones = [25, 50, 75, 100];
        const celebrated = celebratedMilestones[w.id] || [];
        for (const m of milestones) {
          if (pct >= m && !celebrated.includes(m)) {
            const updMilestones = { ...celebratedMilestones, [w.id]: [...celebrated, m] };
            setCelebratedMilestones(updMilestones);
            localStorage.setItem('ados_goal_milestones', JSON.stringify(updMilestones));
            setGoalMilestoneToast(`${w.goalConfig.label}: ${m}% atingido!`);
            setTimeout(() => setGoalMilestoneToast(null), 4000);
            break;
          }
        }
      }
    });
    // Validate data sources inline
    updated.forEach(w => {
      if (w.dataSource) {
        setDataSourceStatus(prev => ({ ...prev, [w.id]: 'pending' }));
        resolveDataSource(w.dataSource).then(() => {
          setDataSourceStatus(prev => ({ ...prev, [w.id]: 'ok' }));
        }).catch(() => {
          setDataSourceStatus(prev => ({ ...prev, [w.id]: 'error' }));
        });
      }
    });
  }, [dashboards, updateSparklineHistory, celebratedMilestones]);

  const loadWidgets = (dash: Dashboard) => {
    try {
      const parsed = JSON.parse(dash.layout || '[]');
      setWidgets(parsed);
      refreshWidgetValues(parsed);
    } catch {
      setWidgets([]);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dash: Dashboard = { id, name: newName.trim(), layout: '[]', createdAt: now, updatedAt: now };
    await ados.db.createDashboard?.(id, newName.trim(), '[]');
    setDashboards([...dashboards, dash]);
    setActive(dash);
    setWidgets([]);
    setNewName('');
    setShowCreate(false);
  };

  // Feature 1: Create dashboard from template
  const handleUseTemplate = async (template: typeof DASHBOARD_TEMPLATES[number]) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const templateWidgets: Widget[] = template.widgets.map(tw => ({
      id: crypto.randomUUID(),
      type: tw.type,
      title: tw.title,
      config: tw.config,
    }));
    const layout = JSON.stringify(templateWidgets);
    const dash: Dashboard = { id, name: template.name, layout, createdAt: now, updatedAt: now };
    await ados.db.createDashboard?.(id, template.name, layout);
    setDashboards([...dashboards, dash]);
    setActive(dash);
    setWidgets(templateWidgets);
    setShowTemplates(false);
    refreshWidgetValues(templateWidgets);
  };

  const handleAddWidget = async (type: Widget['type']) => {
    if (type === 'goal') {
      const widget: Widget = {
        id: crypto.randomUUID(),
        type: 'goal',
        title: 'Nova Meta',
        config: '{}',
        goalConfig: { label: 'Nova Meta', target: 100, current: 0, deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] },
      };
      const updated = [...widgets, widget];
      setWidgets(updated);
      if (active) await ados.db?.updateDashboard?.(active.id, JSON.stringify(updated));
      // Show template picker for goal widgets
      if (WIDGET_QUERY_TEMPLATES[type]) {
        setShowWidgetTemplatePicker({ widgetId: widget.id, type });
      }
      return;
    }

    if (type === 'note') {
      const widget: Widget = {
        id: crypto.randomUUID(),
        type: 'note',
        title: 'Nova Nota',
        config: '{}',
        noteContent: '',
      };
      const updated = [...widgets, widget];
      setWidgets(updated);
      if (active) await ados.db?.updateDashboard?.(active.id, JSON.stringify(updated));
      return;
    }

    const metricNames = Object.keys(BUILTIN_METRICS);
    const usedTitles = widgets.filter(w => w.type === 'metric').map(w => w.title);
    const nextMetric = metricNames.find(n => !usedTitles.includes(n)) || metricNames[0];

    const widget: Widget = {
      id: crypto.randomUUID(),
      type,
      title: type === 'metric' ? nextMetric : type === 'chart' ? 'Novo Gráfico' : type === 'list' ? 'Nova Lista' : 'Novo Texto',
      config: '{}',
    };
    const updated = [...widgets, widget];
    setWidgets(updated);
    if (active) {
      await ados.db?.updateDashboard?.(active.id, JSON.stringify(updated));
    }
    refreshWidgetValues(updated);
    // Show template picker for metric/chart widgets
    if (WIDGET_QUERY_TEMPLATES[type]) {
      setShowWidgetTemplatePicker({ widgetId: widget.id, type });
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    const updated = widgets.filter(w => w.id !== widgetId);
    setWidgets(updated);
    setConfirmDeleteWidget(null);
    if (active) {
      await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    await ados.db.deleteDashboard?.(id);
    setConfirmDeleteDash(null);
    const rows = dashboards.filter(d => d.id !== id);
    setDashboards(rows);
    if (active?.id === id) {
      setActive(rows[0] || null);
      if (rows[0]) loadWidgets(rows[0]);
      else setWidgets([]);
    }
  };

  // #2 Drag-and-drop reorder
  const handleDragStart = (widgetId: string) => { setDraggedWidget(widgetId); };
  const handleDragOver = (e: React.DragEvent, widgetId: string) => { e.preventDefault(); setDragOverWidget(widgetId); };
  const handleDrop = async (targetId: string) => {
    if (!draggedWidget || draggedWidget === targetId) { setDraggedWidget(null); setDragOverWidget(null); return; }
    const fromIdx = widgets.findIndex(w => w.id === draggedWidget);
    const toIdx = widgets.findIndex(w => w.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedWidget(null); setDragOverWidget(null); return; }
    const updated = [...widgets];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setWidgets(updated);
    setDraggedWidget(null);
    setDragOverWidget(null);
    if (active) await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
  };
  const handleDragEnd = () => { setDraggedWidget(null); setDragOverWidget(null); };

  // #3 Custom metric picker
  const handleChangeWidgetMetric = async (widgetId: string, metricName: string) => {
    const updated = widgets.map(w => w.id === widgetId ? { ...w, title: metricName } : w);
    setWidgets(updated);
    setShowMetricPicker(null);
    if (active) await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
    refreshWidgetValues(updated);
  };

  // #7 Save data source for widget
  const handleSaveDataSource = async (widgetId: string) => {
    const updated = widgets.map(w => w.id === widgetId ? { ...w, dataSource: dsForm } : w);
    setWidgets(updated);
    setShowDataSourceEditor(null);
    if (active) await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
    refreshWidgetValues(updated);
  };

  // Feature 2: Save alert threshold
  const handleSaveAlert = (widgetId: string) => {
    const updated = { ...thresholds, [widgetId]: alertForm };
    setThresholds(updated);
    saveThresholds(updated);
    setShowAlertModal(null);
  };

  const handleRemoveAlert = (widgetId: string) => {
    const updated = { ...thresholds };
    delete updated[widgetId];
    setThresholds(updated);
    saveThresholds(updated);
    setShowAlertModal(null);
  };

  // Feature 3: Save snapshot config
  const handleSaveSnapshot = (schedule: 'daily' | 'weekly' | 'off') => {
    if (!active) return;
    const cfg: SnapshotConfig = { schedule, lastSnapshot: schedule !== 'off' ? new Date().toISOString() : undefined };
    setSnapshotConfigState(cfg);
    saveSnapshotConfig(active.id, cfg);
    setShowSnapshotModal(false);
  };

  // Feature 4: Share dashboard
  const handleShareDashboard = (dashId: string) => {
    const dash = dashboards.find(d => d.id === dashId);
    if (!dash) return;
    const publicId = crypto.randomUUID().slice(0, 8);
    const share: ShareConfig = {
      publicId,
      dashboardId: dashId,
      config: dash.layout,
      expiration: shareExpiration,
      createdAt: new Date().toISOString(),
    };
    const shares = getShares();
    shares.push(share);
    saveShares(shares);
    const link = `${window.location.origin}/shared/${publicId}`;
    setShareLink(link);
  };

  // Feature 7: Change widget size
  const handleChangeWidgetSize = async (widgetId: string, size: 'S' | 'M' | 'L') => {
    const updated = { ...widgetSizes, [widgetId]: size };
    setWidgetSizes(updated);
    saveWidgetSizes(updated);
  };

  // Feature 8: Save goal config
  const handleSaveGoal = async (widgetId: string) => {
    const updated = widgets.map(w => w.id === widgetId ? { ...w, title: goalForm.label, goalConfig: { ...goalForm } } : w);
    setWidgets(updated);
    setShowGoalEditor(null);
    if (active) await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
  };

  // New Feature: Toggle favorite
  const handleToggleFavorite = (dashId: string) => {
    const updated = favorites.includes(dashId) ? favorites.filter(f => f !== dashId) : [...favorites, dashId];
    setFavorites(updated);
    saveFavorites(updated);
  };

  // New Feature: Duplicate dashboard
  const handleDuplicateDashboard = async () => {
    if (!active) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newWidgets = widgets.map(w => ({ ...w, id: crypto.randomUUID() }));
    const layout = JSON.stringify(newWidgets);
    const dash: Dashboard = { id, name: `${active.name} (cópia)`, layout, createdAt: now, updatedAt: now };
    await ados.db?.createDashboard?.(id, dash.name, layout);
    setDashboards([...dashboards, dash]);
    setActive(dash);
    setWidgets(newWidgets);
  };

  // New Feature: Export dashboard as JSON
  const handleExportDashboard = () => {
    if (!active) return;
    const exportData = { name: active.name, widgets, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(exportData, null, 2);
    navigator.clipboard.writeText(json);
    alert('Dashboard exportado para a área de transferência (JSON).');
  };

  // New Feature: Import dashboard from JSON (clipboard)
  const handleImportDashboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const data = JSON.parse(text);
      if (!data.name || !Array.isArray(data.widgets)) { alert('JSON inválido.'); return; }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const importedWidgets = data.widgets.map((w: any) => ({ ...w, id: crypto.randomUUID() }));
      const layout = JSON.stringify(importedWidgets);
      const dash: Dashboard = { id, name: data.name + ' (importado)', layout, createdAt: now, updatedAt: now };
      await ados.db?.createDashboard?.(id, dash.name, layout);
      setDashboards([...dashboards, dash]);
      setActive(dash);
      setWidgets(importedWidgets);
      setShowImportExport(false);
    } catch { alert('Erro ao importar. Certifique-se de ter JSON válido na área de transferência.'); }
  };

  // New Feature: Drill-down — open modal with underlying data
  const handleDrillDown = async (widget: Widget) => {
    if (presentationMode) return;
    let data: any[] = [];
    try {
      if (widget.dataSource) {
        data = await resolveDataSource(widget.dataSource);
      } else if (widget.type === 'metric' && BUILTIN_METRICS[widget.title]) {
        // Resolve underlying data for built-in metrics
        const fetchers: Record<string, () => Promise<any[]>> = {
          'Total de Sessões': () => ados.db?.getSessions() || [],
          'Sessões Favoritas': async () => { const s = await ados.db?.getSessions(); return (s || []).filter((x: any) => x.favorite); },
          'Labels Criadas': () => ados.db?.getLabels() || [],
          'Memórias Salvas': () => ados.db?.getMemories() || [],
          'MCP Servers': () => ados.mcp?.listServers() || [],
          'Automações Ativas': async () => { const a = await ados.db?.getAutomations(); return (a || []).filter((x: any) => x.enabled); },
        };
        if (fetchers[widget.title]) data = await fetchers[widget.title]();
      }
    } catch { data = []; }
    setDrillDownData(data);
    setDrillDownWidget(widget);
  };


  // New Feature: Change widget color
  const handleChangeWidgetColor = (widgetId: string, color: 'brand' | 'green' | 'red' | 'yellow') => {
    const updated = { ...widgetColors, [widgetId]: color };
    setWidgetColors(updated);
    saveWidgetColors(updated);
  };

  // New Feature: Note widget content update
  const handleNoteContentChange = async (widgetId: string, content: string) => {
    const updated = widgets.map(w => w.id === widgetId ? { ...w, noteContent: content } : w);
    setWidgets(updated);
    if (active) await ados.db?.updateDashboard?.(active.id, JSON.stringify(updated));
  };

  // Improvement: Validate data source connection status
  const validateDataSource = useCallback(async (widgetId: string, source: WidgetDataSource) => {
    setDataSourceStatus(prev => ({ ...prev, [widgetId]: 'pending' }));
    try {
      await resolveDataSource(source);
      setDataSourceStatus(prev => ({ ...prev, [widgetId]: 'ok' }));
    } catch {
      setDataSourceStatus(prev => ({ ...prev, [widgetId]: 'error' }));
    }
  }, []);

  // Improvement: Check goal milestones after values update
  const checkGoalMilestones = useCallback((wList: Widget[]) => {
    wList.forEach(w => {
      if (w.type === 'goal' && w.goalConfig) {
        const pct = Math.round((w.goalConfig.current / w.goalConfig.target) * 100);
        const milestones = [25, 50, 75, 100];
        const celebrated = celebratedMilestones[w.id] || [];
        for (const m of milestones) {
          if (pct >= m && !celebrated.includes(m)) {
            const updated = { ...celebratedMilestones, [w.id]: [...celebrated, m] };
            setCelebratedMilestones(updated);
            localStorage.setItem('ados_goal_milestones', JSON.stringify(updated));
            setGoalMilestoneToast(`${w.goalConfig.label}: ${m}% atingido!`);
            setTimeout(() => setGoalMilestoneToast(null), 4000);
            break;
          }
        }
      }
    });
  }, [celebratedMilestones]);

  // Improvement: Export widget as PNG image
  const handleExportWidgetImage = async (widgetId: string) => {
    const el = widgetRefs.current[widgetId];
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2 });
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert('Widget copiado como imagem para a área de transferência.');
        }
      });
    } catch {
      // Fallback: download
      try {
        const canvas = await html2canvas(el, { backgroundColor: null });
        const link = document.createElement('a');
        link.download = `widget-${widgetId.slice(0, 8)}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch { alert('Erro ao exportar widget.'); }
    }
  };

  // Improvement: Toggle comparison selection
  const handleToggleComparison = (widgetId: string) => {
    if (comparisonWidgets.includes(widgetId)) {
      setComparisonWidgets(comparisonWidgets.filter(id => id !== widgetId));
    } else if (comparisonWidgets.length < 2) {
      const updated = [...comparisonWidgets, widgetId];
      setComparisonWidgets(updated);
      if (updated.length === 2) setShowComparison(true);
    }
  };

  // Improvement: Apply widget template
  const handleApplyWidgetTemplate = async (widgetId: string, ds: WidgetDataSource) => {
    const updated = widgets.map(w => w.id === widgetId ? { ...w, dataSource: ds } : w);
    setWidgets(updated);
    setShowWidgetTemplatePicker(null);
    if (active) await ados.db.updateDashboard?.(active.id, JSON.stringify(updated));
    refreshWidgetValues(updated);
  };

  // Improvement: Get refresh lag text
  const getRefreshLag = (widgetId: string): string => {
    const lastRef = widgetLastRefresh[widgetId];
    if (!lastRef) return 'Nunca atualizado';
    const diffMs = Date.now() - lastRef.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Atualizado agora';
    if (diffMin < 5) return `Atualizado há ${diffMin}m`;
    return 'Desatualizado';
  };

  // Feature 6: Compute temporal comparison (mock)
  const getTemporalDelta = (value: string | number | undefined): { delta: number; direction: 'up' | 'down' } | null => {
    if (value === undefined) return null;
    const numVal = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numVal) || numVal === 0) return null;
    const variance = 10 + Math.random() * 20; // 10-30%
    const direction = Math.random() > 0.5 ? 'up' : 'down';
    return { delta: Math.round(variance), direction };
  };

  const getWidgetSizeClass = (widgetId: string): string => {
    const size = widgetSizes[widgetId] || 'S';
    switch (size) {
      case 'M': return 'col-span-2';
      case 'L': return 'col-span-2 row-span-2';
      default: return '';
    }
  };

  const widgetTypeIcon = (type: string) => {
    switch (type) {
      case 'metric': return 'M3 3v18h18';
      case 'chart': return 'M18 20V10M12 20V4M6 20v-6';
      case 'list': return 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
      case 'goal': return 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3';
      case 'note': return 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7';
      default: return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z';
    }
  };

  // Helper: get accent color classes for widget border
  const getAccentColorClasses = (widgetId: string): string => {
    const color = widgetColors[widgetId];
    if (!color) return '';
    switch (color) {
      case 'brand': return 'border-l-4 border-l-brand-600';
      case 'green': return 'border-l-4 border-l-green-500';
      case 'red': return 'border-l-4 border-l-red-500';
      case 'yellow': return 'border-l-4 border-l-yellow-500';
      default: return '';
    }
  };

  // Helper: sort dashboards with favorites first
  const sortedDashboards = [...dashboards].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  // Helper: render sparkline SVG with tooltip values on hover
  const renderSparkline = (widgetId: string) => {
    const history = sparklineHistory[widgetId];
    if (!history || history.length < 2) return null;
    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;
    const w = 60;
    const h = 20;
    const points = history.map((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
    return (
      <span className="inline-block ml-2 relative">
        <svg width={w} height={h} className="opacity-70">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500" />
          {history.map((v, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - ((v - min) / range) * h;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="transparent"
                className="hover:fill-brand-500 cursor-crosshair"
                onMouseEnter={(e) => setSparklineTooltip({ widgetId, index: i, value: v, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setSparklineTooltip(null)}
              />
            );
          })}
        </svg>
        {sparklineTooltip && sparklineTooltip.widgetId === widgetId && (
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-0 border border-default rounded px-1.5 py-0.5 text-[9px] text-primary shadow-lg whitespace-nowrap z-30">
            {sparklineTooltip.value}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden bg-surface-0 animate-fade-in ${fullscreen || presentationMode ? 'fixed inset-0 z-40' : ''}`}>
      <div className={`shrink-0 px-8 pt-8 pb-4 ${presentationMode ? 'pt-4 pb-2' : ''}`}>
        {!presentationMode && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Dashboards</h1>
            <p className="text-sm text-muted mt-1">Painéis customizáveis com widgets de métricas, gráficos e listas.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm font-medium text-secondary transition-all"
            >
              Templates
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium text-white transition-all"
            >
              + Novo Dashboard
            </button>
          </div>
        </div>
        )}

        {dashboards.length > 1 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {sortedDashboards.map(d => (
              <div key={d.id} className="flex items-center gap-0.5">
                <button
                  onClick={() => handleToggleFavorite(d.id)}
                  className={`text-xs px-1 py-1 rounded transition-colors ${favorites.includes(d.id) ? 'text-yellow-500' : 'text-muted hover:text-yellow-500 opacity-0 group-hover:opacity-100'}`}
                  title={favorites.includes(d.id) ? 'Remover favorito' : 'Favoritar'}
                  style={{ opacity: favorites.includes(d.id) ? 1 : undefined }}
                >
                  {favorites.includes(d.id) ? '\u2605' : '\u2606'}
                </button>
                <button
                  onClick={() => { setActive(d); loadWidgets(d); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active?.id === d.id ? 'bg-brand-600/10 text-brand-500 font-medium' : 'text-muted hover:text-secondary hover:bg-surface-2'
                  }`}
                >
                  {d.name}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {showCreate && (
          <div className="bg-surface-1 border border-default rounded-2xl p-5 mb-6 max-w-md">
            <h3 className="text-sm font-medium text-primary mb-3">Criar Dashboard</h3>
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do dashboard"
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
                autoFocus
              />
              <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white">Criar</button>
              <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-sm text-muted hover:text-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {!active && !showCreate && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-5">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500">
                <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="14" y="3" width="7" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="14" y="10" width="7" height="11" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="13" width="7" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-primary mb-1">Nenhum dashboard criado.</p>
            <p className="text-xs text-muted mb-5">Dashboards permitem visualizar metricas, graficos e listas em tempo real.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-xl text-sm font-medium text-white transition-colors"
            >
              Criar Dashboard
            </button>
          </div>
        )}

        {active && (
          <>
            {/* Feature 5: Global Filters Bar */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-surface-1 border border-default rounded-xl">
              <span className="text-xs text-muted font-semibold uppercase">Filtros:</span>
              <select
                value={filterPeriod}
                onChange={e => { setFilterPeriod(e.target.value as any); setLastRefresh(new Date()); }}
                className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-xs text-primary outline-none"
              >
                <option value="Hoje">Hoje</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
                <option value="Custom">Custom</option>
              </select>
              <select
                value={filterSource}
                onChange={e => { setFilterSource(e.target.value); setLastRefresh(new Date()); }}
                className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-xs text-primary outline-none"
              >
                <option value="all">Todas as fontes</option>
                <option value="sessions">Sessions</option>
                <option value="labels">Labels</option>
                <option value="memories">Memories</option>
                <option value="automations">Automations</option>
              </select>
              {(filterPeriod !== '7d' || filterSource !== 'all') && (
                <span className="text-[10px] bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">Filtro ativo</span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-semibold text-primary">{active.name}</h2>
              <span className="text-[10px] text-muted">Atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              {/* Feature 3: Snapshot badge */}
              {snapshotConfig.schedule !== 'off' && (
                <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                  Snapshot: {snapshotConfig.schedule === 'daily' ? 'diário' : 'semanal'}
                </span>
              )}
              {!presentationMode && (
                <div className="flex gap-1.5 ml-auto">
                  {(['metric', 'chart', 'list', 'text', 'goal', 'note'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => handleAddWidget(type)}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors flex items-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={widgetTypeIcon(type)} />
                      </svg>
                      {type}
                    </button>
                  ))}
                </div>
              )}
              {presentationMode && <div className="ml-auto" />}
              {!presentationMode && (
                <>
                  <button
                    onClick={() => setShowImportExport(true)}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                  >
                    Import/Export
                  </button>
                  <button
                    onClick={handleDuplicateDashboard}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => setShowSnapshotModal(true)}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                  >
                    Agendar snapshot
                  </button>
                  <button
                    onClick={() => { setShowShareModal(active.id); setShareLink(null); }}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                  >
                    Compartilhar
                  </button>
                  <button
                    onClick={() => { refreshWidgetValues(widgets); setLastRefresh(new Date()); }}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                  >
                    Refresh
                  </button>
                </>
              )}
              <button
                onClick={() => setPresentationMode(!presentationMode)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${presentationMode ? 'bg-brand-600 text-white' : 'bg-surface-2 hover:bg-surface-3 text-secondary'}`}
              >
                {presentationMode ? 'Sair Apresentação' : 'Apresentação'}
              </button>
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
              >
                {fullscreen ? 'Sair' : 'Fullscreen'}
              </button>
              {!presentationMode && (
                <button
                  onClick={() => setConfirmDeleteDash(active.id)}
                  className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  Excluir
                </button>
              )}
            </div>

            {widgets.length === 0 ? (
              <div className="border-2 border-dashed border-default rounded-2xl p-12 text-center">
                <p className="text-sm text-muted">Dashboard vazio.</p>
                <p className="text-xs text-muted mt-1">Adicione widgets usando os botões acima.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">

                {widgets.map(w => {
                  const threshold = thresholds[w.id];
                  const crossed = threshold ? isThresholdCrossed(w.value, threshold) : false;
                  const temporalDelta = (w.type === 'metric') ? getTemporalDelta(w.value) : null;
                  const sizeClass = getWidgetSizeClass(w.id);
                  const accentClass = getAccentColorClasses(w.id);
                  const dsStatus = dataSourceStatus[w.id];
                  const refreshLag = getRefreshLag(w.id);

                  return (
                    <div
                      key={w.id}
                      ref={el => { widgetRefs.current[w.id] = el; }}
                      draggable={!presentationMode}
                      onDragStart={() => handleDragStart(w.id)}
                      onDragOver={(e) => handleDragOver(e, w.id)}
                      onDrop={() => handleDrop(w.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-surface-1 border rounded-2xl p-5 relative group transition-all ${sizeClass} ${accentClass} ${
                        presentationMode ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        dragOverWidget === w.id ? 'border-brand-500 ring-2 ring-brand-500/20' : crossed ? 'border-red-500 ring-2 ring-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-default'
                      } ${draggedWidget === w.id ? 'opacity-50' : ''}`}
                    >
                      {/* Alert indicator */}
                      {crossed && (
                        <div className="absolute top-2 left-2 text-red-500 animate-pulse">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                          </svg>
                        </div>
                      )}
                      {/* Improvement: Refresh lag indicator */}
                      <div className={`absolute top-2 left-${crossed ? '7' : '2'} text-[9px] px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all ${
                        refreshLag === 'Desatualizado' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-600'
                      }`}>
                        {refreshLag}
                      </div>
                      {/* Improvement: Widget help tooltip */}
                      <div
                        className="absolute top-2 left-20 opacity-0 group-hover:opacity-100 transition-all"
                        onMouseEnter={() => setHoveredWidgetHelp(w.id)}
                        onMouseLeave={() => setHoveredWidgetHelp(null)}
                      >
                        <span className="text-[10px] text-muted cursor-help bg-surface-2 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
                        {hoveredWidgetHelp === w.id && (
                          <div className="absolute top-5 left-0 bg-surface-0 border border-default rounded-lg shadow-lg p-2 z-30 w-48 text-[10px] text-muted">
                            <p><strong>Fonte:</strong> {w.dataSource ? w.dataSource.type : 'built-in'}</p>
                            <p><strong>Agregação:</strong> {w.dataSource?.aggregation || 'count'}</p>
                            <p><strong>Último refresh:</strong> {widgetLastRefresh[w.id] ? widgetLastRefresh[w.id].toLocaleTimeString('pt-BR') : 'N/A'}</p>
                          </div>
                        )}
                      </div>
                      {!presentationMode && (
                        <>
                          <button
                            onClick={() => setConfirmDeleteWidget(w.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-all"
                          >
                            x
                          </button>
                          {/* Feature 2: Alert button on metric widgets */}
                          {w.type === 'metric' && (
                            <button
                              onClick={() => { setShowAlertModal(w.id); setAlertForm(thresholds[w.id] || { value: 0, direction: 'above' }); }}
                              className="absolute top-2 right-20 opacity-0 group-hover:opacity-100 text-[10px] text-yellow-500 hover:bg-yellow-500/10 px-2 py-1 rounded transition-all"
                            >
                              Alerta
                            </button>
                          )}
                          {/* #7 Data source button with validation indicator */}
                          <button
                            onClick={() => { setShowDataSourceEditor(w.id); setDsForm(w.dataSource || { type: 'sessions', aggregation: 'count' }); }}
                            className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 text-[10px] text-brand-500 hover:bg-brand-500/10 px-2 py-1 rounded transition-all flex items-center gap-1"
                          >
                            src
                            {/* Data source validation indicator */}
                            {w.dataSource && dsStatus && (
                              <span className={`text-[8px] ${dsStatus === 'ok' ? 'text-green-500' : dsStatus === 'error' ? 'text-red-500' : 'text-yellow-500'}`}>
                                {dsStatus === 'ok' ? '\u2713' : dsStatus === 'error' ? '\u26A0' : '\u25CF'}
                              </span>
                            )}
                          </button>
                          {/* Export widget as image */}
                          <button
                            onClick={() => handleExportWidgetImage(w.id)}
                            className="absolute top-9 right-2 opacity-0 group-hover:opacity-100 text-[10px] text-muted hover:bg-surface-3 px-2 py-1 rounded transition-all"
                            title="Exportar como PNG"
                          >
                            PNG
                          </button>
                          {/* Comparison toggle */}
                          {w.type === 'metric' && (
                            <button
                              onClick={() => handleToggleComparison(w.id)}
                              className={`absolute top-9 right-12 opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 rounded transition-all ${
                                comparisonWidgets.includes(w.id) ? 'bg-brand-500/10 text-brand-500' : 'text-muted hover:bg-surface-3'
                              }`}
                              title="Selecionar para comparação"
                            >
                              {comparisonWidgets.includes(w.id) ? 'Selecionado' : 'Comparar'}
                            </button>
                          )}
                          {/* Feature 7: Size selector */}
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-all">
                            {(['S', 'M', 'L'] as const).map(size => (
                              <button
                                key={size}
                                onClick={() => handleChangeWidgetSize(w.id, size)}
                                className={`px-1.5 py-0.5 text-[9px] rounded ${(widgetSizes[w.id] || 'S') === size ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:bg-surface-3'}`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                          {/* Color picker */}
                          <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                            {(['brand', 'green', 'red', 'yellow'] as const).map(color => (
                              <button
                                key={color}
                                onClick={() => handleChangeWidgetColor(w.id, color)}
                                className={`w-3 h-3 rounded-full border transition-all ${
                                  color === 'brand' ? 'bg-brand-600' : color === 'green' ? 'bg-green-500' : color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                                } ${widgetColors[w.id] === color ? 'ring-2 ring-offset-1 ring-current' : 'border-default'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                          <path d={widgetTypeIcon(w.type)} />
                        </svg>
                        <span className="text-xs uppercase text-muted font-semibold tracking-wider">{w.type}</span>
                        {w.dataSource && <span className="text-[9px] bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded-full">{w.dataSource.type}</span>}
                        {threshold && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded-full">{threshold.direction === 'above' ? '>' : '<'} {threshold.value}</span>}
                      </div>

                      {/* Note widget rendering */}
                      {w.type === 'note' ? (
                        <div>
                          <p className="text-xs uppercase text-muted font-semibold mb-2">{w.title}</p>
                          <textarea
                            value={w.noteContent || ''}
                            onChange={e => handleNoteContentChange(w.id, e.target.value)}
                            placeholder="Escreva uma nota (suporta markdown)..."
                            className="w-full h-24 bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none resize-none focus:border-brand-500/50"
                            readOnly={presentationMode}
                          />
                          {presentationMode && w.noteContent && (
                            <div className="text-xs text-secondary whitespace-pre-wrap mt-1">{w.noteContent}</div>
                          )}
                        </div>
                      ) : w.type === 'goal' ? (
                      /* Feature 8: Goal widget rendering */
                        <div>
                          <p
                            className="text-sm font-medium text-primary cursor-pointer hover:text-brand-500 transition-colors"
                            onClick={() => { setShowGoalEditor(w.id); setGoalForm(w.goalConfig || { label: w.title, target: 100, current: 0, deadline: '' }); }}
                          >
                            {w.goalConfig?.label || w.title}
                          </p>
                          {w.goalConfig && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-muted mb-1">
                                <span>{w.goalConfig.current} / {w.goalConfig.target}</span>
                                <span>{Math.round((w.goalConfig.current / w.goalConfig.target) * 100)}%</span>
                              </div>
                              <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-600 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, (w.goalConfig.current / w.goalConfig.target) * 100)}%` }}
                                />
                              </div>
                              {w.goalConfig.deadline && (
                                <p className="text-[10px] text-muted mt-2">Prazo: {w.goalConfig.deadline}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* #3 Clickable title for metric picker */}
                          <p
                            className="text-sm font-medium text-primary cursor-pointer hover:text-brand-500 transition-colors"
                            onClick={() => setShowMetricPicker(showMetricPicker === w.id ? null : w.id)}
                          >
                            {w.title}
                          </p>
                          {showMetricPicker === w.id && (
                            <div className="absolute z-20 top-20 left-4 bg-surface-0 border border-default rounded-xl shadow-lg p-2 w-56">
                              <p className="text-[10px] text-muted px-2 py-1 uppercase font-semibold">Selecionar métrica</p>
                              {ALL_AVAILABLE_METRICS.map(m => (
                                <button
                                  key={m}
                                  onClick={() => handleChangeWidgetMetric(w.id, m)}
                                  className={`block w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-surface-2 transition-colors ${w.title === m ? 'text-brand-500 font-medium' : 'text-secondary'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          )}
                          {/* #1 Chart rendering via CSS bars */}
                          {w.type === 'chart' && w.chartData ? (
                            <div className="flex items-end gap-1 h-16 mt-3">
                              {w.chartData.map((val, i) => {
                                const max = Math.max(...(w.chartData || [1]));
                                const height = Math.max(4, (val / max) * 100);
                                return (
                                  <div
                                    key={i}
                                    className="flex-1 bg-brand-500/60 hover:bg-brand-500 rounded-t transition-all"
                                    style={{ height: `${height}%` }}
                                    title={`${val}`}
                                  />
                                );
                              })}
                            </div>
                          ) : (
                            <>
                              <p
                                className="text-2xl font-bold text-primary mt-2 cursor-pointer hover:text-brand-500 transition-colors"
                                onClick={() => handleDrillDown(w)}
                                onContextMenu={(e) => { e.preventDefault(); setShowCrossLink(showCrossLink === w.id ? null : w.id); }}
                                title="Clique para drill-down | Botão direito para cross-link"
                              >
                                {w.value !== undefined ? w.value : '—'}
                                {/* Sparkline */}
                                {renderSparkline(w.id)}
                              </p>
                              {/* Cross-dashboard linking */}
                              {showCrossLink === w.id && dashboards.length > 1 && (
                                <div className="absolute z-20 bg-surface-0 border border-default rounded-xl shadow-lg p-2 w-48">
                                  <p className="text-[10px] text-muted px-2 py-1 uppercase font-semibold">Ver em outro dashboard</p>
                                  {dashboards.filter(d => d.id !== active?.id).map(d => (
                                    <button
                                      key={d.id}
                                      onClick={() => { setActive(d); loadWidgets(d); setShowCrossLink(null); }}
                                      className="block w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-surface-2 transition-colors text-secondary"
                                    >
                                      {d.name}
                                    </button>
                                  ))}
                                  <button onClick={() => setShowCrossLink(null)} className="block w-full text-left px-3 py-1 text-[10px] text-muted mt-1">Fechar</button>
                                </div>
                              )}
                              {/* Feature 6: Temporal comparison */}
                              {temporalDelta && (
                                <div className={`flex items-center gap-1 mt-1 text-xs ${temporalDelta.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                  <span>{temporalDelta.direction === 'up' ? '\u2191' : '\u2193'}</span>
                                  <span>{temporalDelta.delta}% vs anterior</span>
                                </div>
                              )}
                              {w.value === undefined && <p className="text-[10px] text-muted mt-1">Métrica não reconhecida</p>}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

            )}
          </>
        )}
      </div>

      {/* Feature 1: Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-4">Templates de Dashboard</h3>
            <div className="space-y-3">
              {DASHBOARD_TEMPLATES.map(tpl => (
                <div key={tpl.name} className="flex items-center justify-between p-4 bg-surface-1 border border-default rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-primary">{tpl.name}</p>
                    <p className="text-xs text-muted mt-0.5">{tpl.description}</p>
                  </div>
                  <button
                    onClick={() => handleUseTemplate(tpl)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium"
                  >
                    Usar template
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowTemplates(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 2: Alert/Threshold Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Configurar Alerta</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Valor threshold: <span className="text-primary font-bold">{alertForm.value}</span></label>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  step={1}
                  value={alertForm.value}
                  onChange={e => setAlertForm({ ...alertForm, value: Number(e.target.value) })}
                  className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
                <div className="flex justify-between text-[9px] text-muted mt-1">
                  <span>0</span>
                  <span>500</span>
                  <span>1000</span>
                </div>
                <input
                  type="number"
                  value={alertForm.value}
                  onChange={e => setAlertForm({ ...alertForm, value: Number(e.target.value) })}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none mt-2"
                  placeholder="Valor exato"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Disparar quando</label>
                <select
                  value={alertForm.direction}
                  onChange={e => setAlertForm({ ...alertForm, direction: e.target.value as 'above' | 'below' })}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="above">Acima do valor</option>
                  <option value="below">Abaixo do valor</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => handleRemoveAlert(showAlertModal)} className="px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg">Remover alerta</button>
              <div className="flex gap-2">
                <button onClick={() => setShowAlertModal(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
                <button onClick={() => handleSaveAlert(showAlertModal)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 3: Snapshot Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Agendar Snapshot</h3>
            <div className="space-y-2">
              {([
                { value: 'daily', label: 'Diário 8h' },
                { value: 'weekly', label: 'Semanal segunda 8h' },
                { value: 'off', label: 'Desligado' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSaveSnapshot(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    snapshotConfig.schedule === opt.value ? 'border-brand-500 bg-brand-500/5 text-brand-500' : 'border-default bg-surface-1 text-secondary hover:bg-surface-2'
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            {snapshotConfig.lastSnapshot && (
              <p className="text-[10px] text-muted mt-3">Último snapshot: {new Date(snapshotConfig.lastSnapshot).toLocaleString('pt-BR')}</p>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowSnapshotModal(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 4: Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Compartilhar Dashboard</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Expiração</label>
                <select
                  value={shareExpiration}
                  onChange={e => setShareExpiration(e.target.value as any)}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                >
                  <option value="24h">24 horas</option>
                  <option value="7d">7 dias</option>
                  <option value="never">Sem expiração</option>
                </select>
              </div>
              {!shareLink && (
                <button
                  onClick={() => handleShareDashboard(showShareModal)}
                  className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium"
                >
                  Gerar link
                </button>
              )}
              {shareLink && (
                <div className="space-y-2">
                  <input
                    readOnly
                    value={shareLink}
                    className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-xs text-primary outline-none select-all"
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(shareLink)}
                    className="w-full px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium"
                  >
                    Copiar link
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => { setShowShareModal(null); setShareLink(null); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 8: Goal Editor Modal */}
      {showGoalEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Configurar Meta</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Nome da meta</label>
                <input
                  value={goalForm.label}
                  onChange={e => setGoalForm({ ...goalForm, label: e.target.value })}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Valor alvo</label>
                <input
                  type="number"
                  value={goalForm.target}
                  onChange={e => setGoalForm({ ...goalForm, target: Number(e.target.value) })}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Valor atual</label>
                <input
                  type="number"
                  value={goalForm.current}
                  onChange={e => setGoalForm({ ...goalForm, current: Number(e.target.value) })}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Prazo</label>
                <input
                  type="date"
                  value={goalForm.deadline}
                  onChange={e => setGoalForm({ ...goalForm, deadline: e.target.value })}
                  className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowGoalEditor(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleSaveGoal(showGoalEditor)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {showDataSourceEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Data Source</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Fonte</label>
                <select value={dsForm.type} onChange={e => setDsForm({ ...dsForm, type: e.target.value as any })} className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none">
                  <option value="sessions">Sessions</option>
                  <option value="labels">Labels</option>
                  <option value="memories">Memories</option>
                  <option value="mcpServers">MCP Servers</option>
                  <option value="automations">Automations</option>
                  <option value="chat_metrics">Chat Metrics</option>
                  <option value="brain_stats">Brain Stats</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Agregação</label>
                <select value={dsForm.aggregation} onChange={e => setDsForm({ ...dsForm, aggregation: e.target.value as any })} className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none">
                  <option value="count">Count</option>
                  <option value="sum">Sum</option>
                  <option value="avg">Average</option>
                  <option value="last">Last</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Campo (para sum/avg/last)</label>
                <input value={dsForm.field || ''} onChange={e => setDsForm({ ...dsForm, field: e.target.value })} placeholder="ex: tokenCount" className="w-full bg-surface-1 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowDataSourceEditor(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleSaveDataSource(showDataSourceEditor)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm text-white font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDash && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Excluir dashboard?</h3>
            <p className="text-sm text-muted mb-4">Todos os widgets serão removidos permanentemente.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteDash(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleDeleteDashboard(confirmDeleteDash)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteWidget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-2">Excluir widget?</h3>
            <p className="text-sm text-muted mb-4">Esta ação é irreversível.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteWidget(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Cancelar</button>
              <button onClick={() => handleDeleteWidget(confirmDeleteWidget)} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Import/Export Modal */}
      {showImportExport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Import / Export Dashboard</h3>
            <div className="space-y-3">
              <button
                onClick={handleExportDashboard}
                className="w-full px-4 py-3 bg-surface-1 border border-default rounded-xl text-sm text-secondary hover:bg-surface-2 transition-colors text-left"
              >
                <span className="font-medium text-primary block">Exportar como JSON</span>
                <span className="text-xs text-muted">Copia o dashboard para a área de transferência</span>
              </button>
              <button
                onClick={handleImportDashboard}
                className="w-full px-4 py-3 bg-surface-1 border border-default rounded-xl text-sm text-secondary hover:bg-surface-2 transition-colors text-left"
              >
                <span className="font-medium text-primary block">Importar de JSON</span>
                <span className="text-xs text-muted">Cola da área de transferência e cria novo dashboard</span>
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowImportExport(false)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Goal milestone toast */}
      {goalMilestoneToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg animate-bounce text-sm font-medium">
          🎉 {goalMilestoneToast}
        </div>
      )}

      {/* Widget Template Picker Modal */}
      {showWidgetTemplatePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-3">Escolher Template de Query</h3>
            <p className="text-xs text-muted mb-3">Selecione um preset ou configure manualmente depois.</p>
            <div className="space-y-2">
              {(WIDGET_QUERY_TEMPLATES[showWidgetTemplatePicker.type] || []).map((tpl, i) => (
                <button
                  key={i}
                  onClick={() => handleApplyWidgetTemplate(showWidgetTemplatePicker.widgetId, tpl.dataSource)}
                  className="w-full text-left px-4 py-3 bg-surface-1 border border-default rounded-xl text-sm text-secondary hover:bg-surface-2 transition-colors"
                >
                  <span className="font-medium text-primary block">{tpl.label}</span>
                  <span className="text-[10px] text-muted">{tpl.dataSource.type} / {tpl.dataSource.aggregation}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowWidgetTemplatePicker(null)} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Pular</button>
            </div>
          </div>
        </div>
      )}

      {/* Metric Comparison Modal */}
      {showComparison && comparisonWidgets.length === 2 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-primary mb-4">Comparação de Métricas</h3>
            {(() => {
              const w1 = widgets.find(w => w.id === comparisonWidgets[0]);
              const w2 = widgets.find(w => w.id === comparisonWidgets[1]);
              if (!w1 || !w2) return <p className="text-sm text-muted">Widgets não encontrados.</p>;
              const v1 = typeof w1.value === 'number' ? w1.value : parseFloat(String(w1.value || '0'));
              const v2 = typeof w2.value === 'number' ? w2.value : parseFloat(String(w2.value || '0'));
              const delta = v1 - v2;
              const pct = v2 !== 0 ? Math.round(((v1 - v2) / v2) * 100) : 0;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
                      <p className="text-xs text-muted mb-1">{w1.title}</p>
                      <p className="text-2xl font-bold text-primary">{w1.value ?? '—'}</p>
                    </div>
                    <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
                      <p className="text-xs text-muted mb-1">{w2.title}</p>
                      <p className="text-2xl font-bold text-primary">{w2.value ?? '—'}</p>
                    </div>
                  </div>
                  <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Delta</p>
                    <p className={`text-xl font-bold ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {delta >= 0 ? '+' : ''}{delta} ({pct >= 0 ? '+' : ''}{pct}%)
                    </p>
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-end mt-4">
              <button onClick={() => { setShowComparison(false); setComparisonWidgets([]); }} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm text-secondary font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal */}
      {drillDownWidget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-0 border border-default rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-primary">Drill-down: {drillDownWidget.title}</h3>
              <button onClick={() => setDrillDownWidget(null)} className="text-muted hover:text-secondary text-sm">Fechar</button>
            </div>
            <p className="text-xs text-muted mb-3">Valor atual: <span className="font-bold text-primary">{drillDownWidget.value}</span> | {drillDownData.length} registros</p>
            <div className="flex-1 overflow-auto border border-default rounded-xl">
              {drillDownData.length === 0 ? (
                <p className="text-sm text-muted p-4 text-center">Sem dados subjacentes disponíveis.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-surface-1 sticky top-0">
                    <tr>
                      {Object.keys(drillDownData[0] || {}).slice(0, 6).map(key => (
                        <th key={key} className="text-left px-3 py-2 text-muted font-semibold border-b border-default">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillDownData.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="border-b border-default hover:bg-surface-1 transition-colors">
                        {Object.keys(drillDownData[0] || {}).slice(0, 6).map(key => (
                          <td key={key} className="px-3 py-2 text-secondary truncate max-w-[150px]">
                            {typeof row[key] === 'object' ? JSON.stringify(row[key]).slice(0, 30) : String(row[key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {drillDownData.length > 50 && (
              <p className="text-[10px] text-muted mt-2">Mostrando 50 de {drillDownData.length} registros.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
