import { useState, useRef, useEffect, useCallback } from 'react';
import MessageBubble from '../components/MessageBubble';
import ToolSteps from '../components/ToolSteps';
import AutocompletePopup from '../components/AutocompletePopup';
import VoiceInput from '../components/VoiceInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: Array<{ name: string; timestamp: number }>;
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
  const [toolSteps, setToolSteps] = useState<Array<{ name: string; timestamp: number }>>([]);
  const [toolStartTime, setToolStartTime] = useState(0);
  const [autocomplete, setAutocomplete] = useState<{ trigger: '/' | '@'; query: string } | null>(null);
  const [acItems, setAcItems] = useState<Array<{ slug: string; name: string; description: string; type: 'skill' | 'workflow' }>>([]);
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [routingEnabled, setRoutingEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstMessage = useRef(true);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  useEffect(() => {
    loadAcItems();
    loadModels();
    loadRoutingState();
  }, []);

  const loadRoutingState = async () => {
    const r = await ados.agents.getRouting();
    setRoutingEnabled(r?.routingEnabled ?? false);
  };

  const loadModels = async () => {
    const modelsList = await ados.providers.listModels();
    setModels(modelsList || []);
    const defaultModel = await ados.providers.getDefaultModel();
    setSelectedModel(defaultModel || '');
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    await ados.providers.setDefaultModel(modelId);
  };

  const loadAcItems = async () => {
    const [skills, workflows] = await Promise.all([
      ados.db.getSkills(),
      ados.db.getWorkflows(),
    ]);
    setAcItems([
      ...skills.map((s: any) => ({ slug: s.slug, name: s.name, description: s.description, type: 'skill' as const })),
      ...workflows.map((w: any) => ({ slug: w.slug, name: w.name, description: w.description, type: 'workflow' as const })),
    ]);
  };

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

    let msgContent = input.trim();
    if (attachments.length > 0) {
      const attText = attachments.map(a => `--- Anexo: ${a.name} ---\n${a.content}`).join('\n\n');
      msgContent = `${msgContent}\n\n${attText}`;
      setAttachments([]);
    }
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msgContent,
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
    setToolSteps([]);
    setToolStartTime(Date.now());

    let accumulated = '';

    ados.llm.onToolCall((data: any) => {
      setToolSteps((prev) => [...prev, { name: data.name, timestamp: Date.now() }]);
    });

    ados.llm.onStreamChunk((chunk: string) => {
      accumulated += chunk;
      setStreamContent(accumulated);
    });

    ados.llm.onStreamEnd(async () => {
      if (accumulated.trim()) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          steps: toolSteps.length > 0 ? [...toolSteps] : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await ados.db.addMessage(assistantMsg.id, sessionId, 'assistant', accumulated);
      }
      setStreamContent('');
      setToolSteps([]);
      setLoading(false);
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

    let modelToUse = await ados.providers.getDefaultModel();

    // Agent routing: pick optimal model based on task complexity
    if (routingEnabled) {
      try {
        const decision = await ados.agents.route(userMsg.content);
        if (decision.agentId && decision.agentId !== 'direct') {
          const agent = await ados.agents.get(decision.agentId);
          if (agent) {
            modelToUse = agent.model;
            setActiveAgent(agent.name);
          }
        } else {
          setActiveAgent(null);
        }
      } catch {
        setActiveAgent(null);
      }
    } else {
      setActiveAgent(null);
    }

    const mcpTools = await ados.mcp.getAllTools();
    const result = await ados.llm.stream(allMessages, modelToUse, mcpTools.length > 0 ? mcpTools : undefined);

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
  }, [input, loading, messages, sessionId, onUpdateTitle, routingEnabled]);

  const handleInputChange = (value: string) => {
    setInput(value);
    const match = value.match(/(?:^|\s)([/@])(\S*)$/);
    if (match) {
      const trigger = match[1] as '/' | '@';
      const query = match[2];
      setAutocomplete({ trigger, query });
    } else {
      setAutocomplete(null);
    }
  };

  const handleAutocompleteSelect = (item: { slug: string; name: string; type: 'skill' | 'workflow' }) => {
    const trigger = item.type === 'skill' ? '/' : '@';
    const replaced = input.replace(/(?:^|\s)([/@])\S*$/, (m) => {
      const prefix = m.startsWith(' ') ? ' ' : '';
      return `${prefix}${trigger}${item.slug} `;
    });
    setInput(replaced);
    setAutocomplete(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (autocomplete) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const [attachments, setAttachments] = useState<Array<{ name: string; content: string }>>([]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('text/') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments(prev => [...prev, { name: file.name, content: reader.result as string }]);
        };
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments(prev => [...prev, { name: file.name, content: `[Imagem: ${file.name}]` }]);
        };
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setAttachments(prev => [...prev, { name: `pasted-image.${file.type.split('/')[1]}`, content: `[Imagem colada]` }]);
        }
      }
    }
  }, []);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-surface-0"
      data-session={sessionId}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {models.length > 0 && (
        <div className="shrink-0 px-6 py-2 border-b border-default flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-surface-1 border border-default rounded-lg px-3 py-1.5 text-xs text-primary outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.id}</option>
              ))}
            </select>
            <span className="text-[10px] text-muted">Modelo ativo</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => { const v = !routingEnabled; setRoutingEnabled(v); await ados.agents.setRouting(v); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                routingEnabled ? 'bg-brand-600/10 text-brand-500' : 'bg-surface-2 text-muted hover:text-secondary'
              }`}
              title="Multi-agente: roteia tarefas para modelos otimizados por custo"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              Multi-Agent
            </button>
            <span className="text-[10px] text-muted">{messages.length} msgs</span>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !loading && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-2 border border-default flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h2 className="text-base font-medium text-primary mb-1">Nova conversa</h2>
              <p className="text-xs text-muted max-w-xs">
                Use / para skills, @ para workflows, ou digite livremente.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.steps && msg.steps.length > 0 && (
              <div className="flex justify-start mb-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 shrink-0" />
                  <ToolSteps steps={msg.steps} isRunning={false} startTime={msg.steps[0]?.timestamp || 0} />
                </div>
              </div>
            )}
            <MessageBubble role={msg.role} content={msg.content} />
          </div>
        ))}
        {loading && toolSteps.length > 0 && (
          <div className="flex justify-start mb-4">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[10px] font-semibold text-secondary shrink-0">
                A
              </div>
              <div className="max-w-[70%]">
                <ToolSteps steps={toolSteps} isRunning={loading} startTime={toolStartTime} />
              </div>
            </div>
          </div>
        )}
        {streamContent && (
          <MessageBubble role="assistant" content={streamContent} />
        )}
        {loading && !streamContent && toolSteps.length === 0 && (
          <div className="flex justify-start mb-4">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[10px] font-semibold text-secondary shrink-0">
                A
              </div>
              <div>
                {activeAgent && (
                  <div className="text-[10px] text-brand-400 font-medium mb-1">{activeAgent}</div>
                )}
                <div className="bg-surface-2 px-3 py-2 rounded-2xl rounded-tl-md">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot" />
                    <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-muted rounded-full animate-pulse-dot [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 p-4 border-t border-default relative">
        {autocomplete && (
          <AutocompletePopup
            trigger={autocomplete.trigger}
            query={autocomplete.query}
            items={acItems}
            onSelect={handleAutocompleteSelect}
            onClose={() => setAutocomplete(null)}
          />
        )}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-surface-2 border border-default rounded-lg px-2.5 py-1.5 text-xs text-secondary">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span className="truncate max-w-[120px]">{att.name}</span>
                <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-500 ml-1">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-3 bg-surface-1 border border-default rounded-2xl px-4 py-3 shadow-card focus-within:shadow-card-hover focus-within:border-brand-500/50 transition-all">
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Digite sua mensagem... (/ para skills, @ para workflows)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-primary placeholder-muted resize-none outline-none max-h-32 leading-relaxed"
          />
          <VoiceInput
            onTranscript={(text) => setInput(prev => prev + text)}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="p-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-3 disabled:text-muted rounded-xl text-white transition-all hover:shadow-card disabled:shadow-none"
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
