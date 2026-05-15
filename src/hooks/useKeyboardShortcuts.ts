import { useEffect } from 'react';

interface ShortcutMap {
  [action: string]: () => void;
}

const DEFAULT_BINDINGS: Record<string, string> = {
  'new-session': 'ctrl+n',
  'search': 'ctrl+k',
  'settings': 'ctrl+,',
  'toggle-theme': 'ctrl+shift+d',
};

function matchesShortcut(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const ctrl = parts.includes('ctrl');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');

  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey === ctrl &&
    e.shiftKey === shift &&
    e.altKey === alt
  );
}

export function useKeyboardShortcuts(actions: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const [action, callback] of Object.entries(actions)) {
        const binding = DEFAULT_BINDINGS[action];
        if (binding && matchesShortcut(e, binding)) {
          e.preventDefault();
          callback();
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
