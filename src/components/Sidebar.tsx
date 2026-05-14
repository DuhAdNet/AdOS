interface Session {
  id: string;
  title: string;
  date: string;
}

interface SidebarProps {
  sessions: Session[];
  activeSession: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ sessions, activeSession, onSelectSession, onNewSession, onOpenSettings }: SidebarProps) {
  return (
    <aside className="w-64 bg-[#0d1220] border-r border-gray-800 flex flex-col">
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          + Nova Sessão
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="text-[10px] uppercase text-gray-500 font-semibold px-2 py-2 tracking-wider">
          Sessões
        </div>
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
              activeSession === session.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
          >
            {session.title}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={onOpenSettings}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 transition-colors"
        >
          ⚙ Settings
        </button>
      </div>
    </aside>
  );
}
