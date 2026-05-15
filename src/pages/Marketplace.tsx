import { useState } from 'react';

type MktTab = 'skills' | 'workflows';

export default function Marketplace() {
  const [tab, setTab] = useState<MktTab>('skills');

  const categories = ['Pesquisa', 'Texto', 'Código', 'Automação', 'Projetos', 'Reuniões', 'Dados', 'Design'];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-3 bg-surface-1 rounded-xl p-1">
            <button
              onClick={() => setTab('skills')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'skills' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
              }`}
            >
              Skills
            </button>
            <button
              onClick={() => setTab('workflows')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'workflows' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
              }`}
            >
              Workflows
            </button>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors border border-default">
              🔄 Atualizar
            </button>
            <button className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white transition-colors">
              + Criar
            </button>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center text-lg">⚡</span>
            Marketplace AdOS
          </h1>
          <p className="text-sm text-muted mt-1">Descubra e instale skills prontos para usar no workspace.</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-surface-1 border border-default rounded-lg px-3 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input placeholder="Buscar skills por nome, categoria ou caso de uso" className="flex-1 bg-transparent text-sm text-primary placeholder-muted outline-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {categories.map(c => (
            <button key={c} className="px-3 py-1 bg-surface-2 hover:bg-surface-3 rounded-full text-xs text-secondary transition-colors">
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-sm text-muted">Nenhum item disponível ainda.</p>
          <p className="text-xs text-muted mt-1">Crie skills e workflows para populá-los aqui.</p>
        </div>
      </div>
    </div>
  );
}
