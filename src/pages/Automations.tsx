import { useState, useEffect, useCallback } from 'react';

const ados = (window as any).ados;

type AutoTab = 'mine' | 'recommended' | 'hooks';
type ScheduleType = 'once' | 'schedule' | 'interval' | 'cron';
type ActionType = 'new_session' | 'send_message' | 'run_skill' | 'apply_label';
type ConditionType = 'always' | 'source_connected' | 'business_hours' | 'label_applied';
type NotifyChannel = 'in-app' | 'telegram' | 'email' | 'slack';

interface Automation {
  id: string;
  name: string;
  description: string;
  schedule: string;
  sources: string[];
  enabled: boolean;
  lastRun: string | null;
  createdAt: string;
  actionType: ActionType;
  skillSlug: string;
  prompt: string;
  workingDir: string;
  scheduleType: ScheduleType;
  scheduleDays: string[];
  scheduleTime: string;
  selectedSkills: string[];
  conditions?: ConditionType;
  chainTo?: string;
  retryCount?: number;
  notifyChannel?: NotifyChannel;
  variables?: Record<string, string>;
  tags?: string[];
  priority?: number;
  executionWindowStart?: string;
  executionWindowEnd?: string;
  consecutiveFailThreshold?: number;
}

interface AutoForm {
  name: string;
  scheduleType: ScheduleType;
  scheduleDays: string[];
  scheduleTime: string;
  actionType: ActionType;
  skillSlug: string;
  prompt: string;
  sources: string[];
  workingDir: string;
  selectedSkills: string[];
  intervalValue: number;
  intervalUnit: 'hours' | 'minutes';
  permissionMode: 'execute' | 'ask' | 'explore';
  osMode: boolean;
  runIfMissed: boolean;
  notifyOnComplete: boolean;
  conditions: ConditionType;
  chainTo: string;
  retryEnabled: boolean;
  retryCount: number;
  notifyChannel: NotifyChannel;
  variables: Record<string, string>;
  tags: string[];
  priority: number;
  executionWindowStart: string;
  executionWindowEnd: string;
  consecutiveFailThreshold: number;
}

interface ExpandedLogEntry {
  id: string;
  autoName: string;
  status: 'ok' | 'error' | 'retry' | 'skip';
  ts: string;
  duration?: number;
  input?: string;
  output?: string;
  errorDetail?: string;
}

const DAYS = [
  { key: 'dom', label: 'Dom' },
  { key: 'seg', label: 'Seg' },
  { key: 'ter', label: 'Ter' },
  { key: 'qua', label: 'Qua' },
  { key: 'qui', label: 'Qui' },
  { key: 'sex', label: 'Sex' },
  { key: 'sab', label: 'Sáb' },
];

const DAY_PRESETS = [
  { label: 'Todos os dias', days: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] },
  { label: 'Dias úteis', days: ['seg', 'ter', 'qua', 'qui', 'sex'] },
  { label: 'Fins de semana', days: ['dom', 'sab'] },
];

const recommended = [
  { name: 'Briefing da manhã', description: 'Comece o dia com agenda, prioridades e mensagens importantes.', schedule: 'Dias úteis às 08:00', sources: ['Slack', 'Gmail'], skillSlug: 'daily-checkpoint', prompt: 'Faça um briefing da manhã com highlights e prioridades.' },
  { name: 'Checkpoint Diário', description: 'Feche o dia com progresso, bloqueios e próximos passos.', schedule: 'Dias úteis às 18:00', sources: ['Slack'], skillSlug: 'session-checkpoint', prompt: 'Faça um checkpoint diário com highlights, bloqueios e próximos passos.' },
  { name: 'Resumo do Slack', description: 'Digest dos canais mais importantes das últimas 24h.', schedule: 'Todos os dias às 09:00', sources: ['Slack'], skillSlug: 'slack-daily-digest', prompt: '' },
  { name: 'Resumo de Emails', description: 'Resumo de emails recentes por remetente e prioridade.', schedule: 'Dias úteis às 08:30', sources: ['Gmail'], skillSlug: '', prompt: 'Resuma os emails das últimas 12h, agrupe por remetente, destaque ações necessárias.' },
  { name: 'Health Check Semanal', description: 'Verifica skills, fontes e agendamentos toda segunda.', schedule: 'Seg às 09:00', sources: [], skillSlug: 'skill-health-check', prompt: '' },
];

const CONDITION_LABELS: Record<ConditionType, string> = {
  always: 'Sempre',
  source_connected: 'Só se fonte conectada',
  business_hours: 'Só se horário comercial (8h-18h)',
  label_applied: 'Quando label for aplicada',
};

const NOTIFY_LABELS: Record<NotifyChannel, string> = {
  'in-app': 'In-app',
  telegram: 'Telegram',
  email: 'Email',
  slack: 'Slack',
};

const PREDEFINED_VARS: Record<string, string> = {
  '{{hoje}}': new Date().toISOString().slice(0, 10),
  '{{workspace}}': 'my-workspace',
  '{{hora}}': new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
};

const defaultForm: AutoForm = {
  name: '',
  scheduleType: 'schedule',
  scheduleDays: ['seg', 'ter', 'qua', 'qui', 'sex'],
  scheduleTime: '08:00',
  actionType: 'new_session',
  skillSlug: '',
  prompt: '',
  sources: [],
  workingDir: '',
  selectedSkills: [],
  intervalValue: 2,
  intervalUnit: 'hours',
  permissionMode: 'execute',
  osMode: false,
  runIfMissed: true,
  notifyOnComplete: true,
  conditions: 'always',
  chainTo: '',
  retryEnabled: false,
  retryCount: 1,
  notifyChannel: 'in-app',
  variables: {},
  tags: [],
  priority: 3,
  executionWindowStart: '',
  executionWindowEnd: '',
  consecutiveFailThreshold: 3,
};

interface Hook {
  id: string;
  name: string;
  trigger: 'pre_message' | 'post_message' | 'pre_tool' | 'post_tool';
  action: string;
  enabled: boolean;
}

export default function Automations() {
  const [tab, setTab] = useState<AutoTab>('mine');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AutoForm>({ ...defaultForm });
  const [availableSources, setAvailableSources] = useState<Array<{ slug: string; name: string; type: string }>>([]);
  const [availableSkills, setAvailableSkills] = useState<Array<{ slug: string; name: string; description: string }>>([]);
  const [sourceSearch, setSourceSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [cronError, setCronError] = useState('');
  const [cronPreview, setCronPreview] = useState('');
  const [dirError, setDirError] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; autoName: string; status: 'ok' | 'error' | 'retry' | 'skip'; ts: string; duration?: number }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{ name: string; preview: string } | null>(null);
  const [conflictWarning, setConflictWarning] = useState('');
  const [globalPaused, setGlobalPaused] = useState(false);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [showHookForm, setShowHookForm] = useState(false);
  const [hookForm, setHookForm] = useState<{ name: string; trigger: Hook['trigger']; action: string }>({ name: '', trigger: 'pre_message', action: '' });
  const [showVariables, setShowVariables] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [executeModal, setExecuteModal] = useState<Automation | null>(null);
  const [executePrompt, setExecutePrompt] = useState('');
  const [executeSkill, setExecuteSkill] = useState('');

  // Feature 1: Tags
  const [tagFilter, setTagFilter] = useState<string>('');
  const [newTag, setNewTag] = useState('');

  // Feature 2: Expanded logs
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Feature 4: Pause by tag
  const [pauseByTagModal, setPauseByTagModal] = useState(false);

  // Feature 7: Consecutive failure alerts
  const [failureAlerts, setFailureAlerts] = useState<Array<{ autoName: string; count: number; ts: string }>>([]);

  // Feature 8: Clone to workspace
  const [cloneModal, setCloneModal] = useState<Automation | null>(null);

  // NEW #2: Drag to reorder
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // NEW #4: Visual cron builder
  const [showCronBuilder, setShowCronBuilder] = useState(false);
  const [cronBuilderHours, setCronBuilderHours] = useState<number[]>([8]);
  const [cronBuilderDays, setCronBuilderDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // NEW #5: Bulk toggle by tag (enable mode)
  const [enableByTagModal, setEnableByTagModal] = useState(false);

  // NEW #7: Variable preview tooltip
  const [varPreviewId, setVarPreviewId] = useState<string | null>(null);

  // NEW #10: History search/filter
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'ok' | 'error' | 'skip'>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // Cross-menu: Label integration
  const [availableLabels, setAvailableLabels] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [formLabelId, setFormLabelId] = useState('');
  const [formTriggerLabelId, setFormTriggerLabelId] = useState('');

  useEffect(() => { loadAutomations(); loadMeta(); loadHistory(); loadGlobalPause(); loadHooks(); loadLabels(); }, []);

  // Listen for label:applied events to trigger automations with label_applied condition
  useEffect(() => {
    const handler = (e: Event) => {
      const { labelId, sessionId } = (e as CustomEvent).detail;
      // Find automations with label_applied condition matching this label
      automations.filter(a => a.enabled && a.conditions === 'label_applied').forEach(auto => {
        // Check if the automation targets this label (stored in variables)
        if (auto.variables?.triggerLabelId === labelId) {
          // Execute: apply label action or run the configured action
          if (auto.actionType === 'apply_label' && auto.variables?.targetLabelId) {
            (async () => {
              try {
                const sessions = await ados.db.getSessions?.() || [];
                const session = sessions.find((s: any) => s.id === sessionId);
                const existing = session?.labels || [];
                if (!existing.includes(auto.variables!.targetLabelId)) {
                  await ados.db.updateSession(sessionId, { labels: [...existing, auto.variables!.targetLabelId] });
                }
              } catch {}
            })();
          }
        }
      });
    };
    window.addEventListener('label:applied', handler);
    return () => window.removeEventListener('label:applied', handler);
  }, [automations]);

  const loadLabels = async () => {
    try {
      const rows = await ados.db.getLabels?.() || [];
      setAvailableLabels(rows.map((l: any) => ({ id: l.id, name: l.name, color: l.color })));
    } catch { setAvailableLabels([]); }
  };

  const loadAutomations = async () => {
    try {
      const rows = await ados.db.getAutomations();
      setAutomations(rows);
    } catch {
      // Fallback to localStorage
      const saved = localStorage.getItem('ados-automations');
      if (saved) setAutomations(JSON.parse(saved));
    }
  };

  const saveAutomationsLocal = (autos: Automation[]) => {
    localStorage.setItem('ados-automations', JSON.stringify(autos));
  };

  const loadMeta = async () => {
    try {
      const servers = await ados.mcp.listServers();
      setAvailableSources(servers.map((s: any) => ({ slug: s.name, name: s.displayName || s.name, type: s.type || 'mcp' })));
    } catch { setAvailableSources([]); }
    try {
      const skills = await ados.db.getSkills();
      setAvailableSkills(skills.map((s: any) => ({ slug: s.slug, name: s.name, description: s.description || '' })));
    } catch { setAvailableSkills([]); }
  };

  const loadHistory = async () => {
    try {
      const rows = await ados.db.getAutomationHistory?.() || [];
      setHistory(rows.slice(0, 50));
    } catch {
      const saved = localStorage.getItem('ados-automation-history');
      if (saved) setHistory(JSON.parse(saved));
      else setHistory([]);
    }
  };

  const loadGlobalPause = async () => {
    try {
      const paused = await ados.db.getSetting?.('automations_global_pause');
      setGlobalPaused(paused === 'true');
    } catch {
      setGlobalPaused(localStorage.getItem('ados-global-pause') === 'true');
    }
  };

  const loadHooks = () => {
    try {
      const saved = localStorage.getItem('ados-hooks');
      if (saved) setHooks(JSON.parse(saved));
    } catch {}
  };

  const saveHooks = (updated: Hook[]) => {
    setHooks(updated);
    localStorage.setItem('ados-hooks', JSON.stringify(updated));
  };

  const handleAddHook = () => {
    if (!hookForm.name.trim() || !hookForm.action.trim()) return;
    const newHook: Hook = { id: crypto.randomUUID(), name: hookForm.name, trigger: hookForm.trigger, action: hookForm.action, enabled: true };
    saveHooks([...hooks, newHook]);
    setHookForm({ name: '', trigger: 'pre_message', action: '' });
    setShowHookForm(false);
  };

  const handleToggleHook = (id: string) => {
    saveHooks(hooks.map(h => h.id === id ? { ...h, enabled: !h.enabled } : h));
  };

  const handleDeleteHook = (id: string) => {
    saveHooks(hooks.filter(h => h.id !== id));
  };

  const handleGlobalPauseToggle = async () => {
    const next = !globalPaused;
    setGlobalPaused(next);
    try {
      await ados.db.setSetting?.('automations_global_pause', String(next));
    } catch {
      localStorage.setItem('ados-global-pause', String(next));
    }
    if (next) {
      for (const auto of automations.filter(a => a.enabled)) {
        try { await ados.db.toggleAutomation(auto.id, false); } catch {}
      }
      loadAutomations();
    }
  };

  const handleDryRun = async (auto: Automation) => {
    const preview = `Skill: ${auto.skillSlug || 'nenhuma'}\nPrompt: ${auto.prompt || '(vazio)'}\nSources: ${auto.sources.join(', ') || 'nenhuma'}\nModo: ${auto.actionType}\nCondição: ${CONDITION_LABELS[auto.conditions || 'always']}\nRetry: ${auto.retryCount ? auto.retryCount + 'x' : 'desabilitado'}\nNotificação: ${NOTIFY_LABELS[auto.notifyChannel || 'in-app']}\nVariáveis: ${auto.variables ? Object.keys(auto.variables).length : 0}`;
    setDryRunResult({ name: auto.name, preview });
  };

  const checkConflicts = (time: string, days: string[]): string => {
    const conflicts = automations.filter(a =>
      a.scheduleTime === time && a.scheduleDays?.some(d => days.includes(d))
    );
    if (conflicts.length > 0) {
      return `⚠️ Conflito com "${conflicts[0].name}" no mesmo horário`;
    }
    return '';
  };

  const validateCron = (expr: string): boolean => {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5 || parts.length > 6) return false;
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    for (let i = 0; i < 5; i++) {
      const p = parts[i];
      if (p === '*' || /^\*\/\d+$/.test(p)) continue;
      const values = p.split(',');
      for (const v of values) {
        const rangeMatch = v.match(/^(\d+)(?:-(\d+))?(?:\/(\d+))?$/);
        if (!rangeMatch) return false;
        const num = parseInt(rangeMatch[1]);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : num;
        if (num < ranges[i][0] || num > ranges[i][1]) return false;
        if (end < ranges[i][0] || end > ranges[i][1]) return false;
      }
    }
    return true;
  };

  const getNextExecution = (auto: Automation): string => {
    const now = new Date();
    if (auto.scheduleType === 'interval') return 'A cada intervalo';
    if (!auto.scheduleTime) return '—';
    const [h, m] = auto.scheduleTime.split(':').map(Number);
    const days = auto.scheduleDays || [];
    const dayMap: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
    for (let d = 0; d < 7; d++) {
      const target = new Date(now);
      target.setDate(target.getDate() + d);
      target.setHours(h, m, 0, 0);
      const dayKey = Object.entries(dayMap).find(([_, v]) => v === target.getDay())?.[0];
      if (target > now && (days.length === 0 || (dayKey && days.includes(dayKey)))) {
        const isToday = d === 0;
        const isTomorrow = d === 1;
        if (isToday) return `Hoje ${auto.scheduleTime}`;
        if (isTomorrow) return `Amanhã ${auto.scheduleTime}`;
        return `${target.toLocaleDateString('pt-BR', { weekday: 'short' })} ${auto.scheduleTime}`;
      }
    }
    return auto.schedule;
  };

  const buildScheduleString = (f: AutoForm): string => {
    if (f.scheduleType === 'once') return `Uma vez às ${f.scheduleTime}`;
    const dayLabels = f.scheduleDays.length === 7 ? 'Todos os dias'
      : f.scheduleDays.length === 5 && !f.scheduleDays.includes('dom') && !f.scheduleDays.includes('sab') ? 'Dias úteis'
      : f.scheduleDays.map(d => DAYS.find(dd => dd.key === d)?.label).join('/');
    return `${dayLabels} às ${f.scheduleTime}`;
  };

  const handleDuplicate = (auto: Automation) => {
    setForm({
      ...defaultForm,
      name: `${auto.name} (cópia)`,
      scheduleType: auto.scheduleType || 'schedule',
      scheduleDays: auto.scheduleDays || ['seg', 'ter', 'qua', 'qui', 'sex'],
      scheduleTime: auto.scheduleTime || '08:00',
      actionType: auto.actionType || 'new_session',
      skillSlug: auto.skillSlug || '',
      prompt: auto.prompt || '',
      sources: auto.sources || [],
      workingDir: auto.workingDir || '',
      selectedSkills: auto.selectedSkills || [],
      conditions: auto.conditions || 'always',
      chainTo: auto.chainTo || '',
      retryEnabled: (auto.retryCount || 0) > 0,
      retryCount: auto.retryCount || 1,
      notifyChannel: auto.notifyChannel || 'in-app',
      variables: auto.variables || {},
      tags: auto.tags || [],
      priority: auto.priority || 3,
      executionWindowStart: auto.executionWindowStart || '',
      executionWindowEnd: auto.executionWindowEnd || '',
      consecutiveFailThreshold: auto.consecutiveFailThreshold || 3,
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (auto: Automation) => {
    setForm({
      ...defaultForm,
      name: auto.name,
      scheduleType: auto.scheduleType || 'schedule',
      scheduleDays: auto.scheduleDays || ['seg', 'ter', 'qua', 'qui', 'sex'],
      scheduleTime: auto.scheduleTime || '08:00',
      actionType: auto.actionType || 'new_session',
      skillSlug: auto.skillSlug || '',
      prompt: auto.prompt || '',
      sources: auto.sources || [],
      workingDir: auto.workingDir || '',
      selectedSkills: auto.selectedSkills || [],
      conditions: auto.conditions || 'always',
      chainTo: auto.chainTo || '',
      retryEnabled: (auto.retryCount || 0) > 0,
      retryCount: auto.retryCount || 1,
      notifyChannel: auto.notifyChannel || 'in-app',
      variables: auto.variables || {},
      tags: auto.tags || [],
      priority: auto.priority || 3,
      executionWindowStart: auto.executionWindowStart || '',
      executionWindowEnd: auto.executionWindowEnd || '',
      consecutiveFailThreshold: auto.consecutiveFailThreshold || 3,
    });
    setEditingId(auto.id);
    // Restore label integration fields from variables
    const vars = auto.variables || {};
    setFormLabelId(vars.targetLabelId || '');
    setFormTriggerLabelId(vars.triggerLabelId || '');
    setShowForm(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    if (form.workingDir && !/^(\/|[A-Za-z]:\\|~\/)/.test(form.workingDir)) {
      setDirError('Caminho inválido. Use path absoluto (ex: /home/user/project)');
      return;
    }
    setDirError('');
    if (form.scheduleType === 'cron' && cronError) return;
    const schedule = buildScheduleString(form);
    // Inject label integration variables
    const savedVariables = { ...form.variables };
    if (form.actionType === 'apply_label' && formLabelId) savedVariables.targetLabelId = formLabelId;
    if (form.conditions === 'label_applied' && formTriggerLabelId) savedVariables.triggerLabelId = formTriggerLabelId;
    const extra = {
      action_type: form.actionType,
      skill_slug: form.skillSlug,
      prompt: form.prompt,
      working_dir: form.workingDir,
      schedule_type: form.scheduleType,
      schedule_days: JSON.stringify(form.scheduleDays),
      schedule_time: form.scheduleTime,
      selected_skills: JSON.stringify(form.selectedSkills),
      conditions: form.conditions,
      chain_to: form.chainTo,
      retry_count: form.retryEnabled ? form.retryCount : 0,
      notify_channel: form.notifyChannel,
      variables: JSON.stringify(savedVariables),
      tags: JSON.stringify(form.tags),
      priority: form.priority,
      execution_window_start: form.executionWindowStart,
      execution_window_end: form.executionWindowEnd,
      consecutive_fail_threshold: form.consecutiveFailThreshold,
    };
    try {
      if (editingId) {
        await ados.db.updateAutomation(editingId, form.name, '', schedule, JSON.stringify(form.sources), extra);
      } else {
        const id = crypto.randomUUID();
        await ados.db.addAutomation(id, form.name, '', schedule, JSON.stringify(form.sources), extra);
      }
    } catch {
      if (!editingId) {
        const id = crypto.randomUUID();
        const newAuto: Automation = {
          id,
          name: form.name,
          description: '',
          schedule,
          sources: form.sources,
          enabled: false,
          lastRun: null,
          createdAt: new Date().toISOString(),
          actionType: form.actionType,
          skillSlug: form.skillSlug,
          prompt: form.prompt,
          workingDir: form.workingDir,
          scheduleType: form.scheduleType,
          scheduleDays: form.scheduleDays,
          scheduleTime: form.scheduleTime,
          selectedSkills: form.selectedSkills,
          conditions: form.conditions,
          chainTo: form.chainTo,
          retryCount: form.retryEnabled ? form.retryCount : 0,
          notifyChannel: form.notifyChannel,
          variables: form.variables,
          tags: form.tags,
          priority: form.priority,
          executionWindowStart: form.executionWindowStart,
          executionWindowEnd: form.executionWindowEnd,
          consecutiveFailThreshold: form.consecutiveFailThreshold,
        };
        const updated = [...automations, newAuto];
        setAutomations(updated);
        saveAutomationsLocal(updated);
      }
    }
    setForm({ ...defaultForm });
    setEditingId(null);
    setShowForm(false);
    loadAutomations();
  };

  const handleActivateRecommended = async (rec: typeof recommended[0]) => {
    const id = crypto.randomUUID();
    try {
      await ados.db.addAutomation(id, rec.name, rec.description, rec.schedule, JSON.stringify(rec.sources), {
        action_type: 'new_session',
        skill_slug: rec.skillSlug,
        prompt: rec.prompt,
        schedule_type: 'schedule',
        schedule_days: JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex']),
        schedule_time: '08:00',
        selected_skills: '[]',
      });
      await ados.db.toggleAutomation(id, true);
    } catch {}
    loadAutomations();
    setTab('mine');
  };

  const handleToggle = async (auto: Automation) => {
    try {
      await ados.db.toggleAutomation(auto.id, !auto.enabled);
    } catch {
      const updated = automations.map(a => a.id === auto.id ? { ...a, enabled: !a.enabled } : a);
      setAutomations(updated);
      saveAutomationsLocal(updated);
    }
    loadAutomations();
  };

  const handleDelete = async (id: string) => {
    try {
      await ados.db.deleteAutomation(id);
    } catch {
      const updated = automations.filter(a => a.id !== id);
      setAutomations(updated);
      saveAutomationsLocal(updated);
    }
    setConfirmDelete(null);
    loadAutomations();
  };

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      scheduleDays: f.scheduleDays.includes(day)
        ? f.scheduleDays.filter(d => d !== day)
        : [...f.scheduleDays, day],
    }));
  };

  const applyDayPreset = (days: string[]) => {
    setForm(f => ({ ...f, scheduleDays: days }));
  };

  const toggleSource = (slug: string) => {
    setForm(f => ({
      ...f,
      sources: f.sources.includes(slug)
        ? f.sources.filter(s => s !== slug)
        : [...f.sources, slug],
    }));
  };

  const toggleSkill = (slug: string) => {
    setForm(f => ({
      ...f,
      selectedSkills: f.selectedSkills.includes(slug)
        ? f.selectedSkills.filter(s => s !== slug)
        : [...f.selectedSkills, slug],
    }));
  };

  const filteredSources = availableSources.filter(s =>
    !sourceSearch || s.name.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const filteredSkills = availableSkills.filter(s =>
    !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase()) || s.slug.includes(skillSearch.toLowerCase())
  );

  // Feature 6: Import/Export
  const handleExport = async () => {
    const exportData = automations.map(({ id, createdAt, lastRun, enabled, ...rest }) => rest);
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      alert('Automações exportadas para a área de transferência!');
    } catch {
      // Fallback: create download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'automations-export.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        alert('Formato inválido. Esperado: array de automações.');
        return;
      }
      const existingNames = new Set(automations.map(a => a.name));
      const newOnes = parsed.filter((item: any) => item.name && !existingNames.has(item.name));
      if (newOnes.length === 0) {
        alert('Nenhuma automação nova para importar (todas já existem ou formato inválido).');
        return;
      }
      for (const item of newOnes) {
        const id = crypto.randomUUID();
        const newAuto: Automation = {
          id,
          name: item.name || 'Sem nome',
          description: item.description || '',
          schedule: item.schedule || '',
          sources: item.sources || [],
          enabled: false,
          lastRun: null,
          createdAt: new Date().toISOString(),
          actionType: item.actionType || 'new_session',
          skillSlug: item.skillSlug || '',
          prompt: item.prompt || '',
          workingDir: item.workingDir || '',
          scheduleType: item.scheduleType || 'schedule',
          scheduleDays: item.scheduleDays || [],
          scheduleTime: item.scheduleTime || '08:00',
          selectedSkills: item.selectedSkills || [],
          conditions: item.conditions || 'always',
          chainTo: item.chainTo || '',
          retryCount: item.retryCount || 0,
          notifyChannel: item.notifyChannel || 'in-app',
          variables: item.variables || {},
        };
        try {
          await ados.db.addAutomation(id, newAuto.name, newAuto.description, newAuto.schedule, JSON.stringify(newAuto.sources), {
            action_type: newAuto.actionType,
            skill_slug: newAuto.skillSlug,
            prompt: newAuto.prompt,
            working_dir: newAuto.workingDir,
            schedule_type: newAuto.scheduleType,
            schedule_days: JSON.stringify(newAuto.scheduleDays),
            schedule_time: newAuto.scheduleTime,
            selected_skills: JSON.stringify(newAuto.selectedSkills),
            conditions: newAuto.conditions,
            chain_to: newAuto.chainTo,
            retry_count: newAuto.retryCount,
            notify_channel: newAuto.notifyChannel,
            variables: JSON.stringify(newAuto.variables),
          });
        } catch {
          const updated = [...automations, newAuto];
          setAutomations(updated);
          saveAutomationsLocal(updated);
        }
      }
      alert(`${newOnes.length} automação(ões) importada(s) com sucesso!`);
      loadAutomations();
    } catch (err) {
      alert('Erro ao importar. Verifique se a área de transferência contém JSON válido.');
    }
  };

  // Feature 8: Execute manual with override
  const handleExecuteNow = (auto: Automation) => {
    setExecutePrompt(auto.prompt || '');
    setExecuteSkill(auto.skillSlug || '');
    setExecuteModal(auto);
  };

  const handleConfirmExecution = async () => {
    if (!executeModal) return;
    const historyEntry = {
      id: crypto.randomUUID(),
      autoName: executeModal.name,
      status: 'ok' as const,
      ts: new Date().toISOString(),
      duration: 0,
    };
    // Record execution in history
    const updatedHistory = [historyEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('ados-automation-history', JSON.stringify(updatedHistory));

    // Attempt actual execution
    try {
      if (executeSkill) {
        await ados.session?.runSkill?.(executeSkill, { prompt: executePrompt });
      } else if (executePrompt) {
        await ados.session?.sendMessage?.(executePrompt);
      }
    } catch {}
    setExecuteModal(null);
  };

  // Feature 5: Get last 7 execution dots for an automation
  const getExecutionDots = (autoName: string): Array<'ok' | 'error' | 'skip'> => {
    const entries = history
      .filter(h => h.autoName === autoName)
      .slice(0, 7)
      .reverse();
    const dots: Array<'ok' | 'error' | 'skip'> = [];
    for (let i = 0; i < 7; i++) {
      if (entries[i]) {
        dots.push(entries[i].status === 'ok' ? 'ok' : entries[i].status === 'error' ? 'error' : 'skip');
      } else {
        dots.push('skip');
      }
    }
    return dots;
  };

  // Feature 1: Get all unique tags across automations
  const allTags = useCallback((): string[] => {
    const tagSet = new Set<string>();
    automations.forEach(a => (a.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [automations]);

  // Feature 1: Add tag to form
  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    if (!form.tags.includes(tag)) {
      setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  // Feature 4: Pause all automations by tag
  const handlePauseByTag = async (tag: string) => {
    const taggedAutos = automations.filter(a => (a.tags || []).includes(tag) && a.enabled);
    for (const auto of taggedAutos) {
      try {
        await ados.db?.toggleAutomation(auto.id, false);
      } catch {
        const updated = automations.map(a => a.id === auto.id ? { ...a, enabled: false } : a);
        setAutomations(updated);
        saveAutomationsLocal(updated);
      }
    }
    loadAutomations();
    setPauseByTagModal(false);
  };

  // Feature 6: Global statistics
  const globalStats = useCallback(() => {
    const total = history.length;
    const successes = history.filter(h => h.status === 'ok').length;
    const successRate = total > 0 ? Math.round((successes / total) * 100) : 0;
    const withDuration = history.filter(h => h.duration && h.duration > 0);
    const avgDuration = withDuration.length > 0
      ? Math.round(withDuration.reduce((acc, h) => acc + (h.duration || 0), 0) / withDuration.length)
      : 0;
    return { total, successRate, avgDuration };
  }, [history]);

  // Feature 7: Check consecutive failures and generate alerts
  const checkConsecutiveFailures = useCallback(() => {
    const alerts: Array<{ autoName: string; count: number; ts: string }> = [];
    const autoNames = new Set(automations.map(a => a.name));
    autoNames.forEach(name => {
      const auto = automations.find(a => a.name === name);
      const threshold = auto?.consecutiveFailThreshold || 3;
      const entries = history.filter(h => h.autoName === name);
      let consecutiveFails = 0;
      for (const entry of entries) {
        if (entry.status === 'error') consecutiveFails++;
        else break;
      }
      if (consecutiveFails >= threshold) {
        alerts.push({ autoName: name, count: consecutiveFails, ts: entries[0]?.ts || '' });
      }
    });
    setFailureAlerts(alerts);
  }, [history, automations]);

  useEffect(() => { checkConsecutiveFailures(); }, [history, automations, checkConsecutiveFailures]);

  // NEW #1: Execution timeline SVG bar chart data
  const getExecutionTimeline = useCallback((autoName: string): Array<{ status: 'ok' | 'error' | 'skip'; duration: number }> => {
    const entries = history.filter(h => h.autoName === autoName).slice(0, 7).reverse();
    const result: Array<{ status: 'ok' | 'error' | 'skip'; duration: number }> = [];
    for (let i = 0; i < 7; i++) {
      if (entries[i]) {
        result.push({ status: entries[i].status === 'ok' ? 'ok' : entries[i].status === 'error' ? 'error' : 'skip', duration: entries[i].duration || 0 });
      } else {
        result.push({ status: 'skip', duration: 0 });
      }
    }
    return result;
  }, [history]);

  // NEW #2: Drag to reorder handlers
  const handleDragStart = useCallback((id: string) => { setDraggedId(id); }, []);
  const handleDragOver = useCallback((id: string) => { setDragOverId(id); }, []);
  const handleDrop = useCallback(async (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const items = [...automations];
    const fromIdx = items.findIndex(a => a.id === draggedId);
    const toIdx = items.findIndex(a => a.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggedId(null); setDragOverId(null); return; }
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    // Update priorities based on new order
    const updated = items.map((a, i) => ({ ...a, priority: i + 1 }));
    setAutomations(updated);
    saveAutomationsLocal(updated);
    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, automations]);

  // NEW #3: Schedule conflict suggestion (find next available slot)
  const getSuggestedTime = useCallback((time: string, days: string[]): string | null => {
    const conflicts = automations.filter(a =>
      a.scheduleTime === time && a.scheduleDays?.some(d => days.includes(d))
    );
    if (conflicts.length === 0) return null;
    // Suggest 30 minutes later
    const [h, m] = time.split(':').map(Number);
    const newMinutes = m + 30;
    const newHour = h + Math.floor(newMinutes / 60);
    const finalMinutes = newMinutes % 60;
    if (newHour >= 24) return null;
    return `${String(newHour).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  }, [automations]);

  // NEW #4: Visual cron builder -> generate cron expression
  const buildCronFromVisual = useCallback((): string => {
    const hours = cronBuilderHours.length > 0 ? cronBuilderHours.join(',') : '8';
    const days = cronBuilderDays.length > 0 ? cronBuilderDays.join(',') : '*';
    return `0 ${hours} * * ${days}`;
  }, [cronBuilderHours, cronBuilderDays]);

  // NEW #5: Enable all automations by tag
  const handleEnableByTag = useCallback(async (tag: string) => {
    const taggedAutos = automations.filter(a => (a.tags || []).includes(tag) && !a.enabled);
    for (const auto of taggedAutos) {
      try { await ados.db?.toggleAutomation(auto.id, true); } catch {
        const updated = automations.map(a => a.id === auto.id ? { ...a, enabled: true } : a);
        setAutomations(updated);
        saveAutomationsLocal(updated);
      }
    }
    loadAutomations();
    setEnableByTagModal(false);
  }, [automations]);

  // NEW #6: Get average duration for an automation
  const getAvgDuration = useCallback((autoName: string): number => {
    const entries = history.filter(h => h.autoName === autoName && h.duration && h.duration > 0);
    if (entries.length === 0) return 0;
    return entries.reduce((acc, h) => acc + (h.duration || 0), 0) / entries.length;
  }, [history]);

  // NEW #7: Expand variables in prompt for preview
  const expandVariables = useCallback((prompt: string, variables: Record<string, string>): string => {
    let result = prompt;
    for (const [key, val] of Object.entries(variables)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
    }
    // Also expand predefined
    for (const [key, val] of Object.entries(PREDEFINED_VARS)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), val);
    }
    return result;
  }, []);

  // NEW #10: Filtered history
  const filteredHistory = useCallback(() => {
    return history.filter(h => {
      if (historySearch && !h.autoName.toLowerCase().includes(historySearch.toLowerCase())) return false;
      if (historyStatusFilter !== 'all' && h.status !== historyStatusFilter) return false;
      if (historyDateFrom && new Date(h.ts) < new Date(historyDateFrom)) return false;
      if (historyDateTo && new Date(h.ts) > new Date(historyDateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [history, historySearch, historyStatusFilter, historyDateFrom, historyDateTo]);

  // Feature 8: Clone automation as JSON for another workspace
  const handleCloneToWorkspace = (auto: Automation) => {
    setCloneModal(auto);
  };

  const handleExportClone = async (auto: Automation) => {
    const exportData = {
      name: auto.name,
      description: auto.description,
      schedule: auto.schedule,
      sources: auto.sources,
      actionType: auto.actionType,
      skillSlug: auto.skillSlug,
      prompt: auto.prompt,
      workingDir: '',
      scheduleType: auto.scheduleType,
      scheduleDays: auto.scheduleDays,
      scheduleTime: auto.scheduleTime,
      selectedSkills: auto.selectedSkills,
      conditions: auto.conditions,
      chainTo: '',
      retryCount: auto.retryCount,
      notifyChannel: auto.notifyChannel,
      variables: auto.variables,
      tags: auto.tags,
      priority: auto.priority,
      executionWindowStart: auto.executionWindowStart,
      executionWindowEnd: auto.executionWindowEnd,
      consecutiveFailThreshold: auto.consecutiveFailThreshold,
      _exportedAt: new Date().toISOString(),
      _exportedFrom: 'current-workspace',
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      alert(`Automação "${auto.name}" copiada para a área de transferência! Cole em outro workspace para importar.`);
    } catch {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `automation-${auto.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setCloneModal(null);
  };

  // Feature 1: Filtered automations by tag
  const filteredAutomations = tagFilter
    ? automations.filter(a => (a.tags || []).includes(tagFilter))
    : automations;

  // Feature 3: Sort by priority (lower number = higher priority)
  const sortedAutomations = [...filteredAutomations].sort((a, b) => (a.priority || 3) - (b.priority || 3));

  // Feature 7: Add variable to form
  const handleAddVariable = () => {
    if (!newVarKey.trim()) return;
    setForm(f => ({ ...f, variables: { ...f.variables, [newVarKey.trim()]: newVarValue } }));
    setNewVarKey('');
    setNewVarValue('');
  };

  const handleRemoveVariable = (key: string) => {
    setForm(f => {
      const vars = { ...f.variables };
      delete vars[key];
      return { ...f, variables: vars };
    });
  };

  // === FORM VIEW ===
  if (showForm) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
        <div className="shrink-0 px-8 pt-6 pb-4 flex items-center justify-between border-b border-default">
          <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Voltar
          </button>
          <span className="text-sm font-semibold text-primary">{editingId ? 'Editar Automação' : 'Nova Automação'}</span>
          <button
            onClick={handleCreate}
            disabled={!form.name.trim()}
            className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white transition-colors"
          >
            Criar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* DETALHES */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Detalhes</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Nome</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Briefing da manhã"
                  className="w-full bg-surface-1 border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Agenda</label>
                <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-4">
                  {/* Schedule type tabs */}
                  <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5 w-fit">
                    {(['once', 'schedule', 'interval', 'cron'] as ScheduleType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setForm({ ...form, scheduleType: t })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          form.scheduleType === t ? 'bg-surface-0 text-primary shadow-sm' : 'text-muted hover:text-secondary'
                        }`}
                      >
                        {t === 'once' ? 'Uma vez' : t === 'schedule' ? 'Agenda' : t === 'interval' ? 'Intervalo' : 'Avançado'}
                      </button>
                    ))}
                  </div>

                  {form.scheduleType === 'schedule' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          Agenda
                        </div>
                        <input
                          type="time"
                          value={form.scheduleTime}
                          onChange={e => { setForm({ ...form, scheduleTime: e.target.value }); setConflictWarning(checkConflicts(e.target.value, form.scheduleDays)); }}
                          className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                        />
                      </div>
                      {conflictWarning && <p className="text-[10px] text-yellow-500">{conflictWarning}</p>}
                      {/* NEW #3: Schedule conflict suggestion */}
                      {conflictWarning && getSuggestedTime(form.scheduleTime, form.scheduleDays) && (
                        <button
                          onClick={() => setForm({ ...form, scheduleTime: getSuggestedTime(form.scheduleTime, form.scheduleDays)! })}
                          className="text-[10px] text-brand-500 hover:underline"
                        >
                          Horario disponivel: {getSuggestedTime(form.scheduleTime, form.scheduleDays)}
                        </button>
                      )}

                      {/* Day buttons */}
                      <div className="flex gap-1.5">
                        {DAYS.map(d => (
                          <button
                            key={d.key}
                            onClick={() => toggleDay(d.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              form.scheduleDays.includes(d.key)
                                ? 'bg-brand-600 text-white'
                                : 'bg-surface-2 text-muted hover:text-secondary'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>

                      {/* Presets */}
                      <div className="flex gap-2">
                        {DAY_PRESETS.map(p => (
                          <button
                            key={p.label}
                            onClick={() => applyDayPreset(p.days)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                              JSON.stringify(form.scheduleDays.sort()) === JSON.stringify(p.days.sort())
                                ? 'bg-surface-0 text-primary border border-default'
                                : 'text-muted hover:text-secondary'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Summary */}
                      <div className="flex items-center gap-2 text-[11px] text-muted pt-1 border-t border-default">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        Resumo: {buildScheduleString(form)}
                      </div>
                    </div>
                  )}

                  {form.scheduleType === 'once' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={form.scheduleTime}
                        onChange={e => setForm({ ...form, scheduleTime: e.target.value })}
                        className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                      />
                      <span className="text-xs text-muted">Executa uma vez e desativa.</span>
                    </div>
                  )}

                  {form.scheduleType === 'interval' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">A cada</span>
                        <input
                          type="number"
                          min="1"
                          value={form.intervalValue}
                          onChange={e => setForm({ ...form, intervalValue: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-16 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none text-center"
                        />
                        <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
                          <button
                            onClick={() => setForm({ ...form, intervalUnit: 'hours' })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              form.intervalUnit === 'hours' ? 'bg-surface-0 text-primary shadow-sm' : 'text-muted'
                            }`}
                          >Horas</button>
                          <button
                            onClick={() => setForm({ ...form, intervalUnit: 'minutes' })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              form.intervalUnit === 'minutes' ? 'bg-surface-0 text-primary shadow-sm' : 'text-muted'
                            }`}
                          >Minutos</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted pt-1 border-t border-default">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        Resumo: A cada {form.intervalValue} {form.intervalUnit === 'hours' ? 'horas' : 'minutos'}
                      </div>
                    </div>
                  )}

                  {form.scheduleType === 'cron' && (
                    <div className="space-y-3">
                      <input
                        placeholder="0 8 * * 1-5"
                        value={cronPreview}
                        onChange={e => {
                          const v = e.target.value;
                          setCronPreview(v);
                          if (!v.trim()) { setCronError(''); return; }
                          if (validateCron(v)) {
                            setCronError('');
                          } else {
                            setCronError('Expressão cron inválida. Formato: minuto hora dia mês dia-semana');
                          }
                        }}
                        className={`w-full bg-surface-0 border rounded-lg px-3 py-2 text-sm text-primary font-mono placeholder-muted outline-none ${cronError ? 'border-red-500' : 'border-default'}`}
                      />
                      {cronError ? (
                        <p className="text-[10px] text-red-500 mt-1">{cronError}</p>
                      ) : cronPreview.trim() && validateCron(cronPreview) ? (
                        <p className="text-[10px] text-green-500 mt-1">✓ Expressão válida — Ex: {cronPreview.startsWith('0 8') ? 'Todos os dias às 08:00' : 'Custom schedule'}</p>
                      ) : (
                        <p className="text-[10px] text-muted mt-1">Formato cron: minuto hora dia mês dia-semana (ex: 0 8 * * 1-5 = dias úteis 08h)</p>
                      )}
                      {/* NEW #4: Visual cron builder */}
                      <button
                        onClick={() => setShowCronBuilder(!showCronBuilder)}
                        className="text-[10px] text-brand-500 hover:underline"
                      >
                        {showCronBuilder ? 'Fechar' : 'Abrir'} editor visual
                      </button>
                      {showCronBuilder && (
                        <div className="bg-surface-0 border border-default rounded-lg p-3 space-y-3">
                          <div>
                            <p className="text-[10px] text-muted mb-1.5 font-medium">Horas (clique para selecionar):</p>
                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                <button
                                  key={h}
                                  onClick={() => setCronBuilderHours(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h].sort((a, b) => a - b))}
                                  className={`w-7 h-7 rounded text-[10px] font-mono transition-colors ${cronBuilderHours.includes(h) ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-secondary'}`}
                                >
                                  {String(h).padStart(2, '0')}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted mb-1.5 font-medium">Dias da semana:</p>
                            <div className="flex gap-1">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d, i) => (
                                <button
                                  key={i}
                                  onClick={() => setCronBuilderDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b))}
                                  className={`px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors ${cronBuilderDays.includes(i) ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-secondary'}`}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-default">
                            <span className="text-[10px] text-muted font-mono">{buildCronFromVisual()}</span>
                            <button
                              onClick={() => { setCronPreview(buildCronFromVisual()); setCronError(''); setShowCronBuilder(false); }}
                              className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 rounded text-[10px] text-white font-medium"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* TAGS (Feature 1) */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Tags / Categorias</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Adicione tags para organizar e filtrar automações.</p>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-1 bg-brand-600/10 text-brand-500 rounded-full flex items-center gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 ml-0.5">x</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Nova tag (ex: relatórios, slack, diário)"
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium"
                >
                  +
                </button>
              </div>
              {allTags().length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-muted mr-1">Existentes:</span>
                  {allTags().filter(t => !form.tags.includes(t)).map(tag => (
                    <button
                      key={tag}
                      onClick={() => setForm(f => ({ ...f, tags: [...f.tags, tag] }))}
                      className="text-[10px] px-2 py-0.5 bg-surface-2 text-muted hover:text-secondary rounded-full transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* PRIORIDADE (Feature 3) */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Prioridade de Execução</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Prioridade 1 (mais alta) a 5 (mais baixa). Automações com prioridade maior executam primeiro na fila.</p>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map(p => (
                  <button
                    key={p}
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
                      form.priority === p
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-2 text-muted hover:text-secondary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <span className="text-[10px] text-muted ml-2">
                  {form.priority === 1 ? 'Crítica' : form.priority === 2 ? 'Alta' : form.priority === 3 ? 'Normal' : form.priority === 4 ? 'Baixa' : 'Mínima'}
                </span>
              </div>
            </div>
          </section>

          {/* JANELA DE EXECUÇÃO (Feature 5) */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Janela de Execução</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Defina um horário permitido para execução. Fora deste intervalo, a automação será adiada.</p>
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Início</label>
                  <input
                    type="time"
                    value={form.executionWindowStart}
                    onChange={e => setForm({ ...form, executionWindowStart: e.target.value })}
                    className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                  />
                </div>
                <span className="text-muted mt-4">—</span>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Fim</label>
                  <input
                    type="time"
                    value={form.executionWindowEnd}
                    onChange={e => setForm({ ...form, executionWindowEnd: e.target.value })}
                    className="bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none"
                  />
                </div>
              </div>
              {form.executionWindowStart && form.executionWindowEnd && (
                <p className="text-[10px] text-green-500">Executa apenas entre {form.executionWindowStart} e {form.executionWindowEnd}</p>
              )}
              {!form.executionWindowStart && !form.executionWindowEnd && (
                <p className="text-[10px] text-muted">Sem restrição — executa a qualquer hora.</p>
              )}
            </div>
          </section>

          {/* NOTIFICAÇÃO POR FALHA CONSECUTIVA (Feature 7) */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Alerta por Falha Consecutiva</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Dispara alerta quando a automação falhar N vezes seguidas.</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">Alertar após</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={form.consecutiveFailThreshold}
                  onChange={e => setForm({ ...form, consecutiveFailThreshold: Math.max(1, parseInt(e.target.value) || 3) })}
                  className="w-16 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none text-center"
                />
                <span className="text-xs text-muted">falhas consecutivas</span>
              </div>
            </div>
          </section>

          {/* CONDIÇÕES (Feature 1) */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Condições</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Defina quando a automação deve ser executada.</p>
              <select
                value={form.conditions}
                onChange={e => setForm({ ...form, conditions: e.target.value as ConditionType })}
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
              >
                <option value="always">Sempre</option>
                <option value="source_connected">Só se fonte conectada</option>
                <option value="business_hours">Só se horário comercial (8h-18h)</option>
                <option value="label_applied">Quando label for aplicada</option>
              </select>
              {form.conditions === 'label_applied' && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-secondary mb-0.5 block">Label que dispara</label>
                  <select
                    value={formTriggerLabelId}
                    onChange={e => setFormTriggerLabelId(e.target.value)}
                    className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                  >
                    <option value="">Selecione uma label</option>
                    {availableLabels.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* AÇÃO */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Ação</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-0.5 block">Tipo</label>
                <p className="text-[10px] text-muted mb-2">O que fazer quando a automação executar</p>
                <select
                  value={form.actionType}
                  onChange={e => setForm({ ...form, actionType: e.target.value as ActionType })}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none w-full"
                >
                  <option value="new_session">Nova sessão</option>
                  <option value="send_message">Enviar mensagem em sessão existente</option>
                  <option value="run_skill">Executar skill direto</option>
                  <option value="apply_label">Aplicar label</option>
                </select>
                {form.actionType === 'apply_label' && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-secondary mb-0.5 block">Label a aplicar</label>
                    <select
                      value={formLabelId}
                      onChange={e => setFormLabelId(e.target.value)}
                      className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                    >
                      <option value="">Selecione uma label</option>
                      {availableLabels.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-0.5 block">Slug da skill</label>
                <p className="text-[10px] text-muted mb-2">Skill opcional para iniciar a sessão com contexto específico.</p>
                <input
                  value={form.skillSlug}
                  onChange={e => setForm({ ...form, skillSlug: e.target.value })}
                  placeholder="daily-checkpoint"
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary placeholder-muted outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-0.5 block">Prompt (opcional)</label>
                <p className="text-[10px] text-muted mb-2">Suporta instruções em múltiplas linhas com menções. Use [source:slug] e [skill:slug].</p>
                <textarea
                  value={form.prompt}
                  onChange={e => setForm({ ...form, prompt: e.target.value })}
                  placeholder="Faça um checkpoint diário com highlights, bloqueios e próximos passos."
                  rows={4}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary placeholder-muted outline-none resize-none"
                />
              </div>

              {/* Feature 2: Encadeamento */}
              <div>
                <label className="text-xs font-medium text-secondary mb-0.5 block">Depois executar (encadeamento)</label>
                <p className="text-[10px] text-muted mb-2">Escolha outra automação para executar após esta concluir.</p>
                <select
                  value={form.chainTo}
                  onChange={e => setForm({ ...form, chainTo: e.target.value })}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                >
                  <option value="">Nenhuma</option>
                  {automations.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* FONTES */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Fontes</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Escolha fontes, MCPs e APIs para ativar na sessão criada pela automação.</p>
              <div className="flex items-center justify-between">
                <input
                  value={sourceSearch}
                  onChange={e => setSourceSearch(e.target.value)}
                  placeholder="Buscar fontes..."
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none"
                />
                <span className="text-[10px] text-muted ml-3">{form.sources.length} selecionado(s)</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filteredSources.map(s => (
                  <label key={s.slug} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={form.sources.includes(s.slug)}
                      onChange={() => toggleSource(s.slug)}
                      className="w-3.5 h-3.5 rounded border-default accent-brand-600"
                    />
                    <div>
                      <span className="text-xs font-medium text-primary">{s.name}</span>
                      <span className="text-[10px] text-muted ml-2">{s.type}</span>
                    </div>
                  </label>
                ))}
                {filteredSources.length === 0 && (
                  <p className="text-xs text-muted text-center py-3">Nenhuma fonte disponível. Configure MCPs em Ferramentas.</p>
                )}
              </div>
            </div>
          </section>

          {/* DIRETÓRIO */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Diretório de trabalho</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4">
              <label className="text-xs font-medium text-secondary mb-0.5 block">Caminho</label>
              <p className="text-[10px] text-muted mb-2">Deixe vazio para usar o padrão do workspace.</p>
              <input
                value={form.workingDir}
                onChange={e => { setForm({ ...form, workingDir: e.target.value }); setDirError(''); }}
                placeholder="/Users/you/projects/myapp"
                className={`w-full bg-surface-0 border rounded-lg px-3 py-2.5 text-sm text-primary placeholder-muted outline-none font-mono ${dirError ? 'border-red-500' : 'border-default'}`}
              />
              {dirError && <p className="text-[10px] text-red-500 mt-1">{dirError}</p>}
            </div>
          </section>

          {/* SKILLS */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Skills</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
              <p className="text-[10px] text-muted">Escolha skills para ativar na sessão criada pela automação.</p>
              <div className="flex items-center justify-between">
                <input
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  placeholder="Buscar skills..."
                  className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none"
                />
                <span className="text-[10px] text-muted ml-3">{form.selectedSkills.length} selecionado(s)</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredSkills.map(s => (
                  <label key={s.slug} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={form.selectedSkills.includes(s.slug)}
                      onChange={() => toggleSkill(s.slug)}
                      className="w-3.5 h-3.5 rounded border-default accent-brand-600 mt-0.5"
                    />
                    <div>
                      <span className="text-xs font-medium text-primary">{s.name}</span>
                      <p className="text-[10px] text-muted leading-tight mt-0.5">{s.description.slice(0, 100)}{s.description.length > 100 ? '...' : ''}</p>
                    </div>
                  </label>
                ))}
                {filteredSkills.length === 0 && (
                  <p className="text-xs text-muted text-center py-3">Nenhuma skill disponível.</p>
                )}
              </div>
            </div>
          </section>

          {/* VARIÁVEIS (Feature 7) */}
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">
              <button
                onClick={() => setShowVariables(!showVariables)}
                className="flex items-center gap-2 hover:text-brand-500 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform ${showVariables ? 'rotate-90' : ''}`}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
                Variáveis
                {Object.keys(form.variables).length > 0 && (
                  <span className="text-[10px] font-normal bg-brand-600/10 text-brand-500 px-2 py-0.5 rounded-full">
                    {Object.keys(form.variables).length} vars
                  </span>
                )}
              </button>
            </h2>
            {showVariables && (
              <div className="bg-surface-1 border border-default rounded-xl p-4 space-y-3">
                <p className="text-[10px] text-muted">Defina variáveis para usar no prompt. Pré-definidas: {'{{hoje}}'}, {'{{workspace}}'}, {'{{hora}}'}.</p>

                {/* Pre-defined vars */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(PREDEFINED_VARS).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setForm(f => ({ ...f, variables: { ...f.variables, [key]: val } }))}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                        form.variables[key] !== undefined
                          ? 'bg-brand-600/10 text-brand-500 border border-brand-500/30'
                          : 'bg-surface-2 text-muted hover:text-secondary'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>

                {/* Current vars */}
                {Object.keys(form.variables).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(form.variables).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 bg-surface-0 rounded-lg px-3 py-2">
                        <span className="text-xs font-mono text-primary flex-1">{k}</span>
                        <span className="text-xs text-muted flex-1 truncate">{v}</span>
                        <button onClick={() => handleRemoveVariable(k)} className="text-red-500 hover:bg-red-500/10 rounded px-1.5 py-0.5 text-[10px]">x</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new var */}
                <div className="flex gap-2">
                  <input
                    value={newVarKey}
                    onChange={e => setNewVarKey(e.target.value)}
                    placeholder="Chave (ex: {{meu_var}})"
                    className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none font-mono"
                  />
                  <input
                    value={newVarValue}
                    onChange={e => setNewVarValue(e.target.value)}
                    placeholder="Valor"
                    className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none"
                  />
                  <button
                    onClick={handleAddVariable}
                    disabled={!newVarKey.trim()}
                    className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs text-white font-medium"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* OPÇÕES */}
          <section className="space-y-4 pb-8">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider">Opções</h2>
            <div className="bg-surface-1 border border-default rounded-xl divide-y divide-default">
              {/* Permission mode */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-xs font-medium text-primary block">Modo de permissão</span>
                  <span className="text-[10px] text-muted">Modo de permissão das sessões criadas.</span>
                </div>
                <select
                  value={form.permissionMode}
                  onChange={e => setForm({ ...form, permissionMode: e.target.value as 'execute' | 'ask' | 'explore' })}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="execute">Executar (aprovar automaticamente)</option>
                  <option value="ask">Perguntar antes de editar</option>
                  <option value="explore">Apenas explorar</option>
                </select>
              </div>

              {/* OS Mode */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-xs font-medium text-primary block">Modo OS</span>
                  <span className="text-[10px] text-muted">Ativa o Modo OS por padrão nas sessões criadas pela automação.</span>
                </div>
                <button
                  onClick={() => setForm({ ...form, osMode: !form.osMode })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.osMode ? 'bg-brand-600' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.osMode ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Run if missed */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-xs font-medium text-primary block">Executar ao abrir se perdeu o horário</span>
                  <span className="text-[10px] text-muted">Executa na próxima abertura do app se o horário foi perdido nas últimas 2 horas.</span>
                </div>
                <button
                  onClick={() => setForm({ ...form, runIfMissed: !form.runIfMissed })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.runIfMissed ? 'bg-brand-600' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.runIfMissed ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Notify on complete */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-xs font-medium text-primary block">Notificar ao concluir</span>
                  <span className="text-[10px] text-muted">Mostra uma notificação quando a automação termina.</span>
                </div>
                <button
                  onClick={() => setForm({ ...form, notifyOnComplete: !form.notifyOnComplete })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.notifyOnComplete ? 'bg-brand-600' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.notifyOnComplete ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Feature 3: Retry with backoff */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-xs font-medium text-primary block">Retry em falha</span>
                  <span className="text-[10px] text-muted">Tenta novamente com backoff exponencial em caso de erro.</span>
                </div>
                <div className="flex items-center gap-2">
                  {form.retryEnabled && (
                    <select
                      value={form.retryCount}
                      onChange={e => setForm({ ...form, retryCount: parseInt(e.target.value) })}
                      className="bg-surface-0 border border-default rounded-lg px-2 py-1 text-xs text-primary outline-none"
                    >
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={3}>3x</option>
                    </select>
                  )}
                  <button
                    onClick={() => setForm({ ...form, retryEnabled: !form.retryEnabled })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${form.retryEnabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.retryEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Feature 4: Notification channel */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <span className="text-xs font-medium text-primary block">Canal de notificação</span>
                  <span className="text-[10px] text-muted">Onde enviar notificações desta automação.</span>
                </div>
                <select
                  value={form.notifyChannel}
                  onChange={e => setForm({ ...form, notifyChannel: e.target.value as NotifyChannel })}
                  className="bg-surface-0 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="in-app">In-app</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                  <option value="slack">Slack</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer buttons */}
        <div className="shrink-0 px-8 py-4 border-t border-default flex justify-end gap-3">
          <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-secondary hover:bg-surface-2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!form.name.trim()}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-xs font-medium text-white transition-colors"
          >
            {editingId ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    );
  }

  // === LIST VIEW ===
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Automações</h1>
            <p className="text-sm text-muted">{automations.length} automações · {automations.filter(a => a.enabled).length} ativas</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Feature 6: Import/Export buttons */}
            <button
              onClick={handleImport}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors"
              title="Importar automações da área de transferência"
            >
              Importar
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors"
              title="Exportar automações para a área de transferência"
            >
              Exportar
            </button>
            <button
              onClick={handleGlobalPauseToggle}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${globalPaused ? 'bg-red-600/10 text-red-500' : 'bg-surface-2 text-secondary hover:bg-surface-3'}`}
              title="Kill Switch — Pausa todas as automações"
            >
              {globalPaused ? '⏸ Pausado' : '⏸ Pausar Todas'}
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary font-medium transition-colors"
            >
              Histórico
            </button>
            <button
              onClick={() => { setForm({ ...defaultForm }); setEditingId(null); setShowForm(true); }}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
            >
              + Nova Automação
            </button>
          </div>
        </div>

        <div className="flex gap-1 bg-surface-1 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'mine' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            Minhas Automações <span className="text-xs opacity-60">{automations.length}</span>
          </button>
          <button
            onClick={() => setTab('recommended')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'recommended' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            Rotinas Recomendadas <span className="text-xs opacity-60">{recommended.length}</span>
          </button>
          <button
            onClick={() => setTab('hooks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              tab === 'hooks' ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
            }`}
          >
            Hooks
            {hooks.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] font-bold">
                {hooks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {/* Feature 6: Global Statistics Card */}
        {tab === 'mine' && history.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
            <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{globalStats().total}</p>
              <p className="text-[10px] text-muted uppercase font-medium">Total Execuções</p>
            </div>
            <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${globalStats().successRate >= 80 ? 'text-green-500' : globalStats().successRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {globalStats().successRate}%
              </p>
              <p className="text-[10px] text-muted uppercase font-medium">Taxa de Sucesso</p>
            </div>
            <div className="bg-surface-1 border border-default rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{globalStats().avgDuration > 0 ? `${(globalStats().avgDuration / 1000).toFixed(1)}s` : '—'}</p>
              <p className="text-[10px] text-muted uppercase font-medium">Tempo Médio</p>
            </div>
          </div>
        )}

        {/* Feature 7: Failure alerts banner */}
        {tab === 'mine' && failureAlerts.length > 0 && (
          <div className="mt-4 mb-4 space-y-2">
            {failureAlerts.map(alert => (
              <div key={alert.autoName} className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-red-500 text-sm font-bold">!</span>
                <div className="flex-1">
                  <p className="text-xs text-red-500 font-medium">"{alert.autoName}" falhou {alert.count} vezes consecutivas</p>
                  <p className="text-[10px] text-red-400">Última falha: {new Date(alert.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature 1: Tag filter */}
        {tab === 'mine' && allTags().length > 0 && (
          <div className="flex items-center gap-2 mt-4 mb-2 flex-wrap">
            <span className="text-[10px] text-muted uppercase font-semibold">Filtrar por tag:</span>
            <button
              onClick={() => setTagFilter('')}
              className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                !tagFilter ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-secondary'
              }`}
            >
              Todas
            </button>
            {allTags().map(tag => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? '' : tag)}
                className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                  tagFilter === tag ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted hover:text-secondary'
                }`}
              >
                {tag}
              </button>
            ))}
            {/* Feature 4: Pause by tag button */}
            <button
              onClick={() => setPauseByTagModal(true)}
              className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors ml-2"
            >
              Pausar por tag
            </button>
            {/* NEW #5: Enable by tag button */}
            <button
              onClick={() => setEnableByTagModal(true)}
              className="text-[10px] px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
            >
              Ativar por tag
            </button>
          </div>
        )}

        {tab === 'mine' && (
          <>
            {automations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-secondary mb-1">Nenhuma automação configurada</p>
                <p className="text-xs text-muted mb-4">Crie uma nova ou ative uma rotina recomendada.</p>
                <button
                  onClick={() => { setForm({ ...defaultForm }); setEditingId(null); setShowForm(true); }}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                >
                  + Nova Automação
                </button>
              </div>
            )}

            <div className="space-y-3 mt-4">
              {sortedAutomations.map((auto) => {
                const chainTarget = auto.chainTo ? automations.find(a => a.id === auto.chainTo) : null;
                const dots = getExecutionDots(auto.name);
                const varCount = auto.variables ? Object.keys(auto.variables).length : 0;
                const timeline = getExecutionTimeline(auto.name);
                const avgDur = getAvgDuration(auto.name);
                const consecutiveFails = (() => { const entries = history.filter(h => h.autoName === auto.name); let c = 0; for (const e of entries) { if (e.status === 'error') c++; else break; } return c; })();

                return (
                  <div
                    key={auto.id}
                    className={`bg-surface-1 border rounded-2xl p-5 shadow-card transition-all animate-fade-in ${dragOverId === auto.id ? 'border-brand-500 ring-1 ring-brand-500/30' : 'border-default'}`}
                    draggable
                    onDragStart={() => handleDragStart(auto.id)}
                    onDragOver={(e) => { e.preventDefault(); handleDragOver(auto.id); }}
                    onDrop={() => handleDrop(auto.id)}
                    onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {/* NEW #2: Drag handle */}
                        <span className="cursor-grab text-muted hover:text-secondary text-xs select-none" title="Arrastar para reordenar">⠿</span>
                        <span className="text-sm font-medium text-primary">{auto.name}</span>
                        {/* NEW #6: Duration badge */}
                        {avgDur > 0 && (
                          <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted font-mono">~{(avgDur / 1000).toFixed(1)}s</span>
                        )}
                        {/* NEW #8: Consecutive failure badge */}
                        {consecutiveFails >= (auto.consecutiveFailThreshold || 3) && (
                          <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full font-semibold">{consecutiveFails} falhas seguidas</span>
                        )}
                        <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          auto.enabled ? 'bg-green-500/10 text-green-500' : 'bg-surface-3 text-muted'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${auto.enabled ? 'bg-status-success' : consecutiveFails > 0 ? 'bg-status-error' : 'bg-status-warning'}`} />
                          {auto.enabled ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(auto)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${auto.enabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${auto.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                        <button onClick={() => handleEdit(auto)} className="px-2 py-1 rounded-lg text-xs text-blue-500 hover:bg-blue-500/10 transition-colors font-medium">
                          Editar
                        </button>
                        <button onClick={() => handleExecuteNow(auto)} className="px-2 py-1 rounded-lg text-xs text-green-500 hover:bg-green-500/10 transition-colors font-medium">
                          Executar
                        </button>
                        <button onClick={() => handleDryRun(auto)} className="px-2 py-1 rounded-lg text-xs text-brand-500 hover:bg-brand-600/10 transition-colors">
                          Dry Run
                        </button>
                        <button onClick={() => handleDuplicate(auto)} className="px-2 py-1 rounded-lg text-xs text-secondary hover:bg-surface-2 transition-colors">
                          Duplicar
                        </button>
                        {/* Feature 8: Clone to workspace */}
                        <button onClick={() => handleCloneToWorkspace(auto)} className="px-2 py-1 rounded-lg text-xs text-purple-500 hover:bg-purple-500/10 transition-colors">
                          Clonar
                        </button>
                        <button onClick={() => setConfirmDelete({ id: auto.id, name: auto.name })} className="px-2 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">
                          Remover
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted mb-2">{auto.description || auto.prompt || '—'}</p>

                    {/* NEW #1: Execution timeline SVG bar chart */}
                    <div className="flex items-end gap-0.5 mb-2 h-5">
                      <span className="text-[10px] text-muted mr-1 self-center">Últimas 7:</span>
                      <svg width="84" height="20" viewBox="0 0 84 20" className="inline-block">
                        {timeline.map((entry, i) => {
                          const maxDur = Math.max(...timeline.map(t => t.duration), 1);
                          const barHeight = entry.status === 'skip' ? 3 : Math.max(4, (entry.duration / maxDur) * 18);
                          const color = entry.status === 'ok' ? '#22c55e' : entry.status === 'error' ? '#ef4444' : '#3f3f46';
                          return (
                            <rect key={i} x={i * 12} y={20 - barHeight} width="10" height={barHeight} rx="2" fill={color}>
                              <title>{entry.status === 'ok' ? 'Sucesso' : entry.status === 'error' ? 'Falha' : 'Sem dados'}{entry.duration ? ` (${(entry.duration / 1000).toFixed(1)}s)` : ''}</title>
                            </rect>
                          );
                        })}
                      </svg>
                    </div>
                    {/* NEW #7: Variable preview tooltip */}
                    {varCount > 0 && (
                      <div className="relative inline-block mb-1">
                        <button
                          onMouseEnter={() => setVarPreviewId(auto.id)}
                          onMouseLeave={() => setVarPreviewId(null)}
                          className="text-[10px] text-teal-500 hover:underline"
                        >
                          Preview vars ({varCount})
                        </button>
                        {varPreviewId === auto.id && auto.variables && (
                          <div className="absolute z-30 bottom-full left-0 mb-1 bg-surface-0 border border-default rounded-lg p-2 shadow-lg w-64">
                            <p className="text-[9px] text-muted font-semibold mb-1">Prompt expandido:</p>
                            <p className="text-[10px] text-secondary font-mono whitespace-pre-wrap line-clamp-4">
                              {expandVariables(auto.prompt || '(sem prompt)', auto.variables)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1.5 flex-wrap items-center">
                      <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{auto.schedule}</span>
                      {auto.enabled && (
                        <span className="text-[10px] px-2 py-0.5 bg-brand-600/10 rounded-full text-brand-500">Próxima: {getNextExecution(auto)}</span>
                      )}
                      {auto.skillSlug && <span className="text-[10px] px-2 py-0.5 bg-brand-600/10 rounded-full text-brand-500 font-mono">{auto.skillSlug}</span>}
                      {auto.sources.map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{s}</span>
                      ))}
                      {/* Feature 1: Condition tag */}
                      {auto.conditions && auto.conditions !== 'always' && (
                        <span className="text-[10px] px-2 py-0.5 bg-yellow-500/10 rounded-full text-yellow-600">
                          {CONDITION_LABELS[auto.conditions]}
                        </span>
                      )}
                      {/* Feature 2: Chain indicator */}
                      {chainTarget && (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 rounded-full text-purple-500 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          {chainTarget.name}
                        </span>
                      )}
                      {/* Feature 3: Retry badge */}
                      {(auto.retryCount || 0) > 0 && (
                        <span className="text-[10px] px-2 py-0.5 bg-orange-500/10 rounded-full text-orange-500">
                          Retry {auto.retryCount}x
                        </span>
                      )}
                      {/* Feature 4: Notify channel tag */}
                      {auto.notifyChannel && auto.notifyChannel !== 'in-app' && (
                        <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 rounded-full text-blue-500">
                          {NOTIFY_LABELS[auto.notifyChannel]}
                        </span>
                      )}
                      {/* Feature 7: Variables badge */}
                      {varCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 bg-teal-500/10 rounded-full text-teal-500">
                          {varCount} vars
                        </span>
                      )}
                      {/* Feature 1: Tags */}
                      {(auto.tags || []).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-brand-600/10 rounded-full text-brand-500">
                          #{tag}
                        </span>
                      ))}
                      {/* Feature 3: Priority badge */}
                      {auto.priority && auto.priority !== 3 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          auto.priority <= 2 ? 'bg-red-500/10 text-red-500' : 'bg-surface-3 text-muted'
                        }`}>
                          P{auto.priority}
                        </span>
                      )}
                      {/* Feature 5: Execution window badge */}
                      {auto.executionWindowStart && auto.executionWindowEnd && (
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 rounded-full text-indigo-500">
                          {auto.executionWindowStart}–{auto.executionWindowEnd}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* NEW #9: Recommended automations carousel (visual cards) */}
        {tab === 'recommended' && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted uppercase font-semibold tracking-wider">Ative com um clique</p>
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
              {recommended.map((r) => (
                <div key={r.name} className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card min-w-[320px] max-w-[360px] shrink-0 snap-start flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-600/10 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-500">
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-primary">{r.name}</span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-brand-600/10 rounded text-brand-500 uppercase font-medium">Rotina</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted mb-3">{r.description}</p>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      <span className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{r.schedule}</span>
                      {r.sources.map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-surface-2 rounded-full text-muted">{s}</span>
                      ))}
                      {r.skillSlug && <span className="text-[10px] px-2 py-0.5 bg-brand-600/10 rounded-full text-brand-500 font-mono">{r.skillSlug}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleActivateRecommended(r)}
                    className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-xl text-xs text-white font-medium transition-colors"
                  >
                    Ativar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'hooks' && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted uppercase font-semibold tracking-wider">Hooks configurados</p>
              <button
                onClick={() => setShowHookForm(!showHookForm)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
              >
                + Novo Hook
              </button>
            </div>

            {showHookForm && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-5 shadow-card">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      value={hookForm.name}
                      onChange={e => setHookForm({ ...hookForm, name: e.target.value })}
                      placeholder="Nome do hook"
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <select
                      value={hookForm.trigger}
                      onChange={e => setHookForm({ ...hookForm, trigger: e.target.value as Hook['trigger'] })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none"
                    >
                      <option value="pre_message">Pre Message</option>
                      <option value="post_message">Post Message</option>
                      <option value="pre_tool">Pre Tool</option>
                      <option value="post_tool">Post Tool</option>
                    </select>
                  </div>
                  <textarea
                    value={hookForm.action}
                    onChange={e => setHookForm({ ...hookForm, action: e.target.value })}
                    placeholder="Ação (JS code ou comando)"
                    rows={4}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none font-mono resize-none focus:border-brand-500/50"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowHookForm(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddHook}
                      disabled={!hookForm.name.trim() || !hookForm.action.trim()}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {hooks.length === 0 && !showHookForm && (
              <div className="bg-surface-1 border border-default rounded-2xl p-8 text-center">
                <p className="text-sm text-muted">Nenhum hook configurado.</p>
                <p className="text-xs text-muted mt-1">Hooks permitem executar ações antes/depois de mensagens e tools.</p>
              </div>
            )}

            <div className="space-y-2">
              {hooks.map(hook => (
                <div key={hook.id} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => handleToggleHook(hook.id)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${hook.enabled ? 'bg-brand-600' : 'bg-surface-3'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hook.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-primary">{hook.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-2 rounded text-muted">{hook.trigger}</span>
                    </div>
                    <p className="text-[10px] text-muted font-mono truncate mt-0.5">{hook.action}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteHook(hook.id)}
                    className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg shrink-0"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHistory(false)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Histórico de Execuções</h3>
            {/* NEW #10: History search/filter */}
            <div className="space-y-2 mb-4">
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={historyStatusFilter}
                  onChange={e => setHistoryStatusFilter(e.target.value as any)}
                  className="bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                >
                  <option value="all">Todos status</option>
                  <option value="ok">Sucesso</option>
                  <option value="error">Erro</option>
                  <option value="skip">Pulado</option>
                </select>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={e => setHistoryDateFrom(e.target.value)}
                  className="bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                  placeholder="De"
                />
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={e => setHistoryDateTo(e.target.value)}
                  className="bg-surface-0 border border-default rounded-lg px-2 py-1.5 text-xs text-primary outline-none"
                  placeholder="Até"
                />
                <span className="text-[10px] text-muted">{filteredHistory().length} resultados</span>
              </div>
            </div>
            {filteredHistory().length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Nenhuma execução registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {filteredHistory().map(h => (
                  <div key={h.id} className="bg-surface-0 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedLogId(expandedLogId === h.id ? null : h.id)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${h.status === 'ok' ? 'bg-green-500' : h.status === 'retry' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-primary">{h.autoName}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`text-muted transition-transform ${expandedLogId === h.id ? 'rotate-90' : ''}`}>
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.duration && <span className="text-[10px] text-muted">{(h.duration / 1000).toFixed(1)}s</span>}
                        <span className="text-[10px] text-muted">{new Date(h.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                    {/* Feature 2: Expanded log details */}
                    {expandedLogId === h.id && (
                      <div className="px-3 pb-3 border-t border-default">
                        <div className="mt-2 space-y-1.5 text-[10px]">
                          <div>
                            <span className="text-muted font-medium">Status:</span>{' '}
                            <span className={h.status === 'ok' ? 'text-green-500' : h.status === 'retry' ? 'text-yellow-500' : 'text-red-500'}>
                              {h.status === 'ok' ? 'Sucesso' : h.status === 'retry' ? 'Retry' : h.status === 'skip' ? 'Pulado' : 'Erro'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Duração:</span>{' '}
                            <span className="text-secondary">{h.duration ? `${(h.duration / 1000).toFixed(2)}s` : 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Timestamp:</span>{' '}
                            <span className="text-secondary">{new Date(h.ts).toLocaleString('pt-BR')}</span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Input:</span>{' '}
                            <span className="text-secondary font-mono">{(h as any).input || '(não registrado)'}</span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Output:</span>{' '}
                            <span className="text-secondary font-mono">{(h as any).output || '(não registrado)'}</span>
                          </div>
                          {h.status === 'error' && (
                            <div>
                              <span className="text-muted font-medium">Erro:</span>{' '}
                              <span className="text-red-500 font-mono">{(h as any).errorDetail || 'Erro desconhecido'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowHistory(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Dry run result modal */}
      {dryRunResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDryRunResult(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Dry Run — {dryRunResult.name}</h3>
            <p className="text-[10px] text-muted mb-3">Preview do que seria executado (sem ação real):</p>
            <pre className="text-xs text-secondary bg-surface-0 rounded-lg p-3 whitespace-pre-wrap font-mono">{dryRunResult.preview}</pre>
            <div className="flex justify-end mt-4">
              <button onClick={() => setDryRunResult(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 8: Execute manual modal */}
      {executeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setExecuteModal(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Executar Agora — {executeModal.name}</h3>
            <p className="text-[10px] text-muted mb-4">Edite o prompt e skill antes de confirmar a execução manual.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-secondary mb-1 block">Skill</label>
                <input
                  value={executeSkill}
                  onChange={e => setExecuteSkill(e.target.value)}
                  placeholder="slug da skill (opcional)"
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder-muted outline-none font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-secondary mb-1 block">Prompt</label>
                <textarea
                  value={executePrompt}
                  onChange={e => setExecutePrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder-muted outline-none resize-none"
                />
              </div>

              {/* Dry run preview */}
              <div className="bg-surface-0 border border-default rounded-lg p-3">
                <p className="text-[10px] text-muted uppercase font-semibold mb-1">Preview</p>
                <pre className="text-[11px] text-secondary font-mono whitespace-pre-wrap">
{`Skill: ${executeSkill || 'nenhuma'}
Prompt: ${executePrompt || '(vazio)'}
Sources: ${executeModal.sources?.join(', ') || 'nenhuma'}
Condição: ${CONDITION_LABELS[executeModal.conditions || 'always']}`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setExecuteModal(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button
                onClick={handleConfirmExecution}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-medium text-white transition-colors"
              >
                Confirmar execução
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Excluir automação</h3>
            <p className="text-xs text-muted mb-4">
              Tem certeza que deseja excluir <span className="font-medium text-secondary">"{confirmDelete.name}"</span>? O agendamento será removido permanentemente.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 4: Pause by tag modal */}
      {pauseByTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPauseByTagModal(false)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Pausar por Tag</h3>
            <p className="text-xs text-muted mb-4">Selecione uma tag para pausar todas as automações associadas.</p>
            {allTags().length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Nenhuma tag encontrada. Adicione tags às suas automações primeiro.</p>
            ) : (
              <div className="space-y-2">
                {allTags().map(tag => {
                  const count = automations.filter(a => (a.tags || []).includes(tag) && a.enabled).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => handlePauseByTag(tag)}
                      disabled={count === 0}
                      className="w-full flex items-center justify-between px-4 py-3 bg-surface-0 rounded-xl hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-xs font-medium text-primary">#{tag}</span>
                      <span className="text-[10px] text-muted">{count} ativa(s)</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setPauseByTagModal(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW #5: Enable by tag modal */}
      {enableByTagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEnableByTagModal(false)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Ativar por Tag</h3>
            <p className="text-xs text-muted mb-4">Selecione uma tag para ativar todas as automações associadas.</p>
            {allTags().length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Nenhuma tag encontrada.</p>
            ) : (
              <div className="space-y-2">
                {allTags().map(tag => {
                  const count = automations.filter(a => (a.tags || []).includes(tag) && !a.enabled).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => handleEnableByTag(tag)}
                      disabled={count === 0}
                      className="w-full flex items-center justify-between px-4 py-3 bg-surface-0 rounded-xl hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-xs font-medium text-primary">#{tag}</span>
                      <span className="text-[10px] text-muted">{count} inativa(s)</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => setEnableByTagModal(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 8: Clone to workspace modal */}
      {cloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setCloneModal(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Clonar para outro Workspace</h3>
            <p className="text-xs text-muted mb-4">
              Exporta "{cloneModal.name}" como JSON. Copie e importe em outro workspace.
            </p>
            <div className="bg-surface-0 border border-default rounded-lg p-3 mb-4">
              <p className="text-[10px] text-muted uppercase font-semibold mb-1">Preview do export</p>
              <pre className="text-[10px] text-secondary font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
{JSON.stringify({
  name: cloneModal.name,
  schedule: cloneModal.schedule,
  actionType: cloneModal.actionType,
  skillSlug: cloneModal.skillSlug,
  tags: cloneModal.tags,
  priority: cloneModal.priority,
  executionWindow: cloneModal.executionWindowStart && cloneModal.executionWindowEnd
    ? `${cloneModal.executionWindowStart}-${cloneModal.executionWindowEnd}` : 'sem restrição',
}, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCloneModal(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button
                onClick={() => handleExportClone(cloneModal)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium text-white transition-colors"
              >
                Copiar JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
