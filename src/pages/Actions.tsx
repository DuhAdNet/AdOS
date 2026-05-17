import { useState, useEffect, useCallback } from 'react';

const ados = (window as any).ados;

type TriggerType = 'manual' | 'event' | 'schedule' | 'webhook';
type ListenerType = 'gmail' | 'calendar' | 'sheets' | 'uptime' | 'slack';
type ActionNodeType = 'http_request' | 'run_script' | 'send_notification' | 'transform_data' | 'condition' | 'delay' | 'loop';

interface Flow {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  enabled: boolean;
  lastRun: string | null;
  runCount: number;
  nodes: ActionNode[];
  createdAt: string;
}

interface ActionNode {
  id: string;
  type: ActionNodeType;
  label: string;
  config: Record<string, any>;
}

interface Listener {
  id: string;
  name: string;
  type: ListenerType;
  enabled: boolean;
  interval: number;
  lastCheck: string | null;
  eventsCount: number;
}

interface ListenerEvent {
  id: string;
  listenerId: string;
  listenerName: string;
  type: ListenerType;
  message: string;
  timestamp: string;
}

type Tab = 'flows' | 'listeners' | 'events';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: 'Manual',
  event: 'Evento',
  schedule: 'Agendado',
  webhook: 'Webhook',
};

const TRIGGER_COLORS: Record<TriggerType, string> = {
  manual: 'bg-blue-500/20 text-blue-400',
  event: 'bg-purple-500/20 text-purple-400',
  schedule: 'bg-green-500/20 text-green-400',
  webhook: 'bg-orange-500/20 text-orange-400',
};

const LISTENER_COLORS: Record<ListenerType, string> = {
  gmail: 'bg-red-500/20 text-red-400',
  calendar: 'bg-blue-500/20 text-blue-400',
  sheets: 'bg-green-500/20 text-green-400',
  uptime: 'bg-yellow-500/20 text-yellow-400',
  slack: 'bg-purple-500/20 text-purple-400',
};

const ACTION_NODE_LABELS: Record<ActionNodeType, string> = {
  http_request: 'HTTP Request',
  run_script: 'Executar Script',
  send_notification: 'Enviar Notificação',
  transform_data: 'Transformar Dados',
  condition: 'Condição',
  delay: 'Delay',
  loop: 'Loop',
};

const defaultFlowForm = {
  name: '',
  description: '',
  triggerType: 'manual' as TriggerType,
  nodes: [] as ActionNode[],
};

export default function Actions() {
  const [tab, setTab] = useState<Tab>('flows');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [events, setEvents] = useState<ListenerEvent[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [flowForm, setFlowForm] = useState({ ...defaultFlowForm });
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [flowsRes, listenersRes, eventsRes] = await Promise.all([
        ados?.actions?.listFlows?.() ?? { flows: [] },
        ados?.listeners?.list?.() ?? { listeners: [] },
        ados?.listeners?.getEvents?.('', 50) ?? { events: [] },
      ]);
      setFlows(Array.isArray(flowsRes) ? flowsRes : (flowsRes?.flows || []));
      setListeners(Array.isArray(listenersRes) ? listenersRes : (listenersRes?.listeners || []));
      setEvents(Array.isArray(eventsRes) ? eventsRes : (eventsRes?.events || []));
    } catch (e) {
      console.error('Actions: failed to load data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Listen for cross-page events
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('actions-updated', handler);
    return () => window.removeEventListener('actions-updated', handler);
  }, [loadData]);

  // Stats
  const totalFlows = flows.length;
  const activeFlows = flows.filter(f => f.enabled).length;
  const totalExecutions = flows.reduce((sum, f) => sum + (f.runCount || 0), 0);

  // Flow CRUD
  const handleCreateFlow = async () => {
    if (!flowForm.name.trim()) return;
    try {
      if (editingFlowId) {
        await ados?.actions?.updateFlow?.(editingFlowId, {
          name: flowForm.name,
          description: flowForm.description,
          triggerType: flowForm.triggerType,
          nodes: flowForm.nodes,
        });
      } else {
        await ados?.actions?.createFlow?.({
          name: flowForm.name,
          description: flowForm.description,
          triggerType: flowForm.triggerType,
          nodes: flowForm.nodes,
        });
      }
      setShowCreateModal(false);
      setFlowForm({ ...defaultFlowForm });
      setEditingFlowId(null);
      window.dispatchEvent(new CustomEvent('actions-updated'));
      loadData();
    } catch (e) {
      console.error('Failed to save flow', e);
    }
  };

  const handleDeleteFlow = async (id: string) => {
    try {
      await ados?.actions?.deleteFlow?.(id);
      window.dispatchEvent(new CustomEvent('actions-updated'));
      loadData();
    } catch (e) {
      console.error('Failed to delete flow', e);
    }
  };

  const handleToggleFlow = async (id: string, enabled: boolean) => {
    try {
      await ados?.actions?.updateFlow?.(id, { enabled });
      window.dispatchEvent(new CustomEvent('actions-updated'));
      loadData();
    } catch (e) {
      console.error('Failed to toggle flow', e);
    }
  };

  const handleExecuteFlow = async (id: string) => {
    try {
      await ados?.actions?.executeFlow?.(id);
      window.dispatchEvent(new CustomEvent('actions-updated'));
      loadData();
    } catch (e) {
      console.error('Failed to execute flow', e);
    }
  };

  const handleEditFlow = (flow: Flow) => {
    setEditingFlowId(flow.id);
    setFlowForm({
      name: flow.name,
      description: flow.description,
      triggerType: flow.triggerType,
      nodes: flow.nodes || [],
    });
    setShowCreateModal(true);
  };

  const handleToggleListener = async (id: string, enabled: boolean) => {
    try {
      await ados?.listeners?.update?.(id, { enabled });
      window.dispatchEvent(new CustomEvent('actions-updated'));
      loadData();
    } catch (e) {
      console.error('Failed to toggle listener', e);
    }
  };

  // Node builder helpers
  const addNode = (type: ActionNodeType) => {
    const node: ActionNode = {
      id: crypto.randomUUID(),
      type,
      label: ACTION_NODE_LABELS[type],
      config: {},
    };
    setFlowForm(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
  };

  const removeNode = (nodeId: string) => {
    setFlowForm(prev => ({ ...prev, nodes: prev.nodes.filter(n => n.id !== nodeId) }));
  };

  const updateNodeConfig = (nodeId: string, key: string, value: any) => {
    setFlowForm(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n
      ),
    }));
  };

  const formatTime = (ts: string | null) => {
    if (!ts) return 'Nunca';
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0b0f1a]">
        <div className="animate-pulse text-gray-400">Carregando Actions Engine...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0f1a] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2538]">
        <div>
          <h1 className="text-xl font-bold text-white">Actions Engine</h1>
          <p className="text-sm text-gray-400 mt-0.5">Automações sem tokens</p>
        </div>
        <button
          onClick={() => {
            setEditingFlowId(null);
            setFlowForm({ ...defaultFlowForm });
            setShowCreateModal(true);
          }}
          className="px-4 py-2 bg-[#6c5ce7] hover:bg-[#5a4bd6] text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Criar Flow
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-[#1e2538]">
        <div className="bg-[#141926] rounded-lg p-3 border border-[#1e2538]">
          <p className="text-xs text-gray-400">Total Flows</p>
          <p className="text-lg font-bold text-white">{totalFlows}</p>
        </div>
        <div className="bg-[#141926] rounded-lg p-3 border border-[#1e2538]">
          <p className="text-xs text-gray-400">Flows Ativos</p>
          <p className="text-lg font-bold text-green-400">{activeFlows}</p>
        </div>
        <div className="bg-[#141926] rounded-lg p-3 border border-[#1e2538]">
          <p className="text-xs text-gray-400">Total Execuções</p>
          <p className="text-lg font-bold text-white">{totalExecutions}</p>
        </div>
        <div className="bg-[#141926] rounded-lg p-3 border border-[#1e2538]">
          <p className="text-xs text-gray-400">Tokens Gastos</p>
          <p className="text-lg font-bold text-emerald-400">0</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4">
        {([
          { key: 'flows', label: 'Flows', count: totalFlows },
          { key: 'listeners', label: 'Listeners', count: listeners.length },
          { key: 'events', label: 'Eventos', count: events.length },
        ] as { key: Tab; label: string; count: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.key
                ? 'bg-[#141926] text-white border border-[#1e2538] border-b-transparent'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Flows Tab */}
        {tab === 'flows' && (
          <div className="space-y-3 pt-4">
            {flows.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Nenhum flow criado</p>
                <p className="text-sm mt-1">Clique em "Criar Flow" para começar</p>
              </div>
            )}
            {flows.map(flow => (
              <div key={flow.id} className="bg-[#141926] border border-[#1e2538] rounded-lg p-4 animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{flow.name}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${TRIGGER_COLORS[flow.triggerType]}`}>
                        {TRIGGER_LABELS[flow.triggerType]}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                        flow.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${flow.enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
                        {flow.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {flow.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{flow.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                      <span>Última exec: {formatTime(flow.lastRun)}</span>
                      <span>Execuções: {flow.runCount || 0}</span>
                      <span>{flow.nodes?.length || 0} nodes</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggleFlow(flow.id, !flow.enabled)}
                      className={`w-9 h-5 rounded-full relative transition-colors ${
                        flow.enabled ? 'bg-[#6c5ce7]' : 'bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          flow.enabled ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                    {/* Execute */}
                    <button
                      onClick={() => handleExecuteFlow(flow.id)}
                      className="p-1.5 rounded hover:bg-[#1e2538] text-green-400 transition-colors"
                      title="Executar"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => handleEditFlow(flow)}
                      className="p-1.5 rounded hover:bg-[#1e2538] text-blue-400 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteFlow(flow.id)}
                      className="p-1.5 rounded hover:bg-[#1e2538] text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Listeners Tab */}
        {tab === 'listeners' && (
          <div className="space-y-3 pt-4">
            {listeners.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Nenhum listener ativo</p>
                <p className="text-sm mt-1">Listeners são criados via configuração do sistema</p>
              </div>
            )}
            {listeners.map(listener => (
              <div key={listener.id} className="bg-[#141926] border border-[#1e2538] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{listener.name}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${LISTENER_COLORS[listener.type]}`}>
                        {listener.type}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                        listener.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {listener.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                      <span>Intervalo: {listener.interval}s</span>
                      <span>Último check: {formatTime(listener.lastCheck)}</span>
                      <span>Eventos: {listener.eventsCount || 0}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleListener(listener.id, !listener.enabled)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      listener.enabled ? 'bg-[#6c5ce7]' : 'bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        listener.enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <div className="space-y-2 pt-4">
            {events.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">Nenhum evento recente</p>
                <p className="text-sm mt-1">Eventos aparecerão aqui quando listeners detectarem mudanças</p>
              </div>
            )}
            {events.map(event => (
              <div key={event.id} className="bg-[#141926] border border-[#1e2538] rounded-lg px-4 py-3 flex items-center gap-3">
                <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full shrink-0 ${LISTENER_COLORS[event.type]}`}>
                  {event.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{event.message}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{event.listenerName}</p>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">{formatTime(event.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Flow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#141926] border border-[#1e2538] rounded-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2538]">
              <h2 className="text-base font-bold text-white">
                {editingFlowId ? 'Editar Flow' : 'Criar Flow'}
              </h2>
              <button
                onClick={() => { setShowCreateModal(false); setEditingFlowId(null); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={flowForm.name}
                  onChange={e => setFlowForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Sync dados do Sheets"
                  className="w-full px-3 py-2 bg-[#0b0f1a] border border-[#1e2538] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
                <input
                  type="text"
                  value={flowForm.description}
                  onChange={e => setFlowForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Breve descrição do flow"
                  className="w-full px-3 py-2 bg-[#0b0f1a] border border-[#1e2538] rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7]"
                />
              </div>

              {/* Trigger Type */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tipo de Trigger</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setFlowForm(prev => ({ ...prev, triggerType: t }))}
                      className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                        flowForm.triggerType === t
                          ? 'border-[#6c5ce7] bg-[#6c5ce7]/10 text-[#6c5ce7]'
                          : 'border-[#1e2538] text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {TRIGGER_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Node Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-400">Nodes ({flowForm.nodes.length})</label>
                  <select
                    onChange={e => { if (e.target.value) { addNode(e.target.value as ActionNodeType); e.target.value = ''; } }}
                    className="px-2 py-1 bg-[#0b0f1a] border border-[#1e2538] rounded text-xs text-gray-300 focus:outline-none focus:border-[#6c5ce7]"
                    defaultValue=""
                  >
                    <option value="" disabled>+ Adicionar node</option>
                    {(Object.keys(ACTION_NODE_LABELS) as ActionNodeType[]).map(type => (
                      <option key={type} value={type}>{ACTION_NODE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>

                {flowForm.nodes.length === 0 && (
                  <div className="border border-dashed border-[#1e2538] rounded-lg p-4 text-center text-xs text-gray-500">
                    Adicione nodes para construir o flow
                  </div>
                )}

                <div className="space-y-2">
                  {flowForm.nodes.map((node, idx) => (
                    <div key={node.id} className="bg-[#0b0f1a] border border-[#1e2538] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono">#{idx + 1}</span>
                          <span className="text-xs font-medium text-white">{node.label}</span>
                          <span className="text-[10px] text-gray-500 bg-[#141926] px-1.5 py-0.5 rounded">{node.type}</span>
                        </div>
                        <button
                          onClick={() => removeNode(node.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Config fields per node type */}
                      {node.type === 'http_request' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="URL"
                            value={node.config.url || ''}
                            onChange={e => updateNodeConfig(node.id, 'url', e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7]"
                          />
                          <select
                            value={node.config.method || 'GET'}
                            onChange={e => updateNodeConfig(node.id, 'method', e.target.value)}
                            className="px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white focus:outline-none focus:border-[#6c5ce7]"
                          >
                            <option>GET</option>
                            <option>POST</option>
                            <option>PUT</option>
                            <option>DELETE</option>
                          </select>
                        </div>
                      )}
                      {node.type === 'run_script' && (
                        <textarea
                          placeholder="Script (bash/node)"
                          value={node.config.script || ''}
                          onChange={e => updateNodeConfig(node.id, 'script', e.target.value)}
                          rows={3}
                          className="w-full px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7] font-mono resize-none"
                        />
                      )}
                      {node.type === 'send_notification' && (
                        <div className="space-y-2">
                          <select
                            value={node.config.channel || 'in-app'}
                            onChange={e => updateNodeConfig(node.id, 'channel', e.target.value)}
                            className="px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white focus:outline-none focus:border-[#6c5ce7]"
                          >
                            <option value="in-app">In-app</option>
                            <option value="slack">Slack</option>
                            <option value="telegram">Telegram</option>
                            <option value="email">Email</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Mensagem"
                            value={node.config.message || ''}
                            onChange={e => updateNodeConfig(node.id, 'message', e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7]"
                          />
                        </div>
                      )}
                      {node.type === 'transform_data' && (
                        <textarea
                          placeholder="Expressão de transformação (JSON path, template)"
                          value={node.config.expression || ''}
                          onChange={e => updateNodeConfig(node.id, 'expression', e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7] font-mono resize-none"
                        />
                      )}
                      {node.type === 'condition' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Condição (ex: response.status === 200)"
                            value={node.config.condition || ''}
                            onChange={e => updateNodeConfig(node.id, 'condition', e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7] font-mono"
                          />
                        </div>
                      )}
                      {node.type === 'delay' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Segundos"
                            value={node.config.seconds || ''}
                            onChange={e => updateNodeConfig(node.id, 'seconds', parseInt(e.target.value) || 0)}
                            className="w-24 px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7]"
                          />
                          <span className="text-xs text-gray-500">segundos</span>
                        </div>
                      )}
                      {node.type === 'loop' && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Iterável (ex: data.items)"
                            value={node.config.iterable || ''}
                            onChange={e => updateNodeConfig(node.id, 'iterable', e.target.value)}
                            className="w-full px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7] font-mono"
                          />
                          <input
                            type="number"
                            placeholder="Max iterações"
                            value={node.config.maxIterations || ''}
                            onChange={e => updateNodeConfig(node.id, 'maxIterations', parseInt(e.target.value) || 0)}
                            className="w-32 px-2 py-1.5 bg-[#141926] border border-[#1e2538] rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#6c5ce7]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#1e2538]">
              <button
                onClick={() => { setShowCreateModal(false); setEditingFlowId(null); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFlow}
                disabled={!flowForm.name.trim()}
                className="px-4 py-2 bg-[#6c5ce7] hover:bg-[#5a4bd6] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editingFlowId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
