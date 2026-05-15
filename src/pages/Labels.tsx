import { useState, useEffect } from 'react';

const ados = (window as any).ados;

interface Label {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  sortOrder: number;
  autoPattern: string | null;
}

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'];

export default function Labels() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [autoPattern, setAutoPattern] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const rows = await ados.db.getLabels();
    setLabels(rows);
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    const id = crypto.randomUUID();
    await ados.db.addLabel(id, name.trim(), color, null, autoPattern.trim() || null);
    setName('');
    setAutoPattern('');
    load();
  };

  const handleDelete = async (id: string) => {
    await ados.db.deleteLabel(id);
    load();
  };

  const handleUpdate = async (id: string, fields: Partial<Label>) => {
    await ados.db.updateLabel(id, fields);
    setEditing(null);
    load();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Labels</h1>
        <p className="text-sm text-muted mt-1">Organize sessões com marcadores hierárquicos e regras automáticas.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-primary">Nova Label</h3>
            <div className="flex items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da label"
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary outline-none focus:border-brand-500/50"
              />
              <input
                value={autoPattern}
                onChange={(e) => setAutoPattern(e.target.value)}
                placeholder="Auto-apply pattern (regex)"
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
              />
            </div>
            <div className="flex items-center gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface-1 ring-brand-500 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                onClick={handleAdd}
                disabled={!name.trim()}
                className="ml-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
              >
                Criar
              </button>
            </div>
          </div>

          {labels.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Nenhuma label criada.</p>
          ) : (
            <div className="space-y-2">
              {labels.map(label => (
                <div key={label.id} className="bg-surface-1 border border-default rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                  {editing === label.id ? (
                    <input
                      defaultValue={label.name}
                      autoFocus
                      onBlur={(e) => handleUpdate(label.id, { name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(label.id, { name: (e.target as HTMLInputElement).value }); }}
                      className="flex-1 bg-surface-0 border border-default rounded px-2 py-1 text-sm text-primary outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm text-primary font-medium">{label.name}</span>
                  )}
                  {label.autoPattern && (
                    <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded-full">{label.autoPattern}</span>
                  )}
                  <button onClick={() => setEditing(label.id)} className="text-xs text-muted hover:text-primary transition-colors">Editar</button>
                  <button onClick={() => handleDelete(label.id)} className="text-xs text-red-500 hover:text-red-400 transition-colors">Excluir</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
