import { useState, useEffect, useRef } from 'react';

const ados = (window as any).ados;

interface TelegramChat {
  id: number;
  title: string;
  type: string;
  username?: string;
}

interface TelegramMessage {
  id: number;
  chatId: number;
  chatTitle: string;
  chatType: string;
  from: { id: number; name: string; username?: string } | null;
  text: string;
  date: number;
}

type Tab = 'inbox' | 'send' | 'config';

export default function Telegram() {
  const [tab, setTab] = useState<Tab>('config');
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [botInfo, setBotInfo] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const [sendText, setSendText] = useState('');
  const [sending, setSending] = useState(false);
  const [configStatus, setConfigStatus] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkToken();
    return () => { ados.telegram.removeListeners(); };
  }, []);

  useEffect(() => {
    if (hasToken) {
      loadBotInfo();
      loadChats();
      checkPolling();
    }
  }, [hasToken]);

  useEffect(() => {
    if (!hasToken) return;
    ados.telegram.onMessage((msg: TelegramMessage) => {
      setMessages(prev => [...prev, msg]);
      if (!chats.find(c => c.id === msg.chatId)) {
        setChats(prev => [...prev, { id: msg.chatId, title: msg.chatTitle, type: msg.chatType }]);
      }
    });
    return () => { ados.telegram.removeListeners(); };
  }, [hasToken, chats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkToken = async () => {
    const result = await ados.telegram.getToken();
    setHasToken(result.hasToken);
    if (result.hasToken) setTab('inbox');
  };

  const loadBotInfo = async () => {
    const result = await ados.telegram.getMe();
    if (result.success) setBotInfo(result.bot);
  };

  const loadChats = async () => {
    const result = await ados.telegram.getChats();
    if (result.success) setChats(result.chats);
  };

  const checkPolling = async () => {
    const result = await ados.telegram.pollingStatus();
    setPolling(result.active);
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setConfigStatus('Validando...');
    const result = await ados.telegram.setToken(tokenInput.trim());
    if (result.success) {
      setHasToken(true);
      setBotInfo(result.bot);
      setConfigStatus('');
      setTokenInput('');
      setTab('inbox');
    } else {
      setConfigStatus(result.error || 'Erro ao salvar token');
    }
  };

  const handleRemoveToken = async () => {
    await ados.telegram.removeToken();
    setHasToken(false);
    setBotInfo(null);
    setMessages([]);
    setChats([]);
    setPolling(false);
    setTab('config');
  };

  const handleTogglePolling = async () => {
    if (polling) {
      await ados.telegram.stopPolling();
      setPolling(false);
    } else {
      const result = await ados.telegram.startPolling();
      if (result.success) setPolling(true);
    }
  };

  const handleSend = async () => {
    if (!sendText.trim() || !selectedChat || sending) return;
    setSending(true);
    const result = await ados.telegram.send(selectedChat, sendText.trim());
    if (result.success) {
      setMessages(prev => [...prev, {
        id: result.messageId,
        chatId: selectedChat,
        chatTitle: chats.find(c => c.id === selectedChat)?.title || '',
        chatType: 'private',
        from: null,
        text: sendText.trim(),
        date: Math.floor(Date.now() / 1000),
      }]);
      setSendText('');
    }
    setSending(false);
  };

  const filteredMessages = selectedChat
    ? messages.filter(m => m.chatId === selectedChat)
    : messages;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Telegram</h1>
            <p className="text-sm text-muted mt-1">
              {botInfo ? `@${botInfo.username}` : 'Conecte seu bot para receber e enviar mensagens'}
            </p>
          </div>
          {hasToken && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePolling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  polling ? 'bg-green-500/10 text-green-500' : 'bg-surface-2 text-muted hover:text-secondary'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${polling ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                {polling ? 'Escutando' : 'Parado'}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 bg-surface-1 rounded-xl p-1">
          {hasToken && (
            <>
              <button
                onClick={() => setTab('inbox')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'inbox' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
                }`}
              >
                Inbox
              </button>
              <button
                onClick={() => setTab('send')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'send' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
                }`}
              >
                Enviar
              </button>
            </>
          )}
          <button
            onClick={() => setTab('config')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'config' ? 'bg-brand-600 text-white' : 'text-muted hover:text-secondary'
            }`}
          >
            Configurar
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        {tab === 'config' && (
          <div className="max-w-lg space-y-6 mt-4">
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-primary">Bot Token</h3>
              <p className="text-xs text-muted">
                Crie um bot com o <span className="text-primary font-mono">@BotFather</span> no Telegram e cole o token aqui.
              </p>

              {hasToken && botInfo ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-surface-2 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-[#2AABEE]/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2AABEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">{botInfo.first_name}</p>
                      <p className="text-xs text-muted">@{botInfo.username}</p>
                    </div>
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">Conectado</span>
                  </div>
                  <button
                    onClick={handleRemoveToken}
                    className="text-xs text-red-500 hover:text-red-400 transition-colors"
                  >
                    Desconectar bot
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary font-mono outline-none focus:border-brand-500/50"
                  />
                  {configStatus && (
                    <p className="text-xs text-red-400">{configStatus}</p>
                  )}
                  <button
                    onClick={handleSaveToken}
                    disabled={!tokenInput.trim()}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
                  >
                    Conectar
                  </button>
                </div>
              )}
            </div>

            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-medium text-primary">Como funciona</h3>
              <ol className="text-xs text-muted space-y-2 list-decimal list-inside">
                <li>Abra o Telegram e busque <span className="text-primary font-mono">@BotFather</span></li>
                <li>Envie <span className="text-primary font-mono">/newbot</span> e siga as instruções</li>
                <li>Copie o token HTTP API e cole acima</li>
                <li>Envie uma mensagem para seu bot no Telegram</li>
                <li>Ative o polling aqui para receber mensagens em tempo real</li>
              </ol>
            </div>
          </div>
        )}

        {tab === 'inbox' && (
          <div className="flex gap-4 mt-4 h-full">
            <div className="w-56 shrink-0 space-y-1">
              <button
                onClick={() => setSelectedChat(null)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                  !selectedChat ? 'bg-brand-600/10 text-brand-500 font-medium' : 'text-secondary hover:bg-surface-2'
                }`}
              >
                Todas ({messages.length})
              </button>
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors truncate ${
                    selectedChat === chat.id ? 'bg-brand-600/10 text-brand-500 font-medium' : 'text-secondary hover:bg-surface-2'
                  }`}
                >
                  {chat.title}
                  <span className="text-[10px] text-muted ml-1">
                    {messages.filter(m => m.chatId === chat.id).length}
                  </span>
                </button>
              ))}
              {chats.length === 0 && (
                <p className="text-xs text-muted px-3 py-2">
                  Nenhum chat ainda. Envie uma mensagem para o bot no Telegram.
                </p>
              )}
            </div>

            <div className="flex-1 bg-surface-1 border border-default rounded-2xl flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted">
                      {polling ? 'Aguardando mensagens...' : 'Ative o polling para receber mensagens'}
                    </p>
                  </div>
                ) : (
                  filteredMessages.map(msg => (
                    <div key={`${msg.chatId}-${msg.id}`} className={`flex ${msg.from ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                        msg.from
                          ? 'bg-surface-2 text-primary rounded-tl-md'
                          : 'bg-brand-600 text-white rounded-tr-md'
                      }`}>
                        {msg.from && (
                          <p className="text-[10px] text-muted font-medium mb-0.5">
                            {msg.from.name} {msg.chatType !== 'private' && `· ${msg.chatTitle}`}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className="text-[9px] text-muted mt-1">
                          {new Date(msg.date * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}

        {tab === 'send' && (
          <div className="max-w-lg space-y-4 mt-4">
            <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Destinatário</label>
                <select
                  value={selectedChat || ''}
                  onChange={(e) => setSelectedChat(Number(e.target.value) || null)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50"
                >
                  <option value="">Selecione um chat</option>
                  {chats.map(chat => (
                    <option key={chat.id} value={chat.id}>{chat.title} ({chat.type})</option>
                  ))}
                </select>
                {chats.length === 0 && (
                  <p className="text-[10px] text-muted mt-1">
                    Nenhum chat disponível. Alguém precisa enviar uma mensagem para o bot primeiro.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Mensagem</label>
                <textarea
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value)}
                  placeholder="Digite a mensagem..."
                  rows={4}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none resize-none focus:border-brand-500/50"
                />
                <p className="text-[10px] text-muted mt-1">Suporta Markdown: *bold*, _italic_, `code`</p>
              </div>

              <button
                onClick={handleSend}
                disabled={!sendText.trim() || !selectedChat || sending}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-lg text-sm font-medium text-white transition-all"
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
