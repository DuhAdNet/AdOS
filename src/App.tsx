import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import SetupWizard from './components/SetupWizard';
import TitleBar from './components/TitleBar';
import BrowserPanel from './components/BrowserPanel';
import BrowserPill from './components/BrowserPill';

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
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    checkSetup();
    loadSessions();
    ados.browser.onStateChanged((state: any) => {
      setBrowserOpen(state.open);
      setBrowserVisible(state.visible);
      if (state.url) setBrowserUrl(state.url);
    });
  }, []);

  const checkSetup = async () => {
    const hasOpenAI = await ados.llm.hasKey('openai');
    const hasAnthropic = await ados.llm.hasKey('anthropic');
    const hasGoogle = await ados.llm.hasKey('google');
    const hasOpenRouter = await ados.llm.hasKey('openrouter');
    setNeedsSetup(!hasOpenAI && !hasAnthropic && !hasGoogle && !hasOpenRouter);
  };

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

  if (needsSetup === null) {
    return <div className="flex h-screen items-center justify-center bg-surface-0"><span className="text-muted">Carregando...</span></div>;
  }

  if (needsSetup) {
    return (
      <div className="flex flex-col h-screen bg-surface-0 text-primary">
        <TitleBar theme={theme} onToggleTheme={toggleTheme} />
        <SetupWizard onComplete={() => setNeedsSetup(false)} />
      </div>
    );
  }

  const handleBrowserShow = () => {
    setBrowserVisible(true);
    ados.browser.show();
  };

  const handleBrowserHide = () => {
    setBrowserVisible(false);
    ados.browser.hide();
  };

  const handleBrowserClose = () => {
    setBrowserOpen(false);
    setBrowserVisible(false);
    ados.browser.close();
  };

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-primary">
      <div className="flex items-center">
        <div className="flex-1">
          <TitleBar theme={theme} onToggleTheme={toggleTheme} />
        </div>
        {browserOpen && !browserVisible && (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-50">
            <BrowserPill url={browserUrl} onClick={handleBrowserShow} />
          </div>
        )}
      </div>
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
      {browserVisible && (
        <BrowserPanel
          visible={browserVisible}
          onClose={handleBrowserClose}
          onMinimize={handleBrowserHide}
        />
      )}
    </div>
  );
}
