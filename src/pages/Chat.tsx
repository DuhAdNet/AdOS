import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from '../components/MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  sessionId: string;
  onUpdateTitle: (title: string) => void;
}

const ados = (window as any).ados;

export default function Chat({ sessionId, onUpdateTitle }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstMessage = useRef(true);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const loadMessages = async () => {
    const rows = await ados.db.getMessages(sessionId);
    setMessages(rows.map((r: any) => ({ id: r.id, role: r.role, content: r.content })));
    isFirstMessage.current = rows.length === 0;
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamContent('');

    await ados.db.addMessage(userMsg.id, sessionId, 'user', userMsg.content);

    if (isFirstMessage.current) {
      const title = userMsg.content.slice(0, 50) + (userMsg.content.length > 50 ? '...' : '');
      onUpdateTitle(title);
      isFirstMessage.current = false;
    }

    ados.llm.removeStreamListeners();

    let accumulated = '';

    ados.llm.onStreamChunk((chunk: string) => {
      accumulated += chunk;
      setStreamContent(accumulated);
    });

    ados.llm.onStreamEnd(async () => {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accumulated,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamContent('');
      setLoading(false);
      await ados.db.addMessage(assistantMsg.id, sessionId, 'assistant', accumulated);
      ados.llm.removeStreamListeners();
    });

    ados.llm.onStreamError(async (error: string) => {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Erro: ${error}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStreamContent('');
      setLoading(false);
      await ados.db.addMessage(errorMsg.id, sessionId, 'assistant', `Erro: ${error}`);
      ados.llm.removeStreamListeners();
    });

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await ados.llm.stream(allMessages, 'codex-mini-latest');

    if (result.error && !accumulated) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Erro: ${result.error}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
      setLoading(false);
      await ados.db.addMessage(errorMsg.id, sessionId, 'assistant', `Erro: ${result.error}`);
    }
  }, [input, loading, messages, sessionId, onUpdateTitle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-0" data-session={sessionId}>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-5 shadow-glow">
                <span className="text-2xl font-bold text-white">A</span>
              </div>
              <h2 className="text-xl font-semibold text-primary mb-2">Olá! Como posso ajudar?</h2>
              <p className="text-sm text-muted max-w-sm">
                Pergunte qualquer coisa, peça para navegar na web, automatizar tarefas ou analisar dados.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {streamContent && (
          <MessageBubble role="assistant" content={streamContent} />
        )}
        {loading && !streamContent && (
          <div className="flex justify-start mb-4">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center text-xs font-semibold text-secondary shrink-0">
                A
              </div>
              <div className="bg-surface-2 px-4 py-3 rounded-2xl rounded-tl-md">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot" />
                  <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot [animation-delay:0.2s]" />
                  <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-default">
        <div className="flex items-end gap-3 bg-surface-1 border border-default rounded-2xl px-4 py-3 shadow-card focus-within:shadow-card-hover focus-within:border-brand-500/50 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted resize-none outline-none max-h-32 leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-white transition-all hover:shadow-glow disabled:shadow-none"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-muted text-center mt-2">
          AdOS usa OpenAI Codex · Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}
