import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import TitleBar from './components/TitleBar';

type Page = 'chat' | 'settings';

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const ados = (window as any).ados;

export default function App() {
  const [page, setPage] = useState<Page>('chat');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const rows = await ados.db.getSessions();
    if (rows.length === 0) {
      const id = crypto.randomUUID();
      await ados.db.createSession(id, 'Nova Sessão');
      setSessions([{ id, title: 'Nova Sessão', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
      setActiveSession(id);
    } else {
      setSessions(rows);
      setActiveSession(rows[0].id);
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleNewSession = async () => {
    const id = crypto.randomUUID();
    await ados.db.createSession(id, 'Nova Sessão');
    const rows = await ados.db.getSessions();
    setSessions(rows);
    setActiveSession(id);
    setPage('chat');
  };

  const handleDeleteSession = async (id: string) => {
    await ados.db.deleteSession(id);
    const rows = await ados.db.getSessions();
    setSessions(rows);
    if (activeSession === id) {
      setActiveSession(rows.length > 0 ? rows[0].id : null);
    }
  };

  const handleRenameSession = async (id: string, title: string) => {
    await ados.db.updateSessionTitle(id, title);
    setSessions(sessions.map(s => s.id === id ? { ...s, title } : s));
  };

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-primary">
      <TitleBar theme={theme} onToggleTheme={toggleTheme} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeSession={activeSession}
          onSelectSession={(id) => { setActiveSession(id); setPage('chat'); }}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onOpenSettings={() => setPage('settings')}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          {page === 'chat' && activeSession && (
            <Chat
              sessionId={activeSession}
              onUpdateTitle={(title) => handleRenameSession(activeSession, title)}
            />
          )}
          {page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
