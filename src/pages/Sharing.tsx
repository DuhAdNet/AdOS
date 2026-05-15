import { useState, useEffect } from 'react';

const ados = (window as any).ados;

interface SharedSession {
  sessionId: string;
  publicId: string;
  publishedAt: string;
  updatedAt: string;
}

export default function Sharing() {
  const [shared, setShared] = useState<SharedSession[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [sharedList, sessionList] = await Promise.all([
      ados.db.getSharedSessions(),
      ados.db.getSessions(),
    ]);
    setShared(sharedList);
    setSessions(sessionList);
  };

  const handleShare = async () => {
    if (!selectedSession) return;
    const publicId = crypto.randomUUID().split('-').join('').slice(0, 12);
    await ados.db.shareSession(selectedSession, publicId);
    setSelectedSession('');
    load();
  };

  const handleUnshare = async (sessionId: string) => {
    await ados.db.unshareSession(sessionId);
    load();
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

  const getTitle = (sessionId: string) => sessions.find(s => s.id === sessionId)?.title || 'Sessão';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Compartilhamento</h1>
        <p className="text-sm text-muted mt-1">Publique sessões com link para leitura externa.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-medium text-primary">Publicar sessão</h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="flex-1 bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
              >
                <option value="">Selecione uma sessão</option>
                {sessions.filter(s => !shared.find(sh => sh.sessionId === s.id)).map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                onClick={handleShare}
                disabled={!selectedSession}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
              >
                Publicar
              </button>
            </div>
          </div>

          {shared.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">Nenhuma sessão compartilhada.</p>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-secondary">Sessões publicadas</h3>
              {shared.map(s => (
                <div key={s.sessionId} className="bg-surface-1 border border-default rounded-xl px-5 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary">{getTitle(s.sessionId)}</p>
                    <p className="text-[10px] text-muted font-mono mt-0.5">ados://shared/{s.publicId}</p>
                    <p className="text-[10px] text-muted mt-1">Publicado em {new Date(s.publishedAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(s.publicId)}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-secondary transition-colors"
                  >
                    {copied === s.publicId ? 'Copiado' : 'Copiar link'}
                  </button>
                  <button
                    onClick={() => handleUnshare(s.sessionId)}
                    className="px-3 py-1.5 bg-surface-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-xs text-secondary transition-colors"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
