import { useState, useEffect, useRef } from 'react';

const ados = (window as any).ados;

interface BrowserPanelProps {
  visible: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

export default function BrowserPanel({ visible, onClose, onMinimize }: BrowserPanelProps) {
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (visible && position.x === -1) {
      setPosition({
        x: Math.max(0, Math.floor((window.innerWidth - size.width) / 2)),
        y: Math.max(40, Math.floor((window.innerHeight - size.height) / 2)),
      });
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(async () => {
      const res = await ados.browser.getUrl();
      if (res?.url && res.url !== url) {
        setUrl(res.url);
        setInputUrl(res.url);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, url]);

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
      if (resizing) {
        setSize((prev) => ({
          width: Math.max(400, e.clientX - position.x),
          height: Math.max(300, e.clientY - position.y),
        }));
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      setResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, position]);

  useEffect(() => {
    if (visible && position.x >= 0) {
      ados.browser.resize({
        x: Math.round(position.x),
        y: Math.round(position.y + 40),
        width: Math.round(size.width),
        height: Math.round(size.height - 40),
      });
    }
  }, [visible, position, size]);

  const navigate = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    setLoading(true);
    await ados.browser.navigate(finalUrl);
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    setTimeout(() => setLoading(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') navigate(inputUrl);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    setDragging(true);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute pointer-events-auto flex flex-col rounded-xl border border-default bg-surface-0 shadow-2xl overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
      >
        {/* Header — draggable */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center gap-2 h-10 px-3 border-b border-default bg-surface-1 shrink-0 cursor-grab active:cursor-grabbing select-none"
        >
          <button onClick={() => ados.browser.back()} onMouseDown={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-surface-2 text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button onClick={() => ados.browser.forward()} onMouseDown={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-surface-2 text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
          <button onClick={() => ados.browser.reload()} onMouseDown={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-surface-2 text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>

          <div className="flex-1 flex items-center bg-surface-2 rounded-lg px-3 py-1 gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma URL..."
              className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none"
            />
            {loading && <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />}
          </div>

          <button onClick={onMinimize} onMouseDown={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-surface-2 text-muted" title="Minimizar">
            <svg width="14" height="14" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button onClick={onClose} onMouseDown={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-500" title="Fechar">
            <svg width="14" height="14" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Browser content area */}
        <div className="flex-1 relative bg-white">
          {!url && (
            <div className="absolute inset-0 flex items-center justify-center text-muted text-xs bg-surface-1">
              Navegador integrado
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setResizing(true); }}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-50 hover:opacity-100"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-1 right-1 text-muted">
            <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
