import { useState, useEffect, useRef } from 'react';

interface AutocompleteItem {
  slug: string;
  name: string;
  description: string;
  type: 'skill' | 'workflow';
}

interface AutocompletePopupProps {
  query: string;
  trigger: '/' | '@';
  items: AutocompleteItem[];
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
}

export default function AutocompletePopup({ query, trigger, items, onSelect, onClose }: AutocompletePopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter(
    (item) =>
      item.type === (trigger === '/' ? 'skill' : 'workflow') &&
      (item.slug.includes(query.toLowerCase()) || item.name.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [filtered, selectedIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-2 w-72 bg-surface-1 border border-default rounded-xl shadow-lg overflow-hidden z-50"
    >
      <div className="px-3 py-2 border-b border-default">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
          {trigger === '/' ? 'Skills' : 'Workflows'}
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((item, i) => (
          <button
            key={item.slug}
            onClick={() => onSelect(item)}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
              i === selectedIndex ? 'bg-brand-600/10' : 'hover:bg-surface-2'
            }`}
          >
            <span className="w-6 h-6 rounded-lg bg-surface-3 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0">
              {trigger}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary truncate">{item.name}</p>
              <p className="text-[11px] text-muted truncate">{item.description || item.slug}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
