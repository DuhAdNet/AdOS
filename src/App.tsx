import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import TitleBar from './components/TitleBar';

type Page = 'chat' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('chat');
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; date: string }>>([
    { id: '1', title: 'Nova Sessão', date: new Date().toISOString() },
  ]);
  const [activeSession, setActiveSession] = useState('1');

  const handleNewSession = () => {
    const id = Date.now().toString();
    setSessions([{ id, title: 'Nova Sessão', date: new Date().toISOString() }, ...sessions]);
    setActiveSession(id);
    setPage('chat');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0e17] text-white">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeSession={activeSession}
          onSelectSession={(id) => { setActiveSession(id); setPage('chat'); }}
          onNewSession={handleNewSession}
          onOpenSettings={() => setPage('settings')}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          {page === 'chat' && <Chat sessionId={activeSession} />}
          {page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
