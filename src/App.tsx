import { useState, useEffect, useMemo } from 'react';
import NavRail, { NavPage } from './components/NavRail';
import SessionPanel from './components/SessionPanel';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Tools from './pages/Tools';
import Automations from './pages/Automations';
import Actions from './pages/Actions';
import Marketplace from './pages/Marketplace';
import Brain from './pages/Brain';
import TelegramPage from './pages/Telegram';
import Labels from './pages/Labels';
import Sharing from './pages/Sharing';
import Preferences from './pages/Preferences';
import Shortcuts from './pages/Shortcuts';
import HealthCheck from './pages/HealthCheck';
import Dashboards from './pages/Dashboards';
import CloudSync from './pages/CloudSync';
import SetupWizard from './components/SetupWizard';
import TitleBar from './components/TitleBar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import BrowserPill from './components/BrowserPill';

interface Session {
  id: string;
  title: string;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const ados = (window as any).ados;

export default function App() {
  const [page, setPage] = useState<NavPage>('sessions');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [font, setFont] = useState<'manrope' | 'system'>('manrope');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [browserSessionId, setBrowserSessionId] = useState<string | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontFamily = font === 'manrope'
      ? "'Manrope', sans-serif"
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }, [font]);

  useEffect(() => {
    checkSetup();
    loadSessions();
    loadAppearance();
    ados.browser.onStateChanged((state: any) => {
      setBrowserOpen(state.open);
      setBrowserVisible(state.visible);
      if (state.url) setBrowserUrl(state.url);
      if (state.sessionId) setBrowserSessionId(state.sessionId);
    });

    // Telegram bridge: process messages from paired chats using the same LLM stream
    ados.telegram.onProcessMessage(async (data: { sessionId: string; chatId: number; userText: string }) => {
      try {
        // Notify Chat component to reload (shows user message from Telegram)
        window.dispatchEvent(new CustomEvent('telegram-session-update', { detail: { sessionId: data.sessionId } }));

        // Get session history
        const messages = await ados.db.getMessages(data.sessionId);
        const history = messages.map((m: any) => ({ role: m.role, content: m.content }));

        // Stream LLM response (same as typing in chat)
        let reply = '';
        ados.llm.onStreamChunk((chunk: string) => { reply += chunk; });
        const endPromise = new Promise<void>((resolve) => {
          ados.llm.onStreamEnd(() => resolve());
        });

        const model = await ados.db.getSetting('default_model') || 'gpt-4.1-mini';
        await ados.llm.stream(history, model);
        await endPromise;
        ados.llm.removeStreamListeners();

        if (reply) {
          await ados.telegram.replyFromSession(data.chatId, reply, data.sessionId);
          // Notify Chat component to reload (shows assistant reply)
          window.dispatchEvent(new CustomEvent('telegram-session-update', { detail: { sessionId: data.sessionId } }));
        }
      } catch (err: any) {
        console.error('Telegram process error:', err);
      }
    });

    const onThemeChange = (e: Event) => {
      const t = (e as CustomEvent).detail as 'dark' | 'light';
      setTheme(t);
    };
    window.addEventListener('ados-theme-change', onThemeChange);
    return () => window.removeEventListener('ados-theme-change', onThemeChange);
  }, []);

  const loadAppearance = async () => {
    const savedTheme = await ados.db.getSetting('theme_mode');
    const savedFont = await ados.db.getSetting('font');
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    else if (savedTheme === 'system') {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    if (savedFont === 'system' || savedFont === 'manrope') setFont(savedFont);
  };

  const checkSetup = async () => {
    const hasOpenAI = await ados.llm.hasKey('openai');
    const hasAnthropic = await ados.llm.hasKey('anthropic');
    const hasGoogle = await ados.llm.hasKey('google');
    const hasOpenRouter = await ados.llm.hasKey('openrouter');
    const hasOAuth = await ados.openaiOAuth.check();
    setNeedsSetup(!hasOpenAI && !hasAnthropic && !hasGoogle && !hasOpenRouter && !hasOAuth?.authenticated);
  };

  const loadSessions = async () => {
    const rows = await ados.db.getSessions();
    if (rows.length === 0) {
      const id = crypto.randomUUID();
      await ados.db.createSession(id, 'Nova Sessão');
      setSessions([{ id, title: 'Nova Sessão', favorite: false, archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
      setActiveSession(id);
    } else {
      setSessions(rows);
      setActiveSession(rows[0].id);
    }
  };

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await ados.db.setSetting('theme_mode', next);
  };

  const shortcuts = useMemo(() => ({
    'new-session': () => handleNewSession(),
    'settings': () => setPage('settings'),
    'toggle-theme': () => toggleTheme(),
  }), []);
  useKeyboardShortcuts(shortcuts);

  const handleNewSession = async () => {
    const id = crypto.randomUUID();
    await ados.db.createSession(id, 'Nova Sessão');
    const rows = await ados.db.getSessions();
    setSessions(rows);
    setActiveSession(id);
    setPage('sessions');
  };

  const handleDeleteSession = async (id: string) => {
    await ados.db.deleteSession(id);
    const rows = await ados.db.getSessions();
    setSessions(rows);
    if (activeSession === id) {
      setActiveSession(rows.length > 0 ? rows[0].id : null);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    await ados.db.toggleSessionFavorite(id);
    const rows = await ados.db.getSessions();
    setSessions(rows);
  };

  const handleToggleArchived = async (id: string) => {
    await ados.db.toggleSessionArchived(id);
    const rows = await ados.db.getSessions();
    setSessions(rows);
  };

  const handleRenameSession = async (id: string, title: string) => {
    await ados.db.updateSessionTitle(id, title);
    setSessions(sessions.map(s => s.id === id ? { ...s, title } : s));
  };

  const handleBrowserShow = () => { setBrowserVisible(true); ados.browser.show(browserSessionId || undefined); };
  const handleBrowserHide = () => { setBrowserVisible(false); ados.browser.hide(browserSessionId || undefined); };

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

  return (
    <div className="flex flex-col h-screen bg-surface-0 text-primary">
      <div className="flex items-center">
        <div className="flex-1">
          <TitleBar theme={theme} onToggleTheme={toggleTheme} />
        </div>
        {browserOpen && (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-50">
            <BrowserPill url={browserUrl} onClick={browserVisible ? handleBrowserHide : handleBrowserShow} />
          </div>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <NavRail active={page} onNavigate={setPage} collapsed={navCollapsed} onToggleCollapse={() => setNavCollapsed(!navCollapsed)} />

        <div className={`flex flex-1 overflow-hidden ${page !== 'sessions' ? 'hidden' : ''}`}>
          <SessionPanel
            sessions={sessions}
            activeSession={activeSession}
            onSelectSession={(id) => setActiveSession(id)}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onToggleFavorite={handleToggleFavorite}
            onToggleArchived={handleToggleArchived}
          />
          <main className="flex-1 flex flex-col overflow-hidden">
            {activeSession && (
              <Chat
                sessionId={activeSession}
                onUpdateTitle={(title) => handleRenameSession(activeSession, title)}
              />
            )}
          </main>
        </div>

        {page === 'tools' && <Tools />}
        {page === 'automations' && <Automations />}
        {page === 'actions' && <Actions />}
        {page === 'marketplace' && <Marketplace />}
        {page === 'brain' && <Brain />}
        {page === 'telegram' && <TelegramPage />}
        {page === 'labels' && <Labels />}
        {page === 'sharing' && <Sharing />}
        {page === 'dashboards' && <Dashboards />}
        {page === 'health' && <HealthCheck />}
        {page === 'cloud-sync' && <CloudSync />}
        {page === 'settings' && <Settings />}
      </div>
    </div>
  );
}
