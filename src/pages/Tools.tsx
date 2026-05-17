import { useState, useEffect, useRef, useCallback } from 'react';

type ToolsTab = 'connections' | 'skills' | 'workflows' | 'dashboards';

interface Connection {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
}

interface Workflow {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
}

interface Dashboard {
  id: string;
  name: string;
  slug: string;
  html: string;
  createdAt: string;
  updatedAt: string;
}

interface InstructionVersion {
  instructions: string;
  savedAt: string;
}

interface ConnTestDetail {
  status: 'ok' | 'error' | string;
  latencyMs?: number;
  httpStatus?: number;
}

const CONNECTION_TEMPLATES = [
  { name: 'Notion API', type: 'api_key', baseUrl: 'https://api.notion.com/v1' },
  { name: 'Slack Webhook', type: 'mcp', baseUrl: 'https://hooks.slack.com/services/' },
  { name: 'GitHub API', type: 'api_key', baseUrl: 'https://api.github.com' },
  { name: 'OpenAI API', type: 'api_key', baseUrl: 'https://api.openai.com/v1' },
];

const ados = (window as any).ados;

export default function Tools() {
  const [tab, setTab] = useState<ToolsTab>('connections');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [viewingDashboard, setViewingDashboard] = useState<Dashboard | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [connForm, setConnForm] = useState({ name: '', type: 'api_key', apiKey: '', baseUrl: '' });
  const [skillForm, setSkillForm] = useState({ name: '', slug: '', description: '', instructions: '' });
  const [workflowForm, setWorkflowForm] = useState({ name: '', slug: '', description: '', instructions: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [testingConn, setTestingConn] = useState<string | null>(null);
  const [connTestResult, setConnTestResult] = useState<Record<string, ConnTestDetail>>({});
  const [urlError, setUrlError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [dragSkill, setDragSkill] = useState<number | null>(null);
  const [dashLoaded, setDashLoaded] = useState(false);
  const connTestCache = useRef<Record<string, { result: ConnTestDetail; ts: number }>>({});

  // Feature 3: Global search
  const [globalSearch, setGlobalSearch] = useState('');

  // Feature 4: Favorites/Pin
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('tools-favorites') || '[]'); } catch { return []; }
  });

  // Feature 2: Instruction version history
  const [showHistory, setShowHistory] = useState<string | null>(null);

  // Feature 7: Connection templates
  const [showTemplates, setShowTemplates] = useState(false);

  // Feature 8: Tags
  const [skillTags, setSkillTags] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('tools-skill-tags') || '{}'); } catch { return {}; }
  });
  const [tagFilter, setTagFilter] = useState('');

  // Feature 6: Dependency warning state
  const [dependencyWarning, setDependencyWarning] = useState<{ id: string; name: string; dependents: string[] } | null>(null);

  // NEW Feature 1: Duplicar skill (no extra state needed, handled in handler)

  // NEW Feature 2: Ordenação de conexões
  const [connSortBy, setConnSortBy] = useState<'name' | 'status' | 'date'>('name');

  // NEW Feature 3: Webhook de eventos por skill
  const [skillWebhooks, setSkillWebhooks] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('tools-skill-webhooks') || '{}'); } catch { return {}; }
  });

  // NEW Feature 4: Uso por skill (execution counter)
  const [skillUsage, setSkillUsage] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('tools-skill-usage') || '{}'); } catch { return {}; }
  });

  // NEW Feature 5: OAuth refresh automático
  const [expiredTokens, setExpiredTokens] = useState<Record<string, boolean>>({});

  // NEW Feature 6: Multi-select bulk delete
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // NEW Feature 7: Preview de instrução no hover (tooltip state)
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  // NEW Feature 8: Indicador de saúde por conexão (uses connTestResult latency)

  // NEW Feature 9: Test skill in modal
  const [testingSkillId, setTestingSkillId] = useState<string | null>(null);
  const [testSkillInput, setTestSkillInput] = useState('');
  const [testSkillOutput, setTestSkillOutput] = useState('');
  const [testSkillRunning, setTestSkillRunning] = useState(false);

  // NEW Feature 10: Import skill from URL
  const [importUrlInput, setImportUrlInput] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);

  // NEW Feature 11: Skill templates wizard
  const [showSkillTemplates, setShowSkillTemplates] = useState(false);

  // NEW Feature 12: MCP auto-reconnect
  const [mcpAutoReconnect, setMcpAutoReconnect] = useState(() => localStorage.getItem('mcp-auto-reconnect') === 'true');

  // NEW Feature 13: Instruction validator
  const [validationResult, setValidationResult] = useState<Record<string, { score: number; issues: string[] }>>({})

  // Cross-menu integration: notification from marketplace/healthcheck
  const [crossMenuNotification, setCrossMenuNotification] = useState<string | null>(null);

  // UI/UX Improvement 1: Drag-and-drop for connections
  const [draggedConnIdx, setDraggedConnIdx] = useState<number | null>(null);

  // UI/UX Improvement 2: Bulk operations for connections/workflows
  const [selectedConnIds, setSelectedConnIds] = useState<Set<string>>(new Set());
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<Set<string>>(new Set());

  // UI/UX Improvement 3: Last-tested badge
  const [lastTestedAt, setLastTestedAt] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('tools-conn-last-tested') || '{}'); } catch { return {}; }
  });

  // UI/UX Improvement 5: Workflow visualizer
  const [previewingWorkflow, setPreviewingWorkflow] = useState<Workflow | null>(null);

  // UI/UX Improvement 7: Keyboard shortcut overlay
  const [showShortcuts, setShowShortcuts] = useState(false);

  // UI/UX Improvement 8: Instruction tooltip
  const [showInstructionTip, setShowInstructionTip] = useState(false);

  // UI/UX Improvement 10: Inline workflow editing
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [editWorkflowInstructions, setEditWorkflowInstructions] = useState('');

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (tab === 'dashboards' && !dashLoaded) {
      ados.db.getDashboards().then((d: Dashboard[]) => { setDashboards(d); setDashLoaded(true); }).catch(() => {});
    }
  }, [tab]);

  // Feature 1: Health check every 5 minutes
  useEffect(() => {
    const runHealthCheck = async () => {
      for (const conn of connections) {
        const baseUrl = conn.config?.baseUrl;
        const apiKey = conn.config?.apiKey;
        if (!baseUrl && !apiKey) {
          setConnTestResult((prev) => ({ ...prev, [conn.id]: { status: 'Sem URL ou API key configurada' } }));
          continue;
        }
        try {
          if (baseUrl) {
            const start = performance.now();
            const response = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            const latencyMs = Math.round(performance.now() - start);
            if (response.ok || response.status === 405 || response.status === 401) {
              await ados.db.updateConnection(conn.id, { status: 'connected' }).catch(() => {});
              setConnTestResult((prev) => ({ ...prev, [conn.id]: { status: 'ok', latencyMs, httpStatus: response.status } }));
              connTestCache.current[conn.id] = { result: { status: 'ok', latencyMs, httpStatus: response.status }, ts: Date.now() };
            } else {
              await ados.db.updateConnection(conn.id, { status: 'error' }).catch(() => {});
              const detail: ConnTestDetail = { status: `HTTP ${response.status}`, latencyMs, httpStatus: response.status };
              setConnTestResult((prev) => ({ ...prev, [conn.id]: detail }));
              connTestCache.current[conn.id] = { result: detail, ts: Date.now() };
            }
          } else {
            await ados.db.updateConnection(conn.id, { status: 'connected' }).catch(() => {});
            setConnTestResult((prev) => ({ ...prev, [conn.id]: { status: 'ok' } }));
            connTestCache.current[conn.id] = { result: { status: 'ok' }, ts: Date.now() };
          }
        } catch (err: any) {
          await ados.db.updateConnection(conn.id, { status: 'error' }).catch(() => {});
          const errStatus = err?.name === 'TimeoutError' ? 'Timeout (5s)' : 'Conexão recusada';
          setConnTestResult((prev) => ({ ...prev, [conn.id]: { status: errStatus } }));
          connTestCache.current[conn.id] = { result: { status: errStatus }, ts: Date.now() };
        }
      }
      loadAll();
    };

    if (connections.length === 0) return;
    const interval = setInterval(runHealthCheck, 300000);
    return () => clearInterval(interval);
  }, [connections.length]);

  // UI/UX Improvement 7: Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') { setShowShortcuts(prev => !prev); e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cross-menu integration: listen for marketplace installs
  useEffect(() => {
    const handleMarketplaceInstall = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      loadAll();
      setCrossMenuNotification(`Nova ${detail.type === 'skill' ? 'skill' : 'workflow'} instalada: ${detail.name}`);
      setTimeout(() => setCrossMenuNotification(null), 4000);
    };
    window.addEventListener('marketplace:installed', handleMarketplaceInstall);
    return () => window.removeEventListener('marketplace:installed', handleMarketplaceInstall);
  }, []);

  // Cross-menu integration: listen for healthcheck connection updates
  useEffect(() => {
    const handleHealthCheckUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && Array.isArray(detail)) {
        const updatedResults: Record<string, ConnTestDetail> = {};
        for (const r of detail) {
          if (r.connId && r.status) {
            updatedResults[r.connId] = { status: r.status, latencyMs: r.latencyMs, httpStatus: r.httpStatus };
          }
        }
        if (Object.keys(updatedResults).length > 0) {
          setConnTestResult(prev => ({ ...prev, ...updatedResults }));
        }
      }
      loadAll();
    };
    window.addEventListener('healthcheck:connections-updated', handleHealthCheckUpdate);
    return () => window.removeEventListener('healthcheck:connections-updated', handleHealthCheckUpdate);
  }, []);

  // UI/UX Improvement 4: Health grade calculator
  const getHealthGrade = (connId: string): { grade: string; color: string } => {
    const result = connTestResult[connId];
    if (!result || result.status !== 'ok') return { grade: 'F', color: 'text-red-500' };
    if (result.latencyMs === undefined) return { grade: 'A', color: 'text-green-500' };
    if (result.latencyMs < 200) return { grade: 'A', color: 'text-green-500' };
    if (result.latencyMs <= 500) return { grade: 'B', color: 'text-blue-500' };
    if (result.latencyMs <= 1000) return { grade: 'C', color: 'text-yellow-500' };
    if (result.latencyMs <= 2000) return { grade: 'D', color: 'text-orange-500' };
    return { grade: 'F', color: 'text-red-500' };
  };

  // UI/UX Improvement 3: Format last tested time
  const formatLastTested = (connId: string): string | null => {
    const ts = lastTestedAt[connId];
    if (!ts) return null;
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Testado agora';
    if (diffMin < 60) return `Testado há ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Testado há ${diffH}h`;
    return `Testado há ${Math.floor(diffH / 24)}d`;
  };

  // UI/UX Improvement 1: Connection drag handlers
  const handleConnDragStart = (index: number) => setDraggedConnIdx(index);
  const handleConnDrop = (targetIndex: number) => {
    if (draggedConnIdx === null || draggedConnIdx === targetIndex) return;
    const reordered = [...connections];
    const [moved] = reordered.splice(draggedConnIdx, 1);
    reordered.splice(targetIndex, 0, moved);
    setConnections(reordered);
    ados.db.reorderConnections?.(reordered.map(c => c.id)).catch(() => {});
    setDraggedConnIdx(null);
  };

  // UI/UX Improvement 2: Bulk export/delete for connections
  const handleBulkDeleteConnections = async () => {
    for (const id of Array.from(selectedConnIds)) {
      await ados.db.deleteConnection(id);
    }
    setSelectedConnIds(new Set());
    loadAll();
  };

  const handleBulkExportConnections = () => {
    const data = connections.filter(c => selectedConnIds.has(c.id)).map(({ name, type, config }) => ({ name, type, config }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  // UI/UX Improvement 2: Bulk export/delete for workflows
  const handleBulkDeleteWorkflows = async () => {
    for (const id of Array.from(selectedWorkflowIds)) {
      await ados.db.deleteWorkflow(id);
    }
    setSelectedWorkflowIds(new Set());
    loadAll();
  };

  const handleBulkExportWorkflows = () => {
    const data = workflows.filter(w => selectedWorkflowIds.has(w.id)).map(({ name, slug, description, instructions }) => ({ name, slug, description, instructions }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  // UI/UX Improvement 10: Save inline workflow editing
  const handleSaveWorkflowInstructions = async (id: string) => {
    await ados.db.updateWorkflow?.(id, { instructions: editWorkflowInstructions });
    setEditingWorkflowId(null);
    loadAll();
  };

  const loadAll = async () => {
    try {
      const [conns, sk, wf, dash] = await Promise.all([
        ados.db.getConnections().catch(() => []),
        ados.db.getSkills().catch(() => []),
        ados.db.getWorkflows().catch(() => []),
        ados.db.getDashboards().catch(() => []),
      ]);
      setConnections(conns);
      setSkills(sk);
      setWorkflows(wf);
      setDashboards(dash);
    } catch { /* individual catches above handle failures */ }
  };

  const handleDeleteDashboard = async (id: string) => {
    await ados.db.deleteDashboard(id);
    setViewingDashboard(null);
    loadAll();
  };

  const handleAddConnection = async () => {
    if ((connForm.type === 'mcp' || connForm.type === 'oauth') && connForm.baseUrl) {
      try { new URL(connForm.baseUrl); } catch {
        setUrlError('URL inválida. Use formato: https://...');
        return;
      }
    }
    setUrlError('');
    const id = crypto.randomUUID();
    const config = JSON.stringify({ apiKey: connForm.apiKey, baseUrl: connForm.baseUrl });
    await ados.db.addConnection(id, connForm.name, connForm.type, config);
    setConnForm({ name: '', type: 'api_key', apiKey: '', baseUrl: '' });
    setShowAdd(false);
    loadAll();
  };

  const handleDeleteConnection = async (id: string) => {
    await ados.db.deleteConnection(id);
    setConfirmDelete(null);
    loadAll();
  };

  // Feature 5: Enhanced test with latency and HTTP status
  const handleTestConnection = async (conn: Connection) => {
    const cached = connTestCache.current[conn.id];
    if (cached && Date.now() - cached.ts < 30000) {
      setConnTestResult((prev) => ({ ...prev, [conn.id]: cached.result }));
      return;
    }
    setTestingConn(conn.id);
    setConnTestResult((prev) => { const next = { ...prev }; delete next[conn.id]; return next; });
    const baseUrl = conn.config?.baseUrl;
    const apiKey = conn.config?.apiKey;
    let testDetail: ConnTestDetail = { status: 'ok' };
    if (!baseUrl && !apiKey) {
      await ados.db.updateConnection(conn.id, { status: 'error' });
      testDetail = { status: 'Sem URL ou API key configurada' };
      setConnTestResult((prev) => ({ ...prev, [conn.id]: testDetail }));
      setTestingConn(null);
      connTestCache.current[conn.id] = { result: testDetail, ts: Date.now() };
      loadAll();
      return;
    }
    try {
      if (baseUrl) {
        const start = performance.now();
        const response = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        const latencyMs = Math.round(performance.now() - start);
        if (response.ok || response.status === 405 || response.status === 401) {
          await ados.db.updateConnection(conn.id, { status: 'connected' });
          testDetail = { status: 'ok', latencyMs, httpStatus: response.status };
        } else {
          await ados.db.updateConnection(conn.id, { status: 'error' });
          testDetail = { status: `HTTP ${response.status}`, latencyMs, httpStatus: response.status };
        }
      } else {
        await ados.db.updateConnection(conn.id, { status: 'connected' });
        testDetail = { status: 'ok' };
      }
    } catch (err: any) {
      await ados.db.updateConnection(conn.id, { status: 'error' });
      testDetail = { status: err?.name === 'TimeoutError' ? 'Timeout (5s)' : 'Conexão recusada' };
    }
    setConnTestResult((prev) => ({ ...prev, [conn.id]: testDetail }));
    setTestingConn(null);
    connTestCache.current[conn.id] = { result: testDetail, ts: Date.now() };
    // UI/UX Improvement 3: Persist last-tested timestamp
    setLastTestedAt(prev => {
      const next = { ...prev, [conn.id]: Date.now() };
      localStorage.setItem('tools-conn-last-tested', JSON.stringify(next));
      return next;
    });
    loadAll();
  };

  // Feature 2: Save version history before editing
  const getInstructionHistory = (skillId: string): InstructionVersion[] => {
    try { return JSON.parse(localStorage.getItem(`skill-history-${skillId}`) || '[]'); } catch { return []; }
  };

  const saveInstructionVersion = (skillId: string, instructions: string) => {
    const history = getInstructionHistory(skillId);
    history.push({ instructions, savedAt: new Date().toISOString() });
    localStorage.setItem(`skill-history-${skillId}`, JSON.stringify(history));
  };

  const handleEditSkillInstructions = async (skill: Skill) => {
    setEditingSkill(skill.id);
    setEditInstructions(skill.instructions);
  };

  const handleSaveInstructions = async (id: string) => {
    // Save current version to history before overwriting
    const currentSkill = skills.find(s => s.id === id);
    if (currentSkill) {
      saveInstructionVersion(id, currentSkill.instructions);
    }
    await ados.db.updateSkill?.(id, { instructions: editInstructions });
    setEditingSkill(null);
    loadAll();
  };

  const handleSkillDragStart = (index: number) => setDragSkill(index);
  const handleSkillDrop = (targetIndex: number) => {
    if (dragSkill === null || dragSkill === targetIndex) return;
    const reordered = [...skills];
    const [moved] = reordered.splice(dragSkill, 1);
    reordered.splice(targetIndex, 0, moved);
    setSkills(reordered);
    ados.db.reorderSkills?.(reordered.map(s => s.id)).catch(() => {});
    setDragSkill(null);
  };

  // NEW Feature 1: Duplicar skill handler
  const handleDuplicateSkill = async (skill: Skill) => {
    const id = crypto.randomUUID();
    const newName = `${skill.name} (cópia)`;
    const newSlug = `${skill.slug}-copia-${Date.now().toString(36)}`;
    await ados.db?.addSkill(id, newName, newSlug, skill.description, skill.instructions);
    loadAll();
  };


  // NEW Feature 3: Update webhook URL for skill
  const updateSkillWebhook = (skillId: string, url: string) => {
    setSkillWebhooks(prev => {
      const next = { ...prev, [skillId]: url };
      localStorage.setItem('tools-skill-webhooks', JSON.stringify(next));
      return next;
    });
  };

  // NEW Feature 3: Fire webhook for skill execution
  const fireSkillWebhook = async (skillId: string, result: any) => {
    const url = skillWebhooks[skillId];
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, result, timestamp: new Date().toISOString() }),
      });
    } catch { /* webhook delivery failed silently */ }
  };

  // NEW Feature 4: Increment skill usage
  const incrementSkillUsage = (skillId: string) => {
    setSkillUsage(prev => {
      const next = { ...prev, [skillId]: (prev[skillId] || 0) + 1 };
      localStorage.setItem('tools-skill-usage', JSON.stringify(next));
      return next;
    });
    // Also fire webhook if configured
    fireSkillWebhook(skillId, { event: 'execution', count: (skillUsage[skillId] || 0) + 1 });
  };

  // NEW Feature 5: Detect expired OAuth tokens
  useEffect(() => {
    const checkTokens = () => {
      const expired: Record<string, boolean> = {};
      for (const conn of connections) {
        if (conn.type === 'oauth') {
          const expiresAt = conn.config?.expiresAt;
          if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
            expired[conn.id] = true;
          }
        }
      }
      setExpiredTokens(expired);
    };
    checkTokens();
  }, [connections]);

  // NEW Feature 5: Refresh OAuth token
  const handleRefreshToken = async (conn: Connection) => {
    try {
      await ados.mcp?.refreshOAuthToken?.(conn.id);
      setExpiredTokens(prev => { const next = { ...prev }; delete next[conn.id]; return next; });
      loadAll();
    } catch { /* refresh failed */ }
  };

  // NEW Feature 6: Toggle skill selection
  const toggleSkillSelection = (id: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // NEW Feature 6: Bulk delete selected skills
  const handleBulkDeleteSkills = async () => {
    for (const id of Array.from(selectedSkills)) {
      await ados.db?.deleteSkill(id);
    }
    setSelectedSkills(new Set());
    setBulkMode(false);
    loadAll();
  };

  // NEW Feature 9: Test skill in modal
  const handleTestSkill = async (skillId: string) => {
    setTestSkillRunning(true);
    setTestSkillOutput('');
    try {
      const skill = skills.find(s => s.id === skillId);
      if (!skill) return;
      const result = await ados.llm?.chat?.([
        { role: 'system', content: skill.instructions },
        { role: 'user', content: testSkillInput || 'Olá, teste rápido.' }
      ], 'gpt-4.1-nano');
      setTestSkillOutput(result?.response || result?.error || 'Sem resposta');
      incrementSkillUsage(skillId);
    } catch (e: any) {
      setTestSkillOutput(`Erro: ${e.message}`);
    }
    setTestSkillRunning(false);
  };

  // NEW Feature 10: Import skill from URL
  const handleImportFromUrl = async () => {
    if (!importUrlInput.trim()) return;
    setImportingUrl(true);
    try {
      const response = await fetch(importUrlInput.trim());
      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { name: 'Imported', instructions: text }; }
      const items = Array.isArray(data) ? data : [data];
      for (const s of items) {
        if (!s.name) continue;
        const slug = s.slug || s.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (skills.some(ex => ex.slug === slug)) continue;
        const id = crypto.randomUUID();
        await ados.db.addSkill(id, s.name, slug, s.description || '', s.instructions || '');
      }
      setImportUrlInput('');
      loadAll();
    } catch { /* import failed */ }
    setImportingUrl(false);
  };

  // NEW Feature 11: Skill templates
  const SKILL_TEMPLATES = [
    { name: 'Resumo', slug: 'resumo', description: 'Resumir textos longos', instructions: 'Resuma o texto fornecido em bullet points concisos, mantendo as ideias principais.' },
    { name: 'Análise', slug: 'analise', description: 'Analisar dados e métricas', instructions: 'Analise os dados fornecidos, identifique tendências e forneça insights acionáveis.' },
    { name: 'Tradução', slug: 'traducao', description: 'Traduzir entre idiomas', instructions: 'Traduza o texto para o idioma solicitado, mantendo o tom e contexto original.' },
    { name: 'Código', slug: 'codigo', description: 'Gerar e revisar código', instructions: 'Gere ou revise código conforme solicitado. Use boas práticas, seja conciso e comente apenas o necessário.' },
    { name: 'Email', slug: 'email', description: 'Redigir emails profissionais', instructions: 'Redija um email profissional com tom adequado ao contexto. Seja direto e objetivo.' },
  ];

  const handleApplyTemplate = async (template: typeof SKILL_TEMPLATES[0]) => {
    const slug = `${template.slug}-${Date.now().toString(36)}`;
    const id = crypto.randomUUID();
    await ados.db.addSkill(id, template.name, slug, template.description, template.instructions);
    setShowSkillTemplates(false);
    loadAll();
  };

  // NEW Feature 12: MCP auto-reconnect
  useEffect(() => {
    if (!mcpAutoReconnect) return;
    const interval = setInterval(async () => {
      const servers = await ados.mcp?.listServers?.() || [];
      for (const server of servers) {
        if (server.status === 'disconnected') {
          await ados.mcp?.reconnect?.(server.id).catch(() => {});
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [mcpAutoReconnect]);

  // NEW Feature 13: Validate instruction quality
  const validateInstruction = (skillId: string, instructions: string) => {
    const issues: string[] = [];
    if (instructions.length < 20) issues.push('Instrução muito curta (mín. 20 caracteres)');
    if (instructions.length > 5000) issues.push('Instrução muito longa (máx. 5000 caracteres)');
    if (!instructions.includes(' ')) issues.push('Instrução sem espaços — pode estar mal formatada');
    if (instructions.split('\n').length < 2 && instructions.length > 100) issues.push('Considere quebrar em múltiplas linhas para clareza');
    const score = Math.max(0, 100 - issues.length * 25);
    setValidationResult(prev => ({ ...prev, [skillId]: { score, issues } }));
  };

  // Feature 2: Rollback instruction to previous version
  const handleRollback = async (skillId: string, version: InstructionVersion) => {
    await ados.db.updateSkill?.(skillId, { instructions: version.instructions });
    setShowHistory(null);
    loadAll();
  };

  // NEW Feature 8: Get health dot color based on latency
  const getHealthDot = (connId: string): { color: string; label: string } => {
    const result = connTestResult[connId];
    if (!result) return { color: 'bg-gray-400', label: 'Sem teste' };
    if (result.status !== 'ok') return { color: 'bg-red-500', label: 'Erro' };
    if (result.latencyMs !== undefined) {
      if (result.latencyMs < 300) return { color: 'bg-green-500', label: `${result.latencyMs}ms` };
      if (result.latencyMs < 1000) return { color: 'bg-yellow-500', label: `${result.latencyMs}ms` };
      return { color: 'bg-red-500', label: `${result.latencyMs}ms` };
    }
    return { color: 'bg-green-500', label: 'OK' };
  };

  const handleExportSkills = () => {
    const data = skills.map(({ name, slug, description, instructions }) => ({ name, slug, description, instructions }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const handleImportSkills = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const imported = JSON.parse(text);
      if (!Array.isArray(imported)) return;
      for (const s of imported) {
        if (!s.name || !s.slug) continue;
        if (skills.some(ex => ex.slug === s.slug)) continue;
        const id = crypto.randomUUID();
        await ados.db.addSkill(id, s.name, s.slug, s.description || '', s.instructions || '');
      }
      loadAll();
    } catch { /* invalid clipboard content */ }
  };

  const handleAddSkill = async () => {
    const id = crypto.randomUUID();
    const slug = skillForm.slug || skillForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (skills.some(s => s.slug === slug)) {
      setSlugError(`Slug "/${slug}" já existe`);
      return;
    }
    setSlugError('');
    await ados.db.addSkill(id, skillForm.name, slug, skillForm.description, skillForm.instructions);
    setSkillForm({ name: '', slug: '', description: '', instructions: '' });
    setShowAdd(false);
    loadAll();
  };

  // Feature 6: Check dependencies before deleting
  const handleDeleteSkill = async (id: string) => {
    const skillToDelete = skills.find(s => s.id === id);
    if (skillToDelete) {
      const dependents = skills.filter(s => s.id !== id && s.instructions.includes(`/${skillToDelete.slug}`));
      if (dependents.length > 0 && !dependencyWarning) {
        setDependencyWarning({ id, name: skillToDelete.name, dependents: dependents.map(d => d.name) });
        return;
      }
    }
    await ados.db.deleteSkill(id);
    setConfirmDelete(null);
    setDependencyWarning(null);
    loadAll();
  };

  const handleAddWorkflow = async () => {
    const id = crypto.randomUUID();
    const slug = workflowForm.slug || workflowForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (workflows.some(w => w.slug === slug)) {
      setSlugError(`Slug "@${slug}" já existe`);
      return;
    }
    setSlugError('');
    await ados.db.addWorkflow(id, workflowForm.name, slug, workflowForm.description, workflowForm.instructions);
    setWorkflowForm({ name: '', slug: '', description: '', instructions: '' });
    setShowAdd(false);
    loadAll();
  };

  const handleDeleteWorkflow = async (id: string) => {
    await ados.db.deleteWorkflow(id);
    setConfirmDelete(null);
    loadAll();
  };

  // Feature 4: Toggle favorite
  const toggleFavorite = (slug: string) => {
    setFavorites(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      localStorage.setItem('tools-favorites', JSON.stringify(next));
      return next;
    });
  };

  // Feature 6: Parse dependencies from instructions
  const getSkillDependencies = (skill: Skill): string[] => {
    const matches = skill.instructions.match(/\/([a-z0-9-]+)/g) || [];
    const slugs = matches.map(m => m.slice(1));
    return slugs.filter(s => skills.some(sk => sk.slug === s) && s !== skill.slug);
  };

  // Feature 8: Tags helpers
  const updateSkillTags = (skillId: string, tags: string) => {
    setSkillTags(prev => {
      const next = { ...prev, [skillId]: tags };
      localStorage.setItem('tools-skill-tags', JSON.stringify(next));
      return next;
    });
  };

  const getAllTags = (): string[] => {
    const allTags = new Set<string>();
    Object.values(skillTags).forEach(t => {
      t.split(',').map(tag => tag.trim()).filter(Boolean).forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  };

  // Feature 3: Global search filtering
  const searchLower = globalSearch.toLowerCase().trim();
  const filteredConnections = searchLower ? connections.filter(c => c.name.toLowerCase().includes(searchLower) || c.type.toLowerCase().includes(searchLower)) : connections;
  const filteredSkills = (() => {
    let result = skills;
    if (searchLower) {
      result = result.filter(s => s.name.toLowerCase().includes(searchLower) || s.slug.toLowerCase().includes(searchLower) || s.description.toLowerCase().includes(searchLower));
    }
    if (tagFilter) {
      result = result.filter(s => {
        const tags = (skillTags[s.id] || '').split(',').map(t => t.trim());
        return tags.includes(tagFilter);
      });
    }
    // Sort favorites first
    result = [...result].sort((a, b) => {
      const aFav = favorites.includes(a.slug) ? 0 : 1;
      const bFav = favorites.includes(b.slug) ? 0 : 1;
      return aFav - bFav;
    });
    return result;
  })();
  const filteredWorkflows = (() => {
    let result = searchLower ? workflows.filter(w => w.name.toLowerCase().includes(searchLower) || w.slug.toLowerCase().includes(searchLower) || w.description.toLowerCase().includes(searchLower)) : workflows;
    // Sort favorites first
    result = [...result].sort((a, b) => {
      const aFav = favorites.includes(a.slug) ? 0 : 1;
      const bFav = favorites.includes(b.slug) ? 0 : 1;
      return aFav - bFav;
    });
    return result;
  })();
  const filteredDashboards = searchLower ? dashboards.filter(d => d.name.toLowerCase().includes(searchLower) || d.slug.toLowerCase().includes(searchLower)) : dashboards;

  // NEW Feature 2: Sort connections
  const sortedFilteredConnections = (() => {
    const list = [...filteredConnections];
    if (connSortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (connSortBy === 'status') list.sort((a, b) => a.status.localeCompare(b.status));
    else if (connSortBy === 'date') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return list;
  })();

  const showAllTabs = searchLower.length > 0;

  const tabs: Array<{ id: ToolsTab; label: string; count: number }> = [
    { id: 'connections', label: 'Conexões', count: connections.length },
    { id: 'skills', label: 'Skills', count: skills.length },
    { id: 'workflows', label: 'Workflows', count: workflows.length },
    { id: 'dashboards', label: 'Dashboards', count: dashboards.length },
  ];

  const typeLabels: Record<string, string> = {
    api_key: 'API Key',
    oauth: 'OAuth',
    mcp: 'MCP',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0 animate-fade-in">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-primary">Ferramentas</h1>
          {tab !== 'dashboards' && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
            >
              + Adicionar
            </button>
          )}
        </div>
        <p className="text-sm text-muted mb-4">
          {connections.length} conexões, {skills.length} skills, {workflows.length} workflows, {dashboards.length} dashboards
        </p>

        {/* Feature 3: Global search */}
        <input
          placeholder="Buscar em todas as abas..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full bg-surface-1 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 mb-4"
        />

        <div className="flex gap-1 bg-surface-1 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShowAdd(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id && !showAllTabs ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
              }`}
            >
              {t.label} <span className="text-xs opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {/* CONNECTIONS TAB */}
        {(tab === 'connections' || showAllTabs) && (
          <>
            {showAllTabs && filteredConnections.length > 0 && (
              <h2 className="text-sm font-semibold text-secondary mb-3 mt-4">Conexões</h2>
            )}
            {!showAllTabs && showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Nova Conexão</h3>
                <div className="space-y-3">
                  {/* Feature 7: Templates button */}
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors"
                    >
                      Templates
                    </button>
                  </div>
                  {showTemplates && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {CONNECTION_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.name}
                          onClick={() => { setConnForm({ name: tpl.name, type: tpl.type, apiKey: '', baseUrl: tpl.baseUrl }); setShowTemplates(false); }}
                          className="text-left px-3 py-2 bg-surface-2 border border-default rounded-lg hover:bg-surface-3 transition-colors"
                        >
                          <span className="text-xs font-medium text-primary">{tpl.name}</span>
                          <span className="block text-[10px] text-muted truncate">{tpl.baseUrl}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome (ex: Gmail, GitHub, Notion)"
                      value={connForm.name}
                      onChange={(e) => setConnForm({ ...connForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <select
                      value={connForm.type}
                      onChange={(e) => setConnForm({ ...connForm, type: e.target.value })}
                      className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none"
                    >
                      <option value="api_key">API Key</option>
                      <option value="oauth">OAuth</option>
                      <option value="mcp">MCP</option>
                    </select>
                  </div>
                  {connForm.type === 'api_key' && (
                    <input
                      type="password"
                      placeholder="API Key"
                      value={connForm.apiKey}
                      onChange={(e) => setConnForm({ ...connForm, apiKey: e.target.value })}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  )}
                  {(connForm.type === 'mcp' || connForm.type === 'oauth') && (
                    <div>
                      <input
                        placeholder={connForm.type === 'mcp' ? 'URL do servidor MCP' : 'URL de autorização OAuth'}
                        value={connForm.baseUrl}
                        onChange={(e) => { setConnForm({ ...connForm, baseUrl: e.target.value }); setUrlError(''); }}
                        className={`w-full bg-surface-0 border rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 ${urlError ? 'border-red-500' : 'border-default'}`}
                      />
                      {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddConnection}
                      disabled={!connForm.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UI/UX Improvement 6: Enhanced empty state for connections */}
            {!showAllTabs && connections.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-surface-1 border border-default rounded-2xl p-8 shadow-card max-w-sm w-full">
                  <div className="w-14 h-14 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4 mx-auto">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-primary mb-2">Nenhuma conexão cadastrada</p>
                  <p className="text-xs text-muted mb-5">Conecte suas APIs e serviços externos para expandir as capacidades do JVOS.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => { setShowAdd(true); setShowTemplates(true); }} className="px-4 py-2 rounded-xl text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium">Criar de template</button>
                    <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors font-medium">Importar</button>
                  </div>
                </div>
              </div>
            )}

            {/* NEW Feature 2: Sort dropdown for connections */}
            {!showAllTabs && filteredConnections.length > 0 && (
              <div className="flex gap-2 mb-4 items-center">
                <span className="text-xs text-muted">Ordenar por:</span>
                <select
                  value={connSortBy}
                  onChange={(e) => setConnSortBy(e.target.value as 'name' | 'status' | 'date')}
                  className="px-3 py-1.5 rounded-lg text-xs bg-surface-2 text-secondary border border-default outline-none"
                >
                  <option value="name">Nome</option>
                  <option value="status">Status</option>
                  <option value="date">Data</option>
                </select>
              </div>
            )}

            {/* UI/UX Improvement 2: Floating toolbar for bulk operations on connections */}
            {selectedConnIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-1 border border-default rounded-2xl px-5 py-3 shadow-xl">
                <span className="text-xs text-secondary font-medium">{selectedConnIds.size} selecionada{selectedConnIds.size > 1 ? 's' : ''}</span>
                <button onClick={handleBulkDeleteConnections} className="px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700 transition-colors">Excluir selecionados</button>
                <button onClick={handleBulkExportConnections} className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors">Exportar selecionados</button>
                <button onClick={() => setSelectedConnIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:bg-surface-2 transition-colors">Cancelar</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {sortedFilteredConnections.map((conn, connIdx) => (
                <div
                  key={conn.id}
                  draggable
                  onDragStart={() => handleConnDragStart(connIdx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleConnDrop(connIdx)}
                  className={`bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200 cursor-grab ${draggedConnIdx === connIdx ? 'opacity-50' : ''} ${selectedConnIds.has(conn.id) ? 'ring-2 ring-brand-600' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* UI/UX Improvement 2: Checkbox for bulk selection */}
                      <input
                        type="checkbox"
                        checked={selectedConnIds.has(conn.id)}
                        onChange={() => setSelectedConnIds(prev => { const next = new Set(prev); if (next.has(conn.id)) next.delete(conn.id); else next.add(conn.id); return next; })}
                        className="w-3.5 h-3.5 rounded border-default accent-brand-600"
                      />
                      {/* NEW Feature 8: Health dot indicator */}
                      <span className={`w-2.5 h-2.5 rounded-full ${getHealthDot(conn.id).color}`} title={getHealthDot(conn.id).label}></span>
                      {/* UI/UX Improvement 3: Last tested badge */}
                      {formatLastTested(conn.id) && (
                        <span className="text-[9px] text-muted">{formatLastTested(conn.id)}</span>
                      )}
                      <span className="text-sm font-medium text-primary">{conn.name}</span>
                      {/* UI/UX Improvement 4: Health grade badge */}
                      <span className={`text-xs font-bold ${getHealthGrade(conn.id).color}`}>{getHealthGrade(conn.id).grade}</span>
                    </div>
                    <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      conn.status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-surface-3 text-muted'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${conn.status === 'connected' ? 'bg-status-success' : 'bg-status-error'}`} />
                      {conn.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-3">{typeLabels[conn.type] || conn.type}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleTestConnection(conn)}
                      disabled={testingConn === conn.id}
                      className="px-3 py-1 rounded-lg text-xs bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 transition-colors disabled:opacity-50"
                    >
                      {testingConn === conn.id ? '...' : 'Testar'}
                    </button>
                    {/* Feature 5: Show detailed test results */}
                    {connTestResult[conn.id] && connTestResult[conn.id].status !== 'ok' && (
                      <span className="text-[10px] text-red-500">{connTestResult[conn.id].status}</span>
                    )}
                    {connTestResult[conn.id] && connTestResult[conn.id].status === 'ok' && (
                      <span className="text-[10px] text-green-500">
                        ✓ OK
                        {connTestResult[conn.id].latencyMs !== undefined && ` (${connTestResult[conn.id].latencyMs}ms)`}
                        {connTestResult[conn.id].httpStatus !== undefined && ` [${connTestResult[conn.id].httpStatus}]`}
                      </span>
                    )}
                    <button onClick={() => setConfirmDelete({ type: 'connection', id: conn.id, name: conn.name })} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">Remover</button>
                    {/* NEW Feature 5: OAuth refresh button */}
                    {conn.type === 'oauth' && expiredTokens[conn.id] && (
                      <button onClick={() => handleRefreshToken(conn)} className="px-3 py-1 rounded-lg text-xs bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-colors">Renovar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SKILLS TAB */}
        {(tab === 'skills' || showAllTabs) && (
          <>
            {showAllTabs && filteredSkills.length > 0 && (
              <h2 className="text-sm font-semibold text-secondary mb-3 mt-4">Skills</h2>
            )}
            {!showAllTabs && !showAdd && skills.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                <button onClick={handleExportSkills} className="px-3 py-1.5 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors">Exportar</button>
                <button onClick={handleImportSkills} className="px-3 py-1.5 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors">Importar</button>
                <button onClick={() => setShowSkillTemplates(true)} className="px-3 py-1.5 rounded-lg text-xs bg-brand-600/10 text-brand-400 hover:bg-brand-600/20 transition-colors">Templates</button>
                {/* NEW Feature 6: Multi-select bulk delete toggle */}
                <button
                  onClick={() => { setBulkMode(!bulkMode); setSelectedSkills(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${bulkMode ? 'bg-red-500/10 text-red-500' : 'bg-surface-2 text-secondary hover:bg-surface-3'}`}
                >
                  {bulkMode ? 'Cancelar seleção' : 'Selecionar múltiplas'}
                </button>
                {bulkMode && selectedSkills.size > 0 && (
                  <button
                    onClick={handleBulkDeleteSkills}
                    className="px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Excluir {selectedSkills.size} selecionada{selectedSkills.size > 1 ? 's' : ''}
                  </button>
                )}
                {/* Feature 8: Tag filter */}
                {getAllTags().length > 0 && (
                  <select
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-surface-2 text-secondary border border-default outline-none"
                  >
                    <option value="">Todas as tags</option>
                    {getAllTags().map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {/* NEW Feature 10: Import from URL */}
            {!showAllTabs && !showAdd && skills.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={importUrlInput}
                  onChange={(e) => setImportUrlInput(e.target.value)}
                  placeholder="Importar skill de URL (gist, raw)..."
                  className="flex-1 bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted outline-none focus:border-brand-500/50"
                />
                <button onClick={handleImportFromUrl} disabled={!importUrlInput.trim() || importingUrl} className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 text-white hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted transition-colors">
                  {importingUrl ? '...' : 'Importar'}
                </button>
              </div>
            )}
            {/* NEW Feature 12: MCP auto-reconnect toggle */}
            {!showAllTabs && tab === 'skills' && (
              <div className="flex items-center gap-2 mb-4">
                <label className="text-[10px] text-muted">MCP Auto-reconnect:</label>
                <button
                  onClick={() => { const v = !mcpAutoReconnect; setMcpAutoReconnect(v); localStorage.setItem('mcp-auto-reconnect', String(v)); }}
                  className={`w-8 h-4 rounded-full transition-colors relative ${mcpAutoReconnect ? 'bg-brand-500' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${mcpAutoReconnect ? 'left-4.5 translate-x-0' : 'left-0.5'}`} style={{ left: mcpAutoReconnect ? '17px' : '2px' }} />
                </button>
              </div>
            )}
            {!showAllTabs && showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Nova Skill</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome da skill"
                      value={skillForm.name}
                      onChange={(e) => { setSkillForm({ ...skillForm, name: e.target.value }); setSlugError(''); }}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <input
                      placeholder="Slug (auto)"
                      value={skillForm.slug}
                      onChange={(e) => { setSkillForm({ ...skillForm, slug: e.target.value }); setSlugError(''); }}
                      className="w-40 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  </div>
                  {skillForm.name && !skillForm.slug && (
                    <p className="text-[10px] text-muted">Slug: <span className="font-mono text-secondary">/{skillForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}</span></p>
                  )}
                  {slugError && <p className="text-xs text-red-500">{slugError}</p>}
                  <input
                    placeholder="Descrição curta"
                    value={skillForm.description}
                    onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                  />
                  {/* UI/UX Improvement 8: Instruction tooltip */}
                  <div className="relative">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs text-muted">Instruções</span>
                      <span
                        className="relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-2 text-[10px] text-muted cursor-help"
                        onMouseEnter={() => setShowInstructionTip(true)}
                        onMouseLeave={() => setShowInstructionTip(false)}
                      >
                        ?
                        {showInstructionTip && (
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-surface-2 border border-default rounded-lg p-2.5 shadow-xl text-[10px] text-secondary z-10 pointer-events-none">
                            Dica: seja específico. Ex: "Resuma em 3 bullets, tom formal"
                          </span>
                        )}
                      </span>
                    </div>
                    <textarea
                      placeholder="Instruções (prompt da skill)"
                      value={skillForm.instructions}
                      onChange={(e) => setSkillForm({ ...skillForm, instructions: e.target.value })}
                      rows={4}
                      className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddSkill}
                      disabled={!skillForm.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Criar Skill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UI/UX Improvement 6: Enhanced empty state for skills */}
            {!showAllTabs && skills.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-surface-1 border border-default rounded-2xl p-8 shadow-card max-w-sm w-full">
                  <div className="w-14 h-14 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4 mx-auto">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-primary mb-2">Nenhuma skill cadastrada</p>
                  <p className="text-xs text-muted mb-5">Skills são acionadas com "/" no chat. Crie prompts reutilizáveis para suas tarefas comuns.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setShowSkillTemplates(true)} className="px-4 py-2 rounded-xl text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium">Criar de template</button>
                    <button onClick={handleImportSkills} className="px-4 py-2 rounded-xl text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors font-medium">Importar</button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {filteredSkills.map((skill, idx) => {
                const deps = getSkillDependencies(skill);
                return (
                <div
                  key={skill.id}
                  draggable={!bulkMode}
                  onDragStart={() => handleSkillDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleSkillDrop(idx)}
                  onMouseEnter={() => setHoveredSkill(skill.id)}
                  onMouseLeave={() => setHoveredSkill(null)}
                  className={`relative bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow cursor-grab ${dragSkill === idx ? 'opacity-50' : ''} ${selectedSkills.has(skill.id) ? 'ring-2 ring-brand-600' : ''}`}
                >
                  {/* NEW Feature 7: Preview de instrução no hover (tooltip) */}
                  {hoveredSkill === skill.id && skill.instructions && !editingSkill && (
                    <div className="absolute z-10 bottom-full left-4 mb-2 max-w-xs bg-surface-2 border border-default rounded-lg p-3 shadow-xl pointer-events-none">
                      <p className="text-[10px] text-secondary font-mono whitespace-pre-wrap">{skill.instructions.slice(0, 100)}{skill.instructions.length > 100 ? '...' : ''}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* NEW Feature 6: Multi-select checkbox */}
                      {bulkMode && (
                        <input
                          type="checkbox"
                          checked={selectedSkills.has(skill.id)}
                          onChange={() => toggleSkillSelection(skill.id)}
                          className="w-4 h-4 rounded border-default accent-brand-600"
                        />
                      )}
                      {/* Feature 4: Favorite button */}
                      <button
                        onClick={() => toggleFavorite(skill.slug)}
                        className={`text-sm ${favorites.includes(skill.slug) ? 'text-yellow-500' : 'text-muted hover:text-yellow-500'} transition-colors`}
                        title={favorites.includes(skill.slug) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      >
                        {favorites.includes(skill.slug) ? '★' : '☆'}
                      </button>
                      <span className="text-sm font-medium text-primary">{skill.name}</span>
                      {/* UI/UX Improvement 9: Skill performance indicators */}
                      {(skillUsage[skill.id] || 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-3 text-muted">
                          {skillUsage[skill.id]} usos
                          {(skillUsage[skill.id] || 0) >= 5 && <span className="text-green-500">&#9650;</span>}
                          {(skillUsage[skill.id] || 0) >= 3 && (skillUsage[skill.id] || 0) < 5 && <span className="text-yellow-500">&#9654;</span>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Feature 6: Dependencies badge */}
                      {deps.length > 0 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500" title={`Depende de: ${deps.map(d => '/' + d).join(', ')}`}>
                          {deps.length} dep{deps.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">/{skill.slug}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted mb-2 line-clamp-2">{skill.description || 'Sem descrição'}</p>
                  {/* Feature 8: Tags display and edit */}
                  <div className="mb-3">
                    <input
                      placeholder="Tags (separadas por vírgula)"
                      value={skillTags[skill.id] || ''}
                      onChange={(e) => updateSkillTags(skill.id, e.target.value)}
                      className="w-full bg-surface-0 border border-default rounded-lg px-2 py-1 text-[10px] text-secondary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    {skillTags[skill.id] && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {skillTags[skill.id].split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-brand-600/10 text-brand-500 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {editingSkill === skill.id ? (
                    <div className="mb-3">
                      <textarea
                        value={editInstructions}
                        onChange={(e) => setEditInstructions(e.target.value)}
                        rows={6}
                        className="w-full bg-surface-0 border border-brand-500/30 rounded-lg px-3 py-2 text-xs text-primary font-mono outline-none resize-none"
                        spellCheck={false}
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleSaveInstructions(skill.id)} className="px-3 py-1 rounded-lg text-xs bg-brand-600 text-white hover:bg-brand-700">Salvar</button>
                        <button onClick={() => setEditingSkill(null)} className="px-3 py-1 rounded-lg text-xs text-muted hover:bg-surface-2">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => handleEditSkillInstructions(skill)} className="px-3 py-1 rounded-lg text-xs bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 transition-colors">Editar</button>
                        {/* NEW Feature 1: Duplicar skill button */}
                        <button onClick={() => handleDuplicateSkill(skill)} className="px-3 py-1 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors">Duplicar</button>
                        {/* Feature 2: History button */}
                        <button onClick={() => setShowHistory(showHistory === skill.id ? null : skill.id)} className="px-3 py-1 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors">Histórico</button>
                        {/* NEW Feature 9: Test skill button */}
                        <button onClick={() => { setTestingSkillId(skill.id); setTestSkillInput(''); setTestSkillOutput(''); }} className="px-3 py-1 rounded-lg text-xs bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors">Testar</button>
                        {/* NEW Feature 13: Validate instruction */}
                        <button onClick={() => validateInstruction(skill.id, skill.instructions)} className="px-3 py-1 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors">Validar</button>
                        <button onClick={() => setConfirmDelete({ type: 'skill', id: skill.id, name: skill.name })} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">Remover</button>
                      </div>
                      {/* NEW Feature 3: Webhook URL field */}
                      <div className="mt-2">
                        <input
                          placeholder="Webhook URL (POST ao executar)"
                          value={skillWebhooks[skill.id] || ''}
                          onChange={(e) => updateSkillWebhook(skill.id, e.target.value)}
                          className="w-full bg-surface-0 border border-default rounded-lg px-2 py-1 text-[10px] text-secondary placeholder-muted outline-none focus:border-brand-500/50"
                        />
                      </div>
                    </>
                  )}
                  {/* NEW Feature 13: Validation result */}
                  {validationResult[skill.id] && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-[10px] ${validationResult[skill.id].score >= 75 ? 'bg-green-500/10 text-green-500' : validationResult[skill.id].score >= 50 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-400'}`}>
                      <span className="font-medium">Qualidade: {validationResult[skill.id].score}/100</span>
                      {validationResult[skill.id].issues.length > 0 && (
                        <ul className="mt-1 space-y-0.5 list-disc list-inside">
                          {validationResult[skill.id].issues.map((issue, i) => <li key={i}>{issue}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  {/* Feature 2: History panel */}
                  {showHistory === skill.id && (
                    <div className="mt-3 border-t border-default pt-3">
                      <h4 className="text-[10px] font-semibold text-secondary mb-2">Histórico de versões</h4>
                      {getInstructionHistory(skill.id).length === 0 ? (
                        <p className="text-[10px] text-muted">Nenhuma versão anterior salva.</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {getInstructionHistory(skill.id).slice().reverse().map((ver, i) => (
                            <div key={i} className="bg-surface-0 border border-default rounded-lg p-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[9px] text-muted">{new Date(ver.savedAt).toLocaleString('pt-BR')}</p>
                                <button onClick={() => handleRollback(skill.id, ver)} className="text-[9px] text-brand-400 hover:text-brand-300 font-medium">Restaurar</button>
                              </div>
                              <pre className="text-[10px] text-secondary font-mono whitespace-pre-wrap line-clamp-4">{ver.instructions}</pre>
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
          </>
        )}

        {/* WORKFLOWS TAB */}
        {(tab === 'workflows' || showAllTabs) && (
          <>
            {showAllTabs && filteredWorkflows.length > 0 && (
              <h2 className="text-sm font-semibold text-secondary mb-3 mt-4">Workflows</h2>
            )}
            {!showAllTabs && showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-6 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-4">Novo Workflow</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input
                      placeholder="Nome do workflow"
                      value={workflowForm.name}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                      className="flex-1 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                    <input
                      placeholder="Slug (auto)"
                      value={workflowForm.slug}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, slug: e.target.value })}
                      className="w-40 bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                    />
                  </div>
                  <input
                    placeholder="Descrição curta"
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50"
                  />
                  <textarea
                    placeholder="Instruções (prompt do workflow)"
                    value={workflowForm.instructions}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, instructions: e.target.value })}
                    rows={4}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAddWorkflow}
                      disabled={!workflowForm.name}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Criar Workflow
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* UI/UX Improvement 6: Enhanced empty state for workflows */}
            {!showAllTabs && workflows.length === 0 && !showAdd && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-surface-1 border border-default rounded-2xl p-8 shadow-card max-w-sm w-full">
                  <div className="w-14 h-14 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-4 mx-auto">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500">
                      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-primary mb-2">Nenhum workflow cadastrado</p>
                  <p className="text-xs text-muted mb-5">Workflows são acionados com "@" no chat. Encadeie múltiplas skills em um fluxo automatizado.</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium">Criar de template</button>
                    <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors font-medium">Importar</button>
                  </div>
                </div>
              </div>
            )}

            {/* UI/UX Improvement 2: Floating toolbar for bulk operations on workflows */}
            {selectedWorkflowIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-surface-1 border border-default rounded-2xl px-5 py-3 shadow-xl">
                <span className="text-xs text-secondary font-medium">{selectedWorkflowIds.size} selecionado{selectedWorkflowIds.size > 1 ? 's' : ''}</span>
                <button onClick={handleBulkDeleteWorkflows} className="px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700 transition-colors">Excluir selecionados</button>
                <button onClick={handleBulkExportWorkflows} className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 text-white hover:bg-brand-700 transition-colors">Exportar selecionados</button>
                <button onClick={() => setSelectedWorkflowIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:bg-surface-2 transition-colors">Cancelar</button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {filteredWorkflows.map((wf) => (
                <div key={wf.id} className={`bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow ${selectedWorkflowIds.has(wf.id) ? 'ring-2 ring-brand-600' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* UI/UX Improvement 2: Checkbox for workflow bulk selection */}
                      <input
                        type="checkbox"
                        checked={selectedWorkflowIds.has(wf.id)}
                        onChange={() => setSelectedWorkflowIds(prev => { const next = new Set(prev); if (next.has(wf.id)) next.delete(wf.id); else next.add(wf.id); return next; })}
                        className="w-3.5 h-3.5 rounded border-default accent-brand-600"
                      />
                      {/* Feature 4: Favorite button for workflows */}
                      <button
                        onClick={() => toggleFavorite(wf.slug)}
                        className={`text-sm ${favorites.includes(wf.slug) ? 'text-yellow-500' : 'text-muted hover:text-yellow-500'} transition-colors`}
                        title={favorites.includes(wf.slug) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      >
                        {favorites.includes(wf.slug) ? '★' : '☆'}
                      </button>
                      <span className="text-sm font-medium text-primary">{wf.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">@{wf.slug}</span>
                  </div>
                  <p className="text-xs text-muted mb-3 line-clamp-2">{wf.description || 'Sem descrição'}</p>
                  {/* UI/UX Improvement 10: Inline workflow editing */}
                  {editingWorkflowId === wf.id ? (
                    <div className="mb-3">
                      <textarea
                        value={editWorkflowInstructions}
                        onChange={(e) => setEditWorkflowInstructions(e.target.value)}
                        rows={5}
                        className="w-full bg-surface-0 border border-brand-500/30 rounded-lg px-3 py-2 text-xs text-primary font-mono outline-none resize-none"
                        spellCheck={false}
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleSaveWorkflowInstructions(wf.id)} className="px-3 py-1 rounded-lg text-xs bg-brand-600 text-white hover:bg-brand-700">Salvar</button>
                        <button onClick={() => setEditingWorkflowId(null)} className="px-3 py-1 rounded-lg text-xs text-muted hover:bg-surface-2">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {/* UI/UX Improvement 10: Edit button */}
                      <button onClick={() => { setEditingWorkflowId(wf.id); setEditWorkflowInstructions(wf.instructions); }} className="px-3 py-1 rounded-lg text-xs bg-brand-600/10 text-brand-500 hover:bg-brand-600/20 transition-colors">Editar</button>
                      {/* UI/UX Improvement 5: Preview button */}
                      <button onClick={() => setPreviewingWorkflow(wf)} className="px-3 py-1 rounded-lg text-xs bg-surface-2 text-secondary hover:bg-surface-3 transition-colors">Preview</button>
                      <button onClick={() => setConfirmDelete({ type: 'workflow', id: wf.id, name: wf.name })} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10 transition-colors">Remover</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* DASHBOARDS TAB */}
        {(tab === 'dashboards' || showAllTabs) && (
          <>
            {showAllTabs && filteredDashboards.length > 0 && (
              <h2 className="text-sm font-semibold text-secondary mb-3 mt-4">Dashboards</h2>
            )}
            {!showAllTabs && viewingDashboard ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setViewingDashboard(null)} className="text-xs text-muted hover:text-secondary">← Voltar</button>
                    <span className="text-sm font-medium text-primary">{viewingDashboard.name}</span>
                  </div>
                  <button onClick={() => handleDeleteDashboard(viewingDashboard.id)} className="px-3 py-1 rounded-lg text-xs text-red-500 hover:bg-red-500/10">Remover</button>
                </div>
                <div className="flex-1 rounded-xl overflow-hidden border border-default bg-white">
                  <iframe
                    srcDoc={viewingDashboard.html}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts"
                    title={viewingDashboard.name}
                  />
                </div>
              </div>
            ) : (
              <>
                {!showAllTabs && dashboards.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="14" y="3" width="7" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="14" y="10" width="7" height="11" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="13" width="7" height="8" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-secondary mb-1">Nenhum dashboard encontrado</p>
                    <p className="text-xs text-muted">Peça à IA para criar um dashboard e ele aparecerá aqui.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {filteredDashboards.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setViewingDashboard(d)}
                      className="bg-surface-1 border border-default rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-shadow text-left"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">{d.name}</span>
                        <span className="text-[10px] text-muted">{new Date(d.updatedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-muted">/{d.slug}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Confirmar exclusão</h3>
            <p className="text-xs text-muted mb-4">
              Tem certeza que deseja excluir <span className="font-medium text-secondary">"{confirmDelete.name}"</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button
                onClick={() => {
                  if (confirmDelete.type === 'connection') handleDeleteConnection(confirmDelete.id);
                  else if (confirmDelete.type === 'skill') handleDeleteSkill(confirmDelete.id);
                  else if (confirmDelete.type === 'workflow') handleDeleteWorkflow(confirmDelete.id);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 9: Test skill modal */}
      {testingSkillId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setTestingSkillId(null); setTestSkillOutput(''); setTestSkillInput(''); }}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-3">Testar Skill</h3>
            <textarea
              value={testSkillInput}
              onChange={(e) => setTestSkillInput(e.target.value)}
              placeholder="Digite uma mensagem de teste..."
              rows={3}
              className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder-muted outline-none focus:border-brand-500/50 resize-none mb-3"
            />
            <button onClick={() => handleTestSkill(testingSkillId)} disabled={testSkillRunning} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 rounded-xl text-sm font-medium text-white mb-3">
              {testSkillRunning ? 'Executando...' : 'Executar teste'}
            </button>
            {testSkillOutput && (
              <div className="bg-surface-0 border border-default rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-secondary whitespace-pre-wrap">{testSkillOutput}</pre>
              </div>
            )}
            <div className="flex justify-end mt-3">
              <button onClick={() => { setTestingSkillId(null); setTestSkillOutput(''); setTestSkillInput(''); }} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW Feature 11: Skill templates wizard */}
      {showSkillTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSkillTemplates(false)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Templates de Skill</h3>
            <div className="space-y-2">
              {SKILL_TEMPLATES.map((t) => (
                <button key={t.slug} onClick={() => handleApplyTemplate(t)} className="w-full flex items-center gap-3 p-3 bg-surface-0 border border-default rounded-xl hover:border-brand-500/40 transition-all text-left">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-primary">{t.name}</div>
                    <div className="text-[10px] text-muted">{t.description}</div>
                  </div>
                  <span className="text-[10px] text-brand-400">Usar →</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowSkillTemplates(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* UI/UX Improvement 7: Keyboard shortcut overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Atalhos de teclado</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-default">
                <span className="text-xs text-secondary">Excluir item</span>
                <kbd className="px-2 py-0.5 bg-surface-2 rounded text-[10px] font-mono text-muted">Del</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-default">
                <span className="text-xs text-secondary">Editar item</span>
                <kbd className="px-2 py-0.5 bg-surface-2 rounded text-[10px] font-mono text-muted">E</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-default">
                <span className="text-xs text-secondary">Testar conexão</span>
                <kbd className="px-2 py-0.5 bg-surface-2 rounded text-[10px] font-mono text-muted">T</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-default">
                <span className="text-xs text-secondary">Duplicar skill</span>
                <kbd className="px-2 py-0.5 bg-surface-2 rounded text-[10px] font-mono text-muted">D</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-secondary">Mostrar/ocultar atalhos</span>
                <kbd className="px-2 py-0.5 bg-surface-2 rounded text-[10px] font-mono text-muted">?</kbd>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowShortcuts(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* UI/UX Improvement 5: Workflow visualizer modal */}
      {previewingWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPreviewingWorkflow(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-4">Preview: {previewingWorkflow.name}</h3>
            <div className="bg-surface-0 border border-default rounded-xl p-4 overflow-y-auto max-h-80">
              {/* Simple div-based flowchart */}
              <div className="flex flex-col items-center gap-0">
                {(previewingWorkflow.instructions || '').split('\n').filter(line => line.trim()).map((step, i, arr) => (
                  <div key={i} className="flex flex-col items-center w-full">
                    <div className="w-full max-w-xs bg-brand-600/10 border border-brand-500/30 rounded-lg px-4 py-2.5 text-center">
                      <span className="text-[10px] text-muted block mb-0.5">Passo {i + 1}</span>
                      <span className="text-xs text-primary">{step.trim()}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex flex-col items-center my-1">
                        <div className="w-px h-4 bg-brand-500/40"></div>
                        <div className="text-brand-500 text-[10px]">&#9660;</div>
                      </div>
                    )}
                  </div>
                ))}
                {!(previewingWorkflow.instructions || '').trim() && (
                  <p className="text-xs text-muted text-center">Nenhuma instrução definida para este workflow.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setPreviewingWorkflow(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-menu integration: notification toast */}
      {crossMenuNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-brand-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          {crossMenuNotification}
        </div>
      )}

      {/* Feature 6: Dependency warning modal */}
      {dependencyWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDependencyWarning(null)}>
          <div className="bg-surface-1 border border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-primary mb-2">Aviso de dependência</h3>
            <p className="text-xs text-muted mb-2">
              A skill <span className="font-medium text-secondary">"{dependencyWarning.name}"</span> é referenciada por:
            </p>
            <ul className="text-xs text-secondary mb-4 list-disc list-inside">
              {dependencyWarning.dependents.map(d => <li key={d}>{d}</li>)}
            </ul>
            <p className="text-xs text-muted mb-4">Deseja excluir mesmo assim?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDependencyWarning(null)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
              <button
                onClick={() => handleDeleteSkill(dependencyWarning.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-medium text-white"
              >
                Excluir mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
