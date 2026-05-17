import { useState, useEffect } from 'react';

const ados = (window as any).ados;

const TIMEZONES = [
  'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Lisbon',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC',
];

const LANGUAGES = [
  { id: 'pt-BR', name: 'Português (Brasil)' },
  { id: 'en-US', name: 'English (US)' },
  { id: 'es-ES', name: 'Español' },
  { id: 'fr-FR', name: 'Français' },
  { id: 'de-DE', name: 'Deutsch' },
];

const LANGUAGE_GREETINGS: Record<string, string> = {
  'pt-BR': 'Olá! Como posso ajudar hoje?',
  'en-US': 'Hello! How can I help you today?',
  'es-ES': '¡Hola! ¿Cómo puedo ayudarte hoy?',
  'fr-FR': 'Bonjour ! Comment puis-je vous aider ?',
  'de-DE': 'Hallo! Wie kann ich Ihnen helfen?',
};

const THEME_COLORS = {
  brand: '#6366f1',
  surface0: '#0f0f14',
  surface1: '#1a1a24',
  surface2: '#24243a',
  text: '#e2e8f0',
  muted: '#64748b',
};

// Notification event types
const NOTIFICATION_EVENTS = [
  { id: 'session_complete', label: 'Sessão concluída' },
  { id: 'alert_triggered', label: 'Alerta disparado' },
  { id: 'goal_reached', label: 'Meta atingida' },
  { id: 'automation_run', label: 'Automação executada' },
  { id: 'system_update', label: 'Atualização do sistema' },
];

function getNotificationMatrix(): Record<string, { slack: boolean; email: boolean; inapp: boolean }> {
  try {
    return JSON.parse(localStorage.getItem('ados_notification_matrix') || '{}');
  } catch { return {}; }
}
function saveNotificationMatrix(m: Record<string, { slack: boolean; email: boolean; inapp: boolean }>) {
  localStorage.setItem('ados_notification_matrix', JSON.stringify(m));
}

export default function Preferences() {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [language, setLanguage] = useState('pt-BR');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'cloud'>('local');
  const [currentTime, setCurrentTime] = useState('');
  const [notificationMatrix, setNotificationMatrix] = useState<Record<string, { slack: boolean; email: boolean; inapp: boolean }>>(getNotificationMatrix());
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [showEducational, setShowEducational] = useState(false);

  useEffect(() => { load(); }, []);

  // Update current time for timezone
  useEffect(() => {
    const update = () => {
      try {
        const formatted = new Date().toLocaleTimeString('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
        setCurrentTime(formatted);
      } catch { setCurrentTime('--:--'); }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [timezone]);

  const load = async () => {
    const prefs = await ados.db.getPreferences();
    if (prefs.name) setName(prefs.name);
    if (prefs.timezone) setTimezone(prefs.timezone);
    if (prefs.language) setLanguage(prefs.language);
    if (prefs.role) setRole(prefs.role);
    if (prefs.notes) setNotes(prefs.notes);
    // Check if cloud sync is available
    if (prefs._synced) setSyncStatus('cloud');
  };

  const validate = (): boolean => {
    const errors: Record<string, boolean> = {};
    if (!name.trim()) errors.name = true;
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await Promise.all([
      ados.db.setPreference('name', name),
      ados.db.setPreference('timezone', timezone),
      ados.db.setPreference('language', language),
      ados.db.setPreference('role', role),
      ados.db.setPreference('notes', notes),
    ]);
    window.dispatchEvent(new CustomEvent('ados-preferences-change', { detail: { name, timezone, language, role, notes } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportPreferences = () => {
    const data = { name, timezone, language, role, notes, notificationMatrix, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ados-preferences.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPreferences = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.name) setName(data.name);
        if (data.timezone) setTimezone(data.timezone);
        if (data.language) setLanguage(data.language);
        if (data.role) setRole(data.role);
        if (data.notes) setNotes(data.notes);
        if (data.notificationMatrix) {
          setNotificationMatrix(data.notificationMatrix);
          saveNotificationMatrix(data.notificationMatrix);
        }
      } catch { alert('Arquivo JSON inválido.'); }
    };
    input.click();
  };

  const handleNotificationToggle = (eventId: string, channel: 'slack' | 'email' | 'inapp') => {
    const current = notificationMatrix[eventId] || { slack: false, email: false, inapp: true };
    const updated = { ...notificationMatrix, [eventId]: { ...current, [channel]: !current[channel] } };
    setNotificationMatrix(updated);
    saveNotificationMatrix(updated);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
      <div className="shrink-0 px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-primary">Preferências</h1>
        <p className="text-sm text-muted mt-1">Contexto pessoal usado para personalizar respostas do assistente.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
        <div className="max-w-lg space-y-6">
          <div className="bg-surface-1 border border-default rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Nome</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setValidationErrors(v => ({ ...v, name: false })); }}
                placeholder="Seu nome"
                className={`w-full bg-surface-0 border rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50 ${
                  validationErrors.name ? 'border-red-500' : 'border-default'
                }`}
              />
              {validationErrors.name && <p className="text-[10px] text-red-500 mt-1">Nome é obrigatório</p>}
            </div>

            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Cargo / Função</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: CEO, Gestor de Projetos, Dev Senior"
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none focus:border-brand-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Fuso horário</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                {/* Current time display */}
                <p className="text-[10px] text-muted mt-1">Agora: {currentTime}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary mb-1.5 block">Idioma</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none"
                >
                  {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                {/* Language sample text */}
                <p className="text-[10px] text-muted mt-1 italic">{LANGUAGE_GREETINGS[language] || ''}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Notas para o assistente</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto adicional que ajuda o assistente (projetos atuais, preferências, etc.)"
                rows={3}
                className="w-full bg-surface-0 border border-default rounded-lg px-3 py-2.5 text-sm text-primary outline-none resize-none focus:border-brand-500/50"
              />
            </div>

            {/* Theme preview */}
            <div>
              <label className="text-xs font-medium text-secondary mb-1.5 block">Preview do Tema</label>
              <div className="flex gap-2 items-center p-3 rounded-lg border border-default" style={{ background: THEME_COLORS.surface0 }}>
                <div className="w-16 h-10 rounded-md flex items-center justify-center text-[9px] font-mono" style={{ background: THEME_COLORS.surface1, color: THEME_COLORS.text, border: `1px solid ${THEME_COLORS.surface2}` }}>
                  Card
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-2 w-20 rounded" style={{ background: THEME_COLORS.brand }} />
                  <div className="h-2 w-14 rounded" style={{ background: THEME_COLORS.muted }} />
                </div>
                <div className="ml-auto w-6 h-6 rounded-full flex items-center justify-center text-[8px]" style={{ background: THEME_COLORS.brand, color: '#fff' }}>
                  A
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium text-white transition-all"
              >
                {saved ? 'Salvo' : 'Salvar Preferências'}
              </button>
              {/* Sync status badge */}
              <span className={`text-[10px] px-2 py-1 rounded-full ${
                syncStatus === 'cloud' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-600'
              }`}>
                {syncStatus === 'cloud' ? 'Salvo na nuvem' : 'Apenas local'}
              </span>
            </div>

            {/* Link to Shortcuts */}
            <div className="pt-2 border-t border-default">
              <a
                href="#/shortcuts"
                onClick={(e) => { e.preventDefault(); window.location.hash = '/shortcuts'; }}
                className="text-xs text-brand-500 hover:text-brand-400 transition-colors"
              >
                Ver Atalhos de Teclado →
              </a>
            </div>
          </div>

          {/* Notification matrix */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6">
            <h3 className="text-sm font-medium text-primary mb-3">Canais de Notificação</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 text-muted font-medium">Evento</th>
                    <th className="text-center py-2 text-muted font-medium px-2">Slack</th>
                    <th className="text-center py-2 text-muted font-medium px-2">Email</th>
                    <th className="text-center py-2 text-muted font-medium px-2">In-app</th>
                  </tr>
                </thead>
                <tbody>
                  {NOTIFICATION_EVENTS.map(evt => {
                    const state = notificationMatrix[evt.id] || { slack: false, email: false, inapp: true };
                    return (
                      <tr key={evt.id} className="border-t border-default">
                        <td className="py-2 text-secondary">{evt.label}</td>
                        {(['slack', 'email', 'inapp'] as const).map(ch => (
                          <td key={ch} className="text-center py-2">
                            <input
                              type="checkbox"
                              checked={state[ch]}
                              onChange={() => handleNotificationToggle(evt.id, ch)}
                              className="w-3.5 h-3.5 accent-brand-600"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export / Import */}
          <div className="bg-surface-1 border border-default rounded-2xl p-6">
            <h3 className="text-sm font-medium text-primary mb-3">Backup de Preferências</h3>
            <div className="flex gap-3">
              <button
                onClick={handleExportPreferences}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-medium text-secondary transition-colors"
              >
                Exportar JSON
              </button>
              <button
                onClick={handleImportPreferences}
                className="px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-medium text-secondary transition-colors"
              >
                Importar JSON
              </button>
            </div>
          </div>

          {/* Educational card */}
          <div className="bg-surface-1 border border-default rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowEducational(!showEducational)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-2 transition-colors"
            >
              <span className="text-sm font-medium text-primary">Como as preferências influenciam o assistente?</span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`text-muted transition-transform ${showEducational ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showEducational && (
              <div className="px-6 pb-4 text-xs text-muted space-y-2">
                <p><strong className="text-secondary">Nome e Cargo:</strong> Usados para personalizar saudações e adaptar o nível técnico das respostas.</p>
                <p><strong className="text-secondary">Fuso horário:</strong> Permite agendar notificações e exibir datas/horas no formato correto.</p>
                <p><strong className="text-secondary">Idioma:</strong> Define o idioma principal das respostas do assistente.</p>
                <p><strong className="text-secondary">Notas:</strong> Contexto livre que o assistente usa para entender seus projetos e preferências atuais.</p>
                <p><strong className="text-secondary">Notificações:</strong> Controla quais eventos geram alertas e por quais canais.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
