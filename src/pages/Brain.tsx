import { useState, useEffect } from 'react';

type BrainTab = 'overview' | 'memory' | 'sync';

interface Memory {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

const ados = (window as any).ados;

const categories = ['general', 'user', 'project', 'feedback', 'reference'];

export default function Brain() {
  const [tab, setTab] = useState<BrainTab>('overview');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ content: '', category: 'general' });

  useEffect(() => { loadMemories(); }, []);

  const loadMemories = async () => {
    const rows = await ados.db.getMemories();
    setMemories(rows);
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      const rows = await ados.db.searchMemories(query);
      setMemories(rows);
    } else {
      loadMemories();
    }
  };

  const handleAdd = async () => {
    const id = crypto.randomUUID();
    await ados.db.addMemory(id, form.content, form.category);
    setForm({ content: '', category: 'general' });
    setShowAdd(false);
    loadMemories();
  };

  const handleDelete = async (id: string) => {
    await ados.db.deleteMemory(id);
    loadMemories();
  };

  const categoryColors: Record<string, string> = {
    general: 'bg-surface-3 text-muted',
    user: 'bg-blue-500/10 text-blue-500',
    project: 'bg-purple-500/10 text-purple-500',
    feedback: 'bg-yellow-500/10 text-yellow-600',
    reference: 'bg-green-500/10 text-green-500',
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="bg-surface-1 border border-default rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-primary flex items-center gap-2">
                Shared Brain
                <span className="text-[10px] px-2 py-0.5 bg-brand-600/20 text-brand-400 rounded-full font-medium">Beta</span>
              </h1>
              <p className="text-sm text-muted mt-1">
                Camada de memória do workspace: {memories.length} registros armazenados localmente.
              </p>
            </div>
            <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
              {(['overview', 'memory', 'sync'] as BrainTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tab === t ? 'bg-surface-3 text-primary' : 'text-muted hover:text-secondary'
                  }`}
                >
                  {t === 'overview' ? 'Visao geral' : t === 'memory' ? 'Memoria' : 'Sync e nos'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {tab === 'overview' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Saude</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Estado</p>
                <p className="text-sm font-medium text-primary">Apenas local</p>
                <p className="text-xs text-muted">Schema v1</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Modo</p>
                <p className="text-sm font-medium text-primary">Ativo</p>
                <p className="text-xs text-muted">Memoria local habilitada</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Registros</p>
                <p className="text-sm font-medium text-primary">{memories.length}</p>
                <p className="text-xs text-muted">{categories.map(c => memories.filter(m => m.category === c).length).filter(Boolean).length} categorias</p>
              </div>
              <div className="bg-surface-1 border border-default rounded-xl p-4">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Ultima atualizacao</p>
                <p className="text-sm font-medium text-primary">{memories.length > 0 ? new Date(memories[0].createdAt).toLocaleDateString('pt-BR') : '—'}</p>
                <p className="text-xs text-muted">1 raiz</p>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-primary mb-4">Por categoria</h2>
            <div className="grid grid-cols-5 gap-3">
              {categories.map(cat => {
                const count = memories.filter(m => m.category === cat).length;
                return (
                  <div key={cat} className="bg-surface-1 border border-default rounded-xl p-4 text-center">
                    <p className="text-lg font-bold text-primary">{count}</p>
                    <p className="text-xs text-muted capitalize">{cat}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Memoria</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    placeholder="Buscar memoria"
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="bg-transparent text-xs text-primary placeholder-muted outline-none w-40"
                  />
                </div>
                <button
                  onClick={() => setShowAdd(true)}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {showAdd && (
              <div className="bg-surface-1 border border-brand-500/30 rounded-2xl p-6 mb-4 shadow-card">
                <h3 className="text-sm font-medium text-primary mb-3">Nova memoria</h3>
                <div className="space-y-3">
                  <textarea
                    placeholder="Conteudo da memoria..."
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    rows={3}
                    className="w-full bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary placeholder-muted outline-none focus:border-brand-500/50 resize-none"
                  />
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="bg-surface-0 border border-default rounded-xl px-4 py-2.5 text-sm text-primary outline-none"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm text-secondary hover:bg-surface-2">Cancelar</button>
                    <button
                      onClick={handleAdd}
                      disabled={!form.content.trim()}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-sm font-medium text-white"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {memories.length === 0 && (
              <p className="text-sm text-muted text-center mt-8">Nenhum registro de memoria ainda.</p>
            )}

            <div className="space-y-2">
              {memories.map((mem) => (
                <div key={mem.id} className="bg-surface-1 border border-default rounded-xl p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-primary mb-1">{mem.content}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[mem.category] || categoryColors.general}`}>
                        {mem.category}
                      </span>
                      <span className="text-[10px] text-muted">{new Date(mem.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(mem.id)} className="text-xs text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors shrink-0">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'sync' && (
          <div>
            <h2 className="text-lg font-semibold text-primary mb-4">Sync e nos</h2>
            <div className="bg-surface-1 border border-default rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
                    <path d="M4 12a8 8 0 0116 0M12 4v4M4 12h4M20 12h-4" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Sincronizacao nao configurada</p>
                  <p className="text-xs text-muted">Conecte outro dispositivo para sincronizar memorias entre maquinas.</p>
                </div>
              </div>
              <div className="bg-surface-0 border border-default rounded-lg p-4">
                <p className="text-xs text-muted mb-2">Nos conectados</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-500">
                      <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary">Este computador</p>
                    <p className="text-[10px] text-muted">No local ativo</p>
                  </div>
                  <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">Online</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
